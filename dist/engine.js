import { LEVELS, WORLDS, CHAPTERS } from './levels.js';
export { LEVELS, WORLDS, CHAPTERS };

export const DIRECTIONS = ['up', 'right', 'down', 'left'];
export const ROTATION_ACTIONS = ['forward', 'turnRight', 'turnLeft'];
export const MAX_BLOCKS = 80;
export const MAX_REPEATS = 10;
export const PROGRESS_VERSION = 2;
const vectors = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
const itemTiles = ['P', 'a', 'b', 'c'];
const coordinate = (row, col) => `${row},${col}`;

// Up/down mean forward/backward in the robot-relative control scheme.
export function resolveDirection(heading, action) {
  return DIRECTIONS[(DIRECTIONS.indexOf(heading || 'right') + DIRECTIONS.indexOf(action)) % 4];
}
export function relativeSolution(level) {
  let heading = level.heading || 'right';
  return level.solution.map(block => {
    if (!DIRECTIONS.includes(block.type)) return {...block};
    const type = DIRECTIONS[(DIRECTIONS.indexOf(block.type) - DIRECTIONS.indexOf(heading) + 4) % 4];
    heading = block.type;
    return {...block, type};
  });
}

export function initialState(level) {
  for (let row = 0; row < level.grid.length; row++) {
    const col = level.grid[row].indexOf('S');
    if (col !== -1) return {
      row, col, heading: level.heading || 'right', energy: level.energy ?? null,
      capacity: level.energy ?? null, crystals: [], batteries: [], keys: [],
      doors: [], buttons: [], items: [], won: false, error: null, steps: 0, moves: 0,
      event: null, readyToLaunch: false, phase: 0
    };
  }
  throw new Error('Missing robot start');
}

export function availableActions(level, state) {
  return [...DIRECTIONS,
    ...(level.allowTurns ? (level.robotRelative ? ['turnRight','turnLeft'] : ROTATION_ACTIONS) : []),
    ...(level.grid.join('').includes('C') ? ['collect'] : []),
    ...(level.grid.join('').includes('X') ? ['press'] : []),
    ...(level.id === 30 && state?.readyToLaunch && !state.won ? ['launch'] : [])];
}

export function expandProgram(level, program, repeatCount = 1) {
  if (!Array.isArray(program) || program.length > MAX_BLOCKS) throw new Error('invalid-program');
  if (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > MAX_REPEATS) throw new Error('invalid-repeat');
  const allowed = [...availableActions(level), ...(level.id === 30 ? ['launch'] : [])];
  let count = 0;
  const compile = (blocks, parent = null) => Array.from(blocks, (block, index) => {
    if (++count > MAX_BLOCKS) throw new Error('invalid-program');
    const key = parent === null ? String(index) : `${parent}.${index}`;
    if (block?.type === 'repeat') {
      if (parent !== null || !Array.isArray(block.body) || !block.body.length || !Number.isInteger(block.count) || block.count < 2 || block.count > MAX_REPEATS) throw new Error('invalid-repeat');
      const body = compile(block.body,index);
      return Array.from({length:block.count},(_,iteration)=>body.map(action=>({...action,iteration:iteration+1}))).flat();
    }
    if (!block || typeof block !== 'object' || !allowed.includes(block.type)) throw new Error('invalid-block');
    return { type: block.type, index, key };
  }).flat();
  const sequence = compile(program);
  if(sequence.length * repeatCount > MAX_BLOCKS * MAX_REPEATS) throw new Error('invalid-program');
  return Array.from({ length: repeatCount }, (_, iteration) => sequence.map(action => ({...action, iteration: action.iteration ?? iteration + 1}))).flat();
}

export function collectedItemTypes(level, state) {
  return state.items.map(position => {
    const [row, col] = position.split(',').map(Number);
    return level.grid[row][col];
  });
}

export function step(level, state, action) {
  if (state.won || state.error) return state;
  const next = { ...state, steps: state.steps + 1, event: null };
  if (action === 'launch') {
    if (level.id !== 30 || !state.readyToLaunch || level.grid[state.row]?.[state.col] !== 'R') {
      return { ...next, error: 'launch' };
    }
    return { ...next, won: true, event: 'launch' };
  }
  if (!availableActions(level).includes(action)) return { ...next, error: 'invalid' };
  if (action === 'turnRight' || action === 'turnLeft') {
    const order = DIRECTIONS, index = order.indexOf(state.heading || 'right');
    const offset = action === 'turnRight' ? 1 : -1;
    return { ...next, heading: order[(index + offset + order.length) % order.length], event: 'turn' };
  }
  if (action === 'press') {
    const position = coordinate(state.row, state.col);
    if (level.grid[state.row]?.[state.col] !== 'X') return { ...next, error: 'button' };
    return { ...next, buttons: state.buttons.includes(position) ? state.buttons : [...state.buttons, position], event: 'button' };
  }
  if (action === 'collect') {
    const position = coordinate(state.row, state.col);
    if (level.grid[state.row]?.[state.col] !== 'C' || state.crystals.includes(position)) return { ...next, error: 'collect' };
    if (level.id === 30 && state.phase !== 0) return { ...next, error: 'sequence' };
    return { ...next, crystals: [...state.crystals, position], phase: level.id === 30 ? 1 : state.phase, event: 'crystal' };
  }
  if (action === 'forward') action = state.heading || 'right';
  else if (level.robotRelative && DIRECTIONS.includes(action)) action = resolveDirection(state.heading, action);
  if (!DIRECTIONS.includes(action)) return { ...next, error: 'invalid' };
  const [dr, dc] = vectors[action];
  const row = state.row + dr, col = state.col + dc, tile = level.grid[row]?.[col];
  if (!tile || tile === '#') return { ...next, error: 'wall', attemptedHeading: action };
  const position = coordinate(row, col);
  if ((tile === 'D' || tile === 'F') && !state.doors.includes(position) && !state.keys.includes(tile === 'D' ? 'K' : 'L')) {
    return { ...next, error: 'door' };
  }
  if (state.energy !== null && state.energy < 1) return { ...next, error: 'energy' };
  const stages = ['C', 'K', 'D', 'B', 'R'];
  const phase = level.id === 30 ? stages.indexOf(tile) : -1;
  if (phase >= 0 && phase > state.phase) return { ...next, error: 'sequence' };
  const moved = { ...next, row, col, heading: action, moves: state.moves + 1,
    energy: state.energy === null ? null : state.energy - 1, event: 'move',
    readyToLaunch: false, phase: phase === state.phase && tile !== 'C' ? state.phase + 1 : state.phase };
  if (tile === 'B' && !state.batteries.includes(position)) {
    moved.batteries = [...state.batteries, position]; moved.energy = moved.capacity; moved.event = 'battery';
  } else if ((tile === 'K' || tile === 'L') && !state.keys.includes(tile)) {
    moved.keys = [...state.keys, tile]; moved.event = 'key';
  } else if ((tile === 'D' || tile === 'F') && !state.doors.includes(position)) {
    moved.doors = [...state.doors, position]; moved.event = 'door';
  } else if (itemTiles.includes(tile) && !state.items.includes(position)) {
    moved.items = [...state.items, position]; moved.event = tile === 'P' ? 'component' : 'fragment';
  }
  if (tile === 'E' || tile === 'R') {
    const collected = collectedItemTypes(level, moved);
    if ((level.requiredItems || []).some(item => !collected.includes(item))) return { ...moved, error: 'items' };
    if (tile === 'R') {
      if (level.id !== 30 || moved.phase !== 5) return { ...moved, error: 'sequence' };
      return { ...moved, readyToLaunch: true, event: 'ready' };
    }
    return { ...moved, won: true, event: 'goal' };
  }
  // Arrival pickups and completion resolve before exhaustion.
  if (moved.energy === 0 && tile !== 'C') return { ...moved, error: 'energy' };
  return moved;
}

export function simulate(level, program) {
  let state = initialState(level);
  for (const action of expandProgram(level, program)) {
    state = step(level, state, action.type);
    if (state.won || state.error) break;
  }
  return state;
}

export function scoreRun(level, state, programLength) {
  if (!state.won || state.error) return 0;
  const total = level.grid.join('').split('C').length - 1;
  if (state.crystals.length < total) return 1;
  return Number.isInteger(programLength) && programLength <= level.target ? 3 : 2;
}

export function normalizeProgress(input) {
  const result = { version: PROGRESS_VERSION, stars: Array(LEVELS.length).fill(0), crystals: Array(LEVELS.length).fill(0) };
  if (!input || input.version !== PROGRESS_VERSION || !Array.isArray(input.stars)) return result;
  // A five-mission prototype save cannot unlock unrelated story missions.
  for (let index = 0; index < LEVELS.length; index++) {
    const value = input.stars[index];
    if (!Number.isInteger(value) || value < 1 || value > 3) break;
    result.stars[index] = value;
    const crystals = input.crystals?.[index];
    const total = LEVELS[index].grid.join('').split('C').length - 1;
    result.crystals[index] = Number.isInteger(crystals) ? Math.max(0, Math.min(total, crystals)) : 0;
  }
  return result;
}

export function isUnlocked(progress, index) {
  return Number.isInteger(index) && index >= 0 && index < LEVELS.length &&
    (index === 0 || normalizeProgress(progress).stars[index - 1] > 0);
}

export function completeLevel(progress, index, score, crystalCount = 0) {
  const result = normalizeProgress(progress);
  if (isUnlocked(result, index)) {
    const safeScore = Number.isFinite(score) ? Math.max(1, Math.min(3, Math.floor(score))) : 1;
    const total = LEVELS[index].grid.join('').split('C').length - 1;
    const safeCrystals = Number.isFinite(crystalCount) ? Math.max(0, Math.min(total, Math.floor(crystalCount))) : 0;
    result.stars[index] = Math.max(result.stars[index], safeScore);
    result.crystals[index] = Math.max(result.crystals[index], safeCrystals);
  }
  return result;
}
