import test from 'node:test';
import assert from 'node:assert/strict';
import { adventureMenu, missionMapY } from '../dist/adventure.js';
import { normalizeProgress } from '../dist/engine.js';

const options = { page: 'map', chapter: 0, world: 0, lang: 'en', progress: normalizeProgress(null), sound: true, theme: 'dark', unlockAll: true };
test('Chapter one shows fifteen missions and later chapters retain thirty', () => {
  const indices = [adventureMenu(options)]
    .flatMap(html => [...html.matchAll(/data-level="(\d+)"/g)].map(m => Number(m[1])));
  assert.deepEqual(indices, Array.from({length:15},(_,i)=>i));
  assert.equal([...adventureMenu({...options, chapter: 1}).matchAll(/data-level="(\d+)"/g)].length, 30);
  for (let world = 0; world < 3; world++) assert.doesNotMatch(adventureMenu({...options,world}), / disabled/);
});
test('Map can enforce progression when debug access ends and shows earned stars', () => {
  const progress = normalizeProgress(null); progress.stars[0] = 3;
  const html = adventureMenu({...options,progress,unlockAll:false});
  assert.match(html, /★ 3 \/ 45/);
  assert.equal([...html.matchAll(/ disabled/g)].length,13);
  assert.match(html, /data-level="1"\s+aria-label/);
});
test('Chapter one totals exclude saved stars beyond mission fifteen', () => {
  const progress = normalizeProgress(null); progress.stars[0] = 2; progress.stars[15] = 3;
  const first = adventureMenu({...options, progress});
  assert.match(first, /★ 2 \/ 45/);
  assert.match(first, /15 MISSIONS · 3 WORLDS/);
  assert.doesNotMatch(first, /16–20/);
  assert.match(adventureMenu({...options, chapter: 1, progress}), /★ 5 \/ 90/);
});

test('The shorter first chapter keeps its mission markers aligned with the cropped map', () => {
  assert.equal(missionMapY(0, 42), 0);
  assert.equal(missionMapY(0, 100), 100);
  assert.equal(missionMapY(1, 48), 48);
  const html = adventureMenu(options);
  assert.match(html, new RegExp(`--x:49%;--y:${missionMapY(0, 48)}%`));
});
test('Chapter names and ages are translated and later campaign previews are identified', () => {
  const en = adventureMenu({...options,page:'chapters'});
  const tr = adventureMenu({...options,page:'chapters',lang:'tr'});
  for (const name of ['EXPLORER','INVENTOR','CODE MASTER','Ages 4–7','Ages 7–10','Ages 10–12+']) assert.ok(en.includes(name));
  for (const name of ['KAŞİF','MUCİT','KOD USTASI','4–7 yaş','7–10 yaş','10–12+ yaş']) assert.ok(tr.includes(name));
  assert.equal([...en.matchAll(/Preview · shared training missions/g)].length,2);
});

test('Home animates the original illustration and map water has no dotted overlay',()=>{
  const home=adventureMenu({...options,page:'home'});
  assert.match(home,/data-illustration="robot"/);
  assert.doesNotMatch(home,/menu-robot scene-host/);
  const map=adventureMenu(options);
  assert.match(map,/data-illustration="water"/);
  assert.match(map,/data-src="\/assets\/journey-terrain.png"/);
  assert.doesNotMatch(map,/river-current|waterfall-mist/);
});

test('Ice map uses snowfall without distorting frozen cliffs as flowing water',()=>{
  const ice=adventureMenu({...options,chapter:2});
  assert.match(ice,/class="snowfall"/);
  assert.doesNotMatch(ice,/data-illustration="water"|flying-bird/);
});

test('Mars uses dry artwork and excludes water and birds from map and chapter card',()=>{
  const mars=adventureMenu({...options,chapter:1});
  assert.match(mars,/\/assets\/mars-dry-terrain\.png/);
  assert.doesNotMatch(mars,/\/assets\/mars-terrain\.png|data-illustration="water"|flying-bird/);
  const chapters=adventureMenu({...options,page:'chapters'});
  const inventor=chapters.match(/<article[^>]*planet-1[\s\S]*?<\/article>/)?.[0];
  assert.ok(inventor);
  assert.doesNotMatch(inventor,/data-illustration="water"|flying-bird/);
});
