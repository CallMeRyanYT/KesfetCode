/** Animates pixels of the illustrations, not stand-in 3D characters or dotted lines. */
const cache = new Map();
function load(src) {
  if (!cache.has(src)) cache.set(src, new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;}));
  return cache.get(src);
}
// Trace the actual forearm and four fingers. The upper arm stays attached to
// the body; a rigid rotation at the elbow cannot stretch the painted armor.
const FOREARM = 'M311 682 L339 636 Q345 622 352 626 L355 626 Q352 620 352 611 '
  + 'Q345 603 345 593 Q345 585 352 585 Q360 585 365 600 L369 601 '
  + 'L376 572 Q378 563 385 564 Q395 565 393 574 L389 595 L393 599 '
  + 'L400 578 Q404 568 411 572 Q420 575 416 583 L407 604 L411 608 '
  + 'L417 595 Q422 588 428 593 Q433 597 427 605 L416 621 '
  + 'Q410 636 391 646 L387 657 Q366 692 344 705 '
  + 'Q330 718 318 707 Q311 700 311 682 Z';

function wavingArm(image, plate) {
  const path = new Path2D(FOREARM);
  const arm = document.createElement('canvas'); arm.width=image.width; arm.height=image.height;
  const a=arm.getContext('2d'); a.save(); a.clip(path); a.drawImage(image,0,0); a.restore();
  // Erase a padded footprint, including the old antialiased silhouette. The
  // former exact clip left stationary slivers behind the moving fingers.
  const base=document.createElement('canvas'); base.width=image.width; base.height=image.height;
  const b=base.getContext('2d'); b.fillStyle='#fff'; b.strokeStyle='#fff'; b.lineWidth=7; b.lineJoin='round';
  b.fill(path); b.stroke(path); b.globalCompositeOperation='source-in'; b.drawImage(plate,0,0);
  b.globalCompositeOperation='destination-over'; b.drawImage(image,0,0); b.globalCompositeOperation='source-over';
  return {arm,base};
}
function polygon(ctx,points) {ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
function chapterSprite(source, chapter) {
  const sprite=document.createElement('canvas');sprite.width=512;sprite.height=1024;
  sprite.getContext('2d').drawImage(source,chapter*512,0,512,1024,0,0,512,1024);
  return sprite;
}
function satelliteLayer(img,chapter) {
  const layer=document.createElement('canvas');layer.width=512;layer.height=1024;
  const c=layer.getContext('2d');
  // Bowls and feed arms are rigid sprites; their support posts remain stationary.
  const path=new Path2D(chapter===1
    ? 'M358 237 Q381 223 421 248 L427 262 Q450 285 442 304 Q430 322 397 304 Q370 285 358 256 Z'
    : 'M365 328 Q392 310 426 340 L435 347 Q451 369 437 380 Q413 393 388 377 Q371 363 365 341 Z');
  c.clip(path);c.drawImage(img,0,0);
  return layer;
}
// Broad water regions are intersected with a pixel-color mask, keeping trees/bridges dry.
const WATER = [
  {p:[[14,9],[20,9],[20,22],[16,22],[14,16]],fall:true},
  {p:[[24,32],[38,33],[45,34],[43,36],[31,35],[24,34]],fall:false},
  {p:[[51,34],[63,35],[70,38],[72,44],[69,48],[64,45],[64,39],[54,37]],fall:true},
  {p:[[69,49],[79,49],[80,57],[74,61],[68,58]],fall:true},
  {p:[[43,58],[58,58],[72,63],[83,66],[86,70],[78,71],[66,65],[51,62]],fall:false},
  {p:[[85,72],[92,73],[97,84],[95,88],[90,85],[87,79]],fall:true}
];
function waterPatch(image,region) {
  const xs=region.p.map(p=>p[0]*image.width/100),ys=region.p.map(p=>p[1]*image.height/100);
  const x=Math.floor(Math.min(...xs)),y=Math.floor(Math.min(...ys)),w=Math.ceil(Math.max(...xs)-x),h=Math.ceil(Math.max(...ys)-y);
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d',{willReadFrequently:true});
  m.drawImage(image,x,y,w,h,0,0,w,h);const pixels=m.getImageData(0,0,w,h);
  for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];const aqua=b>r*1.1&&g>r*1.08&&b>105;const foam=r>190&&g>205&&b>210;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=aqua||foam?235:0;}
  m.putImageData(pixels,0,0);m.globalCompositeOperation='destination-in';polygon(m,region.p.map(([a,b])=>[a*image.width/100-x,b*image.height/100-y]));m.fill();
  const layer=document.createElement('canvas');layer.width=w;layer.height=h;
  return {...region,x,y,w,h,mask,layer,ctx:layer.getContext('2d')};
}
export function mountIllustrations(root) {
  let stopped=false,frame=0,last=0,time=0;
  const entries=[];
  for(const canvas of root.querySelectorAll('canvas[data-illustration]')) {
    const home=canvas.dataset.illustration==='robot',chapter=canvas.dataset.illustration==='chapter'?Number(canvas.dataset.chapter):null;
    const src=home?'/assets/spaceport-menu.png':canvas.dataset.src;
    Promise.all([load(src),home?load('/assets/spaceport-arm-plate.png'):chapter>0?load('/assets/chapter-dish-plate.png'):Promise.resolve(null)]).then(([img,plate])=>{
      if(stopped)return;
      if(chapter!==null){img=chapterSprite(img,chapter);if(plate)plate=chapterSprite(plate,chapter);}
      canvas.width=img.width;canvas.height=img.height;
      const entry={canvas,ctx:canvas.getContext('2d'),img,plate,home,chapter};
      if(home)Object.assign(entry,wavingArm(img,plate));
      else if(chapter>0)entry.dish=satelliteLayer(img,chapter);
      else if(chapter===0)entry.patches=[{p:[[50,42],[73,44],[75,50],[74,78],[59,80],[57,51],[47,48]],fall:true},{p:[[15,47],[25,47],[24,68],[18,67]],fall:true}].map(p=>waterPatch(img,p));
      else entry.patches=WATER.map(p=>waterPatch(img,p));
      entries.push(entry);canvas.dataset.ready='true';
    }).catch(()=>{canvas.hidden=true;});
  }
  function tick(now){
    if(stopped)return;frame=requestAnimationFrame(tick);if(now-last<40||document.hidden)return;
    const dt=Math.min(60,now-last);last=now;
    const enabled=document.documentElement.dataset.sceneryMotion!=='off';if(enabled)time+=dt/1000;
    for(const e of entries){
      const {ctx:c,canvas,img}=e;c.clearRect(0,0,canvas.width,canvas.height);
      if(e.home){
        c.drawImage(img,0,0);
        if(enabled){
          c.drawImage(e.base,0,0);
          const angle=Math.sin(time*2.8)*.13;
          c.save();c.translate(327,697);c.rotate(angle);c.translate(-327,-697);c.drawImage(e.arm,0,0);c.restore();
          // Original circular elbow cap covers the seam in both directions.
          c.save();c.beginPath();c.arc(327,697,11,0,Math.PI*2);c.clip();c.drawImage(img,0,0);c.restore();
          canvas.dataset.armAngle=angle.toFixed(3);
        }
      }else if(e.chapter>0){
        c.drawImage(enabled?e.plate:img,0,0);
        if(enabled){const pivot=e.chapter===1?[380,304]:[393,376],angle=Math.sin(time*.8+e.chapter)*.12;
          c.save();c.translate(...pivot);c.rotate(angle);c.translate(-pivot[0],-pivot[1]);
          c.beginPath();c.moveTo(...pivot);c.lineTo(pivot[0]+16,pivot[1]-9);c.strokeStyle=e.chapter===1?'#665453':'#444c70';c.lineWidth=8;c.lineCap='round';c.stroke();
          c.drawImage(e.dish,0,0);c.restore();canvas.dataset.dishAngle=angle.toFixed(3);
        }
      }else if(enabled){
        if(e.chapter===0)c.drawImage(img,0,0);
        for(const p of e.patches){
          const a=p.ctx;a.clearRect(0,0,p.w,p.h);a.globalCompositeOperation='source-over';
          // Advect the original foam texture downward, crossfading two wrapped phases.
          for(let pass=0;pass<2;pass++){
            const phase=(time*(p.fall?.65:.28)+pass*.5)%1; a.globalAlpha=1-Math.abs(phase*2-1);
            const travel=phase*(p.fall?24:9);
            for(let row=0;row<p.h;row+=3){
              const sy=Math.max(0,Math.min(p.h-3,row-travel));
              const ripple=Math.sin(row*.13-time*3)* (p.fall?1.3:2.8);
              a.drawImage(img,p.x,p.y+sy,p.w,3,ripple,row,p.w,3);
            }
          }
          a.globalAlpha=1;a.globalCompositeOperation='destination-in';a.drawImage(p.mask,0,0);a.globalCompositeOperation='source-over';c.drawImage(p.layer,p.x,p.y);
        }
        canvas.dataset.flowTime=time.toFixed(2);
      }else if(e.chapter===0)c.drawImage(img,0,0);
    }
  }
  frame=requestAnimationFrame(tick);
  return ()=>{stopped=true;cancelAnimationFrame(frame);};
}
