"""Exercise the actual ASGI/Socket.IO transport with two independent clients."""
import asyncio
import socket

import pytest
import socketio
import uvicorn
from app import main as game


@pytest.mark.asyncio
async def test_two_clients_complete_mission(monkeypatch):
    monkeypatch.setattr(game, 'RESULT_SECONDS', 0.01)
    game.rooms.clear()
    game.connections.clear()
    game.lock = asyncio.Lock()
    listener = socket.socket()
    listener.bind(('127.0.0.1', 0))
    port = listener.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(game.app, log_level='error', lifespan='off'))
    server_task = asyncio.create_task(server.serve(sockets=[listener]))
    clients = [socketio.AsyncClient(), socketio.AsyncClient()]
    states = [[], []]
    for i, client in enumerate(clients):
        client.on('room_state', lambda state, i=i: states[i].append(state))
    async def wait_for(predicate):
        async def poll():
            while not predicate():
                await asyncio.sleep(0.01)
        await asyncio.wait_for(poll(), 5)
    try:
        await wait_for(lambda: server.started)
        for client in clients:
            await client.connect(f'http://127.0.0.1:{port}', transports=['polling'])
        created = await clients[0].call('create_room', {'name': 'Host'})
        await clients[1].call('join_room', {'name': 'Medic', 'code': created['code']})
        for client in clients:
            await client.call('set_ready', {'ready': True})
        assert not (await clients[1].call('start_game', {}))['ok']
        assert (await clients[0].call('start_game', {}))['ok']
        await wait_for(lambda: all(s[-1]['status'] == 'playing' for s in states))
        assert states[0][-1]['mission']['deadline'] == states[1][-1]['mission']['deadline']
        for round_number in range(1, 6):
            await wait_for(lambda: all(s[-1]['mission']['round'] == round_number and
                                      s[-1]['mission']['phase'] == 'action' for s in states))
            for client in clients:
                assert (await client.call('submit_action', {'round': round_number, 'kind': 'respond', 'missionId': states[0][-1]['mission']['id']}))['ok']
        await wait_for(lambda: all(s[-1]['status'] == 'complete' for s in states))
        assert states[0][-1]['mission']['history'] == states[1][-1]['mission']['history']
        assert len(states[0][-1]['mission']['history']) == 5
        assert states[0][-1]['mission']['outcome'] == 'saved'
        old_id = states[0][-1]['mission']['id']
        assert not (await clients[1].call('reset_game', {'mode': 'next'}))['ok']
        assert (await clients[0].call('reset_game', {'mode': 'next'}))['ok']
        await wait_for(lambda: all(s[-1]['status'] == 'lobby' for s in states))
        assert all(s[-1]['missionNumber'] == 2 for s in states)
        for client in clients:
            await client.call('set_ready', {'ready': True})
        await clients[0].call('start_game', {})
        await wait_for(lambda: all(s[-1]['status'] == 'playing' for s in states))
        assert states[0][-1]['mission']['crisis']['key'] == 'ransomware'
        assert not (await clients[0].call('submit_action', {'missionId': old_id, 'round': 1, 'kind': 'respond'}))['ok']
    finally:
        for client in clients:
            if client.connected:
                await client.disconnect()
        server.should_exit = True
        await asyncio.wait_for(server_task, 5)
        for task in list(game.mission_tasks.values()):
            task.cancel()
        game.rooms.clear()
        game.connections.clear()
