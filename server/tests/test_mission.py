import asyncio
import time
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from app import main as game


@pytest_asyncio.fixture(autouse=True)
async def clean(monkeypatch):
    game.rooms.clear()
    game.connections.clear()
    game.lock = asyncio.Lock()
    monkeypatch.setattr(game.sio, 'emit', AsyncMock())
    monkeypatch.setattr(game.sio, 'enter_room', AsyncMock())
    yield
    tasks = list(game.mission_tasks.values())
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    game.mission_tasks.clear()


async def squad(count=2):
    host = await game.create_room('host', {'name': 'Host'})
    for i in range(1, count):
        await game.join_room(str(i), {'name': str(i), 'code': host['code']})
    for sid in game.connections:
        await game.set_ready(sid, {'ready': True})
    return host['code']


@pytest.mark.asyncio
async def test_start_guards_and_shared_first_round():
    code = await squad()
    assert not (await game.start_game('1'))['ok']
    await game.set_ready('1', {'ready': False})
    assert not (await game.start_game('host'))['ok']
    await game.set_ready('1', {'ready': True})
    assert (await game.start_game('host'))['ok']
    state = game.public_room(code)
    assert state['status'] == 'playing'
    assert state['mission']['round'] == 1
    assert state['mission']['crisis']['key'] == 'blackout'
    assert 44 < state['mission']['deadline'] - time.time() <= 45
    assert not (await game.start_game('host'))['ok']
    assert not (await game.join_room('new', {'name': 'Late', 'code': code}))['ok']
    assert game.sio.emit.call_args.kwargs['room'] == code


@pytest.mark.asyncio
@pytest.mark.parametrize('count', [1, 6])
async def test_player_limits(count):
    code = await squad(count)
    assert (await game.start_game('host'))['ok'] == (count == 6)
    if count == 6:
        assert len(game.rooms[code]['players']) == 6


@pytest.mark.asyncio
async def test_disconnected_player_blocks_start():
    await squad()
    await game.disconnect('1')
    assert not (await game.start_game('host'))['ok']


@pytest.mark.asyncio
async def test_actions_are_authenticated_validated_and_locked():
    code = await squad()
    await game.start_game('host')
    for payload in [None, [], {'round': True}, {'round': 2, 'kind': 'respond'},
                    {'round': 1, 'kind': 'bad'}, {'round': 1, 'kind': 'conserve', 'resource': []},
                    {'round': 1, 'kind': 'support', 'target': []}]:
        if isinstance(payload, dict):
            payload['missionId'] = game.rooms[code]['mission']['id']
        assert not (await game.submit_action('host', payload))['ok']
    assert not (await game.submit_action('outsider', {'round': 1, 'kind': 'respond', 'missionId': game.rooms[code]['mission']['id']}))['ok']
    assert (await game.submit_action('host', {'round': 1, 'kind': 'respond', 'missionId': game.rooms[code]['mission']['id']}))['ok']
    assert not (await game.submit_action('host', {'round': 1, 'kind': 'respond', 'missionId': game.rooms[code]['mission']['id']}))['ok']
    assert (await game.submit_action('1', {'round': 1, 'kind': 'respond', 'missionId': game.rooms[code]['mission']['id']}))['ok']
    m = game.rooms[code]['mission']
    assert m['phase'] == 'resolution'
    assert m['history'][0]['points'] == 5
    assert m['resources']['energy'] == 55
    assert len(m['history']) == 1


@pytest.mark.asyncio
async def test_deadline_rejects_late_action_and_resolves_once():
    code = await squad()
    await game.start_game('host')
    m = game.rooms[code]['mission']
    m['expires'] = time.monotonic() - 1
    assert not (await game.submit_action('host', {'round': 1, 'kind': 'respond', 'missionId': game.rooms[code]['mission']['id']}))['ok']
    await game.finish_round(code)
    assert len(m['history']) == 1
    assert m['resources']['stability'] == 68


@pytest.mark.asyncio
async def test_timer_runs_all_five_rounds_after_disconnect(monkeypatch):
    monkeypatch.setattr(game, 'ROUND_SECONDS', 0.01)
    monkeypatch.setattr(game, 'RESULT_SECONDS', 0.01)
    code = await squad()
    await game.start_game('host')
    await game.disconnect('1')
    task = game.mission_tasks[code]
    await asyncio.wait_for(task, 3)
    state = game.public_room(code)
    assert state['status'] == 'complete'
    assert len(state['mission']['history']) == 5
    assert state['mission']['phase'] == 'complete'
    assert state['mission']['deadline'] is None
    assert state['mission']['outcome'] == 'lost'


@pytest.mark.asyncio
async def test_concurrent_final_actions_resolve_only_once():
    code = await squad()
    await game.start_game('host')
    results = await asyncio.gather(*[game.submit_action(sid, {'round': 1, 'kind': 'respond', 'missionId': game.rooms[code]['mission']['id']})
                                    for sid in ['host', '1', '1']])
    assert sum(r['ok'] for r in results) == 2
    assert len(game.rooms[code]['mission']['history']) == 1


@pytest.mark.asyncio
async def test_host_restart_clears_state_and_offline_players():
    code = await squad(3)
    await game.start_game('host')
    assert not (await game.reset_game('host', {'mode': 'restart'}))['ok']
    old_id = game.rooms[code]['mission']['id']
    game.rooms[code]['status'] = 'complete'
    game.rooms[code]['mission']['outcome'] = 'lost'
    await game.disconnect('2')
    assert not (await game.reset_game('1', {'mode': 'restart'}))['ok']
    assert not (await game.reset_game('host', {'mode': 'next'}))['ok']
    assert (await game.reset_game('host', {'mode': 'restart'}))['ok']
    room = game.rooms[code]
    assert room['status'] == 'lobby' and 'mission' not in room
    assert len(room['players']) == 2
    assert all(not p['ready'] and 'role' not in p for p in room['players'].values())
    for sid in ['host', '1']:
        await game.set_ready(sid, {'ready': True})
    await game.start_game('host')
    assert room['mission']['id'] != old_id
    assert not (await game.submit_action('host', {'missionId': old_id, 'round': 1, 'kind': 'respond'}))['ok']
    await asyncio.sleep(0)
    assert code in game.mission_tasks


@pytest.mark.asyncio
async def test_next_mission_rotates_crises_and_resets_resources():
    code = await squad()
    await game.start_game('host')
    room = game.rooms[code]
    room['status'] = 'complete'
    room['mission']['outcome'] = 'saved'
    room['mission']['resources']['energy'] = 0
    assert (await game.reset_game('host', {'mode': 'next'}))['ok']
    assert game.public_room(code)['missionNumber'] == 2
    assert not (await game.start_game('host'))['ok']
    for sid in ['host', '1']:
        await game.set_ready(sid, {'ready': True})
    await game.start_game('host')
    state = game.public_room(code)['mission']
    assert state['crisis']['key'] == 'ransomware'
    assert state['resources']['energy'] == 70
    assert state['history'] == []
