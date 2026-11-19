import { LEVELS, WORLDS, CHAPTERS } from './levels.js';
export { LEVELS, WORLDS, CHAPTERS };

export const DIRECTIONS = ['up', 'right', 'down', 'left'];
export const ROTATION_ACTIONS = ['forward', 'turnRight', 'turnLeft'];
export const MAX_BLOCKS = 80;
export const MAX_REPEATS = 10;
export const MAX_DIRECTION_COUNT = 10;
/** The Explorer mission whose tutorial introduces repeating a move with + and −. */
export const COUNT_UNLOCK_MISSION = 13;
export const PROGRESS_VERSION = 2;
const vectors = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
const itemTiles = ['P', 'a', 'b', 'c'];
const coordinate = (row, col) => `${row},${col}`;

// Up/down mean forward/backward in the robot-relative control scheme.
export function resolveDirection(heading, action) {
  return DIRECTIONS[(DIRECTIONS.indexOf(heading || 'right') + DIRECTIONS.indexOf(action)) % 4];
}
export function relativeSolution(level) {
  if (level.robotRelative === false) return level.solution.map(block => ({...block}));
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

export function isDirectionBlock(type) {
  return DIRECTIONS.includes(type) || type === 'forward';
}

export function directionCountsAvailable(level) {
  // Explorer teaches the multi-step (+/−) control in its own tutorial mission.
  return !(level.curriculum === 0 && level.id < COUNT_UNLOCK_MISSION);
}

export function directionBlockCount(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) throw new Error('invalid-block');
  const count = block.count === undefined ? 1 : block.count;
  if (!Number.isInteger(count) || count < 1 || count > MAX_DIRECTION_COUNT || (!isDirectionBlock(block.type) && count !== 1)) throw new Error('invalid-block');
  return count;
}

// Count the physical coding cards, not the commands produced by their counts.
// A legacy loop's wrapper and each card inside it are counted once each.
export function programBlockCount(program) {
  if (!Array.isArray(program)) throw new Error('invalid-program');
  return program.reduce((total, block) => total + 1 + (block?.type === 'repeat' ? programBlockCount(block.body) : 0), 0);
}

function matchingMetadataValue(left, right, seen = new WeakMap()) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const prototype = Object.getPrototypeOf(left);
  if (prototype !== Object.getPrototypeOf(right) || prototype !== Object.prototype && !Array.isArray(left)) return false;
  if (seen.has(left)) return seen.get(left) === right;
  seen.set(left, right);
  const keys = Reflect.ownKeys(left);
  return keys.length === Reflect.ownKeys(right).length && keys.every(key => Object.hasOwn(right, key) && matchingMetadataValue(left[key], right[key], seen));
}

function matchingMovementMetadata(left, right) {
  const keys = Object.keys(left).filter(key => key !== 'count');
  if (keys.length !== Object.keys(right).filter(key => key !== 'count').length) return false;
  return keys.every(key => {
    if (!Object.hasOwn(right, key)) return false;
    return matchingMetadataValue(left[key], right[key]);
  });
}

export function missionTargetProgram(level) {
  if (!Array.isArray(level?.solution) || !level.solution.length) return [];
  // Bare authored levels use absolute movement. Older chapter instances use
  // the converted relative arrows that the player actually has in the editor.
  const canonical = level.robotRelative === true ? relativeSolution(level) : level.solution;
  const counted = directionCountsAvailable(level), result = [];
  for (const original of canonical) {
    const block = structuredClone(original);
    if (!isDirectionBlock(block.type)) { result.push(block); continue; }
    let remaining = directionBlockCount(block);
    if (!counted) {
      while (remaining-- > 0) {
        const single = structuredClone(block);
        if (Object.hasOwn(single, 'count')) single.count = 1;
        result.push(single);
      }
      continue;
    }
    while (remaining > 0) {
      const previous = result.at(-1), previousCount = previous && isDirectionBlock(previous.type) ? directionBlockCount(previous) : MAX_DIRECTION_COUNT;
      if (previous?.type === block.type && previousCount < MAX_DIRECTION_COUNT && matchingMovementMetadata(previous, block)) {
        const added = Math.min(remaining, MAX_DIRECTION_COUNT - previousCount);
        previous.count = previousCount + added; remaining -= added;
      } else {
        const added = Math.min(remaining, MAX_DIRECTION_COUNT), next = structuredClone(block);
        if (added > 1 || Object.hasOwn(next, 'count')) next.count = added;
        result.push(next); remaining -= added;
      }
    }
  }
  return result;
}

export function missionBlockTarget(level) {
  const reference = missionTargetProgram(level);
  if (reference.length) return programBlockCount(reference);
  return Number.isSafeInteger(level?.target) && level.target >= 0 ? level.target : 1;
}

export function expandProgram(level, program, repeatCount = 1) {
  if (!Array.isArray(program) || program.length > MAX_BLOCKS) throw new Error('invalid-program');
  if (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > MAX_REPEATS) throw new Error('invalid-repeat');
  const allowed = [...availableActions(level), ...(level.id === 30 ? ['launch'] : [])];
  let count = 0;
  const compile = (blocks, parent = null) => {
    const result = [];
    for (const [index, block] of blocks.entries()) {
      if (++count > MAX_BLOCKS) throw new Error('invalid-program');
      const key = parent === null ? String(index) : `${parent}.${index}`;
      if (block?.type === 'repeat') {
        if (parent !== null || !Array.isArray(block.body) || !block.body.length || !Number.isInteger(block.count) || block.count < 2 || block.count > MAX_REPEATS) throw new Error('invalid-repeat');
        const body = compile(block.body,index);
        if (result.length + body.length * block.count > MAX_BLOCKS * MAX_REPEATS) throw new Error('invalid-program');
        for (let iteration = 1; iteration <= block.count; iteration++) result.push(...body.map(action => ({...action, iteration})));
      } else {
        if (!block || typeof block !== 'object' || Array.isArray(block) || !allowed.includes(block.type)) throw new Error('invalid-block');
        const repetitions = directionBlockCount(block);
        if (repetitions > 1 && !directionCountsAvailable(level)) throw new Error('invalid-block');
        if (result.length + repetitions > MAX_BLOCKS * MAX_REPEATS) throw new Error('invalid-program');
        for (let movement = 0; movement < repetitions; movement++) result.push({type:block.type,index,key});
      }
    }
    return result;
  };
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

export function scoreRun(level, state, physicalBlocks) {
  if (!state.won || state.error) return 0;
  const total = level.grid.join('').split('C').length - 1;
  if (state.crystals.length < total) return 1;
  if (!Number.isSafeInteger(physicalBlocks) || physicalBlocks < 1) return 1;
  const extra = physicalBlocks - missionBlockTarget(level);
  return extra <= 0 ? 3 : extra <= 4 ? 2 : 1;
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

export function completeLevel(progress, index, score, crystalCount = 0, { force = false } = {}) {
  const result = normalizeProgress(progress);
  // `force` saves a mission opened out of order (all missions open for testing).
  if (force || isUnlocked(result, index)) {
    const safeScore = Number.isFinite(score) ? Math.max(1, Math.min(3, Math.floor(score))) : 1;
    const total = LEVELS[index].grid.join('').split('C').length - 1;
    const safeCrystals = Number.isFinite(crystalCount) ? Math.max(0, Math.min(total, Math.floor(crystalCount))) : 0;
    result.stars[index] = Math.max(result.stars[index], safeScore);
    result.crystals[index] = Math.max(result.crystals[index], safeCrystals);
  }
  return result;
}
