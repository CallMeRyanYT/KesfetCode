const roadPositions = new Map();

// Stars are saved per mission, so completed missions may be separated by gaps.
export function missionRoadSteps({ currentMission = 1, stars = [], total = 30 } = {}) {
  const count = Number.isInteger(total) && total > 0 ? Math.min(total, 30) : 30;
  const current = Math.max(1, Math.min(count, Number.isInteger(currentMission) ? currentMission : 1));
  return Array.from({ length: count }, (_, index) => {
    const earned = Math.min(3, Math.max(0, Number.isFinite(stars?.[index]) ? Math.floor(stars[index]) : 0));
    return { mission: index + 1, current: index + 1 === current, stars: earned, completed: earned > 0 };
  });
}

export function missionRoadMarkup({ currentMission = 1, stars = [], lang = 'en', total = 30, chapter = 0 } = {}) {
  const steps = missionRoadSteps({ currentMission, stars, total });
  const current = steps.find(step => step.current).mission;
  const completed = steps.filter(step => step.completed).length;
  const tr = lang === 'tr';
  const title = tr ? 'Görev yolculuğun' : 'Your mission journey';
  const position = tr ? `Görev ${current} / ${steps.length}` : `Mission ${current} / ${steps.length}`;
  const summary = tr ? `${completed} / ${steps.length} tamamlandı` : `${completed} / ${steps.length} complete`;
  const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  return `<nav class="mission-road" aria-label="${title}" data-road-key="${Number.isInteger(chapter) ? chapter : 0}" data-current-mission="${current}"><div class="mission-road-heading"><span>${position}</span><strong>${summary}</strong></div><div class="mission-road-scroll"><ol class="mission-road-track">${steps.map(step => {
    const partial = step.completed && step.stars < 3;
    const status = partial ? (tr ? `tamamlandı, ${step.stars} yıldız` : `completed, ${step.stars} ${step.stars === 1 ? 'star' : 'stars'}`) : step.completed ? (tr ? 'tamamlandı' : 'completed') : (tr ? 'tamamlanmadı' : 'not completed');
    const label = tr ? `Görev ${step.mission}, ${status}${step.current ? ', şu anki görev' : ''}` : `Mission ${step.mission}, ${status}${step.current ? ', current mission' : ''}`;
    return `<li class="mission-road-step${step.completed ? ' is-complete' : ''}${partial ? ' is-partial' : ''}${step.current ? ' is-current' : ''}"><button class="mission-road-node" data-level="${step.mission - 1}" aria-label="${label}"${step.current ? ' aria-current="step"' : ''}>${partial ? '<span aria-hidden="true">!</span>' : step.completed ? check : `<span aria-hidden="true">${step.mission}</span>`}</button>${step.completed ? `<span class="mission-road-number" aria-hidden="true">${step.mission}</span>` : ''}</li>`;
  }).join('')}</ol></div></nav>`;
}

// Set only the local scroll position; scrollIntoView would also move the page.
export function mountMissionRoad(host) {
  const road = host?.matches?.('.mission-road') ? host : host?.querySelector?.('.mission-road');
  const scroller = road?.querySelector('.mission-road-scroll');
  if (!scroller) return () => {};
  const key = road.dataset.roadKey;
  const current = road.dataset.currentMission;
  const remember = () => roadPositions.set(key, { current, left: scroller.scrollLeft });
  const previous = roadPositions.get(key);
  if (previous?.current === current) {
    scroller.scrollLeft = previous.left;
  } else {
    const selected = road.querySelector('[aria-current="step"]');
    if (selected) {
      const item = selected.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      const desired = scroller.scrollLeft + item.left - view.left - (scroller.clientWidth - item.width) / 2;
      scroller.scrollLeft = Math.max(0, Math.min(scroller.scrollWidth - scroller.clientWidth, desired));
    }
  }
  remember();
  scroller.addEventListener('scroll', remember, { passive: true });
  return () => {
    remember();
    scroller.removeEventListener('scroll', remember);
  };
}
