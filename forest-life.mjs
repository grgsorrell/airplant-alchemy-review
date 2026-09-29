// Driven by the existing 27fps forest renderer. No extra frame loop, timer or asset downloads.
const forest=document.querySelector('#forest');
const body=document.body;
const loadCover=document.querySelector('#load-cover');
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
const layers=['left','right'].map(side=>{
  const layer=document.createElement('div');layer.className='forest-breeze forest-breeze-'+side;
  layer.setAttribute('aria-hidden','true');forest.append(layer);return layer;
});
const visitor=document.createElement('div');visitor.id='forest-visitor';visitor.setAttribute('aria-hidden','true');
// A distant, hunched outline with a low head, long arms and broad feet. No face or eye lights.
visitor.innerHTML=`<svg class="forest-visitor-world" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
 <defs>
  <clipPath id="forest-trunk-edge"><path d="M855 328H983L976 348 965 367 941 385 929 402H855Z"/></clipPath>
  <linearGradient id="forest-ground-fade" x1="0" y1="383" x2="0" y2="397" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
  <mask id="forest-ground-cover" maskUnits="userSpaceOnUse" x="855" y="328" width="145" height="80"><path fill="url(#forest-ground-fade)" d="M855 328H1000V397L970 396 962 391 954 395 945 390 938 394 929 397 921 391 911 397 902 393 892 397 879 394 867 398 855 397Z"/></mask>
 </defs>
 <rect id="forest-visitor-zone" x="900" y="348" width="98" height="57" fill="none"/>
 <g clip-path="url(#forest-trunk-edge)" mask="url(#forest-ground-cover)"><g class="forest-visitor-figure">
 <g data-limb="back-arm"><path d="M43 42 Q25 47 22 69 L14 102 Q12 111 21 113 L28 102 36 79 53 62Z"/></g>
 <g data-limb="back-leg"><path d="M42 98 Q35 116 40 132 L35 148 22 153 Q17 158 27 160 L46 159 52 139 58 113Z"/></g>
 <path d="M28 87 27 74 29 59 Q30 41 45 34 L49 25 Q48 14 59 11 Q69 8 74 19 L75 27 82 33 77 38 69 39 73 51 78 57 76 61 79 70 74 74 74 89 68 106 59 112 40 107 33 101 34 95Z"/>
 <g data-limb="front-leg"><path d="M53 98 Q63 104 63 119 L70 139 71 148 84 153 Q89 159 78 159 L61 156 56 143 47 127 44 109Z"/></g>
 <g data-limb="front-arm"><path d="M59 42 Q74 43 74 59 L69 81 62 105 56 115 Q48 119 47 110 L51 99 55 77 50 60Z"/></g>
</g></g></svg>`;
// Match the photograph's own cover crop, including its original scroll-camera movement.
forest.append(visitor);
const figure=visitor.querySelector('.forest-visitor-figure');
const zone=visitor.querySelector('#forest-visitor-zone');
const limbs=Object.fromEntries([...visitor.querySelectorAll('[data-limb]')].map(limb=>[limb.dataset.limb,limb]));
const duration=1.8,interval=45;
let breezeTime=0,clock=0,nextAt=1.5,startedAt=null,lastTick=null,running=false;
let direction='away',nextDirection='away';
const blocked=()=>document.hidden||reducedQuery.matches||!loadCover.classList.contains('loaded')||['effects-off','reduced-motion','fx-paused','catalog-open'].some(name=>body.classList.contains(name));
function treeVisible(){const r=zone.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}
function hideVisitor(){visitor.style.opacity='0';visitor.dataset.state='hidden';startedAt=null;}
function pauseVisit(){lastTick=null;if(startedAt!==null){hideVisitor();nextAt=clock+interval;}}
function suspend(){
  if(running){running=false;body.classList.remove('forest-life-running');}
  pauseVisit();visitor.style.opacity='0';
}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
function pose(progress){
  const distance=direction==='away'?progress:1-progress;
  const stride=Math.sin(progress*Math.PI*4);
  // A short path follows the root shelf, with the feet hidden by foreground moss and ferns.
  const size=.225-distance*.012,groundY=390+distance*8;
  figure.setAttribute('transform',`translate(${983-distance*73} ${groundY}) scale(${direction==='away'?-size:size} ${size}) translate(-50 -160)`);
  limbs['back-arm'].setAttribute('transform',`rotate(${-stride*13} 44 48)`);
  limbs['front-arm'].setAttribute('transform',`rotate(${stride*12} 61 48)`);
  limbs['back-leg'].setAttribute('transform',`rotate(${stride*13} 49 104)`);
  limbs['front-leg'].setAttribute('transform',`rotate(${-stride*12} 53 104)`);
  // The trunk clips the near end; distant foliage and haze dissolve the far end.
  visitor.style.opacity=(.32*(1-smooth(.74,1,distance))).toFixed(4);
}
function startVisit(){
  direction=nextDirection;nextDirection=direction==='away'?'return':'away';
  startedAt=clock;nextAt=clock+interval;
  visitor.dataset.state='passing';visitor.dataset.direction=direction;pose(0);
}
hideVisitor();
// Only an explicit comparison URL exposes this replay aid; the normal shop has no Easter-egg UI.
let replay=null;
if(new URLSearchParams(location.search).get('forest-glimpse')==='1'){
  replay=document.createElement('button');replay.type='button';replay.className='forest-glimpse-replay';
  replay.textContent='Replay forest glimpse';replay.disabled=blocked();body.append(replay);
  replay.addEventListener('click',()=>{
    if(blocked()||!['canopy','fall'].includes(body.dataset.phase)||!treeVisible())return;
    startVisit();
  });
}
window.AA_FOREST_LIFE={update(dt,{enabled,phase}){
  const allowed=enabled&&!blocked();
  const inView=treeVisible(),visitAllowed=allowed&&['canopy','fall'].includes(phase)&&inView;
  if(replay){
    replay.disabled=!visitAllowed||startedAt!==null;
    replay.textContent=inView?'Replay forest glimpse':innerWidth<innerHeight?'Widen view to see the tree':'Return to the opening forest to replay';
  }
  if(!allowed){suspend();return;}
  if(!running){running=true;body.classList.add('forest-life-running');}
  const seconds=Math.min(64,Math.max(0,dt))/1000;breezeTime+=seconds;
  const breeze=Math.sin(breezeTime*.44)*2.3+Math.sin(breezeTime*.79)*.8;
  const scale=innerWidth<701?.65:1;
  layers[0].style.transform=`translate3d(${(breeze*scale).toFixed(2)}px,${(Math.sin(breezeTime*.39)*.9*scale).toFixed(2)}px,0) rotate(${(breeze*.025).toFixed(3)}deg)`;
  layers[1].style.transform=`translate3d(${((Math.sin(breezeTime*.44-1.3)*2.4+Math.sin(breezeTime*.71)*.65)*scale).toFixed(2)}px,${(Math.sin(breezeTime*.31)*.7*scale).toFixed(2)}px,0)`;
  // Use visible elapsed time for the requested 45-second cadence, even on a slower device.
  if(!visitAllowed){pauseVisit();return;}
  const now=performance.now();if(lastTick!==null)clock+=(now-lastTick)/1000;lastTick=now;
  if(startedAt===null){if(clock<nextAt)return;startVisit();}
  const progress=(clock-startedAt)/duration;
  if(progress>=1){hideVisitor();return;}
  pose(progress);
}};
// The original frame exits early in the catalog or background tab: hide an in-flight visit immediately.
const observer=new MutationObserver(()=>{if(blocked()){suspend();if(replay)replay.disabled=true;}});
observer.observe(body,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
reducedQuery.addEventListener('change',()=>{if(reducedQuery.matches)suspend();});
addEventListener('pagehide',suspend);
