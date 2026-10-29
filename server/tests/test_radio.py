import pytest
from app import main as game
from test_mission import clean, squad


@pytest.mark.asyncio
async def test_radio_uses_socket_identity_and_room_scope():
    code = await squad()
    outsider = await game.create_room('other', {'name': 'Other squad'})
    result = await game.send_message('1', {'text': ' Copy. What should we do here? ', 'playerId': game.rooms[code]['host'], 'leader': True})
    assert result['ok']
    messages = game.public_room(code)['messages']
    assert messages[0]['text'] == 'Copy. What should we do here?'
    assert messages[0]['playerId'] == game.connections['1'][1]
    assert messages[0]['leader'] is False
    assert game.public_room(outsider['code'])['messages'] == []
    assert game.sio.emit.call_args.kwargs['room'] == code
    assert not (await game.send_message('1', {'text': 'too fast'}))['ok']


@pytest.mark.asyncio
async def test_radio_validates_text_and_membership():
    await squad()
    for data in [None, [], {}, {'text': 4}, {'text': '   '}, {'text': 'x'*241}, {'text': '\x00bad'}]:
        assert not (await game.send_message('host', data))['ok']
    assert not (await game.send_message('unknown', {'text': 'Hello'}))['ok']
    assert (await game.send_message('host', {'text': '<script>alert(1)</script>'}))['ok']


@pytest.mark.asyncio
async def test_radio_retains_bounded_history_through_reset():
    code = await squad()
    for index in range(55):
        game.rooms[code]['players'][game.rooms[code]['host']]['last_message_at'] = -100
        assert (await game.send_message('host', {'text': str(index)}))['ok']
    assert len(game.public_room(code)['messages']) == 50
    assert game.public_room(code)['messages'][0]['text'] == '5'
    await game.start_game('host')
    game.rooms[code]['status'] = 'complete'
    game.rooms[code]['mission']['outcome'] = 'saved'
    await game.reset_game('host', {'mode': 'next'})
    assert len(game.public_room(code)['messages']) == 50
    await game.disconnect('1')
    assert not (await game.send_message('1', {'text': 'offline'}))['ok']
