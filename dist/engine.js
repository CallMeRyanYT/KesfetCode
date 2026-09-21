export const DIRECTIONS = ['up', 'down', 'left', 'right'];
export const MAX_BLOCKS = 24;
const moves = { up: [-1,0], down: [1,0], left: [0,-1], right: [0,1] };
const move = type => ({type});
export const LEVELS = [
  {id:1, names:['First charge','İlk enerji'], topics:['MOVEMENT','HAREKET'], grid:['#####','#####','S..B#','#####','#####'], target:3,
   objective:['Help your robot reach its first battery','Robotunu ilk piline ulaştır'], hint:['Add three Right blocks, then press Run','Üç Sağa bloğu ekle, sonra Çalıştır’a bas'], solution:['right','right','right'].map(move)},
  {id:2, names:['Around the corner','Köşeyi dön'], topics:['DIRECTIONS','YÖNLER'], grid:['##B##','##.##','S..##','#####','#####'], target:4,
   objective:['Turn the corner and collect the battery','Köşeyi dön ve pili topla'], hint:['Go right twice, then up twice','İki kez sağa, sonra iki kez yukarı git'], solution:['right','right','up','up'].map(move)},
  {id:3, names:['Factory explorer','Fabrika kâşifi'], topics:['PLANNING','PLANLAMA'], grid:['S...#','###.#','##..#','##.##','##..B'], target:10,
   objective:['Find a safe route around the factory machines','Fabrika makinelerinin etrafında güvenli bir yol bul'], hint:['Right ×3, down ×2, left, down ×2, right ×2','Sağa ×3, aşağı ×2, sola, aşağı ×2, sağa ×2'], solution:['right','right','right','down','down','left','down','down','right','right'].map(move)},
  {id:4, names:['Open the gate','Kapıyı aç'], topics:['SWITCHES','DÜĞMELER'], grid:['#####','X.D.B','.####','.####','S####'], target:8,
   objective:['Stand on the switch and press it to open the door','Düğmenin üzerine git ve kapıyı açmak için düğmeye bas'], hint:['Up ×3, Press button, then right ×4','Yukarı ×3, Düğmeye bas, sonra sağa ×4'], solution:['up','up','up','press','right','right','right','right'].map(move)},
  {id:5, names:['Work smarter','Akıllı çözüm'], topics:['REPEATS','TEKRAR'], grid:['#####','X.D.#','.##.#','.##.#','S##.B'], target:5,
   objective:['Use repeat blocks to give the factory its final battery','Tekrar bloklarıyla fabrikaya son pilini ulaştır'], hint:['Repeat up ×3, press, repeat right ×3, repeat down ×3, then right','Yukarı ×3 tekrarla, bas, sağa ×3 tekrarla, aşağı ×3 tekrarla, sonra sağa'], solution:[{type:'repeat',direction:'up',count:3},{type:'press'},{type:'repeat',direction:'right',count:3},{type:'repeat',direction:'down',count:3},{type:'right'}]}
];
export function initialState(level){
  for(let row=0;row<level.grid.length;row++){
    const col=level.grid[row].indexOf('S');
    if(col!==-1)return {row,col,doorOpen:false,won:false,error:null,steps:0};
  }
  throw new Error('Missing robot start');
}
export function availableActions(level){return [...DIRECTIONS,...(level.id>=4?['press']:[]),...(level.id>=5?['repeat']:[])];}
export function expandProgram(level,program){
  if(!Array.isArray(program)||program.length>MAX_BLOCKS)throw new Error('invalid-program');
  return Array.from(program).flatMap((block,index)=>{
    if(!block||!availableActions(level).includes(block.type))throw new Error('invalid-block');
    if(block.type==='repeat'){
      if(!DIRECTIONS.includes(block.direction)||block.count!==3)throw new Error('invalid-repeat');
      return Array.from({length:3},()=>({type:block.direction,index}));
    }
    return [{type:block.type,index}];
  });
}
export function step(level,state,action){
  if(state.won||state.error)return state;
  const next={...state,steps:state.steps+1};
  if(action==='press'){
    if(level.grid[state.row][state.col]!=='X')return {...next,error:'switch'};
    return {...next,doorOpen:true};
  }
  if(!DIRECTIONS.includes(action))return {...next,error:'invalid'};
  const [dr,dc]=moves[action];const row=state.row+dr,col=state.col+dc;
  const tile=level.grid[row]?.[col];
  if(!tile||tile==='#')return {...next,error:'wall'};
  if(tile==='D'&&!state.doorOpen)return {...next,error:'door'};
  return {...next,row,col,won:tile==='B'};
}
export function simulate(level,program){
  let state=initialState(level);
  for(const action of expandProgram(level,program)){
    state=step(level,state,action.type);
    if(state.won||state.error)break;
  }
  return state;
}
export function normalizeProgress(input){
  const result={stars:[0,0,0,0,0]};
  if(!input||!Array.isArray(input.stars))return result;
  // Unlocks are always contiguous, including when old or damaged data is loaded.
  for(let i=0;i<5;i++){
    const value=input.stars[i];
    if(!Number.isInteger(value)||value<1||value>3)break;
    result.stars[i]=value;
  }
  return result;
}
export function isUnlocked(progress,index){return Number.isInteger(index)&&index>=0&&index<5&&(index===0||progress.stars[index-1]>0);}
export function completeLevel(progress,index,score){
  const result=normalizeProgress(progress);
  if(isUnlocked(result,index))result.stars[index]=Math.max(result.stars[index],Math.max(1,Math.min(3,Math.floor(score)||1)));
  return result;
}
