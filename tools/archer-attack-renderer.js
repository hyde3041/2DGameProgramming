/* Rigid cutout authoring only. Runtime uses the baked sprite sheets. */
window.ArcherAttack=(()=>{
  const mix=(a,b,t)=>a+(b-a)*t,point=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));
  const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
  const rad=x=>x*Math.PI/180;
  function turn(p,c,d){const a=rad(d),x=p[0]-c[0],y=p[1]-c[1];return[c[0]+Math.cos(a)*x-Math.sin(a)*y,c[1]+Math.sin(a)*x+Math.cos(a)*y];}
  function ik(s,t,a,b,branch){const dx=t[0]-s[0],dy=t[1]-s[1],dist=Math.hypot(dx,dy),d=Math.min(a+b-.001,Math.max(Math.abs(a-b)+.001,dist)),x=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));return[s[0]+x*dx/dist-branch*h*dy/dist,s[1]+x*dy/dist+branch*h*dx/dist];}
  function bone(ctx,image,anchors,start,end,length){const [a,b]=anchors,scale=length/Math.hypot(b[0]-a[0],b[1]-a[1]);ctx.save();ctx.translate(...start);ctx.rotate(Math.atan2(end[1]-start[1],end[0]-start[0])-Math.atan2(b[1]-a[1],b[0]-a[0]));ctx.scale(scale,scale);ctx.drawImage(image,-a[0],-a[1]);ctx.restore();}
  async function load(bundle){const images={};await Promise.all(Object.entries(bundle.urls).map(async([n,src])=>{const image=new Image;image.src=src;await image.decode();images[n]=image;}));return{rig:bundle.rig,images};}
  function pose(r,t){
    const raise=smooth(t/.25),draw=smooth((t-.25)/.25),recover=smooth((t-.72)/.28),ready=raise*(1-recover);
    const tension=draw*(1-smooth((t-.5625)/.04))*(1-recover);
    const recoil=t>=.5625?Math.exp(-(t-.5625)*15)*Math.sin((t-.5625)*22):0;
    const grip=point(r.restGrip,r.aimGrip,ready);grip[0]+=r.branch*recoil*1.4;
    const stringCenter=point(r.restPull,point(r.aimGrip,r.aimPull,.15),raise);
    let pull=point(stringCenter,r.aimPull,draw);pull[0]-=r.branch*recoil*7;pull[1]-=recoil*2;
    pull=point(pull,r.restPull,recover);
    return{grip,pull,ready,tension,recoil,lean:(-r.branch*1.15*draw+r.branch*1.4*recoil)*(1-recover),dy:-.7*draw*(1-recover),angle:r.bowAngle*ready};
  }
  function draw(ctx,b,t,{clear=true}={}){
    const {rig:r,images:i}=b;if(clear)ctx.clearRect(0,0,320,320);
    if(t<=0||t>=1){ctx.drawImage(i.idle,0,0,320,320,0,0,320,320);return;}
    const p=pose(r,t),waist=[162,242];
    // Fixed legs/feet. Everything else rotates around the original waist.
    ctx.drawImage(i.legs,0,0);ctx.save();ctx.translate(0,p.dy);ctx.translate(...waist);ctx.rotate(rad(p.lean));ctx.translate(-waist[0],-waist[1]);
    const sway=Math.sin(Math.PI*t*2-.4)*p.ready;
    // Underlaps must stay beneath ALL original visible surfaces.
    for(const name of['body','cloth-hem','head'])ctx.drawImage(i['under-'+name],0,0);
    for(const[name,pivot,degrees]of[['hair-tail',[145,155],sway*1.1],['cloth-hem',[162,242],-sway*.8]]){ctx.save();ctx.translate(...pivot);ctx.rotate(rad(degrees));ctx.translate(-pivot[0],-pivot[1]);if(name==='hair-tail')ctx.drawImage(i['under-'+name],0,0);ctx.drawImage(i[name],0,0);ctx.restore();}
    const bowElbow=ik(r.bowShoulder,p.grip,22,25,r.branch),pullElbow=ik(r.pullShoulder,p.pull,21,24,r.branch);
    bone(ctx,i['bow-upper'],r.parts['bow-upper'].anchors,r.bowShoulder,bowElbow,22);
    bone(ctx,i['pull-upper'],r.parts['pull-upper'].anchors,r.pullShoulder,pullElbow,21);
    ctx.drawImage(i.body,0,0);ctx.drawImage(i.gear,0,0);
    ctx.save();ctx.translate(169,212);ctx.rotate(rad(-p.lean*.25));ctx.translate(-169,-212);ctx.drawImage(i.head,0,0);ctx.restore();
    const bowTip=x=>{const u=turn(x,r.restGrip,p.angle);return[u[0]+p.grip[0]-r.restGrip[0],u[1]+p.grip[1]-r.restGrip[1]];};
    const [top,bottom]=r.tips.map(bowTip);
    ctx.save();ctx.translate(...p.grip);ctx.rotate(rad(p.angle));ctx.translate(-r.restGrip[0],-r.restGrip[1]);ctx.drawImage(i.bow,0,0);ctx.restore();
    const midpoint=point(top,bottom,.5);
    let nock=t<.1875?midpoint:p.pull;
    if(t>=.5625){const dt=t-.5625,osc=Math.exp(-dt*32)*Math.cos(dt*78);nock=point(midpoint,r.aimPull,osc);}
    ctx.strokeStyle='#ded6b8';ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(...top);ctx.lineTo(...nock);ctx.lineTo(...bottom);ctx.stroke();
    if(t>=.1875&&t<.875){
      let origin=nock,dir=[p.grip[0]-p.pull[0],p.grip[1]-p.pull[1]];
      if(t>=.5625){const release=pose(r,.5624);origin=release.pull;dir=[release.grip[0]-origin[0],release.grip[1]-origin[1]];const norm=Math.hypot(...dir);origin=[origin[0]+dir[0]/norm*(t-.5625)*600,origin[1]+dir[1]/norm*(t-.5625)*600];}
      const arrow=i.arrow,scale=63/arrow.width;ctx.save();ctx.translate(...origin);ctx.rotate(Math.atan2(dir[1],dir[0]));if(r.branch<0){ctx.scale(-1,1);ctx.translate(-63,0);}ctx.scale(scale,scale);ctx.drawImage(arrow,0,-arrow.height/2);ctx.restore();
    }
    bone(ctx,i['bow-forearm'],r.parts['bow-forearm'].anchors,bowElbow,p.grip,25);
    const open=t>=.5625&&t<.82?'pull-open':'pull-forearm';
    bone(ctx,i[open],r.parts[open].anchors,pullElbow,p.pull,24);
    ctx.restore();
  }
  return{load,draw,pose};
})();
