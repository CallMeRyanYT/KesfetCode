import { CHAPTERS, LEVELS, WORLDS } from './levels.js';
import { brandMarkup } from './brand.js';
import { chapterMissionCount } from './chapter-config.js';

// The Explorer map shows the lower part of the original painting, where its
// fifteen missions are located. Other chapters continue using the full map.
export const missionMapY = (chapter, y) => chapter === 0 ? (y - 42) / 58 * 100 : y;

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// One painted sign per illustration, aligned with a single building's fascia.
function buildingSigns(chapter, map = false) {
  const sign = map ? [81,1268,100,-6,15]
    : [[224,308,84,-1,13],[203,374,88,-2,13],[175,348,111,1,14]][chapter];
  const [x,y,width,angle,size] = sign;
  const finish = `lab-finish-${map?'map':'card'}-${chapter}`;
  return `<svg class="${map?'map-building-signs':'building-signs'}" viewBox="0 0 ${map?'1024 1536':'512 1024'}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${finish}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${chapter===1?'#efdfc9':'#f0f0e9'}" stop-opacity=".72"/><stop offset="1" stop-color="${chapter===1?'#ba9c7e':'#b8c5c5'}" stop-opacity=".48"/></linearGradient></defs><g transform="translate(${x} ${y}) rotate(${angle}) skewX(-5)"><path d="M-5 ${-size-3} Q${width/2} ${-size+1} ${width+5} ${-size-3} L${width+5} 4 Q${width/2} 7 -5 4Z" fill="url(#${finish})"/><path d="M-5 4 Q${width/2} 7 ${width+5} 4" fill="none" stroke="#55696b" stroke-opacity=".2" stroke-width=".6"/><text x="0" y="0" textLength="${width}" lengthAdjust="spacingAndGlyphs" font-family="Arial,sans-serif" font-weight="700" font-size="${size}"><tspan fill="#293d40">Keşfet</tspan><tspan fill="#d36517"> lab</tspan></text></g></svg>`;
}

function livingScenery(chapter=0, card=false) {
  if(card)return `<canvas class="chapter-animation" data-illustration="chapter" data-chapter="${chapter}" data-src="/assets/chapter-islands.png" aria-hidden="true"></canvas>`;
  // Chapter 2 is Mars: no terrestrial wildlife or flowing-water effects.
  if (chapter === 1) return "";
  if (chapter === 2) return `<div class="snowfall" aria-hidden="true">${Array.from({length:22},(_,i)=>`<i style="--x:${(i*47)%100}%;--delay:-${i*.9}s;--duration:${12+i%7}s"></i>`).join('')}</div>`;
  const water = !card && chapter !== 1 ? `<canvas class="water-texture" data-illustration="water" data-src="${chapter === 2 ? '/assets/ice-terrain.png' : '/assets/journey-terrain.png'}" aria-hidden="true"></canvas>` : '';
  return `${water}<svg class="living-scenery scenery-${chapter}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${[0,1,2,3].map(n=>`<g class="flying-bird" style="offset-path:path('M -10 ${20+n*17} C 25 ${5+n*16}, 65 ${45+n*10}, 110 ${18+n*18}');--flight:${18+n*4}s;--delay:${-n*5}s"><path d="M-1.4 0 Q-.7 -1 0 0 Q.7 -1 1.4 0"/></g>`).join('')}</svg>`;
}

export function adventureMenu({ page, chapter, world, lang, progress, sound, theme, unlockAll, motion = true }) {
  const t = (en, tr) => lang === 'tr' ? tr : en;
  const l = pair => escape(pair[lang === 'tr' ? 1 : 0]);
  const missionCount = chapterMissionCount(chapter);
  const stars = progress.stars.slice(0, missionCount).reduce((sum, n) => sum + n, 0);
  const maxStars = missionCount * 3;
  const worldCount = Math.ceil(missionCount / 5);
  const names = [t('EXPLORER', 'KAŞİF'), t('INVENTOR', 'MUCİT'), t('CODE MASTER', 'KOD USTASI')];
  const brand = `<div class="adventure-brand">${brandMarkup()}</div>`;
  const controls = `<div class="adventure-tools"><button data-action="home" aria-label="${t('Main menu','Ana menü')}">⌂</button><button data-action="sound" aria-label="${t(sound ? 'Turn sound off' : 'Turn sound on', sound ? 'Sesi kapat' : 'Sesi aç')}" aria-pressed="${sound}"><span class="sound-note ${sound?'':'is-muted'}" aria-hidden="true">♫</span></button><button data-action="theme" aria-label="${t('Change theme','Temayı değiştir')}">${theme === 'dark' ? '☀' : '☾'}</button><button data-action="help" aria-label="${t('How to play','Nasıl oynanır')}">?</button><div class="adventure-languages"><button data-lang="en" aria-pressed="${lang === 'en'}">EN</button><button data-lang="tr" aria-pressed="${lang === 'tr'}">TR</button></div></div>`;
  let content;
  if (page === 'home') {
    content = `<div class="original-robot-scene" aria-hidden="true"><canvas data-illustration="robot"></canvas></div><section class="home-content">${brand}<p class="adventure-tagline">${t('Small steps. Extraordinary discoveries.', 'Küçük adımlar. Büyük keşifler.')}</p><h1 class="sr-only">${t('CodeKAŞİF coding adventure', 'CodeKAŞİF kodlama macerası')}</h1><button class="space-button start-adventure" data-action="chapters"><span>▶</span>${t('PLAY', 'OYUNA BAŞLA')}</button><button class="space-button blue" data-action="reset-progress">↶ ${t('RESET PROGRESS', 'İLERLEMEYİ SIFIRLA')}</button><button class="story-link" data-action="story">▣ ${t('Meet KAŞİF · Read the story', 'KAŞİF ile tanış · Hikâyeyi oku')}</button><p class="home-quote">${t('Code a better tomorrow.', 'Daha iyi bir gelecek için kodla.')}</p></section>`;
  } else if (page === 'chapters') {
    content = `<h1 class="sr-only">${t('Choose your level','Seviyeni seç')}</h1><section class="planet-cards">${CHAPTERS.map((c, i) => `<article class="planet-card planet-${i}"><div class="planet-art" aria-hidden="true">${livingScenery(i,true)}${buildingSigns(i)}</div><div class="planet-copy"><span class="planet-number">${i + 1}</span><span class="space-eyebrow">${t('LEVEL', 'SEVİYE')} ${i + 1}</span><h2>${names[i]}</h2><p>${l(c.learning)}</p><span class="space-age">♟ ${l(c.age)}</span>${i ? `<small>${t('Preview · shared training missions', 'Önizleme · ortak eğitim görevleri')}</small>` : `<small>${t('15 missions · 3 worlds', '15 görev · 3 dünya')}</small>`}<button class="space-button" data-action="choose-path" data-path="${i}">${t('START', 'BAŞLA')} <span>›</span></button></div></article>`).join('')}</section><p class="adventure-motto">${t('“Today’s little ideas build tomorrow’s wonderful world.”', '“Bugünün küçük fikirleri, yarının güzel dünyasını inşa eder.”')}</p>`;
  } else {
    const w = WORLDS[world];
    // Authored against the road, bridges and clearings in the terrain artwork.
    const positions = [[18,93],[31,90],[48,91],[62,89],[64,84],[62,80],[70,76],[71,72],[60,69],[44,67],[37,63],[42,59],[53,56],[57,52],[49,48],[35,45],[28,41],[33,38],[44,34],[37,30],[35,26],[48,24],[56,28],[70,30],[84,27],[81,20],[62,17],[55,14],[78,16],[88,11]];

    const segment = LEVELS.slice(0, missionCount);
    content = `<header class="map-heading"><button class="space-back" data-action="chapters">‹ ${t('Back', 'Geri')}</button><div><span class="space-eyebrow">${names[chapter]} · ${t(`${missionCount} MISSIONS · ${worldCount} WORLDS`, `${missionCount} GÖREV · ${worldCount} DÜNYA`)}</span><h1>${t('Your adventure map', 'Macera haritan')}</h1></div></header><div class="map-layout"><aside class="map-sidebar">${brand}<strong class="space-score">★ ${stars} / ${maxStars}</strong><div class="mission-brief"><span class="space-eyebrow">${t('LEVEL', 'SEVİYE')} ${chapter + 1}</span><h2>${names[chapter]}</h2><p>${l(w.story)}</p><ul><li>★ ${t(`${missionCount} missions`, `${missionCount} görev`)}</li><li>♟ ${l(CHAPTERS[chapter].age)}</li><li>⚑ ${t('One big adventure', 'Büyük bir macera')}</li></ul>${chapter ? `<small>${t('Preview: this age path currently shares the Explorer missions, with extra turning commands.', 'Önizleme: bu yaş yolu şu anda ek dönüş komutlarıyla Kâşif görevlerini kullanır.')}</small>` : ''}</div><button class="space-button blue" data-action="story">▣ ${t('Read the story', 'Hikâyeyi oku')}</button></aside><section class="journey-map all-missions chapter-map-${chapter}" aria-label="${t('Mission map', 'Görev haritası')}"><div class="map-scenery" aria-hidden="true"><img src="${['/assets/journey-terrain.png','/assets/mars-dry-terrain.png','/assets/ice-terrain.png'][chapter]}" alt=""></div>${livingScenery(chapter)}${buildingSigns(chapter,true)}<svg class="ridge-stairs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M84 27 Q88 23 81 20 Q72 18 62 17 L55 14"/></svg>${segment.map((mission, n) => { const index = n; const earned = progress.stars[index]; const open = unlockAll || index === 0 || progress.stars[index - 1] > 0; return `<button class="mission-node ${earned ? 'earned' : ''}" style="--x:${positions[n][0]}%;--y:${missionMapY(chapter, positions[n][1])}%" data-level="${index}" ${open ? '' : 'disabled'} aria-label="${t('Mission', 'Görev')} ${mission.id}: ${l(mission.names)} · ${earned}/3 ${t('stars','yıldız')}"><span class="node-orb">${open ? mission.id : '🔒'}</span><span class="node-stars" aria-hidden="true">${[1,2,3].map(s => `<i class="${s <= earned ? 'lit' : ''}">★</i>`).join('')}</span><span class="node-title">${l(mission.names)}</span></button>`; }).join('')}<p class="map-caption">${t('Pick a mission. Build a route. Make a discovery.', 'Bir görev seç. Bir rota oluştur. Yeni şeyler keşfet.')}</p></section></div><nav class="world-selector world-legend" aria-label="${t('Story regions', 'Hikâye bölgeleri')}">${WORLDS.slice(0, worldCount).map((w,i)=>`<div><span>${w.icon}</span><b>${i+1}</b> ${l(w.names)}<small>${i*5+1}–${i*5+5}</small></div>`).join('')}</nav><div class="map-bottom"><div class="star-progress"><strong>★ ${stars} / ${maxStars}</strong><progress max="${maxStars}" value="${stars}" aria-label="${t('Stars earned','Kazanılan yıldızlar')}"></progress><span>${[maxStars / 3, maxStars * 2 / 3, maxStars].map(n=>`<span class="star-milestone ${stars >= n ? 'achieved' : ''}">✦ ${n}</span>`).join('')}</span></div><p>${unlockAll ? t('All missions open · choose your own adventure', 'Tüm görevler açık · kendi maceranı seç') : t('Earn stars to continue your journey', 'Yolculuğa devam etmek için yıldız kazan')}</p></div>`;
  }
  return `<main class="adventure-shell adventure-${page}"><div class="adventure-top">${page === 'home' ? '' : '<button class="space-back" data-action="home">⌂ '+t('Main menu','Ana menü')+'</button>'}${controls}</div>${content}</main>`;
}


