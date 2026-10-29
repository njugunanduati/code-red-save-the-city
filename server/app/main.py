import asyncio
import secrets
import string
from dataclasses import asdict
import time
from .game_engine import CRISES, resolve
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import socketio

api = FastAPI(title="Code Red API")
api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
])
app = socketio.ASGIApp(sio, other_asgi_app=api)
rooms = {}
connections = {}
lock = asyncio.Lock()
ROUND_SECONDS = 45
RESULT_SECONDS = 5
TOTAL_ROUNDS = 5
ROLES = ("engineer", "medic", "security", "dispatcher")
mission_tasks = {}
ALPHABET = string.ascii_uppercase + string.digits

class CreateRoom(BaseModel):
    name: str

@api.get('/health')
async def health():
    return {'status': 'ok', 'rooms': len(rooms)}

def public_room(code):
    room = rooms[code]
    return {'code': code, 'status': room['status'], 'players': [
        {'id': p['id'], 'name': p['name'], 'ready': p['ready'], 'online': p['online'], 'host': p['id'] == room['host'], 'role': p.get('role')}
        for p in room['players'].values()
    ], 'missionNumber': room.get('mission_number', 1), 'mission': public_mission(room)}

async def broadcast(code):
    await sio.emit('room_state', public_room(code), room=code)

@sio.event
async def connect(sid, environ, auth):
    return True

@sio.event
async def disconnect(sid):
    async with lock:
        entry = connections.pop(sid, None)
        if not entry:
            return
        code, player_id = entry
        if code in rooms and player_id in rooms[code]['players']:
            rooms[code]['players'][player_id]['online'] = False
            rooms[code]['players'][player_id]['ready'] = False
            await broadcast(code)

@sio.on('create_room')
async def create_room(sid, data):
    if not isinstance(data, dict):
        return {'ok': False, 'error': 'Invalid payload'}
    if sid in connections:
        return {'ok': False, 'error': 'Already in a room'}
    name = str((data or {}).get('name', '')).strip()[:24]
    if not name:
        return {'ok': False, 'error': 'Enter a player name'}
    async with lock:
        code = ''.join(secrets.choice(ALPHABET) for _ in range(6))
        while code in rooms:
            code = ''.join(secrets.choice(ALPHABET) for _ in range(6))
        player_id = secrets.token_urlsafe(18)
        rooms[code] = {'status': 'lobby', 'host': player_id, 'players': {player_id: {'id': player_id, 'name': name, 'ready': False, 'online': True}}}
        connections[sid] = (code, player_id)
        await sio.enter_room(sid, code)
        await broadcast(code)
        return {'ok': True, 'code': code, 'playerId': player_id}

@sio.on('join_room')
async def join_room(sid, data):
    if not isinstance(data, dict):
        return {'ok': False, 'error': 'Invalid payload'}
    if sid in connections:
        return {'ok': False, 'error': 'Already in a room'}
    code = str((data or {}).get('code', '')).upper().strip()
    name = str((data or {}).get('name', '')).strip()[:24]
    if not name:
        return {'ok': False, 'error': 'Enter a player name'}
    async with lock:
        room = rooms.get(code)
        if not room or room['status'] != 'lobby':
            return {'ok': False, 'error': 'Room unavailable'}
        if len(room['players']) >= 6:
            return {'ok': False, 'error': 'Room is full'}
        player_id = secrets.token_urlsafe(18)
        room['players'][player_id] = {'id': player_id, 'name': name, 'ready': False, 'online': True}
        connections[sid] = (code, player_id)
        await sio.enter_room(sid, code)
        await broadcast(code)
        return {'ok': True, 'code': code, 'playerId': player_id}

@sio.on('set_ready')
async def set_ready(sid, data):
    if not isinstance(data, dict):
        return {'ok': False, 'error': 'Invalid payload'}
    async with lock:
        entry = connections.get(sid)
        if not entry:
            return {'ok': False, 'error': 'Not in a room'}
        code, player_id = entry
        room = rooms.get(code)
        if not room or room['status'] != 'lobby':
            return {'ok': False, 'error': 'Lobby closed'}
        room['players'][player_id]['ready'] = bool((data or {}).get('ready'))
        await broadcast(code)
        return {'ok': True}


def public_mission(room):
    mission = room.get('mission')
    if not mission:
        return None
    return {
        'id': mission['id'], 'number': room.get('mission_number', 1), 'round': mission['round'], 'totalRounds': TOTAL_ROUNDS,
        'phase': mission['phase'], 'crisis': asdict(mission_crisis(room)),
        'deadline': mission['deadline'], 'serverTime': time.time(),
        'resources': dict(mission['resources']),
        'submitted': list(mission['actions']), 'history': list(mission['history']),
        'outcome': mission.get('outcome'),
    }


def open_round(mission):
    mission['phase'] = 'action'
    mission['actions'] = {}
    mission['deadline'] = time.time() + ROUND_SECONDS
    mission['expires'] = time.monotonic() + ROUND_SECONDS


async def finish_round(code):
    room = rooms[code]
    mission = room['mission']
    if mission['phase'] != 'action':
        return
    result = resolve(mission_crisis(room), room['players'],
                     mission['actions'], mission['resources'])
    mission['resources'] = result['resources']
    mission['history'].append({'round': mission['round'], **result})
    if mission['round'] == TOTAL_ROUNDS:
        mission['phase'] = 'complete'
        mission['outcome'] = 'saved' if result['resources']['stability'] > 0 and sum(r['success'] for r in mission['history']) >= 3 else 'lost'
        room['status'] = 'complete'
        mission['deadline'] = None
    else:
        mission['phase'] = 'resolution'
        mission['deadline'] = time.time() + RESULT_SECONDS
        mission['expires'] = time.monotonic() + RESULT_SECONDS
    await broadcast(code)


async def run_mission(code):
    try:
        while True:
            await asyncio.sleep(0.1)
            async with lock:
                room = rooms.get(code)
                if not room or room['status'] != 'playing':
                    return
                mission = room['mission']
                if time.monotonic() < mission['expires']:
                    continue
                if mission['phase'] == 'action':
                    await finish_round(code)
                else:
                    mission['round'] += 1
                    open_round(mission)
                    await broadcast(code)
    finally:
        if mission_tasks.get(code) is asyncio.current_task():
            mission_tasks.pop(code, None)


@sio.on('start_game')
async def start_game(sid, data=None):
    async with lock:
        entry = connections.get(sid)
        if not entry:
            return {'ok': False, 'error': 'Not in a room'}
        code, player_id = entry
        room = rooms[code]
        if player_id != room['host']:
            return {'ok': False, 'error': 'Only the host can start the mission'}
        if room['status'] != 'lobby':
            return {'ok': False, 'error': 'Mission already started'}
        players = list(room['players'].values())
        if not 2 <= len(players) <= 6 or not all(p['online'] and p['ready'] for p in players):
            return {'ok': False, 'error': 'Mission needs 2–6 connected, ready players'}
        for index, player in enumerate(players):
            player['role'] = ROLES[index % len(ROLES)]
        room['status'] = 'playing'
        room['mission'] = {'id': secrets.token_urlsafe(12), 'round': 1, 'history': [],
                           'resources': {'stability': 80, 'energy': 70, 'medical': 60, 'security': 65}}
        open_round(room['mission'])
        mission_tasks[code] = asyncio.create_task(run_mission(code))
        await broadcast(code)
        return {'ok': True}


@sio.on('submit_action')
async def submit_action(sid, data):
    async with lock:
        entry = connections.get(sid)
        if not entry:
            return {'ok': False, 'error': 'Not in a room'}
        code, player_id = entry
        room = rooms[code]
        mission = room.get('mission')
        if not mission or room['status'] != 'playing' or mission['phase'] != 'action':
            return {'ok': False, 'error': 'Round is closed'}
        if not isinstance(data, dict) or data.get('missionId') != mission['id'] or type(data.get('round')) is not int or data['round'] != mission['round']:
            return {'ok': False, 'error': 'Stale or invalid round'}
        if time.monotonic() >= mission['expires']:
            await finish_round(code)
            return {'ok': False, 'error': 'Deadline passed'}
        if player_id in mission['actions']:
            return {'ok': False, 'error': 'Action already submitted'}
        kind = data.get('kind')
        action = {'kind': kind}
        if kind == 'support':
            target = data.get('target')
            if not isinstance(target, str) or target not in room['players'] or target == player_id:
                return {'ok': False, 'error': 'Choose a teammate to support'}
            action['target'] = target
        elif kind == 'conserve':
            if data.get('resource') not in ('energy', 'medical', 'security'):
                return {'ok': False, 'error': 'Choose a valid resource'}
            action['resource'] = data['resource']
        elif kind != 'respond':
            return {'ok': False, 'error': 'Invalid action'}
        mission['actions'][player_id] = action
        if len(mission['actions']) == len(room['players']):
            await finish_round(code)
        else:
            await broadcast(code)
        return {'ok': True}


def mission_crisis(room):
    offset = (room.get('mission_number', 1) - 1) * TOTAL_ROUNDS
    return CRISES[(offset + room['mission']['round'] - 1) % len(CRISES)]


@sio.on('reset_game')
async def reset_game(sid, data=None):
    async with lock:
        entry = connections.get(sid)
        if not entry:
            return {'ok': False, 'error': 'Not in a room'}
        code, player_id = entry
        room = rooms[code]
        if room['host'] != player_id:
            return {'ok': False, 'error': 'Only the host can reset the mission'}
        if room['status'] != 'complete':
            return {'ok': False, 'error': 'Finish the current mission first'}
        if not isinstance(data, dict) or data.get('mode') not in ('restart', 'next'):
            return {'ok': False, 'error': 'Choose start over or next mission'}
        if data['mode'] == 'next':
            if room['mission']['outcome'] != 'saved':
                return {'ok': False, 'error': 'Save the city to unlock the next mission'}
            room['mission_number'] = room.get('mission_number', 1) + 1
        else:
            room['mission_number'] = 1
        task = mission_tasks.pop(code, None)
        if task:
            task.cancel()
        room.pop('mission', None)
        room['status'] = 'lobby'
        room['players'] = {pid: p for pid, p in room['players'].items() if p['online']}
        for player in room['players'].values():
            player['ready'] = False
            player.pop('role', None)
        await broadcast(code)
        return {'ok': True}
