import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, DIRECTIONS, MAX_BLOCKS, initialState, step, simulate, expandProgram, normalizeProgress, isUnlocked, completeLevel } from '../dist/engine.js';
const moves=(...types)=>types.map(type=>({type}));

for(const level of LEVELS){
  test(`Level ${level.id}: example reaches battery within advertised block goal`,()=>{
    const result=simulate(level,level.solution);
    assert.equal(result.won,true);
    assert.equal(result.error,null);
    assert.ok(level.solution.length<=level.target);
    assert.equal(level.grid[result.row][result.col],'B');
  });
}
test('All levels are independently solvable, with the expected shortest routes',()=>{
  const optimal=[3,4,10,8,11];
  for(const level of LEVELS){
    const queue=[initialState(level)],seen=new Set();let shortest;
    while(queue.length){
      const current=queue.shift();const key=[current.row,current.col,current.doorOpen].join(':');
      if(seen.has(key))continue;seen.add(key);
      if(current.won){shortest=current.steps;break;}
      for(const direction of [...DIRECTIONS,...(level.id>=4?['press']:[])]){
        const next=step(level,current,direction);if(!next.error)queue.push(next);
      }
    }
    assert.equal(shortest,optimal[level.id-1]);
  }
});
test('Locked levels cannot complete or unlock out of order',()=>{
  let progress=normalizeProgress(null);
  assert.deepEqual(LEVELS.map((_,i)=>isUnlocked(progress,i)),[true,false,false,false,false]);
  assert.deepEqual(completeLevel(progress,4,3),progress);
  for(let index=0;index<5;index++){
    assert.equal(isUnlocked(progress,index),true);
    assert.equal(simulate(LEVELS[index],LEVELS[index].solution).won,true);
    progress=completeLevel(progress,index,3);
    assert.equal(progress.stars[index],3);
  }
  assert.equal(isUnlocked(progress,5),false);
  assert.equal(isUnlocked(progress,-1),false);
  assert.deepEqual(completeLevel(progress,0,1).stars,[3,3,3,3,3]);
  assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(progress))),progress);
});
test('Door requires an explicit press while standing on its switch',()=>{
  const level=LEVELS[3];
  const approach=moves('up','up','up');
  assert.equal(simulate(level,approach).doorOpen,false);
  assert.equal(simulate(level,[...approach,...moves('right','right')]).error,'door');
  assert.equal(simulate(level,moves('press')).error,'switch');
  assert.equal(simulate(level,[...approach,...moves('press','press')]).doorOpen,true);
  assert.equal(initialState(level).doorOpen,false);
});
test('Collision stops movement and cannot complete a level',()=>{
  const level=LEVELS[0];
  let state=step(level,initialState(level),'up');
  assert.equal(state.error,'wall');assert.equal(state.won,false);
  assert.deepEqual([state.row,state.col],[2,0]);
  assert.equal(step(level,state,'right'),state);
  assert.equal(simulate(level,moves('left')).error,'wall');
  assert.equal(simulate(level,moves('right')).won,false);
});
test('Repeat is exactly three moves and stops at the first collision',()=>{
  const level=LEVELS[4];
  const repeat={type:'repeat',direction:'up',count:3};
  const result=simulate(level,[repeat]);
  assert.deepEqual([result.row,result.col,result.steps],[1,0,3]);
  const blocked=simulate(level,[{...repeat,direction:'left'}]);
  assert.equal(blocked.error,'wall');assert.equal(blocked.steps,1);
  assert.equal(expandProgram(level,level.solution).length,11);
});
test('Invalid, unavailable, sparse, oversized, and unsafe blocks are rejected',()=>{
  const level=LEVELS[4];
  for(const bad of [null,{},Array(3),[null],[{type:'constructor'}],[{type:'repeat',direction:'invalid',count:3}],[{type:'repeat',direction:'up',count:300}]])assert.throws(()=>expandProgram(level,bad));
  assert.throws(()=>expandProgram(LEVELS[0],[{type:'press'}]));
  assert.throws(()=>expandProgram(LEVELS[0],[{type:'repeat',direction:'up',count:3}]));
  assert.throws(()=>expandProgram(level,Array.from({length:MAX_BLOCKS+1},()=>({type:'up'}))));
  for(const action of ['constructor','toString','__proto__','oops'])assert.equal(step(level,initialState(level),action).error,'invalid');
});
test('Damaged saved progress is safely normalized',()=>{
  assert.deepEqual(normalizeProgress({stars:[3,2,0,3,3]}).stars,[3,2,0,0,0]);
  assert.deepEqual(normalizeProgress({stars:['3',2]}).stars,[0,0,0,0,0]);
  assert.deepEqual(normalizeProgress({stars:[99]}).stars,[0,0,0,0,0]);
});
