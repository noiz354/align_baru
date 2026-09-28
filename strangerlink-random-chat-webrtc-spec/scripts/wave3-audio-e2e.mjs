import WebSocket from 'ws';
import wrtc from '@roamhq/wrtc';
import crypto from 'node:crypto';
const {RTCPeerConnection, MediaStream, nonstandard} = wrtc;
const url=process.env.REALTIME_URL || 'ws://127.0.0.1:3001';
const peers=[];
const log=[];
const waiters=[];
const uuid=()=>crypto.randomUUID();
const send=(p,type,payload,sessionId=p.sessionId)=>p.ws.send(JSON.stringify({type,messageId:uuid(),sessionId,fromParticipantId:p.id,sequence:++p.seq,sentAt:new Date().toISOString(),payload}));
function waitFor(pred, timeout=15000){
  if(pred()) return Promise.resolve();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('timeout waiting; '+JSON.stringify(log.slice(-12)))),timeout); waiters.push(()=>{if(pred()){clearTimeout(timer);resolve();}});});
}
function notify(){for(const f of [...waiters])f();}
function makePeer(name){
  const p={name,id:uuid(),ws:null,sessionId:null,role:null,seq:0,pc:new RTCPeerConnection({iceServers:[]}),remoteCandidates:[],remoteTrack:false,connection:'new',iceTypes:[],offerCount:0,answerCount:0,peerLeft:false,peerLeftEvent:null,reportAck:null};
  const source=new nonstandard.RTCAudioSource();
  p.track=source.createTrack();
  p.stream=new MediaStream([p.track]);
  p.pc.addTrack(p.track,p.stream);
  p.audioTimer=setInterval(()=>{
    const samples=new Int16Array(480);
    for(let i=0;i<480;i++) samples[i]=Math.round(Math.sin(2*Math.PI*440*(Date.now()%1000/1000+i/48000))*5000);
    source.onData({samples,sampleRate:48000,bitsPerSample:16,channelCount:1,numberOfFrames:480});
  },10);
  p.pc.onicecandidate=e=>{
    if(!e.candidate)return;
    const c=e.candidate.toJSON();
    p.iceTypes.push(e.candidate.type || (/ typ (\w+)/.exec(c.candidate||'')||[])[1] || 'unknown');
    if(p.sessionId)send(p,'ICE_CANDIDATE',c);
  };
  p.pc.ontrack=e=>{p.remoteTrack ||= e.track.kind==='audio'; log.push(`${p.name}:remote-track:${e.track.kind}`);notify();};
  p.pc.onconnectionstatechange=()=>{p.connection=p.pc.connectionState;log.push(`${p.name}:connection:${p.connection}`);notify();};
  p.pc.oniceconnectionstatechange=()=>{log.push(`${p.name}:ice:${p.pc.iceConnectionState}`);notify();};
  p.ws=new WebSocket(`${url}?token=${encodeURIComponent(p.id)}`);
  p.ws.on('open',()=>{log.push(`${name}:ws-open`);notify();});
  p.ws.on('message',async raw=>{
    const m=JSON.parse(raw.toString());
    log.push(`${p.name}:recv:${m.type}:${m.payload?.reasonClass||m.payload?.code||''}`);
    try {
      if(m.type==='MATCH_FOUND'){
        p.sessionId=m.payload.sessionId;p.role=m.payload.peerRole;notify();
      } else if(m.type==='OFFER'){
        p.offerCount++;
        await p.pc.setRemoteDescription({type:'offer',sdp:m.payload.sdp});
        for(const c of p.remoteCandidates.splice(0)) await p.pc.addIceCandidate(c);
        const answer=await p.pc.createAnswer();await p.pc.setLocalDescription(answer);p.answerCount++;
        send(p,'ANSWER',{sdp:answer.sdp});
      } else if(m.type==='ANSWER'){
        p.answerCount++;
        await p.pc.setRemoteDescription({type:'answer',sdp:m.payload.sdp});
        for(const c of p.remoteCandidates.splice(0)) await p.pc.addIceCandidate(c);
      } else if(m.type==='ICE_CANDIDATE'){
        if(m.payload.candidate){const c=new wrtc.RTCIceCandidate(m.payload);if(p.pc.remoteDescription)await p.pc.addIceCandidate(c);else p.remoteCandidates.push(c);}
      } else if(m.type==='PEER_LEFT'){p.peerLeft=true;p.peerLeftEvent=m.payload;notify();}
      else if(m.type==='REPORT_SUBMITTED'){p.reportAck=m.payload;notify();}
      else if(m.type==='ERROR'){log.push(`${p.name}:ERROR:${JSON.stringify(m.payload)}`);notify();}
    } catch(e){log.push(`${p.name}:handler-error:${e.message}`);notify();}
  });
  p.ws.on('close',(code,reason)=>{log.push(`${p.name}:ws-close:${code}:${reason}`);notify();});
  return p;
}
const a=makePeer('A'),b=makePeer('B');peers.push(a,b);
await waitFor(()=>a.ws.readyState===WebSocket.OPEN&&b.ws.readyState===WebSocket.OPEN);
for (const p of [a,b]) send(p,'JOIN_QUEUE',{mode:'TEXT_AUDIO',interestIds:[],language:'en',regionConstraint:null,consentVersion:1},null);
await waitFor(()=>a.sessionId&&b.sessionId);
if(a.sessionId!==b.sessionId)throw new Error('session mismatch');
const offerer=a.role==='A'?a:b, answerer=offerer===a?b:a;
const offer=await offerer.pc.createOffer();await offerer.pc.setLocalDescription(offer);offerer.offerCount++;
send(offerer,'OFFER',{sdp:offer.sdp,restart:false});
await waitFor(()=>a.connection==='connected'&&b.connection==='connected'&&a.remoteTrack&&b.remoteTrack,20000);
console.log(JSON.stringify({sessionId:a.sessionId,peerA:{id:a.role==='A'?a.id:b.id,role:'A',connection:(a.role==='A'?a:b).connection,offers:(a.role==='A'?a:b).offerCount,answers:(a.role==='A'?a:b).answerCount,remoteAudioTrack:(a.role==='A'?a:b).remoteTrack,iceTypes:(a.role==='A'?a:b).iceTypes},peerB:{id:a.role==='B'?a.id:b.id,role:'B',connection:(a.role==='B'?a:b).connection,offers:(a.role==='B'?a:b).offerCount,answers:(a.role==='B'?a:b).answerCount,remoteAudioTrack:(a.role==='B'?a:b).remoteTrack,iceTypes:(a.role==='B'?a:b).iceTypes},events:log},null,2));
// Disconnect B, then submit a safety report from A and observe the server ack/report id.
b.ws.close(1000,'wave3-peer-disconnect');
await waitFor(()=>a.peerLeft,10000);
console.log('PEER_DISCONNECT '+JSON.stringify(a.peerLeftEvent));
send(a,'REPORT_SUBMITTED',{category:'other',note:'wave3 runtime verification'});
await waitFor(()=>a.reportAck,10000);
console.log('SAFETY_REPORT_ACK '+JSON.stringify(a.reportAck));
// Negative paths against the real signaling server: malformed media envelope and nonexistent/expired session.
const badId=uuid(), badWs=new WebSocket(`${url}?token=${encodeURIComponent(badId)}`), badEvents=[];
await new Promise((resolve,reject)=>{badWs.once('open',resolve);badWs.once('error',reject);});
badWs.on('message',raw=>{const m=JSON.parse(raw.toString());badEvents.push(m.payload?.code||m.type);notify();});
const badBase={messageId:uuid(),sessionId:uuid(),fromParticipantId:badId,sequence:1,sentAt:new Date().toISOString()};
badWs.send(JSON.stringify({type:'OFFER',...badBase,payload:{sdp:'bad'}}));
await waitFor(()=>badEvents.includes('VALIDATION_FAILED'),5000);
badWs.send(JSON.stringify({type:'OFFER',...badBase,messageId:uuid(),sequence:2,payload:{sdp:'v=0\r\n',restart:false}}));
await waitFor(()=>badEvents.includes('NOT_IN_SESSION'),5000);
console.log('NEGATIVE_SIGNALING '+JSON.stringify(badEvents));
badWs.close();
for(const p of peers){clearInterval(p.audioTimer);try{p.pc.close()}catch{};try{p.track.stop()}catch{};if(p.ws.readyState===WebSocket.OPEN)p.ws.close();}

// Permission denial negative path: no OS microphone prompt is bypassed; coordinator surfaces denial.
const { createPeerConnectionCoordinator } = await import('../src/features/media/peer-connection.coordinator.ts');
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => { throw new DOMException('blocked','NotAllowedError'); } } } });
const permissionResult = await createPeerConnectionCoordinator().requestMedia('microphone','runtime-user-gesture');
console.log('NEGATIVE_PERMISSION '+permissionResult);
// @roamhq/wrtc's native libwebrtc may segfault during Node's static teardown in
// some Linux builds even after all peer connections and tracks are closed.
// All observable assertions have completed above; exit explicitly after cleanup.
process.exit(0);
