'use strict';

const g = 10;
const radians = Math.PI / 180;
const challengeRange = 12.47;
const walls = {
  low:  { left: 5.5, right: 7.0, bottom: 3.15, top: 6.6 },
  high: { left: 5.5, right: 7.0, bottom: -1.5, top: 3.15 }
};
const gates = [{ x: 6.8, height: 2.25 }, { x: 17.4, height: 2.85 }];
const targets = [{ x: 12.5, radius: 1.0 }, { x: 21.8, radius: 1.1 }];
const colors = ['#204c80', '#983b4a', '#176345'];
const dashes = [[], [10, 6], [2, 6]];
const patterns = ['solid', 'dashed', 'dotted'];
const quantities = {
  height: { symbol: 'H', name: '最大高度', unit: 'm' },
  range: { symbol: 'R', name: '水平射程', unit: 'm' },
  time: { symbol: 't', name: '總飛行時間', unit: 's' }
};
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const el = id => document.getElementById(id);
const root = document.documentElement;
const embedded = window.parent !== window;
root.classList.toggle('large-controls', !embedded);
const canvas = el('plot');
const pen = canvas.getContext('2d');
const world = el('world');
const filters = [...document.querySelectorAll('[data-show]')];
const locks = document.querySelectorAll('[data-lock]');
const modeButtons = document.querySelectorAll('button[data-mode]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const compactPanels = matchMedia('(max-width:650px) and (orientation:portrait), (max-height:480px) and (orientation:landscape)');
let paintWorld;
try { paintWorld = window.FlightWorld?.create(world, gates, targets); }
catch (error) { console.warn('已使用平面圖模式。', error); }

function measure(speed, angle) {
  const vx = speed * Math.cos(angle * radians);
  const vy = speed * Math.sin(angle * radians);
  const time = 2 * vy / g;
  return { speed, angle, vx, vy, time, height: vy ** 2 / (2 * g), range: vx * time };
}
const altitude = (shot, t) => Math.max(0, shot.vy * t - .5 * g * t ** 2);
const readout = value => (Math.round((value + 1e-10) * 100) / 100).toFixed(2);
const landedInZone = shot => shot.impact == null && readout(shot.range) === challengeRange.toFixed(2);
function impactTime(shot, wall) {
  const entry = wall.left / shot.vx, exit = Math.min(wall.right / shot.vx, shot.time);
  if (entry > exit) return null;
  const h = altitude(shot, entry);
  if (h >= wall.bottom && h <= wall.top) return entry;
  const edge = h < wall.bottom ? wall.bottom : wall.top;
  const discriminant = shot.vy ** 2 - 2*g*edge;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  return [(shot.vy-root)/g,(shot.vy+root)/g].find(t => t >= entry && t <= exit) ?? null;
}
const modes = {
  trial: { speed: 12, angle: 45, last: null, count: 0, cleared:new Set() },
  study: { speed: 12, angle: 45, last: null, count: 0, samples: [], lock: 'angle' },
  challenge: { speed: 12, angle: 45, last: null, count: 0, low: null, high: null, route:'low', review:false, lock: 'speed' }
};
let mode = 'trial', flight = null, drag = null, chart, selected = null, frame = 0, cheerStart = null;
let marks = [];
let replayLanded=false;
const activity = () => modes[mode];
const trialComplete = () => mode==='trial' && modes.trial.cleared.size===targets.length;
const checked = key => filters.find(input => input.dataset.show === key).checked;
function records() {
  if (mode === 'study') return modes.study.samples;
  if (mode === 'challenge') {
    const s=modes.challenge;
    return (s.review ? [s.low,s.high] : [s[s.route]]).filter(Boolean);
  }
  return [];
}
function trajectories() {
  const stored = records();
  const last = activity().last;
  return last && !stored.includes(last) ? [...stored, last] : stored;
}
function announce(text, landed = false) {
  el('status').textContent = text;
  el('status').dataset.landed = String(landed);
  el('status').dataset.hit = 'false';
}
function updateControls() {
  const setting = activity();
  for (const key of ['speed', 'angle']) {
    const input = el(key), value = setting[key];
    const formatted = key === 'speed' ? value.toFixed(1) : String(value);
    const unit = key === 'speed' ? ' m/s' : '°';
    input.value = value;
    input.disabled = Boolean(flight) || setting.lock === key;
    input.setAttribute('aria-valuetext', formatted + unit);
    el(key + '-value').textContent = formatted + unit;
    el('hud-' + key).textContent = formatted;
  }
  if (flight?.low || replayLanded) el('hud-angle').textContent=setting.low.angle+'° / '+setting.high.angle;
  for (const button of locks) {
    const key = button.dataset.lock, locked = setting.lock === key;
    button.hidden = mode !== 'study';
    button.disabled = Boolean(flight);
    button.setAttribute('aria-pressed', String(locked));
    const title = key === 'speed' ? '初速率' : '發射角度';
    button.textContent = locked ? '已鎖定' : '鎖定';
    button.setAttribute('aria-label', (locked ? '解鎖' : '鎖定') + title);
  }
  el('trial-retry').hidden = !trialComplete();
  el('launch').disabled = Boolean(flight || drag || trialComplete());
  el('clear').hidden = mode === 'trial';
  el('clear').disabled = !setting.last && !flight && !setting.low && !setting.high;
  el('clear').textContent = mode === 'challenge' ? '重置挑戰' : '清除記錄';
  el('pause').hidden = !flight;
  el('pause').textContent = flight?.paused ? '繼續' : '暫停';
  el('clock-wrap').hidden = !flight || !checked('time');
  el('clock').textContent = readout(flight?.elapsed || 0);
  canvas.dataset.pull = flight || trialComplete() ? 'off' : drag ? 'held' : 'ready';
  el('pull-hint').hidden = mode !== 'trial' || Boolean(setting.last || drag || flight);
}

function updateRecords() {
  const samples = records();
  el('records').hidden = !samples.length;
  el('record-title').textContent = mode === 'challenge' ? '已達成的路徑' : '最近三次';
  document.querySelectorAll('thead [data-col]').forEach(cell => { cell.hidden = !checked(cell.dataset.col); });
  const body = el('record-rows');
  body.replaceChildren();
  for (const shot of samples) {
    const row = body.insertRow();
    const head = document.createElement('th');
    head.scope = 'row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'run';
    button.style.setProperty('--run', colors[shot.style]);
    button.style.setProperty('--pattern', patterns[shot.style]);
    button.textContent = shot.id;
    button.setAttribute('aria-label', '查看第 ' + shot.id + ' 次的軌跡');
    button.setAttribute('aria-pressed', String((selected ?? activity().last) === shot));
    button.onclick = () => {
      selected = shot;
      render();
      el('record-rows').querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    };
    head.append(button); row.append(head);
    row.insertCell().textContent = shot.speed.toFixed(1);
    row.insertCell().textContent = shot.angle;
    for (const key of Object.keys(quantities)) {
      const cell = row.insertCell();
      cell.dataset.col = key;
      cell.hidden = !checked(key);
      cell.textContent = readout(shot[key]);
    }
  }
  el('goals').hidden = mode !== 'challenge';
  const challenge=modes.challenge;
  el('repeat-angle').hidden=mode!=='challenge' || !challenge.low || challenge.route!=='low' || challenge.review || Boolean(flight);
  el('compare-routes').hidden=!(modes.challenge.low && modes.challenge.high);
  el('replay-routes').hidden=el('compare-routes').hidden;
  el('replay-routes').disabled=Boolean(flight);
  el('compare-routes').setAttribute('aria-pressed',String(modes.challenge.review));
  for (const [key, name] of [['low', '① 懸空岩壁'], ['high', '② 地面石牆']]) {
    const shot = modes.challenge[key];
    el('goal-' + key).dataset.done = String(Boolean(shot));
    el('goal-' + key).setAttribute('aria-pressed',String(!modes.challenge.review && modes.challenge.route===key));
    el('goal-' + key).textContent = name + (shot ? ' ✓ '+shot.angle+'°' : '');
  }
}

function resize() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min(2, devicePixelRatio || 1);
  const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth; canvas.height = pixelHeight;
  }
  pen.setTransform(ratio,0,0,ratio,0,0);
  const portrait = width <= 650 && height >= width;
  const navBottom = document.querySelector('.top').getBoundingClientRect().bottom;
  el('lab').style.setProperty('--nav-bottom', Math.ceil(navBottom+8)+'px');
  const x = portrait ? clamp(width*.17, 54, 88) : clamp(width*.125, 62, 185);
  const y = Math.round(height*(portrait && height<740 ? .74 : portrait ? .69 : .71));
  const right = portrait ? 14 : width - el('dock').getBoundingClientRect().left + 13;
  const top = portrait ? 145 : height < 480 ? 54 : 93;
  const challenge = mode==='challenge';
  const scale = Math.max(2, Math.min((width-x-right)/(challenge ? 15 : 26), (y-top)/(challenge ? 7.1 : 12.3)));
  const birdSize = clamp(31/scale,.86,1.85);
  chart = { width, height, x, y, scale, birdSize, maxPull: clamp(x-15,38,96) };
  el('pull-hint').style.left = (x + 4) + 'px';
  el('pull-hint').style.top = (y - birdSize*scale*.75 - 49) + 'px';
  layoutMarks();
  draw();
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)) *
    Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
}
function layoutMarks() {
  const layer = el('marks'); layer.replaceChildren(); marks = [];
  if (!chart || flight) return;
  const quantitiesOn = filters.filter(input => input.checked).map(input => input.dataset.show);
  if (!quantitiesOn.length || !activity().last) return;
  const paths = trajectories();
  const shots = (quantitiesOn.length === 1 ? paths : [selected ?? activity().last]).filter(s=>s.impact==null);
  const { width, height, x, y, scale, birdSize } = chart;
  const blocked = ['dock','goals'].map(el).filter(node => !node.hidden).map(node => node.getBoundingClientRect());
  const topRects = [...document.querySelector('.top').children, ...document.querySelector('.hud').children]
    .filter(node => !node.hidden && node.offsetWidth);
  blocked.push(...topRects.map(node => node.getBoundingClientRect()));
  for (const [i, shot] of shots.entries()) {
    const end = x+shot.range*scale;
    for (const key of quantitiesOn) {
      const { symbol, name, unit } = quantities[key];
      const tag = document.createElement('span'); tag.className = 'mark'; tag.dataset.qty = key; tag.dataset.run = shot.id;
      tag.style.setProperty('--run', colors[shot.style]);
      tag.setAttribute('aria-label', '第 '+ shot.id +' 次，'+name+' '+readout(shot[key])+' '+unit);
      if (paths.length > 1) {
        const n = document.createElement('small'); n.textContent = '#' + shot.id; tag.append(n);
      }
      const sym = document.createElement('b'); sym.textContent = symbol;
      tag.append(sym, ' ' + readout(shot[key]) + ' ' + unit); layer.append(tag);
      const w = tag.offsetWidth, h = tag.offsetHeight;
      const dimY = y+Math.max(16,birdSize*scale*.65+9) + (key === 'range' && shots.length > 1 ? i*(h+4) : 0);
      const ax = key === 'time' ? end : (x+end)/2;
      const ay = key === 'height' ? y-shot.height*scale : key === 'range' ? dimY : y;
      const preferred = key === 'time' ? [ax+7, ay-h-9] : key === 'range' ? [ax-w/2, ay+3] : [ax-w/2, ay-h-8];
      const offsets = [[0,0],[w*.55,0],[-w*.55,0],[w+6,0],[-w-6,0],[0,-h-6],[0,h+6],[w*.7,-h-7],[-w*.7,-h-7],[0,-2*(h+6)],[0,2*(h+6)]];
      let best, least = Infinity;
      for (const [dx,dy] of offsets) {
        const left = clamp(preferred[0]+dx,3,width-w-3), top = clamp(preferred[1]+dy,3,height-h-3);
        const box = { left, top, right:left+w, bottom:top+h };
        const cost = blocked.reduce((sum, rect) => sum+overlap(box,rect),0);
        if (cost < least) { best = box; least = cost; }
        if (cost === 0) break;
      }
      tag.style.left = best.left+'px'; tag.style.top = best.top+'px';
      blocked.push({ left:best.left-3, right:best.right+3, top:best.top-3, bottom:best.bottom+3 });
      marks.push({ key, shot, ax, ay, end, dimY, box:best });
    }
  }
}

function line(x1,y1,x2,y2,color,width=1) {
  pen.strokeStyle=color; pen.lineWidth=width; pen.beginPath(); pen.moveTo(x1,y1); pen.lineTo(x2,y2); pen.stroke();
}
function ellipse(x,y,rx,ry,fill,stroke,turn=0) {
  pen.beginPath(); pen.ellipse(x,y,rx,ry,turn,0,Math.PI*2);
  if (fill) { pen.fillStyle=fill; pen.fill(); }
  if (stroke) { pen.strokeStyle=stroke; pen.lineWidth=1.5; pen.stroke(); }
}
function trace(shot, elapsed, focus) {
  const { x,y,scale }=chart;
  pen.beginPath(); pen.moveTo(x,y);
  for (let n=1; n<=56; n++) {
    const t=elapsed*n/56;
    pen.lineTo(x+shot.vx*t*scale,y-altitude(shot,t)*scale);
  }
  pen.setLineDash(dashes[shot.style]); pen.lineCap='round'; pen.lineJoin='round';
  pen.strokeStyle='#fffae3'; pen.lineWidth=focus ? 5.5 : 4; pen.stroke();
  pen.strokeStyle=colors[shot.style]; pen.lineWidth=focus ? 3 : 2; pen.stroke();
  pen.setLineDash([]);
}
function dimensions() {
  const { x,y }=chart;
  for (const mark of marks) {
    const { key,shot,ax,ay,end,dimY,box }=mark, ink=colors[shot.style];
    if (key === 'height') {
      pen.setLineDash([4,4]); line(ax,ay,ax,y,ink,1.6); pen.setLineDash([]);
      line(ax-4,y,ax+4,y,ink,1.8);
      ellipse(ax,ay,3.5,3.5,ink,'#fff8de');
    } else if (key === 'range') {
      line(x,dimY,end,dimY,'#fff8de',4); line(x,dimY,end,dimY,ink,1.8);
      for (const tip of [x,end]) line(tip,dimY-4,tip,dimY+4,ink,2);
    } else {
      ellipse(end,y,5,5,'#fff8de',ink); ellipse(end,y,2,2,ink);
    }
    const bx=clamp(ax,box.left,box.right), by=clamp(ay,box.top,box.bottom);
    if (Math.hypot(bx-ax,by-ay)>4) {
      line(ax,ay,bx,by,'#fff7dd',3); line(ax,ay,bx,by,ink,1);
    }
  }
}

function gateFold(gate, shot, elapsed) {
  if (!shot || gate.x > shot.range) return 0;
  const cross = gate.x/shot.vx;
  // The board pivots out of the flight plane. Its sensor never changes the ideal free flight.
  return altitude(shot,cross) <= gate.height ? clamp((elapsed-cross)/.13,0,1) : 0;
}
function hitIndex(shot) {
  if (!shot || mode === 'study') return -1;
  if (mode === 'challenge') return landedInZone(shot) ? 0 : -1;
  return shot.hitTarget ?? targets.findIndex((t,i) => !modes.trial.cleared.has(i) && Math.abs(shot.range-t.x) <= t.radius);
}
function gameState(now) {
  const last = activity().last, shot = flight?.shot ?? last;
  const elapsed = flight?.elapsed ?? (shot ? shot.time+.15 : 0);
  const age = cheerStart === null ? 1 : clamp((now-cheerStart)/1000,0,1);
  return { mode, cleared:modes.trial.cleared, folds:gates.map(gate => gateFold(gate,shot,elapsed)), hit:flight ? -1 : hitIndex(last),
    hop:Math.sin(Math.PI*age)*.85, age };
}

function flatField(pose, game) {
  const { width,x,y,scale,birdSize }=chart, size=birdSize*scale, ground=y+.65*size;
  pen.fillStyle='#a7cd59'; pen.fillRect(0,ground,width,7);
  pen.fillStyle='#46866b'; pen.fillRect(0,ground+7,width,5);
  pen.fillStyle='#d98c53'; pen.fillRect(0,ground+12,width,Math.max(6,scale*.9));
  if (mode === 'trial') gates.forEach((gate,i) => {
    const h=gate.height*scale+.65*size;
    pen.save(); pen.translate(x+gate.x*scale,ground); pen.rotate(game.folds[i]*1.28);
    line(0,0,0,-h+5,'#8f592c',Math.max(3,scale*.18));
    pen.translate(0,-h+scale*.45); pen.rotate(.3);
    for (let n=0;n<4;n++) {
      ellipse(0,-scale*.27,scale*.15,scale*.31,n%2?'#20b9bc':'#ffb43c','#825f38',-.23);
      pen.rotate(Math.PI/2);
    }
    ellipse(0,0,scale*.13,scale*.13,'#ffe39d'); pen.restore();
  });
  if (mode !== 'study') targets.forEach((target,i) => {
    if ((mode === 'trial' && game.cleared.has(i)) || (mode === 'challenge' && (i>0 || game.secondBird))) return;
    const bx=x+target.x*scale, s=clamp(23/scale,.9,1.7)*scale;
    const by=ground-(game.hit===i ? game.hop*s : 0);
    ellipse(bx,ground,scale*(mode === 'challenge' ? .5 : target.radius),Math.max(2,scale*.14),'#ffd45b','#416c61');
    pen.save(); pen.translate(bx,by); pen.scale(s,s);
    const fill=i?'#ed946f':'#ae91d8';
    ellipse(0,-.70,.74,.66,fill);
    ellipse(-.18,-1.41,.13,.35,'#2e967d',null,-.66); ellipse(.13,-1.44,.12,.34,'#a3c94e',null,.58);
    for (const dx of [-.29,.29]) {
      ellipse(dx,-.79,.18,.21,'#fff8de'); ellipse(dx-.025,-.8,.08,.105,'#283c55');
      ellipse(dx,.01,.22,.13,'#494865');
    }
    ellipse(0,-.53,.08,.045,'#5e4562'); pen.restore();
  });
  line(x-.1*size,ground+size*.36,x,y-.06*size,'#805133',size*.23);
  for (const side of [-1,1]) line(x,y+.43*size,x+side*.56*size,y-.06*size,'#b37942',size*.22);
  flatBird(pose);
  if (game.secondBird) flatBird(game.secondBird);
}
function flatBird(pose) {
  const {x,y,scale,birdSize}=chart, size=birdSize*scale;
  pen.save(); pen.translate(x+pose.x*scale,y-pose.y*scale); pen.rotate(-pose.pitch); pen.scale(size,size);
  ellipse(-.87,.03,.46,.13,'#137d89',null,-.18); ellipse(-.75,-.17,.35,.10,'#56c7ac',null,.14);
  ellipse(-.08,.02,.73,.53,'#13a9a6'); ellipse(.05,.22,.48,.25,'#ffc265');
  ellipse(.28,-.23,.49,.47,'#159eaa'); ellipse(-.04,-.66,.39,.09,'#ffb84b',null,.32);
  pen.fillStyle='#ef9d34'; pen.beginPath(); pen.moveTo(.61,-.20); pen.lineTo(1.20,-.09); pen.lineTo(.61,.0); pen.fill();
  ellipse(.4,-.32,.22,.22,'#fff6d7'); ellipse(.46,-.32,.10,.12,'#1c4052'); ellipse(.49,-.37,.031,.031,'#fff');
  ellipse(-.31,.08,.39,.19,'#126b78',null,-.29); ellipse(-.37,.04,.27,.06,'#64d7bc',null,-.28);
  pen.restore();
}

function birdPose(shot,elapsed) {
  const t=Math.min(elapsed,shot.time);
  return {x:shot.vx*t,y:t>=shot.time ? 0 : altitude(shot,t),pitch:t>=shot.time ? 0 : .56*Math.atan2(shot.vy-g*t,shot.vx)};
}
function draw(now=performance.now()) {
  if (!chart) return;
  const { width,height,x,y,scale,birdSize }=chart;
  pen.clearRect(0,0,width,height); pen.lineCap='round';
  const setting = activity(), theta=setting.angle*radians;
  const pull=drag?.length || 0;
  let pose={ x:-pull*Math.cos(theta)/scale, y:-pull*Math.sin(theta)/scale, pitch:0, pulled:pull>0 };
  const second=flight?.low;
  const elapsed=second && reduce.matches ? (flight.elapsed>=second.time ? second.time : 0) : flight?.elapsed;
  if (flight) pose=birdPose(flight.shot,elapsed);
  const game=gameState(now);
  if (second) game.secondBird=birdPose(second,elapsed);
  if (replayLanded) {
    pose=birdPose(setting.high,setting.high.time);
    game.secondBird=birdPose(setting.low,setting.low.time);
    game.hit=-1;
  }
  game.wall=mode==='challenge' && !setting.review ? walls[setting.route] : null;
  const moving=Boolean(flight || drag);
  const scenePaint=paintWorld?.(chart,pose,game,moving);
  const threeD=Boolean(scenePaint);
  world.hidden=!threeD; el('scene-note').hidden=threeD;
  if (!threeD) flatField(pose,game);
  const birdPx=birdSize*scale;
  if(threeD && moving){
    if(!pose.pulled){
      pen.save();pen.globalAlpha=.28/(1+.33*Math.max(0,pose.y));
      ellipse(x+pose.x*scale,y+.56*birdPx,.74*birdPx,.08*birdPx,'#244537');pen.restore();
    }
    const paintBird=p=>{
      pen.save();pen.translate(x+p.x*scale,y-p.y*scale);pen.rotate(-p.pitch);
      pen.drawImage(scenePaint,-1.6*birdPx,-1.6*birdPx,3.2*birdPx,3.2*birdPx);pen.restore();
    };
    if(game.secondBird)paintBird(game.secondBird);
    paintBird(pose);
  }
  if (mode === 'challenge') {
    const col=x+challengeRange*scale;
    line(col,y-1.18*birdPx,col,y+.65*birdPx,'#825220',2);
    pen.fillStyle='#ffca4b'; pen.fillRect(col,y-1.18*birdPx,Math.max(9,.23*scale),.12*scale);
    if (game.wall && !threeD) {
      const w=game.wall, left=x+w.left*scale, top=y-w.top*scale;
      const width=(w.right-w.left)*scale, height=(w.top-Math.max(w.bottom,-.65*birdSize))*scale;
      pen.fillStyle='#49657b'; pen.fillRect(left,top,width,height);
      pen.strokeStyle='#253d50'; pen.strokeRect(left,top,width,height);
      for(let i=1;i<6;i++) line(left,top+height*i/6,left+width,top+height*i/6,'#96aab0',2);
    }
  }
  if (mode !== 'trial' || setting.last) {
    pen.setLineDash([3,7]); line(x,y,x+25.6*scale,y,'#4a7772',1); pen.setLineDash([]);
  }
  const chosen=selected ?? setting.last;
  if (!second) for (const shot of trajectories()) trace(shot,shot.impact ?? shot.time,shot===chosen && !flight);
  if (!flight && setting.last?.impact!=null) {
    const shot=setting.last, cx=x+shot.vx*shot.impact*scale, cy=y-altitude(shot,shot.impact)*scale;
    ellipse(cx,cy,8,8,'#fff7db','#9b3526');
    for (const sign of [-1,1]) line(cx-4,cy-sign*4,cx+4,cy+sign*4,'#9b3526',2);
  }
  if (flight) trace(flight.shot,elapsed,true);
  if (second) trace(second,Math.min(elapsed,second.time),true);
  if (second) {
    pen.save();
    pen.font='bold 16px system-ui';
    for (const [bird,shot,side] of [[game.secondBird,second,-1],[pose,flight.shot,1]]) {
      const bx=x+bird.x*scale+side*7, by=y-bird.y*scale-birdPx*.86;
      pen.textAlign=side<0 ? 'right' : 'left';
      pen.lineWidth=4; pen.strokeStyle='#fff8e3'; pen.strokeText(shot.angle+'°',bx,by);
      pen.fillStyle=colors[shot.style]; pen.fillText(shot.angle+'°',bx,by);
    }
    pen.restore();
  }
  dimensions();
  const centerX=x+pose.x*scale, centerY=y-pose.y*scale;
  if (flight) {
    ellipse(centerX,centerY,2.8,2.8,'#fff9dc',colors[flight.shot.style]);
  } else if (pull || (mode==='trial' && !setting.last)) {
    const aim=measure(setting.speed,setting.angle);
    const dots=pull ? 9 : 5;
    for (let n=1;n<=dots;n++) {
      const t=aim.time*.24*n/dots;
      ellipse(x+aim.vx*t*scale,y-altitude(aim,t)*scale,pull?2.5:2,pull?2.5:2,'#fcf5d6','#41666c');
    }
  }
  const pouchX=flight || replayLanded ? x : centerX-.1*birdPx;
  const pouchY=flight || replayLanded ? y+.16*birdPx : centerY+.23*birdPx;
  for (const side of [-1,1]) {
    const fx=x+side*.57*birdPx, fy=y+.10*birdPx;
    line(fx,fy,pouchX,pouchY,'#67412c',4.5); line(fx,fy,pouchX,pouchY,'#f4b662',2);
  }
  if (game.hit >= 0 && !flight && (mode!=='trial' || game.age<1)) {
    const tx=x+targets[game.hit].x*scale, ty=y-Math.min(1.7*scale,28)*1.4;
    if (game.age<1) {
      pen.save();
      pen.globalAlpha=1-game.age**2;
      const spread=clamp(scale*2,42,92)*game.age;
      ellipse(tx,ty,8+spread,8+spread,null,'#fff3aa');
      for (let i=0;i<12;i++) {
        const angle=Math.PI*2*i/12;
        const dx=Math.cos(angle), dy=Math.sin(angle);
        const radius=12+spread*(i%2 ? .85 : 1.12);
        const sx=tx+radius*dx, sy=ty+radius*dy;
        line(sx,sy,sx+7*dx,sy+7*dy,'#785020',5);
        line(sx,sy,sx+7*dx,sy+7*dy,i%2 ? '#fff9df' : '#ffd343',3);
      }
      pen.restore();
    }
    for (const side of [-1,1]) {
      line(tx+side*12,ty-5-game.hop*10,tx+side*17,ty-9-game.hop*10,'#9a611e',3);
      line(tx+side*12,ty-5-game.hop*10,tx+side*17,ty-9-game.hop*10,'#ffe16d',1.5);
    }
  }
}

function render() {
  updateControls(); updateRecords(); resize();
}
function stopFrame() { cancelAnimationFrame(frame); frame=0; }
let aimFrame=0;
function releaseDrag(restore) {
  cancelAnimationFrame(aimFrame);aimFrame=0;
  if (!drag) return;
  const saved=drag; drag=null;
  if (restore) Object.assign(activity(),{ speed:saved.speed, angle:saved.angle });
  if (canvas.hasPointerCapture(saved.id)) canvas.releasePointerCapture(saved.id);
}
function cancelInteraction() {
  stopFrame(); releaseDrag(true); flight=null; cheerStart=null; replayLanded=false;
}
function finish(shot) {
  const setting=activity();
  flight=null; selected=null; setting.last=shot; setting.count=shot.id;
  let message='已着地，可以再拉一次。';
  if (mode==='study') {
    setting.samples.push(shot);
    if (setting.samples.length>3) setting.samples.shift();
    message='已記錄第 '+shot.id+' 次。';
  } else if (mode==='challenge') {
    if (landedInZone(shot)) setting[setting.route]=shot;
    setting.review=Boolean(landedInZone(shot) && setting.low && setting.high);
    message=setting.review ? '✓ 命中旗標！'+shot.angle+'° 成功。兩條路徑的水平射程同為 12.47 m。' :
      shot.impact!=null ? '碰到岩壁，飛行結束。改變角度再試。' :
      landedInZone(shot) ? '✓ 命中旗標！'+shot.angle+'° 能通過這一關。' : '未落在旗標上，調整角度再試。';
  } else {
    shot.hitTarget=hitIndex(shot);
    if (shot.hitTarget>=0) {
      setting.cleared.add(shot.hitTarget);
      message=trialComplete() ? '✓ 全部目標已命中！按「重試」再玩一次。' :
        '✓ 命中！餘下 '+(targets.length-setting.cleared.size)+' 個目標。';
    } else if (gates.some(gate => gateFold(gate,shot,shot.time+.15)>0)) message='風車木牌翻下了！可以再試一次。';
  }
  const hit=hitIndex(shot)>=0;
  cheerStart=!reduce.matches && hit ? performance.now() : null;
  announce(message,shot.impact==null);
  el('status').dataset.hit=String(hit);
  render();
  if (cheerStart!==null) frame=requestAnimationFrame(animate);
}
function animate(now) {
  frame=0;
  if (!flight) {
    if (cheerStart!==null) {
      draw(now);
      if (now-cheerStart<1000) frame=requestAnimationFrame(animate); else cheerStart=null;
    }
    return;
  }
  if (flight.paused) return;
  const end=flight.shot.impact ?? flight.shot.time;
  const before=flight.elapsed;
  const interval=now-flight.previous;
  flight.elapsed=Math.min(end,flight.elapsed+interval/1000);
  flight.previous=now;
  if (flight.low) {
    if (flight.elapsed>=end) {
      const low=flight.low, high=flight.shot;
      flight=null; replayLanded=true;
      announce('兩鳥落在同一點。'+(checked('time') ? '低弧線 '+readout(low.time)+' s，高弧線 '+readout(high.time)+' s。' : '')+
        (checked('range') ? '兩條路徑的 R 都是 '+readout(high.range)+' m。' : ''),true);
      render(); return;
    }
    if (before<flight.low.time && flight.elapsed>=flight.low.time) announce('低弧線已着地，高弧線仍在空中。');
  }
  if (flight.elapsed>=end) { finish(flight.shot); return; }
  el('clock').textContent=readout(flight.elapsed);
  draw(now); frame=requestAnimationFrame(animate);
}
function launch() {
  if (flight || drag || trialComplete()) return;
  stopFrame(); cheerStart=null; selected=null; replayLanded=false;
  const setting=activity();
  const shot=measure(setting.speed,setting.angle);
  if (mode==='challenge') {
    setting.review=false;
    shot.impact=impactTime(shot,walls[setting.route]);
  }
  shot.id=setting.count+1;
  shot.style=mode==='study' ? setting.count%3 : mode==='challenge' ? (landedInZone(shot) ? Number(shot.angle>45) : 2) : 0;
  if (reduce.matches) { finish(shot); return; }
  flight={shot, elapsed:0, previous:performance.now(), paused:false};
  announce('飛行中'); render(); frame=requestAnimationFrame(animate);
}
function pause() {
  if (!flight) return;
  flight.paused=!flight.paused;
  if (flight.paused) { stopFrame(); announce('已暫停'); draw(); }
  else { flight.previous=performance.now(); announce('飛行中'); frame=requestAnimationFrame(animate); }
  updateControls();
}
function onBird(event) {
  if (!chart) return false;
  const size=chart.birdSize*chart.scale;
  return Math.hypot((event.clientX-chart.x)/(size*1.36+5),(event.clientY-chart.y)/Math.max(25,size*.87+5)) <= 1;
}
function aim(event) {
  const dx=Math.max(0,drag.startX-event.clientX), dy=Math.max(0,event.clientY-drag.startY);
  const distance=Math.hypot(dx,dy);
  drag.length=distance<7 ? 0 : Math.min(distance,chart.maxPull);
  const setting=activity();
  if (!drag.length) {
    setting.speed=drag.speed; setting.angle=drag.angle;
  } else {
    if (setting.lock!=='speed') setting.speed=8+Math.round(clamp((drag.length-9)/(chart.maxPull-9),0,1)*16)/2;
    if (setting.lock!=='angle') setting.angle=clamp(Math.round(Math.atan2(dy,dx)/radians),15,75);
  }
}
function paintAim() {
  aimFrame=0;
  updateControls();draw();
}
canvas.addEventListener('pointerdown', event => {
  if (flight || drag || trialComplete() || event.button!==0 || !onBird(event)) return;
  event.preventDefault();
  replayLanded=false;
  drag={id:event.pointerId, startX:event.clientX, startY:event.clientY, speed:activity().speed, angle:activity().angle, length:0};
  canvas.setPointerCapture(event.pointerId); updateControls();
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id===event.pointerId) {
    aim(event);
    if (!aimFrame) aimFrame=requestAnimationFrame(paintAim);
  }
  else if (!drag) canvas.dataset.overBird=String(!flight && onBird(event));
});
canvas.addEventListener('pointerup', event => {
  if (drag?.id!==event.pointerId) return;
  aim(event);
  const shoot=drag.length>0; releaseDrag(!shoot);
  if (shoot) launch(); else render();
});
for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type,event => {
  if (drag?.id===event.pointerId) { releaseDrag(true); render(); }
});
canvas.addEventListener('keydown',event => {
  if (event.key==='Escape' && drag) { releaseDrag(true); render(); }
  if ((event.key===' ' || event.key==='Enter') && !event.repeat) {
    event.preventDefault(); if (flight) pause(); else launch();
  }
});
for (const key of ['speed','angle']) el(key).addEventListener('input',() => {
  replayLanded=false;
  activity()[key]=el(key).valueAsNumber; updateControls(); draw();
});
for (const button of locks) button.addEventListener('click',() => {
  const setting=activity(), key=button.dataset.lock;
  setting.lock=setting.lock===key ? null : key; updateControls();
});
for (const checkbox of filters) checkbox.addEventListener('change',render);
for (const button of modeButtons) button.addEventListener('click',() => {
  if (mode===button.dataset.mode) return;
  cancelInteraction(); mode=button.dataset.mode; selected=null;
  el('lab').dataset.mode=mode;
  for (const b of modeButtons) b.setAttribute('aria-pressed',String(b===button));
  el('manual').open=mode!=='trial';
  el('records').open=!compactPanels.matches;
  announce(mode==='study' ? '鎖定一項發射設定，每次只改另一項。' : '');
  render();
});
el('launch').addEventListener('click',launch); el('pause').addEventListener('click',pause);
el('trial-retry').addEventListener('click',()=>{
  if (!trialComplete()) return;
  cancelInteraction(); selected=null;
  modes.trial.cleared.clear();
  Object.assign(modes.trial,{last:null,count:0,speed:12,angle:45});
  announce('兩個目標已回到場上。'); render(); canvas.focus({preventScroll:true});
});
el('replay-routes').addEventListener('click',()=>{
  const s=modes.challenge;
  if (mode!=='challenge' || flight || !s.low || !s.high) return;
  cancelInteraction(); selected=null; s.review=true; s.last=s.high;
  flight={shot:s.high,low:s.low,elapsed:0,previous:performance.now(),paused:false};
  announce(s.low.angle+'° 和 '+s.high.angle+'° 同時發射。'); render();
  frame=requestAnimationFrame(animate);
});
el('repeat-angle').addEventListener('click',()=>{
  const s=modes.challenge;
  if (mode!=='challenge' || flight || !s.low || s.route!=='low' || s.review) return;
  cancelInteraction();
  s.route='high'; s.angle=s.low.angle; s.last=s.high;
  el('manual').open=true;
  if (compactPanels.matches) el('records').open=false;
  canvas.focus({preventScroll:true});
  launch();
});
el('compare-routes').addEventListener('click',()=>{
  const s=modes.challenge;
  cancelInteraction(); selected=null; s.review=true; s.last=s[s.route];
  announce('比較兩個角度的水平射程。'); render();
});
for (const button of document.querySelectorAll('[data-route]')) button.addEventListener('click',()=>{
  const s=modes.challenge;
  cancelInteraction(); selected=null; s.review=false; s.route=button.dataset.route;
  s.last=s[s.route]; announce(''); render();
});
el('clear').addEventListener('click',() => {
  cancelInteraction(); selected=null;
  const setting=activity(); setting.last=null; setting.count=0;
  if (mode==='study') setting.samples=[]; else if (mode==='challenge') {
    Object.assign(setting,{low:null,high:null,route:'low',review:false,angle:45});
  }
  announce(''); render();
});
for (const id of ['manual','records']) {
  const panel=el(id);
  panel.querySelector('summary').addEventListener('click',() => {
    if (compactPanels.matches && !panel.open) el(id==='manual' ? 'records' : 'manual').open=false;
  });
  panel.addEventListener('toggle',() => { layoutMarks(); draw(); });
}
compactPanels.addEventListener('change',() => {
  el('records').open=!compactPanels.matches || !el('manual').open;
  resize();
});
function fullState() {
  const on=Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  root.classList.toggle('large-controls', !embedded || on);
  el('fullscreen').setAttribute('aria-pressed',String(on));
  el('full-text').textContent=on ? '退出全螢幕' : '全螢幕';
  resize();
}
el('fullscreen').hidden=!(root.requestFullscreen || root.webkitRequestFullscreen);
el('fullscreen').addEventListener('click',async () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  } catch { announce('此瀏覽器已使用整個網頁畫面。'); }
});
for (const name of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(name,fullState);
document.addEventListener('visibilitychange',() => { if (document.hidden && flight && !flight.paused) pause(); });
if (embedded) {
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.data === 'slide:stop' && flight && !flight.paused) pause();
  });
}
world.addEventListener('webglcontextlost',event => { event.preventDefault(); draw(); });
world.addEventListener('webglcontextrestored',() => { resize(); });
new ResizeObserver(resize).observe(canvas);
const initialMode = Array.from(modeButtons).find(button => '#' + button.dataset.mode === location.hash);
if (initialMode && initialMode.dataset.mode !== mode) initialMode.click();
else render();
