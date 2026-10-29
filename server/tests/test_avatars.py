import base64
import pytest
from app import main as game
from test_mission import clean, squad


@pytest.mark.asyncio
async def test_avatar_identity_scope_and_mission_lock():
    code = await squad()
    assert (await game.set_avatar('1', {'avatar': 'violet', 'playerId': game.rooms[code]['host']}))['ok']
    players = game.public_room(code)['players']
    assert players[0]['avatar'] == 'mint'
    assert players[1]['avatar'] == 'violet'
    assert not (await game.set_avatar('outsider', {'avatar': 'gold'}))['ok']
    await game.start_game('host')
    assert not (await game.set_avatar('1', {'avatar': 'gold'}))['ok']
    assert game.public_room(code)['players'][1]['avatar'] == 'violet'


@pytest.mark.asyncio
async def test_join_avatar_and_invalid_images():
    host = await game.create_room('host', {'name': 'Host', 'avatar': 'blue'})
    assert (await game.join_room('guest', {'name': 'Guest', 'code': host['code'], 'avatar': 'rose'}))['ok']
    assert game.public_room(host['code'])['players'][1]['avatar'] == 'rose'
    for value in [None, {}, [], 4, 'https://example.com/image.png', 'data:image/svg+xml;base64,abc', 'data:image/png;base64,bad', 'x'*25000]:
        assert not (await game.set_avatar('guest', {'avatar': value}))['ok']
        assert not (await game.create_room('bad', {'name': 'Bad', 'avatar': value}))['ok']
    # PNG dimensions must stay within the small avatar bounds.
    raw = b'\x89PNG\r\n\x1a\n' + b'\x00\x00\x00\rIHDR' + (2048).to_bytes(4, 'big')*2
    assert not game.valid_avatar('data:image/png;base64,' + base64.b64encode(raw).decode())
