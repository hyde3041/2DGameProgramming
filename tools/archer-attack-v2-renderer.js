window.ArcherAttackV2=(()=>{
 const rad=d=>d*Math.PI/180;
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 function motion(b,index){const{rig:r,view}=b,f=Math.max(0,Math.min(15,index)),lo=Math.floor(f),hi=Math.min(15,lo+1),mix=f-lo,t=f/16,draw=smooth((t-.10)/.28)*(1-smooth((t-.68)/.32)),recoil=f>=7?Math.exp(-(f-7)*.5)*Math.sin((f-7)*1.6):0,extra=r.head_motion?(r.head_motion.extra_angle_degrees[lo]*(1-mix)+r.head_motion.extra_angle_degrees[hi]*mix)*r.head_motion.view_sign[view]:0;return{draw,recoil,bodyY:-.5*draw,bodyX:(view==='back'?-1:1)*recoil*.7,headAngle:(view==='back'?1:-1)*draw*.8+recoil*.65+extra};}
 async function load(bundle){const images={};await Promise.all(Object.entries(bundle.urls).map(async([n,src])=>{const im=new Image;im.src=src;await im.decode();images[n]=im;}));return{...bundle,images};}
 function draw(ctx,b,f){
  const {images:i,rig:r,alignment:a,view}=b;ctx.clearRect(0,0,320,320);
  if(f===0){ctx.drawImage(i.idle,0,0,320,320,0,0,320,320);return;}
  const{draw,recoil,bodyY,bodyX,headAngle}=motion(b,f);
  ctx.drawImage(i['under:legs'],0,0);ctx.drawImage(i.legs,0,0);
  const delayedHead=r.hair_follow?motion(b,f-r.hair_follow.lag_frames).headAngle:headAngle,lag=r.hair_follow?r.hair_follow.lag_strength*(delayedHead-headAngle):0;
  ctx.save();
  if(r.hair_follow){ctx.translate(a.pivots.head[0]+bodyX*.5,a.pivots.head[1]+bodyY*.8);ctx.rotate(rad(headAngle));ctx.translate(-a.pivots.head[0],-a.pivots.head[1]);}
  ctx.translate(a.pivots.hair[0],a.pivots.hair[1]);ctx.rotate(rad(Math.sin((f-2)*.6)*draw*1.6-recoil*1.5+lag));ctx.translate(-a.pivots.hair[0]-(r.hair_follow?0:recoil*.5),-a.pivots.hair[1]+(r.hair_follow?0:bodyY));ctx.drawImage(i['under:hair-tail'],0,0);ctx.drawImage(i['hair-tail'],0,0);ctx.restore();
  if(view!=='back')ctx.drawImage(i.gear,bodyX,bodyY);
  const frame=r.frames[f];ctx.save();ctx.translate(r.target_neck[0]+bodyX,r.target_neck[1]+bodyY);ctx.scale(r.scale,r.scale);ctx.drawImage(i['pose-'+f],-frame.source_neck[0],-frame.source_neck[1]);ctx.restore();
  if(view==='back')ctx.drawImage(i.gear,bodyX,bodyY);
  const headImage=i['head-pose-'+r.hair_motion?.pose_index[f]]||i.head;
  ctx.save();ctx.translate(a.pivots.head[0]+bodyX*.5,a.pivots.head[1]+bodyY*.8);ctx.rotate(rad(headAngle));ctx.translate(-a.pivots.head[0],-a.pivots.head[1]);ctx.drawImage(headImage,0,0);ctx.restore();
 }
 return{load,draw,motion};
})();
