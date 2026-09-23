import test from 'node:test';
import assert from 'node:assert/strict';
import {AmbientMusic,AMBIENT_TRACKS} from '../dist/ambient.js';
function context(){const p=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});return {state:'running',currentTime:0,destination:{},createGain:()=>({gain:p(),connect(){},disconnect(){}}),createOscillator:()=>({frequency:p(),connect(){},disconnect(){},start(){},stop(){}})};}
test('Ambient themes are distinct and pause clears all voices and timers',async()=>{
  assert.equal(new Set(Object.values(AMBIENT_TRACKS).map(t=>JSON.stringify(t))).size,4);
  const music=new AmbientMusic({createContext:context});
  for(const theme of Object.keys(AMBIENT_TRACKS)){music.setTheme(theme);await music.setEnabled(true);assert.ok(music.voices.size>0);assert.ok(music.timer);await music.setEnabled(false);assert.equal(music.voices.size,0);assert.equal(music.timer,null);}
});
test('Pause during audio activation cannot start a stale music loop',async()=>{
  const c=context();c.state='suspended';let resume;c.resume=()=>new Promise(resolve=>resume=()=>{c.state='running';resolve();});
  const music=new AmbientMusic({createContext:()=>c});const pending=music.setEnabled(true);await music.setEnabled(false);resume();await pending;assert.equal(music.voices.size,0);assert.equal(music.timer,null);
});
