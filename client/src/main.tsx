import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import './style.css';
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000', {autoConnect: true});
type Player = {id:string;name:string;ready:boolean;online:boolean;host:boolean};
type Room = {code:string;status:string;players:Player[]};
function App(){
 const [name,setName]=useState(''),[code,setCode]=useState(''),[room,setRoom]=useState<Room|null>(null),[me,setMe]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const onRoom=(r:Room)=>setRoom(r); socket.on('room_state',onRoom);return()=>{socket.off('room_state',onRoom)}},[]);
 const send=(event:string,payload:object)=>socket.emit(event,payload,(r:{ok:boolean;error?:string;code?:string;playerId?:string})=>{if(!r?.ok){setError(r?.error||'Request failed');return}setError('');if(r.playerId)setMe(r.playerId);if(r.code)setCode(r.code)});
 const mine=room?.players.find(p=>p.id===me);
 return <main><header><span className="eyebrow">EMERGENCY OPERATIONS NETWORK</span><h1>CODE <em>RED</em></h1><p>Save the City · Cooperative Multiplayer</p></header><section className="panel">{!room?<><h2>Enter command center</h2><label>Callsign<input value={name} maxLength={24} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label><button onClick={()=>send('create_room',{name})}>Create mission room</button><div className="divider">OR JOIN A TEAM</div><label>Room code<input value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABC123"/></label><button className="secondary" onClick={()=>send('join_room',{name,code})}>Join room</button></>:<><div className="eyebrow">ROOM CODE</div><h2 className="code">{room.code}</h2><p>Share this code with your teammates.</p><h3>Squad ({room.players.length}/6)</h3>{room.players.map(p=><div className="player" key={p.id}><span>{p.name} {p.host?'★':''}</span><span>{p.online?(p.ready?'READY':'WAITING'):'OFFLINE'}</span></div>)}<button onClick={()=>send('set_ready',{ready:!mine?.ready})}>{mine?.ready?'Cancel ready':'I am ready'}</button><p className="note">Milestone 1: real-time lobby synchronization. Gameplay coming next.</p></>}{error&&<p role="alert" className="error">{error}</p>}</section></main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
