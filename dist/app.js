import { icon } from './icons.js';
import { SoundEffects } from './sounds.js';
import { Factory3D } from './factory3d.js';
import { MOVE_MS, PRESS_MS, PRESS_LAND_MS, IMPACT_MS } from './robot-motion.js';
import { LEVELS, DIRECTIONS, MAX_BLOCKS, initialState, step, expandProgram, availableActions, normalizeProgress, isUnlocked, completeLevel } from './engine.js';

const app = document.querySelector('#app');
const read = (key,fallback) => { try {return JSON.parse(localStorage.getItem(key))??fallback;} catch {return fallback;} };
let storageAvailable=true;
const save = (key,value) => {try {localStorage.setItem(key,JSON.stringify(value));}catch {storageAvailable=false;} };
// Migrate the first preview's plain language preference without losing it.
let lang=read('kesfet-code-language',null);
if(!['en','tr'].includes(lang)){try{lang=localStorage.getItem('kesfet-language')==='tr'?'tr':'en';}catch{lang='en';}}
let theme=read('kesfet-code-theme','light');
if(!['light','dark'].includes(theme))theme='light';
let sound=read('kesfet-code-sound',true)!==false;
const audio=new SoundEffects({enabled:sound});
const factory=new Factory3D(status=>queueMicrotask(()=>{
  if(status==='unavailable'&&running){cancelRun();feedback='stopped';render();}
  updateRunAvailability();
}));
let progress=normalizeProgress(read('kesfet-code-progress',null));
let view='menu', levelIndex=0, program=[], state=initialState(LEVELS[0]);
let running=false, runId=0, activeBlock=-1, hintOpen=false, assisted=false, feedback='ready';
let dragSource=null, dialogReturnFocus=null;
const text=(en,tr)=>lang==='en'?en:tr;
const localized=pair=>pair[lang==='en'?0:1];
const level=()=>LEVELS[levelIndex];
const labels={up:['Up','Yukarı'],down:['Down','Aşağı'],left:['Left','Sola'],right:['Right','Sağa'],press:['Press button','Düğmeye bas'],repeat:['Repeat','Tekrarla']};
const disabled=()=>running?'disabled':'';
const actionLabel=action=>localized(labels[action]);
const completed=()=>progress.stars.filter(Boolean).length;
const resumeLevel=()=>Math.min(completed(),4);
const announce=message=>{document.querySelector('#live-status').textContent=message;};

function header(){return `<header class="site-header"><a class="brand" href="#" data-action="menu"><img src="/assets/kesfet-lab.png" alt="Keşfet Lab"><span><strong>Keṣfet <span>Code</span></strong><small>Made by Keşfet Lab</small></span></a><nav aria-label="${text('Main navigation','Ana menü')}"><button class="nav-link ${view==='menu'?'active':''}" data-action="menu">${icon('grid')}${text('Mission control','Görev merkezi')}</button><button class="nav-link" data-action="help">${icon('help')}${text('How to play','Nasıl oynanır')}</button></nav><div class="header-tools"><button class="icon-button" data-action="sound" aria-label="${text(sound?'Turn sound off':'Turn sound on',sound?'Sesi kapat':'Sesi aç')}" aria-pressed="${sound}">${icon(sound?'sound':'mute')}</button><button class="icon-button theme-toggle" data-action="theme" aria-label="${text(theme==='light'?'Switch to dark mode':'Switch to light mode',theme==='light'?'Koyu temaya geç':'Açık temaya geç')}">${icon(theme==='light'?'moon':'sun')}</button><div class="language-switch" aria-label="${text('Language','Dil')}"><button data-lang="en" class="${lang==='en'?'selected':''}" aria-pressed="${lang==='en'}">EN</button><button data-lang="tr" class="${lang==='tr'?'selected':''}" aria-pressed="${lang==='tr'}">TR</button></div></div></header>`;}


function footer(){return `<footer><span>${icon('code')} ${text('Experiment. Discover. Create.','Dene. Keşfet. Üret.')}</span><span>Made by <b>Keşfet Lab</b></span></footer>`;}
function sceneHTML(menu=false){return `<div class="scene-host ${menu?'lobby-scene':'game-scene'}" role="group" aria-label="${text(menu?'Your 3D robot in the factory':'3D factory puzzle',menu?'Fabrikadaki 3D robotun':'3D fabrika bulmacası')}"><div class="scene-loading" role="status"><span>${text('Getting your robot ready…','Robotun hazırlanıyor…')}</span><button class="secondary" data-action="retry-3d" hidden>${text('Try again','Yeniden dene')}</button></div></div>`;}
function cameraTools(){return `<div class="camera-tools" role="group" aria-label="${text('Camera controls','Kamera kontrolleri')}"><button class="icon-button" data-action="camera" aria-label="${text('Reset camera','Kamerayı sıfırla')}" title="${text('Reset camera','Kamerayı sıfırla')}">${icon('box')}</button><button class="icon-button" data-action="top-view" aria-label="${text('View from above','Üstten görünüm')}" title="${text('View from above','Üstten görünüm')}">${icon('grid')}</button><span></span><button class="icon-button zoom-control" data-action="zoom-in" aria-label="${text('Zoom in','Yakınlaştır')}">+</button><button class="icon-button zoom-control" data-action="zoom-out" aria-label="${text('Zoom out','Uzaklaştır')}">−</button></div>`;}

function renderMenu(){return `<main class="menu-page"><div class="menu-heading"><div><span class="eyebrow">${text('THE ROBOT FACTORY','ROBOT FABRİKASI')} <span class="edition-label">3D</span></span><h1>${text('A little code. <em>A big adventure.</em>','Biraz kod. <em>Büyük bir macera.</em>')}</h1></div><div class="progress-pill">${icon('battery')}<strong>${completed()}<span> / 5</span></strong><span>${text('batteries collected','pil toplandı')}</span></div></div><div class="menu-layout"><section class="mission-select" aria-labelledby="missions-heading"><div class="section-heading"><h2 id="missions-heading">${text('Choose your mission','Görevini seç')}</h2><span>01 — 05</span></div><div class="level-grid">${LEVELS.map((l,n)=>{const unlocked=isUnlocked(progress,n),stars=progress.stars[n];return `<button class="level-card ${unlocked?'available':'locked'} ${stars?'completed':''} ${n===resumeLevel()?'next-mission':''}" data-level="${n}" ${unlocked?'':'disabled'} aria-label="${text('Level','Bölüm')} ${n+1}: ${localized(l.names)}${unlocked?'':text(', locked',', kilitli')}"><span class="level-number">${stars?icon('check'):`0${n+1}`}</span><span class="level-copy"><span class="level-topic">${localized(l.topics)}</span><h3>${localized(l.names)}</h3><span class="card-stars">${stars?[1,2,3].map(s=>icon('star',stars>=s?'earned':'')).join(''):unlocked?text('Ready to explore','Keşfetmeye hazır'):text(`Finish mission ${n} to unlock`, `Açmak için ${n}. görevi tamamla`)}</span></span><span class="level-state">${unlocked?icon('arrow'):icon('lock')}</span></button>`;}).join('')}</div><p class="save-note">${icon('check')}${storageAvailable?text('Your progress is saved on this browser','İlerlemen bu tarayıcıda kaydedilir'):text('Keep this tab open to keep your progress','İlerlemeni korumak için bu sekmeyi açık tut')}</p></section><section class="lobby-panel"><div class="lobby-caption"><span class="scene-tag">${icon('battery')} ${text('READY TO POWER UP','ENERJİ TOPLAMAYA HAZIR')}</span><span class="tiny-label">KEṢFET LAB / 01</span></div>${sceneHTML(true)}<div class="lobby-bottom"><div><h2>${text('Meet your coding buddy','Kodlama arkadaşınla tanış')}</h2><p>${text('Build a plan. Collect the batteries. Bring the factory to life.','Bir plan yap. Pilleri topla. Fabrikayı canlandır.')}</p></div><button class="primary big" data-level="${resumeLevel()}">${icon('play')}${completed()?text('Continue','Devam et'):text('Let’s play','Haydi oyna')}${icon('arrow')}</button></div><div class="lobby-tools"><button class="text-button" data-action="menu-demo">${icon('play')}${text('Watch a demo','Demoyu izle')}</button><span>${text('Drag to look around','Etrafa bakmak için sürükle')}</span><button class="icon-button" data-action="camera" aria-label="${text('Reset camera','Kamerayı sıfırla')}">${icon('reset')}</button></div></section></div>${footer()}</main>`;}

function toolbox(){return `<aside class="toolbox panel"><div class="panel-title"><span class="step-badge">1</span><h2>${text('Your blocks','Blokların')}</h2></div><p class="panel-description">${text('Click or drag a block to add it','Eklemek için tıkla veya sürükle')}</p><div class="block-palette">${availableActions(level()).map(type=>`<button class="code-block palette-block ${type}" draggable="${!running}" data-add="${type}" ${disabled()} aria-label="${text('Add','Ekle:')} ${actionLabel(type)}">${icon(type)}<span>${type==='repeat'?text('Repeat 3 times','3 kez tekrarla'):actionLabel(type)}</span><span class="block-plus">+</span></button>`).join('')}</div><div class="toolbox-note">${icon('code')}<p>${levelIndex===4?text('One repeat block = three steps in the same direction','Bir tekrar bloğu = aynı yönde üç adım'):text('Each arrow moves your robot one square','Her ok robotunu bir kare ilerletir')}</p></div></aside>`;}
function renderProgram(){return `<div class="start-block">${icon('play')}${text('When Run is pressed','Çalıştır’a basıldığında')}</div><ol class="program-list" aria-label="${text('Your program','Programın')}">${program.map((block,index)=>`<li class="program-item ${index===activeBlock?'executing':''}" draggable="${!running}" data-index="${index}"><span class="block-number">${index+1}</span><div class="code-block ${block.type}">${icon(block.type)}${block.type==='repeat'?`<span class="repeat-label">${text('Repeat','Tekrarla')} <b>3×</b></span><select data-direction="${index}" aria-label="${text('Repeat direction for block','Blok için tekrar yönü')} ${index+1}" ${disabled()}>${DIRECTIONS.map(d=>`<option value="${d}" ${block.direction===d?'selected':''}>${actionLabel(d)}</option>`).join('')}</select>`:`<span>${actionLabel(block.type)}</span>`}</div><div class="block-tools"><button data-reorder="${index}:up" class="mini-button" aria-label="${text('Move block','Bloğu yukarı taşı')} ${index+1}${text(' up','')}" ${running||index===0?'disabled':''}>${icon('up')}</button><button data-reorder="${index}:down" class="mini-button" aria-label="${text('Move block','Bloğu aşağı taşı')} ${index+1}${text(' down','')}" ${running||index===program.length-1?'disabled':''}>${icon('down')}</button><button data-remove="${index}" class="mini-button remove-block" aria-label="${text('Remove block','Bloğu sil')} ${index+1}" ${disabled()}>${icon('close')}</button></div></li>`).join('')}</ol>${!program.length?`<div class="empty-program">${icon('code')}<strong>${text('Your idea starts here','Fikrin burada başlıyor')}</strong><span>${text('Add a few blocks, then press Run','Birkaç blok ekle, sonra Çalıştır’a bas')}</span></div>`:''}<div class="drop-target">+ ${text('Add your next step','Sonraki adımı ekle')}</div>`;}
function workspace(){return `<section class="workspace panel"><div class="panel-title"><span class="step-badge">2</span><h2>${text('Build your code','Kodunu oluştur')}</h2><button class="icon-button clear-button" data-action="clear" aria-label="${text('Clear all blocks','Tüm blokları temizle')}" ${!program.length||running?'disabled':''}>${icon('trash')}</button></div><div class="program-scroll" id="program-area">${renderProgram()}</div><div class="workspace-bottom"><span id="block-count">${program.length} / ${MAX_BLOCKS} ${text('blocks','blok')}</span><span>${text('Goal','Hedef')}: ${level().target} ${text('blocks','blok')}</span></div><button class="primary run-button" data-action="${running?'stop':'run'}" ${!program.length&&!running?'disabled':''}>${icon(running?'pause':'play')}${running?text('Stop','Durdur'):text('Run code','Kodu çalıştır')}</button></section>`;}
function boardHTML(){return `<div class="scene-wrap">${sceneHTML()}<div class="scene-topline"><span class="scene-tag">${text('FACTORY','FABRİKA')} / 0${levelIndex+1}</span><span class="scene-tag">${icon('battery')} 0${state.won?1:0} / 01</span></div><div class="scene-bottomline"><span>${text('Drag to look around','Etrafa bakmak için sürükle')}</span>${cameraTools()}</div></div>`;}

const feedbackText=()=>({ready:text('Ready, robot? Let’s build a plan','Hazır mısın robot? Bir plan yapalım'),running:text('Following your instructions…','Komutların uygulanıyor…'),stopped:text('Paused — press Run to start from the beginning','Durduruldu — baştan başlamak için Çalıştır’a bas'),wall:text('A machine is in the way — try a different direction','Yolda bir makine var — başka bir yön dene'),door:text('The door is locked — press the floor button first','Kapı kilitli — önce yerdeki düğmeye bas'),switch:text('Move onto the orange switch before pressing the button','Düğmeye basmadan önce turuncu düğmenin üzerine git'),incomplete:text('Almost there — add more blocks to reach the battery','Az kaldı — pile ulaşmak için daha fazla blok ekle'),success:text('Battery collected — fantastic coding','Pil toplandı — harika kodlama'),demo:text('Watch the example, then try it yourself','Örneği izle, sonra kendin dene'),limit:text('Your program is full — remove a block to add another','Programın dolu — eklemek için bir blok sil'),invalid:text('Try changing that block and run again','Bu bloğu değiştirip tekrar çalıştır')}[feedback]||'');
function renderGame(){return `<main class="game-page"><div class="game-heading"><button class="back-button" data-action="menu">${icon('left')}${text('All missions','Tüm görevler')}</button><div class="level-tracker" aria-label="${text('Level progress','Bölüm ilerlemesi')}">${LEVELS.map((l,n)=>`<button class="tracker-dot ${n===levelIndex?'current':''} ${progress.stars[n]?'done':''}" data-level="${n}" ${!isUnlocked(progress,n)?'disabled':''} aria-label="${text('Level','Bölüm')} ${n+1}" ${n===levelIndex?'aria-current="step"':''}>${progress.stars[n]?icon('check'):n+1}</button>`).join('')}</div><span class="game-edition">${text('ROBOT FACTORY','ROBOT FABRİKASI')} <b>3D</b></span></div><div class="mission-heading"><div><span class="eyebrow">${text('MISSION','GÖREV')} 0${levelIndex+1}<i>/</i>${localized(level().topics)}</span><h1>${localized(level().names)}</h1></div><p>${localized(level().objective)}</p></div><div class="game-layout">${toolbox()}${workspace()}<section class="stage panel"><div class="panel-title"><span class="step-badge">3</span><h2>${text('Bring it to life','Hayata geçir')}</h2><button class="icon-button" data-action="reset" aria-label="${text('Reset robot','Robotu başa al')}">${icon('reset')}</button></div>${boardHTML()}<div class="stage-bottom"><div class="board-legend"><span>${icon('battery')}${text('Collect','Topla')}</span>${levelIndex>=3?`<span>${icon('press')}${text('Activate','Etkinleştir')}</span><span>${icon('door')}${text('Unlock','Kilidi aç')}</span>`:`<span>${icon('box')}${text('Avoid','Kaçın')}</span>`}</div><p class="robot-feedback" id="robot-feedback" role="status">${feedbackText()}</p></div></section></div><div class="hint-bar"><button class="text-button" data-action="hint" aria-expanded="${hintOpen}">${icon('help')}${text('Need a little help?','Biraz yardım ister misin?')}</button><span>${text('Every great idea starts with a little experimenting','Her harika fikir biraz denemeyle başlar')}</span></div><div class="hint-content" ${hintOpen?'':'hidden'}><p>${localized(level().hint)}</p><button class="secondary" data-action="demo" ${disabled()}>${icon('play')}${text('Show me','Bana göster')}</button></div>${footer()}</main>`;}

function render(){
  document.documentElement.lang=lang;document.documentElement.dataset.theme=theme;
  // Reparent the same canvas so editing a block never reloads the model or GPU.
  factory.renderer?.domElement.remove();
  app.innerHTML=header()+(view==='menu'?renderMenu():renderGame());
  factory.attach(document.querySelector('.scene-host'),{mode:view,level:level(),state,theme,lang});
  if(view==='game')updateBoard();
  updateRunAvailability();
}
function updateRunAvailability(){
  const ready=factory.status==='ready';
  document.querySelectorAll('[data-action="run"]').forEach(button=>button.disabled=!ready||!program.length);
  document.querySelectorAll('[data-action="demo"],[data-action="menu-demo"]').forEach(button=>button.disabled=!ready||running);
}
function updateBoard(animate=false,direction){
  const board=document.querySelector('.game-scene');if(!board)return;
  factory.setState(state,animate,direction);
  board.setAttribute('aria-label',text(`3D factory. Robot at row ${state.row+1}, column ${state.col+1}; ${state.doorOpen?'door open':'door closed'}${state.won?'; battery collected':''}`,`3D fabrika. Robot ${state.row+1}. satır, ${state.col+1}. sütunda; kapı ${state.doorOpen?'açık':'kapalı'}${state.won?'; pil toplandı':''}`));
  document.querySelectorAll('.program-item').forEach(el=>el.classList.toggle('executing',Number(el.dataset.index)===activeBlock));
  const message=document.querySelector('#robot-feedback');message.textContent=feedbackText();message.classList.toggle('error',!!state.error||feedback==='incomplete');
}
function cancelRun(){runId++;running=false;activeBlock=-1;audio.cancel();}
function openLevel(index){if(!isUnlocked(progress,index))return;cancelRun();closeDialog();view='game';levelIndex=index;program=[];state=initialState(level());hintOpen=false;assisted=false;feedback='ready';render();window.scrollTo({top:0,behavior:'instant'});}
function openMenu(){cancelRun();closeDialog();view='menu';render();window.scrollTo({top:0,behavior:'instant'});}
function resetRobot(){cancelRun();state=initialState(level());feedback='ready';render();audio.play('reset');}
function editProgram(){assisted=false;state=initialState(level());feedback='ready';activeBlock=-1;render();audio.play('block');}
function addBlock(type){if(running||!availableActions(level()).includes(type))return;if(program.length>=MAX_BLOCKS){feedback='limit';updateBoard();return;}program.push(type==='repeat'?{type,direction:'up',count:3}:{type});editProgram();document.querySelector('.program-scroll').scrollTop=100000;}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runProgram(demo=false){
  if(running||!program.length||factory.status!=='ready')return;
  let instructions;try{instructions=expandProgram(level(),program);}catch{feedback='invalid';updateBoard();return;}
  const id=++runId;running=true;state=initialState(level());activeBlock=-1;feedback=demo?'demo':'running';render();audio.play('run');
  await delay(400);
  for(const action of instructions){
    if(id!==runId)return;
    activeBlock=action.index;updateBoard();
    const current=document.querySelector('.program-item.executing');
    if(current){const container=document.querySelector('.program-scroll');if(current.offsetTop<container.scrollTop||current.offsetTop+current.offsetHeight>container.scrollTop+container.clientHeight)container.scrollTo({top:current.offsetTop-60,behavior:'smooth'});}
    await delay(160);if(id!==runId)return;
    state=step(level(),state,action.type);if(state.error)feedback=state.error;
    updateBoard(true,action.type);
    if(state.error)audio.play(state.error==='wall'||state.error==='door'?'bump':'error');
    else if(action.type==='press'){
      audio.play('jump');
      await delay(PRESS_LAND_MS);if(id!==runId)return;
      audio.play('press');
    }
    else {audio.play('move');if(state.won)audio.play('collect');}
    await delay(state.error?IMPACT_MS:action.type==='press'?PRESS_MS-PRESS_LAND_MS:state.won?2300:MOVE_MS+30);if(id!==runId)return;
    if(state.error||state.won)break;
  }
  running=false;activeBlock=-1;
  if(state.won){
    feedback='success';const score=assisted?1:program.length<=level().target?3:2;
    progress=completeLevel(progress,levelIndex,score);save('kesfet-code-progress',progress);render();audio.play(levelIndex===4?'complete':'success');showSuccess(score);
  }else{if(!state.error)feedback='incomplete';render();announce(feedbackText());}
}
function runDemo(){if(running)return;assisted=true;program=level().solution.map(b=>({...b}));hintOpen=false;runProgram(true);}
function closeDialog(){const dialog=document.querySelector('dialog');if(dialog){dialog.close();dialog.remove();}if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus();dialogReturnFocus=null;}
function showDialog(content){closeDialog();dialogReturnFocus=document.activeElement;const dialog=document.createElement('dialog');dialog.className='game-dialog';dialog.innerHTML=content;const heading=dialog.querySelector('h2');if(heading){heading.id='dialog-title';dialog.setAttribute('aria-labelledby','dialog-title');}document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();const action=e.target.closest('[data-dialog]')?.dataset.dialog;if(action==='close')closeDialog();if(action==='next')openLevel(levelIndex+1);if(action==='menu')openMenu();if(action==='again'){closeDialog();assisted=false;resetRobot();}});dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});dialog.showModal();}
function showSuccess(score){showDialog(`<div class="success-art">${icon('battery')}<span>✦</span><span>✧</span></div><div class="success-stars">${[1,2,3].map(n=>icon('star',n<=score?'earned':'')).join('')}</div><span class="eyebrow">${text('MISSION COMPLETE','GÖREV TAMAMLANDI')}</span><h2>${levelIndex===4?text('You powered the factory','Fabrikaya enerji verdin'):text('Brilliant work, builder','Harika iş, küçük mucit')}</h2><p>${levelIndex===4?text('All five batteries collected — you’re a coding explorer','Beş pil de toplandı — artık bir kodlama kâşifisin'):text(`Battery ${levelIndex+1} collected — level ${levelIndex+2} is now unlocked`,`${levelIndex+1}. pil toplandı — ${levelIndex+2}. bölüm açıldı`)}</p>${assisted?`<p class="score-tip">${text('Now try your own code to earn more stars','Şimdi daha fazla yıldız için kendi kodunu dene')}</p>`:''}<button class="primary dialog-primary" data-dialog="${levelIndex===4?'menu':'next'}">${levelIndex===4?text('Back to the factory','Fabrikaya dön'):text('Next level','Sonraki bölüm')}${icon('arrow')}</button><div class="dialog-actions"><button class="text-button" data-dialog="again">${text('Try again','Yeniden dene')}</button><button class="text-button" data-dialog="menu">${text('All levels','Tüm bölümler')}</button></div>`);}
function showHelp(){if(running){cancelRun();feedback='stopped';render();}showDialog(`<button class="dialog-close icon-button" data-dialog="close" aria-label="${text('Close','Kapat')}">${icon('close')}</button><span class="eyebrow">KEṢFET CODE</span><h2>${text('Little blocks, big adventures','Küçük bloklar, büyük maceralar')}</h2><div class="help-step"><span class="step-badge">1</span><div><h3>${text('Build a plan','Bir plan yap')}</h3><p>${text('Click or drag arrow blocks into your code — each one moves the robot one square','Ok bloklarını koduna eklemek için tıkla veya sürükle — her biri robotu bir kare ilerletir')}</p></div></div><div class="help-step"><span class="step-badge">2</span><div><h3>${text('Watch it work','Çalışmasını izle')}</h3><p>${text('Press Run to follow your code from top to bottom and collect the battery','Kodunu yukarıdan aşağıya uygulamak ve pili toplamak için Çalıştır’a bas')}</p></div></div><div class="help-step"><span class="step-badge">3</span><div><h3>${text('Try, change, discover','Dene, değiştir, keşfet')}</h3><p>${text('Stuck? Reorder or remove a block and try again — every run is a fresh start','Takıldın mı? Bir bloğun yerini değiştir veya sil, yeniden dene — her çalıştırma yeni bir başlangıç')}</p></div></div><div class="help-note">${icon('star')}${text('Earn 3 stars by reaching the battery within the block goal; 2 with extra blocks; 1 for a demo','Blok hedefi içinde pile ulaşarak 3, daha fazla blokla 2, demoyla 1 yıldız kazan')}</div><button class="primary dialog-primary" data-dialog="close">${text('Let’s build','Haydi kodlayalım')}${icon('arrow')}</button>`);}

app.addEventListener('click',e=>{
  const target=e.target.closest('button,a');if(!target||target.disabled)return;
  if(target.hasAttribute('data-lang')){lang=target.dataset.lang;save('kesfet-code-language',lang);render();return;}
  if(target.hasAttribute('data-level')){e.preventDefault();openLevel(Number(target.dataset.level));return;}
  if(target.hasAttribute('data-add')){addBlock(target.dataset.add);return;}
  if(target.hasAttribute('data-remove')&&!running){program.splice(Number(target.dataset.remove),1);editProgram();return;}
  if(target.hasAttribute('data-reorder')&&!running){const [index,direction]=target.dataset.reorder.split(':');const from=Number(index),to=from+(direction==='up'?-1:1);if(to>=0&&to<program.length){[program[from],program[to]]=[program[to],program[from]];editProgram();}return;}
  switch(target.dataset.action){
    case'menu':e.preventDefault();openMenu();break;
    case'theme':theme=theme==='light'?'dark':'light';save('kesfet-code-theme',theme);render();break;
    case'help':showHelp();break;
    case'sound':sound=!sound;audio.setEnabled(sound);save('kesfet-code-sound',sound);render();audio.play('on');break;
    case'run':runProgram();break;
    case'stop':cancelRun();feedback='stopped';render();break;
    case'reset':resetRobot();break;
    case'clear':if(!running){program=[];assisted=false;editProgram();}break;
    case'hint':hintOpen=!hintOpen;render();break;
    case'demo':runDemo();break;
    case'menu-demo':openLevel(0);runDemo();break;
    case'camera':factory.camera.zoom=1;factory.resetCamera();factory.resize();break;
    case'top-view':factory.resetCamera(true);break;
    case'zoom-in':factory.zoom(.15);break;
    case'zoom-out':factory.zoom(-.15);break;
    case'retry-3d':factory.retry();break;
  }
});
app.addEventListener('change',e=>{if(e.target.matches('[data-direction]')&&!running){const block=program[Number(e.target.dataset.direction)];if(block?.type==='repeat'&&DIRECTIONS.includes(e.target.value)){block.direction=e.target.value;editProgram();}}});
app.addEventListener('dragstart',e=>{if(running){e.preventDefault();return;}const item=e.target.closest('[data-add],[data-index]');if(!item)return;dragSource=item.hasAttribute('data-add')?{type:item.dataset.add}:{index:Number(item.dataset.index)};e.dataTransfer.setData('text/plain','kesfet-code-block');e.dataTransfer.effectAllowed=dragSource.type?'copy':'move';});
app.addEventListener('dragover',e=>{if(dragSource&&e.target.closest('#program-area')&&!running){e.preventDefault();e.dataTransfer.dropEffect=dragSource.type?'copy':'move';document.querySelector('#program-area').classList.add('drag-over');}});
app.addEventListener('drop',e=>{if(!dragSource||running||!e.target.closest('#program-area'))return;e.preventDefault();const source=dragSource;dragSource=null;const item=e.target.closest('[data-index]');let to=item?Number(item.dataset.index):program.length;if(source.type){if(program.length<MAX_BLOCKS){const block=source.type==='repeat'?{type:'repeat',direction:'up',count:3}:{type:source.type};program.splice(to,0,block);editProgram();}}else{const [block]=program.splice(source.index,1);if(source.index<to)to--;program.splice(to,0,block);editProgram();}});
app.addEventListener('dragend',()=>{dragSource=null;document.querySelector('#program-area')?.classList.remove('drag-over');});
document.addEventListener('keydown',e=>{if(view!=='game'||running||document.querySelector('dialog[open]')||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('select,input,textarea,button,a'))return;const type={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(type){e.preventDefault();addBlock(type);}if(e.code==='Space'){e.preventDefault();runProgram();}});
window.addEventListener('storage',e=>{if(e.key==='kesfet-code-progress'){progress=normalizeProgress(read(e.key,null));if(view==='menu')render();}});
render();
