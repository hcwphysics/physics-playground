'use strict';
// Coordinates are in metres. Both objects share gravity and linear drag per unit mass.
function forestExperiment({origin, monkey, angle, facing, speed, gravity, k, width, ceiling}) {
  const radians=angle*Math.PI/180;
  const vx=facing*speed*Math.cos(radians), vy=speed*Math.sin(radians);
  function at(t){
    const travel=k?-Math.expm1(-k*t)/k:t;
    const fall=k?gravity*(t-travel)/k:gravity*t*t/2;
    return {x:origin.x+vx*travel,y:origin.y+vy*travel-fall,monkeyY:monkey.y-fall};
  }
  function firstGround(getHeight){
    if(getHeight(20)>0)return Infinity;
    let low=0,high=20;
    for(let i=0;i<48;i++){const mid=(low+high)/2;if(getHeight(mid)>0)low=mid;else high=mid}
    return high;
  }
  function timeForTravel(f){return k?(f*k<1?-Math.log1p(-k*f)/k:Infinity):f}
  const dx=monkey.x-origin.x,dy=monkey.y-origin.y;
  const projected=(dx*vx+dy*vy)/(speed*speed);
  const miss=Math.hypot(dx-vx*projected,dy-vy*projected);
  // A small catching area makes pointer and keyboard placement usable.
  const meet=projected>=0 && miss<=.65?timeForTravel(projected):Infinity;
  const ballGround=firstGround(t=>at(t).y), monkeyGround=firstGround(t=>at(t).monkeyY);
  const side=Math.abs(vx)<1e-8?Infinity:timeForTravel(((vx>0?width:0)-origin.x)/vx);
  const apex=vy<=0?0:gravity===0?20:k?Math.min(20,Math.log1p(k*vy/gravity)/k):Math.min(20,vy/gravity);
  let top=Infinity;
  if(at(apex).y>=ceiling){
    let low=0,high=apex;
    for(let i=0;i<40;i++){const mid=(low+high)/2;if(at(mid).y<ceiling)low=mid;else high=mid}
    top=high;
  }
  const previewEnd=Math.min(20,ballGround,side,top);
  const end=Math.min(meet,monkeyGround,previewEnd);
  const airHit=end===meet && at(end).y>=.005;
  let result='觀察結束';
  if(end===meet)result=airHit?'子彈射中猴子':'在地面相遇';
  else if(Math.abs(ballGround-monkeyGround)<1e-6 && Math.abs(end-ballGround)<1e-6)result='同時著地';
  else if(end===ballGround)result='軟球先著地';
  else if(end===monkeyGround)result='猴子先著地';
  else if(end===side||end===top)result='軟球離開畫面';
  return {at,end,previewEnd,result,airHit};
}
