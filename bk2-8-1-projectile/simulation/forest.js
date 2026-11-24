'use strict';
(() => {
  const el=id=>document.getElementById(id);
  const stage=el('stage'), canvas=el('scene'), c=canvas.getContext('2d');
  const backdrop=el('scenery'),background=backdrop.getContext('2d',{alpha:false});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const origin={x:11,y:8}, monkey={x:47,y:8};
  const width=60,ceiling=34;
  const impactDuration=760;
  let section='level',angle=0,facing=1,t=0,running=false,frame=0,last=0,model,view,pointer;
  let completed=false,hitStart=null;
  let lastLaunch=null;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function randomAngle(){return Math.round(15+Math.random()*50)*(Math.random()<.3?-1:1)}
  let dragFrame=0;
  function flushDrag(){
    if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0;update()}
  }
  function stop(){running=false;cancelAnimationFrame(frame);frame=0;last=0;hitStart=null}
  function update(){
    cancelAnimationFrame(dragFrame);dragFrame=0;stop();t=0;completed=false;
    if(origin.x!==monkey.x)facing=Math.sign(monkey.x-origin.x);
    model=forestExperiment({origin,monkey,angle,facing,width,ceiling,speed:el('speed').valueAsNumber,
      gravity:el('gravity').valueAsNumber,k:el('drag').checked?el('k').valueAsNumber:0});
    el('speed-val').value=(+el('speed').value).toFixed(1)+' m/s';
    el('gravity-val').value=(+el('gravity').value).toFixed(1)+' m/s²';
    el('k-val').value=el('drag').checked?(+el('k').value).toFixed(2)+' s⁻¹':'關閉';
    el('k').disabled=!el('drag').checked;
    draw();
  }
  function reset(){
    lastLaunch=null;el('rewind').disabled=true;
    origin.x=11;origin.y=8;monkey.x=47;monkey.y=section==='level'?8:22;
    angle=section==='level'?0:randomAngle();el('path').checked=false;update();
  }
  function layout(){
    const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(w<=84||h<=84)return;
    const s=Math.min((w-84)/width,(h-84)/ceiling);
    view={w,h,dpr,s,left:(w-width*s)/2,floor:(h+ceiling*s)/2+3,size:clamp(s*.22,.67,1.42)};
    for(const layer of [canvas,backdrop]){
      layer.width=Math.round(w*dpr);layer.height=Math.round(h*dpr);
    }
    scenery();draw();
  }
  function coords(p){return {x:view.left+p.x*view.s,y:view.floor-p.y*view.s}}
  function handlePoint(){
    const q=coords(origin),r=angle*Math.PI/180,len=46*view.size;
    return {x:q.x+len*Math.cos(r)*facing,y:q.y-len*Math.sin(r)};
  }
  function place(id,x,y,size){const b=el(id);b.hidden=running||t>0||completed;if(b.hidden)return;b.style.left=x+'px';b.style.top=y+'px';b.style.width=b.style.height=size+'px'}
  function pointEvent(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
  function setPosition(role,x,y){
    const p=role==='launcher'?origin:monkey,other=p===origin?monkey:origin;
    p.x=clamp(x,1,width-1);p.y=clamp(y,1.5,ceiling-2.2);
    if(section==='level')other.y=p.y;
    else if(el('snap').checked&&Math.abs(p.y-other.y)*view.s<10)p.y=other.y;
  }
  for(const id of ['launcher','monkey','direction']){
    const b=el(id);
    b.onpointerdown=e=>{
      if(t||running||pointer)return;
      const pt=pointEvent(e),p=id==='launcher'?origin:monkey;
      pointer={id:e.pointerId,role:id,x:pt.x,y:pt.y,start:{...p}};b.setPointerCapture(e.pointerId);
    };
    b.onpointermove=e=>{
      if(pointer?.id!==e.pointerId||pointer.role!==id)return;
      const pt=pointEvent(e);
      if(id==='direction'){
        const q=coords(origin);angle=clamp(Math.atan2(q.y-pt.y,(pt.x-q.x)*facing)*180/Math.PI,-89,89);
      }else setPosition(id,pointer.start.x+(pt.x-pointer.x)/view.s,pointer.start.y-(pt.y-pointer.y)/view.s);
      if(!dragFrame)dragFrame=requestAnimationFrame(update);
    };
    b.onlostpointercapture=()=>{flushDrag();pointer=null};
    b.onkeydown=e=>{
      const delta={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];
      if(!delta)return;e.preventDefault();
      if(id==='direction')angle=clamp(angle+delta[1]+delta[0]*facing,-89,89);
      else {const p=id==='launcher'?origin:monkey;setPosition(id,p.x+delta[0]*.5,p.y+delta[1]*.5)}
      update();
    };
  }
  function finishFlight(){
    running=false;
    completed=true;
    if(model.airHit&&!reduced.matches)hitStart=performance.now();
  }
  function tick(now){
    frame=0;
    if(running){
      if(last)t=Math.min(model.end,t+(now-last)/1000);
      last=now;
      if(t>=model.end)finishFlight();
    }
    if(hitStart!==null&&(reduced.matches||now-hitStart>=impactDuration))hitStart=null;
    draw();
    if(running||hitStart!==null)frame=requestAnimationFrame(tick);
  }
  function rememberLaunch(){
    lastLaunch={origin:{...origin},monkey:{...monkey},angle,facing};
    el('rewind').disabled=false;
  }
  el('play').onclick=()=>{
    flushDrag();
    if(running){stop();draw();return}
    if(completed){stop();t=0;completed=false}
    if(t===0)rememberLaunch();
    if(reduced.matches){t=model.end;finishFlight();draw();return}
    running=true;last=0;draw();frame=requestAnimationFrame(tick);
  };
  el('step').onclick=()=>{
    flushDrag();stop();
    if(t===0)rememberLaunch();
    t=Math.min(model.end,Math.round((t+.1)*1000)/1000);
    if(t>=model.end){
      finishFlight();
      if(hitStart!==null)frame=requestAnimationFrame(tick);
    }
    draw();
  };
  el('rewind').onclick=()=>{
    if(!lastLaunch)return;
    Object.assign(origin,lastLaunch.origin);Object.assign(monkey,lastLaunch.monkey);
    angle=lastLaunch.angle;facing=lastLaunch.facing;update();
    setText('status','已返回上次發射的位置和方向');
  };
  el('align').onclick=()=>{
    const dx=Math.abs(monkey.x-origin.x);
    angle=dx===0 && monkey.y===origin.y?0:Math.atan2(monkey.y-origin.y,dx)*180/Math.PI;
    update();
  };
  el('reset').onclick=reset;
  for(const b of document.querySelectorAll('[data-part]'))b.onclick=()=>{
    section=b.dataset.part;
    for(const other of document.querySelectorAll('[data-part]'))other.setAttribute('aria-pressed',String(other===b));
    reset();
  };
  for(const id of ['speed','gravity','drag','k'])el(id).oninput=update;
  el('earth').onclick=()=>{el('gravity').value=9.8;update()};
  el('path').onchange=draw;
  const full=el('full');
  if(full){
    if(!document.fullscreenEnabled)full.hidden=true;
    full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{el('status').textContent='此視窗未能進入全螢幕。'}};
    document.onfullscreenchange=()=>full.textContent=document.fullscreenElement?'退出全螢幕':'全螢幕';
  }

  if(window.parent!==window){
    window.addEventListener('message',event=>{
      if(event.source===window.parent&&event.data==='slide:stop'&&(running||hitStart!==null)){stop();draw()}
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden&&(running||hitStart!==null)){stop();draw()}
    });
  }

  let hour=12,minute=0,weather='clear';
  const skies={clear:'晴朗',cloud:'多雲',rain:'下雨',heavy:'大雨',storm:'雷暴',snow:'下雪',fog:'大霧'};
  function sky(){
    const d=new Date(),local=el('local-time').checked;el('hour').disabled=local;
    if(local){hour=d.getHours();minute=d.getMinutes()}else{[hour,minute]=(el('hour').value||'12:00').split(':').map(Number)}
    const choice=el('weather').value;
    weather=choice==='auto'?Object.keys(skies)[Math.floor(d.getTime()/240000)%7]:choice;
    el('sky-label').textContent=skies[weather]+' · '+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');scenery();draw();
  }
  const weatherControl=el('weather');
  if(weatherControl){
    for(const id of ['weather','hour','local-time'])el(id).oninput=sky;
    setInterval(sky,30000);
  }

  function ellipse(x,y,rx,ry,color,rot=0,ctx=c){
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rot,0,2*Math.PI);ctx.fill();
  }
  function line(a,b,color,thick=2,dash=[],ctx=c){
    ctx.strokeStyle=color;ctx.lineWidth=thick;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  }
  function label(text,x,y,color='#274655'){
    c.font='bold 13px system-ui';const w=c.measureText(text).width+16;
    x=clamp(x,w/2+2,view.w-w/2-2);y=clamp(y,13,view.h-13);
    c.fillStyle=color;c.beginPath();c.roundRect(x-w/2,y-12,w,24,7);c.fill();
    c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff9e7';c.fillText(text,x,y);
  }
  function scenery(){
    if(!view)return;
    const c=background;
    c.setTransform(view.dpr,0,0,view.dpr,0,0);
    const skyOval=(x,y,rx,ry,color)=>ellipse(x,y,rx,ry,color,0,c);
    const skyLine=(a,b,color,width)=>line(a,b,color,width,[],c);
    const {w,h,s,left,floor}=view;
    const night=hour<6||hour>=20,twilight=hour<8||hour>=17;
    const grad=c.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,night?'#354763':twilight?'#ebb89e':'#a7d9dd');grad.addColorStop(1,night?'#96a6ad':twilight?'#fbeac2':'#faf3cf');
    c.fillStyle=grad;c.fillRect(0,0,w,h);
    skyOval(w*.7,h*.22,22,22,night?'#ffefbe':'#fff2b5');
    if(night){for(let i=0;i<42;i++)skyOval((i*139.1)%w,((i*71.3)%(h*.58)),1,1,'#e0e5d9')}
    if(weather!=='clear'){
      for(let i=0;i<(weather==='cloud'?7:11);i++){
        const x=(w*.12+i*157)%w,y=h*.12+(i%3)*18;
        skyOval(x,y,52,11,'#dbe4e388');skyOval(x+6,y-6,28,13,'#dbe4e388');
      }
    }
    for(let j=0;j<2;j++){
      c.beginPath();c.moveTo(0,h);
      for(let x=0;x<=w+6;x+=6)c.lineTo(x,floor-12-j*3+Math.sin(x/(90+j*85)+j)*15+Math.sin(x/56)*5+j*17);
      c.lineTo(w,h);c.closePath();c.fillStyle=j?'#607f78':'#8da69a';c.fill();
    }
    if(['rain','heavy','storm','snow'].includes(weather)){
      const count=weather==='heavy'||weather==='storm'?145:62;
      for(let i=0;i<count;i++){const x=(i*91.23)%w,y=(i*57.71)%(floor||h);
        if(weather==='snow')skyOval(x,y,2,2,'#fff9e5cc');else skyLine({x,y},{x:x-3,y:y+8},'#526b8645',1);
      }
      if(weather==='storm'){c.fillStyle='#23334d20';c.fillRect(0,0,w,h)}
    }
    if(weather==='fog'){c.fillStyle='#e8eddf80';c.fillRect(0,0,w,h)}
    const cell=5*s;c.beginPath();
    for(let x=left%cell;x<w;x+=cell){c.moveTo(x,0);c.lineTo(x,floor)}
    for(let y=floor;y>0;y-=cell){c.moveTo(0,y);c.lineTo(w,y)}
    c.strokeStyle='#3f626c36';c.lineWidth=1;c.stroke();
    skyLine({x:0,y:floor},{x:w,y:floor},'#50695b',2);
    const y=h-12;skyLine({x:14,y},{x:14+10*s,y},'#fff3d3',2);
    c.font='bold 12px system-ui';c.textAlign='left';c.textBaseline='bottom';c.fillStyle='#fff6e4';c.fillText('10 m',16,y-2);
  }
  function drawMonkey(head,holding,surprised,z){
    // Keep the head on the model point while the body tucks up near the floor.
    const tuck=1-clamp((view.floor-head.y)/(41*z),0,1);
    const bodyX=10+15*tuck,bodyY=18-22*tuck;
    const handY=holding?-22:6;
    if(holding){const grip={x:head.x+13*z,y:head.y+handY*z};
      c.strokeStyle='#60845a';c.lineWidth=3*z;c.beginPath();c.moveTo(grip.x+10,0);c.bezierCurveTo(grip.x-9,grip.y*.4,grip.x+10,grip.y*.7,grip.x,grip.y);c.stroke();
      for(let i=1;i<5;i++){const yy=grip.y*i/5;ellipse(grip.x+(i%2?7:-4),yy,8*z,3*z,'#87a06a',i%2?-.6:.6)}
    }
    c.save();c.translate(head.x,head.y);c.scale(z,z);
    c.save();c.translate(bodyX,bodyY);
    c.lineCap='round';c.strokeStyle='#855239';c.lineWidth=5;
    c.beginPath();c.moveTo(7,3);c.bezierCurveTo(31,9,39,-16,25,-15);c.bezierCurveTo(19,-14,23,-7,27,-10);c.stroke();
    ellipse(0,0,12,15,'#995f40',-.18+tuck);
    ellipse(-2,2,7,10,'#f1c493',-.18+tuck);
    ellipse(-8,12,5,3.5,'#996043',-.3);ellipse(6,13,5,3.5,'#996043',.3);
    c.restore();
    line({x:bodyX+4,y:bodyY-6},{x:13,y:handY},'#8a543a',6);
    ellipse(13,handY,4,4,'#e9b681');
    for(const x of [-14,14]){ellipse(x,0,7,7,'#92593f');ellipse(x,0,4,4,'#f0ba90')}
    ellipse(0,0,16,16,'#81513d');ellipse(-5,0,8,9,'#f5d3a2');ellipse(5,0,8,9,'#f5d3a2');ellipse(0,6,11,8,'#f5ce99');
    for(const x of [-5.4,5.4]){
      if(surprised){
        ellipse(x,-2,4.3,5.4,'#fffaf1');
        ellipse(x,-1.7,2.1,2.8,'#342c31');
        line({x:x-2.9,y:-8},{x:x+2.9,y:-8},'#5e4538',1.5);
      }else{
        ellipse(x,-1,2.3,3.2,'#342c31');ellipse(x-.6,-2,.8,1,'#fff');
      }
    }
    ellipse(0,3,2,1.4,'#5e4538');
    if(surprised){
      ellipse(0,9,3.8,4.3,'#5e4538');
    }else{
      c.strokeStyle='#5e4538';c.lineWidth=1.6;c.beginPath();c.arc(0,5,4,.3,2.55);c.stroke();
    }
    c.restore();
  }
  function drawImpact(point,z){
    c.save();c.translate(point.x,point.y);c.scale(z,z);
    if(hitStart!==null){
      const progress=clamp((performance.now()-hitStart)/impactDuration,0,1);
      const spread=1-(1-progress)**2;
      c.globalAlpha=1-progress;
      for(const [radius,colour,thickness] of [[23+37*spread,'#a45625',3],[21+34*spread,'#ffe190',3.5]]){
        c.beginPath();c.arc(0,0,radius,0,2*Math.PI);
        c.strokeStyle=colour;c.lineWidth=thickness;c.stroke();
      }
      c.font='bold '+(19-7*progress)+'px system-ui';
      c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe190';
      c.strokeStyle='#a45625';c.lineWidth=2;c.lineJoin='round';
      for(let i=0;i<7;i++){
        const angle=i*2*Math.PI/7-.5;
        const radius=27+(30+i%2*9)*spread;
        const x=radius*Math.cos(angle),y=radius*Math.sin(angle);
        c.strokeText('✦',x,y);c.fillText('✦',x,y);
      }
    }
    c.globalAlpha=1;
    c.beginPath();c.arc(0,0,18,0,2*Math.PI);
    c.strokeStyle='#fff1bb';c.lineWidth=2.5;c.stroke();
    c.restore();
  }
  function launcher(pos,z){
    c.save();c.translate(pos.x,pos.y);c.scale(z*facing,z);c.lineCap='round';
    c.save();c.rotate(-angle*Math.PI/180);c.fillStyle='#234858';c.beginPath();c.roundRect(-24,-7,26,14,5);c.fill();c.fillStyle='#d0954b';c.fillRect(-4,-8,6,16);c.restore();
    ellipse(-18,8,12,10,'#47746b');ellipse(-18,10,6,6,'#e5b870');
    c.fillStyle='#304a4b';c.beginPath();c.roundRect(-35,16,38,6,3);c.fill();
    ellipse(-34,-6,9,11,'#e6ad78');ellipse(-34,-14,12,3,'#856f41');ellipse(-35,-17,8,5,'#b69b59');ellipse(-29,-7,1.5,2,'#334138');
    c.restore();
  }
  function trajectory(start,end,color,dash=[]){
    c.strokeStyle=color;c.lineWidth=2;c.setLineDash(dash);c.beginPath();
    for(let i=0;i<=70;i++){const p=coords(model.at(start+(end-start)*i/70));if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y)}
    c.stroke();c.setLineDash([]);
  }
  function setText(id,text){
    const node=el(id);
    if(node.textContent!==text)node.textContent=text;
  }
  function draw(){
    if(!model||!view)return;
    const {dpr,size:z}=view;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,view.w,view.h);
    const p=model.at(t),a=coords(origin),b=coords({x:monkey.x,y:p.monkeyY}),q=coords(p),arrow=handlePoint();
    if(Math.abs(origin.y-monkey.y)<1e-7&&!t&&!completed){
      line(a,b,'#437e66',2,[5,5]);label('同一水平 · '+Math.abs(origin.x-monkey.x).toFixed(1)+' m',(a.x+b.x)/2,a.y-18);
    }
    if(el('path').checked){trajectory(0,model.previewEnd,'#b35c25',[6,5]);if(t)trajectory(0,t,'#88471d')}
    // Keep each pose anchored at its physics point, including near the canvas edges.
    const hunterSize=Math.min(z*1.25,(facing>0?a.x:view.w-a.x)/47,a.y/24,(view.h-a.y)/23);
    const monkeySize=Math.min(z*1.25,(view.w-b.x)/65,b.x/22,b.y/29,(view.h-b.y)/20);
    const hit=completed&&model.airHit;
    launcher(a,hunterSize);drawMonkey(b,!t&&!completed,hit,monkeySize);
    if(!t&&!running&&!completed){
      line(a,arrow,'#a85d34',1.5,[4,3]);ellipse(arrow.x,arrow.y,10*z,10*z,'#cb7135');
      c.save();c.translate(arrow.x,arrow.y);c.scale(facing,1);c.rotate(-angle*Math.PI/180);
      c.fillStyle='#fff5d7';c.beginPath();c.moveTo(5,0);c.lineTo(-3,-4);c.lineTo(-3,4);c.closePath();c.fill();c.restore();
    }
    if(hit)drawImpact(b,monkeySize);
    else{
      ellipse(q.x,q.y,5*z,5*z,'#ffbb54');c.strokeStyle='#79502d';c.lineWidth=1.4;c.stroke();
    }
    if(completed){
      label(model.result,b.x,b.y-39*monkeySize);
    }
    place('launcher',a.x-19*hunterSize*facing,a.y+3*hunterSize,42*hunterSize);
    place('monkey',b.x+4*monkeySize,b.y+5*monkeySize,47*monkeySize);place('direction',arrow.x,arrow.y,clamp(28*z,25,42));
    setText('clock',t.toFixed(2));
    setText('play',running?'Ⅱ 暫停':completed?'↻ 重播':t?'▶ 繼續':'▶ 發射');
    el('step').disabled=completed;
    setText('status',running?'運動中':completed?model.result:t?'已暫停':section==='level'?'拖動角色調整距離 · 兩個起點保持同高':'拖動兩個角色擺位 · 拖動橙色箭嘴調角度');
  }
  reset();if(weatherControl)sky();
  new ResizeObserver(layout).observe(stage);layout();
})();
