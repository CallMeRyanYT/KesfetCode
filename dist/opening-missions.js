// Opening puzzles belong to the youngest chapter; older chapters retain their
// authored routes and add the turning controls appropriate to their age path.
import { chapterOneBoard } from './chapter-one-boards.js';

export const isOpeningMission = (chapterIndex, missionId) => chapterIndex === 0 && [1, 2, 3, 4].includes(missionId);

const openingRoutes = {
  1: { grid: ['#####', '##E##', '##S##', '#####', '#####'], heading: 'up', moves: 1 },
  2: { grid: ['#####', '#####', '#E.S#', '#####', '#####'], heading: 'left', moves: 2 },
  3: { grid: ['#####', '##S##', '##.##', '##E##', '#####'], heading: 'down', moves: 2 },
  4: { grid: ['#######', '#S...E#', '#######'], heading: 'right', moves: 4 }
};

export function chapterMission(baseLevel, chapterIndex) {
  const mission = { ...baseLevel, robotRelative: chapterIndex !== 0, allowTurns: chapterIndex > 0, curriculum: chapterIndex };
  const route = chapterIndex === 0 ? openingRoutes[baseLevel.id] : null;
  if (!route) return chapterIndex === 0 ? chapterOneBoard(mission) : mission;
  const directions = { up: ['Up', 'Yukarı'], right: ['Right', 'Sağ'], left: ['Left', 'Sol'], down: ['Down', 'Aşağı'] }[route.heading];
  const count = { 1: ['one', 'bir'], 2: ['two', 'iki'], 4: ['four', 'dört'] }[route.moves];
  const labels = [
    `Connect ${count[0]} ${directions[0]} block${route.moves === 1 ? '' : 's'} below Start to reach the crystal.`,
    `Kristale ulaşmak için ${count[1]} ${directions[1]} bloğunu Başla bloğunun altına bağla.`
  ];
  return chapterOneBoard({
    ...mission,
    grid: [...route.grid],
    heading: route.heading,
    objective: labels,
    hint: directions.map(label => route.moves === 1 ? label : `${label} × ${route.moves}`),
    solution: Array.from({ length: route.moves }, () => ({ type: route.heading })),
    target: route.moves
  });
}
