// Opening puzzles belong to the youngest chapter; older chapters retain their
// authored routes and add the turning controls appropriate to their age path.
import { chapterOneBoard } from './chapter-one-boards.js';

export const isOpeningMission = (chapterIndex, missionId) => chapterIndex === 0 && [1, 2, 3, 4].includes(missionId);

// Explorer missions 1–12 follow Code.org Course 1, Lesson 4 ("Maze: Sequence"),
// puzzles 2–13, cell for cell on its 8×8 board (puzzle 1 is skipped). S is the
// start, E the goal and . the other walkable ground; everything else is a wall.
// Rows count down from the top and columns right from the left edge.
export const VIDEO_MAZES = {
  1: { start: [4, 2], goal: [4, 4], path: [[4, 3]], route: 'R2' },
  2: { start: [3, 4], goal: [5, 4], path: [[4, 4]], route: 'D2' },
  3: { start: [4, 4], goal: [2, 4], path: [[3, 4]], route: 'U2' },
  4: { start: [3, 2], goal: [3, 5], path: [[3, 3], [3, 4]], route: 'R3' },
  5: { start: [2, 5], goal: [4, 4], path: [[1, 6], [2, 4], [2, 6], [3, 4]], route: 'L1 D2' },
  6: { start: [4, 3], goal: [3, 4], path: [[4, 4], [4, 5]], route: 'R1 U1' },
  7: { start: [5, 4], goal: [4, 6], path: [[5, 5], [4, 5]], route: 'R1 U1 R1' },
  8: { start: [3, 4], goal: [4, 2], path: [[3, 3], [4, 3]], route: 'L1 D1 L1' },
  9: { start: [4, 2], goal: [4, 5], path: [[3, 2], [3, 3], [3, 4], [3, 5]], route: 'U1 R3 D1' },
  10: { start: [2, 5], goal: [5, 5], path: [[2, 4], [2, 3], [3, 3], [4, 3], [4, 4], [4, 5]], route: 'L2 D2 R2 D1' },
  11: { start: [2, 2], goal: [4, 3], path: [[2, 3], [3, 3]], route: 'R1 D2' },
  12: { start: [3, 5], goal: [3, 2], path: [[4, 5], [4, 4], [4, 3], [3, 3]], route: 'D1 L2 U1 L1' }
};
// Missions 13–15 continue in the same style once moves can repeat (+ and −).
// 13 is the tutorial: one long straight run. 14 and 15 are a little harder,
// with a dead-end tile that tempts one step too many.
export const COUNT_MAZES = {
  13: { start: [4, 1], goal: [4, 6], path: [[4, 2], [4, 3], [4, 4], [4, 5]], route: 'R5', tutorial: true },
  14: { start: [1, 1], goal: [4, 5], path: [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 5], [3, 5]], route: 'R4 D3' },
  15: { start: [6, 1], goal: [5, 7], path: [[5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [5, 6]], route: 'U3 R4 D2 R2' }
};
export const EXPLORER_MAZES = { ...VIDEO_MAZES, ...COUNT_MAZES };
/** True for Explorer's tutorial mission that teaches the +/− repeat control. */
export const isCountTutorial = (chapterIndex, missionId) => chapterIndex === 0 && Boolean(COUNT_MAZES[missionId]?.tutorial);
const NAMES = { U: 'up', R: 'right', D: 'down', L: 'left' };
const LABELS = { up: ['Up', 'Yukarı'], right: ['Right', 'Sağ'], down: ['Down', 'Aşağı'], left: ['Left', 'Sol'] };

/** The 8×8 grid of a video maze. */
export function videoMazeGrid(maze) {
  const grid = Array.from({ length: 8 }, () => Array(8).fill('#'));
  for (const [row, col] of maze.path) grid[row][col] = '.';
  grid[maze.start[0]][maze.start[1]] = 'S';
  grid[maze.goal[0]][maze.goal[1]] = 'E';
  return grid.map(row => row.join(''));
}
/** One { type } per tile moved, from a route such as "L2 D1". */
export const routeSteps = route => route.split(' ').flatMap(part => Array.from({ length: Number(part.slice(1)) }, () => ({ type: NAMES[part[0]] })));

export function chapterMission(baseLevel, chapterIndex) {
  const mission = { ...baseLevel, robotRelative: chapterIndex !== 0, allowTurns: chapterIndex > 0, curriculum: chapterIndex };
  const maze = chapterIndex === 0 ? EXPLORER_MAZES[baseLevel.id] : null;
  if (!maze) return chapterIndex === 0 ? chapterOneBoard(mission) : mission;
  const solution = routeSteps(maze.route);
  const groups = maze.route.split(' ').map(part => ({ type: NAMES[part[0]], count: Number(part.slice(1)) }));
  const readable = language => groups.map(group => `${LABELS[group.type][language]}${group.count > 1 ? ` × ${group.count}` : ''}`).join(' → ');
  // The grid is already the video's 8×8 board, so it is used as is (not re-centred).
  return {
    ...mission,
    grid: videoMazeGrid(maze),
    heading: solution[0].type,
    crystals: [],
    objective: [`Guide KAŞİF along the grass to the goal: ${readable(0)}.`, `KAŞİF’i çimenlerden hedefe götür: ${readable(1)}.`],
    hint: [readable(0), readable(1)],
    solution,
    target: solution.length
  };
}
