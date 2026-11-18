import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/levels.js';
import { chapterMission } from '../dist/opening-missions.js';
import { missionTip, missionCompanionMarkup } from '../dist/mission-companion.js';

const mission = (id, chapter = 0) => chapterMission(LEVELS[id - 1], chapter);

test('The four Explorer introductions teach the actual screen directions and crystal arrival', () => {
  const expected = [
    ['one Up block', 'Bir Yukarı bloğu'],
    ['two Left blocks', 'iki Sol bloğu'],
    ['two Down blocks', 'iki Aşağı bloğu'],
    ['four Right blocks', 'dört Sağ bloğu']
  ];
  for (const [index, [english, turkish]] of expected.entries()) {
    const level = mission(index + 1);
    assert.ok(missionTip(level, 0, 'en').includes(english));
    assert.ok(missionTip(level, 0, 'tr').includes(turkish));
    for (const language of ['en', 'tr']) {
      const tip = missionTip(level, 0, language);
      assert.match(tip, /crystal|kristal/);
      assert.doesNotMatch(tip, /Collect crystal|Kristali topla|Forward|İleri|turn/i);
    }
  }
});

test('Explorer introductions use separate direction cards before counts unlock at mission six', () => {
  for (const [id, direction, count] of [[2, 'left', 2], [3, 'down', 2], [4, 'right', 4]]) {
    const level = mission(id);
    assert.equal(level.solution.filter(action => action.type === direction).length, count);
    assert.match(missionTip(level, 0, 'en'), /two (?:Left|Down) blocks|four Right blocks/);
    assert.match(missionTip(level, 0, 'tr'), /iki (?:Sol|Aşağı) bloğu|dört Sağ bloğu/);
  }
  for (let id = 1; id <= 5; id++) {
    for (const language of ['en', 'tr']) {
      assert.doesNotMatch(missionTip(mission(id), 0, language), /\+|−|move count|hareket sayısı/);
    }
  }
  assert.match(missionTip(mission(6), 0, 'en'), /move count with \+ and −/);
  assert.match(missionTip(mission(6), 0, 'tr'), /hareket sayısını \+ ve − ile/);
});

test('Older chapters keep robot-relative directions and their first crystal needs explicit collection', () => {
  for (const chapter of [1, 2]) {
    assert.match(missionTip(mission(1, chapter), chapter, 'en'), /one Forward block/);
    assert.match(missionTip(mission(1, chapter), chapter, 'tr'), /Bir İleri bloğu/);
    assert.match(missionTip(mission(2, chapter), chapter, 'en'), /one Forward block.*use \+ to choose 2 moves/);
    assert.match(missionTip(mission(2, chapter), chapter, 'tr'), /Bir İleri bloğu.*\+ ile hareket sayısını 2 yap/);
    assert.match(missionTip(mission(4, chapter), chapter, 'en'), /Collect crystal/);
    assert.match(missionTip(mission(4, chapter), chapter, 'tr'), /Kristali topla/);
    assert.doesNotMatch(missionTip(mission(4, chapter), chapter, 'en'), /four Right/);
  }
});

test('Every crystal pickup goal explains the Collect action, without inventing it for arrival-only goals', () => {
  for (const chapter of [0, 1, 2]) {
    for (const base of LEVELS) {
      const level = chapterMission(base, chapter);
      const hasCrystal = level.grid.some(row => row.includes('C'));
      for (const [language, action] of [['en', 'Collect crystal'], ['tr', 'Kristali topla']]) {
        assert.equal(missionTip(level, chapter, language).includes(action), hasCrystal, `Chapter ${chapter + 1}, mission ${base.id}, ${language}`);
      }
    }
  }
});

test('Tips explain batteries, automatic pickups, doors and finale prerequisites accurately', () => {
  assert.match(missionTip(mission(17), 0), /battery before my energy runs out/);
  assert.match(missionTip(mission(21), 0), /gold key first.*matching door/);
  assert.match(missionTip(mission(24), 0), /gold and blue keys before their doors/);
  assert.match(missionTip(mission(25), 0), /key before its door.*batteries/);
  for (const id of [26, 27, 28]) {
    const tip = missionTip(mission(id), 0);
    assert.match(tip, /component|module/);
    assert.doesNotMatch(tip, /use Launch|Fırlat bloğu|Collect crystal/);
  }
  assert.match(missionTip(mission(29), 0), /all three K–Ş–F code fragments/);
  assert.match(missionTip(mission(29), 0, 'tr'), /üç parçası/);
  const finale = missionTip(mission(30), 0);
  assert.match(finale, /Collect crystal.*key.*door.*battery.*At KEŞFET-1, use Launch/);
  assert.match(missionTip(mission(30), 0, 'tr'), /Kristali topla.*anahtara.*kapısına.*pile.*Fırlat/);
});

test('Every campaign mission has a distinct, concise, localized goal prompt', () => {
  for (const chapter of [0, 1, 2]) {
    for (const language of ['en', 'tr']) {
      const allTips = LEVELS.map(base => missionTip(chapterMission(base, chapter), chapter, language));
      assert.equal(new Set(allTips).size, LEVELS.length);
      for (const tip of allTips) {
        assert.ok(tip.trim().split(/\s+/).length <= 35, tip);
        assert.doesNotMatch(tip, /undefined|null|\[object Object\]/);
      }
    }
  }
});

test('Companion markup is localized live text with a decorative, non-draggable robot', () => {
  const level = mission(1);
  const snapshot = structuredClone(level);
  const html = missionCompanionMarkup(level, 0, 'tr');
  assert.match(html, /<aside class="mission-companion" aria-label="KAŞİF’in görev ipucu">/);
  assert.match(html, /class="companion-bubble"/);
  assert.match(html, /class="companion-name">KAŞİF/);
  assert.match(html, /<p class="companion-tip">Hadi uyanalım!/);
  assert.match(html, /class="companion-robot"><span class="talking-robot [^"]*" data-mood="happy" data-talking-robot aria-hidden="true">/);
  assert.match(html, /<img class="talking-robot-img" src="\/assets\/kasif-talking.webp" alt="" draggable="false">/);
  assert.doesNotMatch(html, /<button|tabindex|aria-live/);
  assert.deepEqual(level, snapshot);
});

test('Unknown mission fallback escapes authored text and preserves its localized objective', () => {
  const level = { id: 99, objective: ['Help <KAŞİF> & explore.', '"KAŞİF" ile keşfet.'] };
  assert.equal(missionTip(level, 0, 'tr'), '"KAŞİF" ile keşfet.');
  assert.match(missionCompanionMarkup(level, 0, 'en'), /Help &lt;KAŞİF&gt; &amp; explore\./);
  assert.match(missionCompanionMarkup(level, 0, 'tr'), /&quot;KAŞİF&quot; ile keşfet\./);
  assert.ok(missionTip({ id: 100 }, 0, 'en').length > 20);
});
