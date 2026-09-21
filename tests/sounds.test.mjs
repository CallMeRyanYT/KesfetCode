import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEffects, CUES } from '../dist/sounds.js';

function fakeContext() {
  const nodes=[];
  const parameter=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
  return {state:'running',currentTime:0,destination:{},nodes,
    createGain(){return {gain:parameter(),connect(){},disconnect(){}};},
    createOscillator(){const node={frequency:parameter(),connect(){},disconnect(){},start(at){this.startAt=at;},stop(at){this.stopAt=at;this.stopped=true;}};nodes.push(node);return node;}
  };
}
test('Every cue produces a bounded sequence of finite notes',async()=>{
  for(const [name,notes] of Object.entries(CUES)) {
    const context=fakeContext();const sound=new SoundEffects({createContext:()=>context});
    await sound.play(name);assert.equal(context.nodes.length,notes.length);
    for(const node of context.nodes){assert.ok(Number.isFinite(node.startAt));assert.ok(node.stopAt>node.startAt);assert.ok(node.stopAt<2);}
  }
});
test('Mute immediately stops active and scheduled notes and blocks new ones',async()=>{
  const context=fakeContext();const sound=new SoundEffects({createContext:()=>context});
  await sound.play('complete');assert.equal(sound.voices.size,7);
  sound.setEnabled(false);assert.equal(sound.voices.size,0);
  const before=context.nodes.length;await sound.play('move');assert.equal(context.nodes.length,before);
  sound.setEnabled(true);await sound.play('on');assert.equal(context.nodes.length,before+2);
});
test('Muting while audio resumes cannot emit delayed sound',async()=>{
  const context=fakeContext();context.state='suspended';let resume;
  context.resume=()=>new Promise(resolve=>{resume=()=>{context.state='running';resolve();};});
  const sound=new SoundEffects({createContext:()=>context});
  const pending=sound.play('run');sound.setEnabled(false);resume();await pending;
  assert.equal(context.nodes.length,0);
});
test('Unsupported audio and unknown cues do not interrupt the game',async()=>{
  const statuses=[];const sound=new SoundEffects({createContext:()=>null,onStatus:status=>statuses.push(status)});await sound.play('move');await sound.play('constructor');
  assert.equal(sound.voices.size,0);
  assert.deepEqual(statuses,['unavailable']);
});
test('Closed and interrupted contexts recover on the next interaction',async()=>{
  const context=fakeContext();let created=0;
  const sound=new SoundEffects({createContext:()=>{created++;return context;}});
  sound.context={state:'closed'};await sound.play('run');assert.equal(created,1);
  context.state='interrupted';context.resume=async()=>{context.state='running';};
  assert.equal(await sound.play('move'),true);
});
test('Blocked activation reports a retry instead of failing silently',async()=>{
  const context=fakeContext();context.state='suspended';context.resume=()=>new Promise(()=>{});
  const statuses=[];const sound=new SoundEffects({createContext:()=>context,onStatus:s=>statuses.push(s),resumeTimeout:5});
  assert.equal(await sound.play('run'),false);assert.deepEqual(statuses,['blocked']);
  assert.equal(context.nodes.length,0);
});
