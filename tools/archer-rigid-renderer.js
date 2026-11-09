// Runtime-independent authoring rig. Each part uses a SINGLE texture and a
// unit-scale rigid transform in every frame. Never swap pose drawings.
window.ArcherRigid=(()=>{
 const mix=(a,b,t)=>a+(b-a)*t,lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);},rad=x=>x*Math.PI/180;
 const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
 function ik(s,grip,upper,lower,branch){const dx=grip[0]-s[0],dy=grip[1]-s[1],d=Math.hypot(dx,dy);if(d>upper+lower+.001||d<Math.abs(upper-lower)-.001)throw Error('Unreachable wrist target');const u=[dx/d,dy/d],x=(upper*upper-lower*lower+d*d)/(2*d),h=Math.sqrt(Math.max(0,upper*upper-x*x));return[s[0]+u[0]*x-u[1]*h*branch,s[1]+u[1]*x+u[0]*h*branch];}
 function chain(s,g,r,branch){const[a,b]=r.arm_lengths,hand=r.hand_length,dx=g[0]-s[0],dy=g[1]-s[1],distance=Math.hypot(dx,dy),reach=Math.max(Math.abs(a-b-hand)+.1,Math.min(a+b+hand-.1,distance)),tip=distance>1e-8?[s[0]+dx/distance*reach,s[1]+dy/distance*reach]:[s[0],s[1]+reach],elbow=ik(s,tip,a,b+hand,branch),theta=angle(elbow,tip),wrist=[elbow[0]+b*Math.cos(theta),elbow[1]+b*Math.sin(theta)];return{shoulder:s,elbow,wrist,grip:tip,requestedGrip:g,reachAdjusted:Math.abs(distance-reach)>1e-7,upperAngle:angle(s,elbow),forearmAngle:theta};}
 function pose(r,f){
  const raise=[0,.12,.4,.73,.94,1,1,1,1,1,.97,.8,.55,.28,.08,.012][f],draw=[0,0,.05,.2,.5,.8,1,1,0,0,0,0,0,0,0,0][f];
  const grip=lerp(r.restGrip,r.aimGrip,raise),direction=r.aimGrip[0]>r.aimPull[0]?1:-1;
  const nearString=[r.aimPull[0]+direction*9,r.aimPull[1]+2],staged=lerp(r.restPull,nearString,raise);let pull=lerp(staged,r.aimPull,draw);
  if(f>=7&&f<=10){const recoil=[0,0,0,0,0,0,0,0,1,.55,.15][f];pull=[r.aimPull[0]-direction*4*recoil,r.aimPull[1]-2*recoil];}
  if(f>=11)pull=lerp(r.aimPull,r.restPull,smooth((f-10)/5));
  const bow=chain(r.bowShoulder,grip,r,r.bowBranch),drawing=chain(r.pullShoulder,pull,r,r.pullBranch);
  const bowAngle=rad(r.bowAngle*raise),topBottom=r.tips.map(p=>{const x=p[0]-r.bowPivot[0],y=p[1]-r.bowPivot[1];return[grip[0]+Math.cos(bowAngle)*x-Math.sin(bowAngle)*y,grip[1]+Math.sin(bowAngle)*x+Math.cos(bowAngle)*y];});
  const middle=lerp(topBottom[0],topBottom[1],.5);let nock=lerp(middle,pull,smooth(raise/.5));
  if(f>=7){const k=f-7,osc=Math.exp(-k*1.6)*Math.cos(k*2.8);nock=lerp(middle,r.aimPull,osc);}
  return{bow,drawing,grip,pull,nock,tips:topBottom,bowAngle,headAngle:rad(-.4*draw),hairAngle:rad(Math.sin(f*.5)*.8*raise)};
 }
 async function load(b){const images={};await Promise.all(Object.entries(b.urls).map(async([name,src])=>{const im=new Image;im.src=src;await im.decode();images[name]=im;}));return{...b,images};}
 function draw(ctx,b,f){const r=b.rig,i=b.images,p=pose(r,f),transforms=[];ctx.clearRect(0,0,320,320);
  const part=(name,start,theta=0,pivot=[16,32])=>{ctx.save();ctx.translate(...start);ctx.rotate(theta);ctx.translate(-pivot[0],-pivot[1]);ctx.drawImage(i[name],0,0);ctx.restore();transforms.push({name,a:Math.cos(theta),b:Math.sin(theta),c:-Math.sin(theta),d:Math.cos(theta),start,pivot});};
  part('hair',r.hairPivot,p.hairAngle,r.hairPivot);
  part('bow-upper',p.bow.shoulder,p.bow.upperAngle);part('pull-upper',p.drawing.shoulder,p.drawing.upperAngle);
  part('under',[0,0],0,[0,0]);part('base',[0,0],0,[0,0]);
  part('bow',p.grip,p.bowAngle,r.bowPivot);
  ctx.strokeStyle='#c5b99c';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(...p.tips[0]);ctx.lineTo(...p.nock);ctx.lineTo(...p.tips[1]);ctx.stroke();
  part('bow-forearm',p.bow.elbow,p.bow.forearmAngle);part('pull-forearm',p.drawing.elbow,p.drawing.forearmAngle);
  part('bow-hand',p.bow.wrist,p.bow.forearmAngle);part('pull-hand',p.drawing.wrist,p.drawing.forearmAngle);
  if(f>=3&&f<=9){let origin=p.nock,theta=angle(r.aimPull,r.aimGrip);if(f>=7){origin=[r.aimPull[0]+Math.cos(theta)*(f-7)*45,r.aimPull[1]+Math.sin(theta)*(f-7)*45];}part('arrow',origin,theta,[4,i.arrow.height/2]);}
  part('head',r.headPivot,p.headAngle,r.headPivot);return{pose:p,transforms};
 }
 return{load,draw,pose};
})();
