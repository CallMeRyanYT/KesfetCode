import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, DIRECTIONS, initialState, step, simulate, scoreRun, missionTargetProgram, programBlockCount } from '../dist/engine.js';
import { chapterMission } from '../dist/opening-missions.js';

function histogram(grid) {
  return [...grid.join('')].filter(tile=>tile!=='#').reduce((counts,tile)=>({ ...counts, [tile]: (counts[tile]||0)+1 }),{});
}

function crop(grid) {
  const cells=grid.flatMap((line,row)=>[...line].flatMap((tile,col)=>tile==='#'?[]:[[row,col]]));
  const rows=cells.map(cell=>cell[0]),cols=cells.map(cell=>cell[1]);
  return grid.slice(Math.min(...rows),Math.max(...rows)+1).map(line=>line.slice(Math.min(...cols),Math.max(...cols)+1));
}

function trace(mission) {
  let state=initialState(mission), movement=0;
  const history=[], positions=[[state.row,state.col]], arrivals=[];
  for(const action of mission.solution) {
    state=step(mission,state,action.type);
    history.push({event:state.event,energy:state.energy,phase:state.phase,won:state.won,error:state.error,moves:state.moves,
      crystals:state.crystals.length,batteries:state.batteries.length,keys:[...state.keys],doors:state.doors.length,items:state.items.length});
    if(DIRECTIONS.includes(action.type)) {
      movement++; positions.push([state.row,state.col]);
      const tile=mission.grid[state.row][state.col];
      if(tile!=='.')arrivals.push([movement,tile]);
    }
  }
  return {history,positions,arrivals,state};
}

for(const base of LEVELS) {
  test(`Chapter 1 mission ${base.id} is a connected 8×8 board and its program earns three stars`, () => {
    const mission=chapterMission(base,0);
    assert.equal(mission.grid.length,8);
    assert.ok(mission.grid.every(row=>row.length===8));
    assert.equal(mission.robotRelative,false);
    assert.equal(mission.allowTurns,false);
    assert.equal(mission.world,base.world);
    const result=trace(mission);
    assert.equal(result.state.error,null);
    assert.equal(result.state.won,true);
    const reference=missionTargetProgram(mission);
    assert.deepEqual(simulate(mission,reference),result.state);
    assert.equal(scoreRun(mission,result.state,programBlockCount(reference)),3);
    assert.equal(mission.solution.length,mission.target);
    if(base.id>=5) {
      assert.deepEqual(histogram(mission.grid),histogram(base.grid));
      assert.equal(mission.target,base.target);
      assert.deepEqual(result.history,trace(base).history);
      assert.deepEqual(result.arrivals,trace(base).arrivals);
      assert.deepEqual(mission.requiredItems,base.requiredItems);
      assert.deepEqual(mission.objective,base.objective);
    }
    const start=initialState(mission),seen=new Set([`${start.row},${start.col}`]),queue=[[start.row,start.col]];
    for(let cursor=0;cursor<queue.length;cursor++)for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const [row,col]=queue[cursor],r=row+dr,c=col+dc,key=`${r},${c}`;
      if(!mission.grid[r]?.[c]||mission.grid[r][c]==='#'||seen.has(key))continue;
      seen.add(key); queue.push([r,c]);
    }
    assert.equal(seen.size,[...mission.grid.join('')].filter(tile=>tile!=='#').length);
  });
}

test('Boards that already fit keep every corridor, branch, and pickup at the same relative position', () => {
  for(const base of LEVELS.slice(4)) {
    const source=crop(base.grid);
    if(source.length>8||source[0].length>8)continue;
    const mission=chapterMission(base,0);
    assert.deepEqual(crop(mission.grid),source);
    assert.deepEqual(mission.solution,base.solution);
  }
});

test('Compact single-corridor boards have no shortcuts between nonconsecutive route tiles', () => {
  for(const id of [17,20,25,30]) {
    const mission=chapterMission(LEVELS[id-1],0),path=trace(mission).positions;
    assert.equal(new Set(path.map(cell=>cell.join(','))).size,path.length);
    for(let i=0;i<path.length;i++)for(let j=i+2;j<path.length;j++) {
      assert.notEqual(Math.abs(path[i][0]-path[j][0])+Math.abs(path[i][1]-path[j][1]),1,`mission ${id} shortcut ${i}→${j}`);
    }
  }
});

test('Compact key/module exploration boards retain their original alternate-route constraints', () => {
  const directions = route => route.split(' ').flatMap(segment=>Array(Number(segment.slice(1))).fill({type:{U:'up',R:'right',D:'down',L:'left'}[segment[0]]}));
  const module=chapterMission(LEVELS[26],0);
  assert.equal(simulate(module,directions('R4 D4')).error,'energy');
  const navigation=chapterMission(LEVELS[27],0);
  assert.equal(simulate(navigation,directions('U6')).error,'items');
  assert.equal(simulate(navigation,directions('U3 L4 U1 L1 U1 L2')).error,'energy');
  const fragments=chapterMission(LEVELS[28],0);
  let state=initialState(fragments);
  for(const action of fragments.solution.slice(0,14))state=step(fragments,state,action.type);
  assert.equal(state.items.length,2);
  const alternative=directions('D3 L1 D3 R2 U1');
  let depleted=state;
  for(const action of alternative)depleted=step(fragments,depleted,action.type);
  assert.equal(depleted.error,'energy');
  assert.equal(depleted.moves,23);
  let bypass={...state,energy:20};
  for(const action of alternative)bypass=step(fragments,bypass,action.type);
  assert.equal(bypass.error,'items');
  assert.equal(bypass.won,false);
});

test('The large exploration boards retain their complete branch topology in eight rows and columns', () => {
  const topology = grid => {
    const degrees = grid.flatMap((line,row)=>[...line].flatMap((tile,col)=>tile==='#'?[]:[[[1,0],[-1,0],[0,1],[0,-1]].filter(([dr,dc])=>grid[row+dr]?.[col+dc]&&grid[row+dr][col+dc]!=='#').length]));
    const vertices=degrees.length,edges=degrees.reduce((sum,degree)=>sum+degree,0)/2;
    return {vertices,edges,cycles:edges-vertices+1,degrees:degrees.sort((a,b)=>a-b)};
  };
  for(const id of [27,28,29])assert.deepEqual(topology(chapterMission(LEVELS[id-1],0).grid),topology(LEVELS[id-1].grid));
});

test('Battery limits, early exits, matching doors, and required items still constrain the puzzles', () => {
  const short=chapterMission(LEVELS[17],0);
  assert.equal(simulate(short,Array.from({length:4},()=>({type:'right'}))).won,true);
  assert.equal(simulate(short,['down','down','right','right','right','right','up','up'].map(type=>({type}))).error,'energy');
  const choice=chapterMission(LEVELS[18],0),direct=simulate(choice,Array.from({length:6},()=>({type:'right'})));
  assert.equal(direct.won,true); assert.equal(scoreRun(choice,direct,6),1);
  for(const base of LEVELS.filter(level=>level.batteryRequired==='goal')) {
    const mission=chapterMission(base,0),withoutBattery={...mission,grid:mission.grid.map(row=>row.replaceAll('B','.'))};
    assert.equal(simulate(withoutBattery,mission.solution).error,'energy',`mission ${base.id} needs charging`);
  }
  for(const id of [21,22,23,24,25]) {
    const mission=chapterMission(LEVELS[id-1],0),withoutKey={...mission,grid:mission.grid.map(row=>row.replaceAll('K','.'))};
    assert.equal(simulate(withoutKey,mission.solution).error,'door',`mission ${id} needs its key`);
  }
  for(const id of [26,27,28,29]) {
    const mission=chapterMission(LEVELS[id-1],0),withoutItem={...mission,grid:mission.grid.map(row=>row.replace(/[Pabc]/g,'.'))};
    assert.equal(simulate(withoutItem,mission.solution).error,'items',`mission ${id} needs its delivery items`);
  }
});

test('The launch mission retains exact pickup order, twenty-energy battery arrival, and the separate launch action', () => {
  const mission=chapterMission(LEVELS[29],0),result=trace(mission);
  assert.deepEqual(result.arrivals,[[3,'C'],[8,'K'],[16,'D'],[20,'B'],[38,'R']]);
  assert.equal(mission.target,40);
  const ready=simulate(mission,mission.solution.slice(0,-1));
  assert.equal(ready.moves,38); assert.equal(ready.won,false); assert.equal(ready.readyToLaunch,true); assert.equal(ready.phase,5);
  assert.equal(ready.energy,2);
  assert.equal(step(mission,ready,'launch').won,true);
  assert.equal(simulate(mission,mission.solution.filter(action=>action.type!=='collect')).error,'sequence');
});

test('Older chapters and the original campaign remain untouched by every 8×8 adaptation', () => {
  const snapshot=structuredClone(LEVELS);
  for(const base of LEVELS) {
    chapterMission(base,0);
    for(const chapter of [1,2]) {
      const mission=chapterMission(base,chapter);
      assert.deepEqual(mission.grid,base.grid); assert.deepEqual(mission.solution,base.solution);
      assert.deepEqual(mission.hint,base.hint); assert.deepEqual(mission.objective,base.objective);
      assert.equal(mission.robotRelative,true); assert.equal(mission.allowTurns,true);
    }
  }
  assert.deepEqual(LEVELS,snapshot);
});
