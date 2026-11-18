const SIZE = 8;
const vectors = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
const names = { U: 'up', R: 'right', D: 'down', L: 'left' };
const labels = [
  { up: 'Up', right: 'Right', down: 'Down', left: 'Left', collect: 'Collect crystal', press: 'Press button', launch: 'Launch' },
  { up: 'Yukarı', right: 'Sağ', down: 'Aşağı', left: 'Sol', collect: 'Kristali topla', press: 'Düğmeye bas', launch: 'Fırlat' }
];

function routePath(route, start = [0, 0]) {
  const path = [[...start]];
  for (const segment of route.split(' ')) {
    const [dr, dc] = vectors[names[segment[0]]];
    for (let count = 0; count < Number(segment.slice(1)); count++) {
      const [row, col] = path.at(-1); path.push([row + dr, col + dc]);
    }
  }
  return path;
}

// A separated serpentine corridor leaves blocked rows between its long runs.
const serpent = routePath('R7 D2 L7 D2 R7 D2 L7');
// The final corridor has 39 cells and no nonconsecutive neighboring cells.
// This retains the 38 moves plus Collect and Launch of the authored finale.
const launchPath = [[0,0],[1,0],[1,1],[2,1],[3,1],[3,2],[3,3],[4,3],[5,3],[5,2],[5,1],[5,0],[6,0],[7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7],[6,7],[5,7],[5,6],[5,5],[4,5],[3,5],[3,6],[3,7],[2,7],[1,7],[0,7],[0,6],[0,5],[1,5],[1,4],[1,3],[0,3],[0,2]];

const compactLayouts = {
  17: { path: routePath('R6 D2') },
  20: { path: serpent.slice(0, 31) },
  25: { path: serpent.slice(0, 25).map(([row, col]) => [col, 7 - row]) },
  27: {
    path: routePath('D4 R6 U2 R1 U2 L1'),
    grid: ['S....#E.', '.###.##.', '.###.#..', '.###.#.#', 'B...P.B#', '########', '########', '########']
  },
  28: {
    path: routePath('L2 U1 L2 D1 L2 U1 L1 U6 R6 D1 R1', [7,7]),
    grid: ['.B.....#', '.###.#.E', 'P..#..#.', '.#..#.#.', '.##.....', '.######.', '..#...#.', '#B..#..S']
  },
  29: {
    path: routePath('R1 D2 L1 D2 R2 U1 R1 U2 R2 U1 R2 D5 L1 D1'),
    grid: ['S.###.cB', '#a#...#.', '..#B#.#.', '.#..#.#.', '..b#..#.', '####.#..', '####.#E#', '####...#']
  },
  30: { path: launchPath }
};

function authoredWalk(mission) {
  const row = mission.grid.findIndex(line => line.includes('S'));
  const path = [[row, mission.grid[row].indexOf('S')]];
  for (const action of mission.solution) {
    const vector = vectors[action.type];
    if (!vector) continue;
    const [r, c] = path.at(-1); path.push([r + vector[0], c + vector[1]]);
  }
  return path;
}

function readable(solution) {
  const groups = [];
  for (const action of solution) {
    if (groups.at(-1)?.type === action.type) groups.at(-1).count++;
    else groups.push({ type: action.type, count: 1 });
  }
  return labels.map(language => groups.map(group => `${language[group.type]}${group.count > 1 ? ` ×${group.count}` : ''}`).join(' → '));
}

function compact(mission) {
  const layout = compactLayouts[mission.id];
  if (!layout) throw new Error(`No compact board for mission ${mission.id}`);
  const source = authoredWalk(mission), path = layout.path;
  if (source.length !== path.length) throw new Error(`Compact route length changed in mission ${mission.id}`);
  const grid = layout.grid ? layout.grid.map(row => [...row]) : Array.from({length: SIZE}, () => Array(SIZE).fill('#'));
  path.forEach(([row,col], index) => {
    const [sourceRow,sourceCol] = source[index]; grid[row][col] = mission.grid[sourceRow][sourceCol];
  });
  let move = 0;
  const solution = mission.solution.map(action => {
    if (!vectors[action.type]) return {...action};
    const [fromRow, fromCol] = path[move++], [toRow,toCol] = path[move];
    const type = Object.keys(vectors).find(direction => vectors[direction][0] === toRow-fromRow && vectors[direction][1] === toCol-fromCol);
    if (!type) throw new Error(`Disconnected compact route in mission ${mission.id}`);
    return {...action,type};
  });
  return {...mission, grid:grid.map(row=>row.join('')), solution, hint:readable(solution), heading:solution.find(action=>vectors[action.type]).type};
}

function bounds(grid) {
  const cells = grid.flatMap((line,row)=>[...line].flatMap((tile,col)=>tile==='#'?[]:[[row,col]]));
  const rows=cells.map(cell=>cell[0]),cols=cells.map(cell=>cell[1]);
  return {top:Math.min(...rows),bottom:Math.max(...rows),left:Math.min(...cols),right:Math.max(...cols)};
}

/** Center every complete puzzle on an 8×8 blocked board, without cropping paths. */
export function chapterOneBoard(mission) {
  let result = mission, box = bounds(mission.grid);
  if (box.bottom-box.top+1 > SIZE || box.right-box.left+1 > SIZE) {
    result=compact(mission); box=bounds(result.grid);
  }
  const rowOffset=Math.floor((SIZE-(box.bottom-box.top+1))/2)-box.top;
  const colOffset=Math.floor((SIZE-(box.right-box.left+1))/2)-box.left;
  const grid=Array.from({length:SIZE},()=>Array(SIZE).fill('#'));
  result.grid.forEach((line,row)=>[...line].forEach((tile,col)=>{
    if(tile!=='#')grid[row+rowOffset][col+colOffset]=tile;
  }));
  return {...result,grid:grid.map(row=>row.join('')),solution:result.solution.map(action=>({...action}))};
}
