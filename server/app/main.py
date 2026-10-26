import asyncio
import secrets
import string
from datetime import datetime, timezone
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
ALPHABET = string.ascii_uppercase + string.digits

class CreateRoom(BaseModel):
    name: str

@api.get('/health')
async def health():
    return {'status': 'ok', 'rooms': len(rooms)}

def public_room(code):
    room = rooms[code]
    return {'code': code, 'status': room['status'], 'players': [
        {'id': p['id'], 'name': p['name'], 'ready': p['ready'], 'online': p['online'], 'host': p['id'] == room['host']}
        for p in room['players'].values()
    ]}

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
            await broadcast(code)

@sio.on('create_room')
async def create_room(sid, data):
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
