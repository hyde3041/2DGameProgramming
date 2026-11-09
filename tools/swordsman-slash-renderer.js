// A tapered motion ribbon, authored as geometry rather than replacement art.
// It is baked behind the original character, never into a body part.
window.SwordsmanSlash = (() => {
  function sample(curve,t) {
    const [a,b,c,d]=curve, s=1-t;
    const point=[0,1].map(n=>s*s*s*a[n]+3*s*s*t*b[n]+3*s*t*t*c[n]+t*t*t*d[n]);
    const tangent=[0,1].map(n=>3*s*s*(b[n]-a[n])+6*s*t*(c[n]-b[n])+3*t*t*(d[n]-c[n]));
    const length=Math.hypot(...tangent);
    return {point,normal:[-tangent[1]/length,tangent[0]/length]};
  }
  function ribbon(ctx,curve,frame,width,color) {
    const left=[],right=[],steps=48;
    for(let k=0;k<=steps;k++) {
      const v=k/steps, t=frame.start+(frame.end-frame.start)*v;
      const {point,normal}=sample(curve,t);
      const taper=Math.pow(Math.sin(Math.PI*v),0.7)*(0.35+0.65*v);
      const halfWidth=width*taper/2;
      left.push([point[0]+normal[0]*halfWidth,point[1]+normal[1]*halfWidth]);
      right.push([point[0]-normal[0]*halfWidth,point[1]-normal[1]*halfWidth]);
    }
    ctx.beginPath();ctx.moveTo(...left[0]);
    for(const p of left.slice(1))ctx.lineTo(...p);
    for(const p of right.reverse())ctx.lineTo(...p);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  function glint(ctx,x,y,amount) {
    if(!amount)return;
    ctx.save();ctx.translate(x,y);ctx.globalAlpha*=amount;
    const glow=ctx.createRadialGradient(0,0,0,0,0,13);
    glow.addColorStop(0,'rgba(105,190,255,0.45)');
    glow.addColorStop(1,'rgba(70,160,255,0)');
    ctx.fillStyle=glow;ctx.fillRect(-13,-13,26,26);
    for(const [w,h,color] of [[7,12,'rgba(105,193,255,0.9)'],[4,8,'rgba(245,255,255,0.98)']]) {
      ctx.beginPath();ctx.moveTo(0,-h);ctx.lineTo(w*.2,-h*.18);
      ctx.lineTo(w,0);ctx.lineTo(w*.2,h*.18);
      ctx.lineTo(0,h);ctx.lineTo(-w*.2,h*.18);
      ctx.lineTo(-w,0);ctx.lineTo(-w*.2,-h*.18);
      ctx.closePath();ctx.fillStyle=color;ctx.fill();
    }
    ctx.restore();
  }
  function draw(ctx,config,view,index,rig) {
    ctx.clearRect(0,0,320,320);
    const frame=config.frames_active[index];
    if(!frame)return;
    const spec=config.views[view], motion=rig.frames[index];
    const theta=motion.angle_degrees*Math.PI/180, [px,py]=rig.pivot;
    const curve=spec.sweep_curve.map(([x,y])=>[x+frame.forward,y]);
    const width=frame.width*spec.width_scale;
    // A torso-height sweep follows the original rigid body transform.
    ctx.save();ctx.translate(px+motion.translation[0],py+motion.translation[1]);
    ctx.rotate(theta);ctx.translate(-px,-py);
    ctx.globalAlpha=frame.opacity;
    const tint=ctx.createLinearGradient(...curve[0],...curve[3]);
    tint.addColorStop(0,'rgba(66,137,244,0)');
    tint.addColorStop(0.25,'rgba(75,160,255,0.5)');
    tint.addColorStop(0.65,'rgba(83,198,255,0.95)');
    tint.addColorStop(1,'rgba(161,236,255,1)');
    const core=ctx.createLinearGradient(...curve[0],...curve[3]);
    core.addColorStop(0,'rgba(214,248,255,0)');
    core.addColorStop(0.3,'rgba(226,252,255,0.7)');
    core.addColorStop(0.7,'rgba(246,255,255,1)');
    core.addColorStop(1,'rgba(255,255,255,1)');
    ctx.save();ctx.globalAlpha*=0.2;
    ribbon(ctx,curve,frame,width*1.7,tint);
    ctx.restore();
    ribbon(ctx,curve,frame,width,tint);
    ribbon(ctx,curve,frame,width*0.34,core);
    const echo=curve.map(([x,y])=>[x-3,y+6]);
    ctx.save();ctx.globalAlpha*=0.66;
    ribbon(ctx,echo,frame,width*0.1,tint);
    ctx.restore();
    glint(ctx,...curve[3],frame.glint);
    ctx.restore();
  }
  return {draw};
})();
