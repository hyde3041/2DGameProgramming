window.SwordsmanMotion=(()=>{
 const rad=x=>x*Math.PI/180;
 const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 function rotate([x,y],degrees){const a=rad(degrees),c=Math.cos(a),s=Math.sin(a);return[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}
 function pose(r,index){index=Math.max(0,Math.min(15,index));const lo=Math.floor(index),hi=Math.min(15,lo+1),t=index-lo,a=r.frames[lo],b=r.frames[hi],f={};
  for(const k of ['arm','forearm','wrist','weapon','body'])f[k]=a[k]+(b[k]-a[k])*t;
  f.translation=a.translation.map((x,n)=>x+(b.translation[n]-x)*t);
  const body=mul([1,0,0,1,...f.translation],rotate(r.body_root,f.body));
  const arm=mul(body,rotate(r.arm_root,f.arm));
  // The pre-separated arm is one complete image. Do not split it at an elbow.
  const forearm=arm,weapon=arm;
  return{f,matrices:{body,arm,forearm,weapon,feet:[1,0,0,1,0,0]},shoulder:point(body,r.arm_root),grip:point(weapon,r.hand_root),tip:point(weapon,r.blade_tip)};
 }
 async function load(bundle){const images={};await Promise.all(Object.entries(bundle.urls).map(async([n,url])=>{const im=new Image();im.src=url;await im.decode();images[n]=im;}));const shoulderCanvas=document.createElement('canvas');shoulderCanvas.width=shoulderCanvas.height=320;return{...bundle,images,shoulderCanvas};}
 function stamp(ctx,image,m){ctx.save();ctx.setTransform(...m);ctx.drawImage(image,0,0);ctx.restore();}
 function drawLayers(ctx,b,index,order=b.rig.layer_order){ctx.clearRect(0,0,320,320);const p=pose(b.rig,index);
  for(const name of order){
   if(name==='shoulder_socket'){
    // Extend the original upper sleeve inward along the arm, without scaling.
    // Mask only the joint so a stationary duplicate sleeve never hangs below it.
    const c=b.shoulderCanvas,s=c.getContext('2d'),radius=b.rig.shoulder_socket_radius_px,feather=b.rig.shoulder_socket_feather_px;
    const offset=b.rig.shoulder_socket_offset;
    const [rest,full]=b.rig.shoulder_socket_fade_degrees,opacity=Math.max(0,Math.min(1,(Math.abs(p.f.arm)-rest)/(full-rest)));
    s.clearRect(0,0,320,320);stamp(s,b.images.arm,mul(p.matrices.arm,[1,0,0,1,...offset]));
    s.save();s.setTransform(...p.matrices.body);s.globalCompositeOperation='destination-in';
    const gradient=s.createRadialGradient(...b.rig.arm_root,radius-feather,...b.rig.arm_root,radius);
    gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=gradient;s.fillRect(0,0,320,320);s.restore();
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=opacity;ctx.drawImage(c,0,0);ctx.restore();continue;
   }
   if(name==='shoulder_overlap'){
    // Feather the existing torso over the joint, without a hard circular seam.
    const c=b.shoulderCanvas,s=c.getContext('2d'),radius=b.rig.shoulder_overlap_radius_px,feather=b.rig.shoulder_overlap_feather_px||0;
    s.clearRect(0,0,320,320);stamp(s,b.images.base,p.matrices.body);
    s.save();s.setTransform(...p.matrices.body);s.globalCompositeOperation='destination-in';
    const gradient=s.createRadialGradient(...b.rig.arm_root,Math.max(0,radius-feather),...b.rig.arm_root,radius);
    gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=gradient;s.fillRect(0,0,320,320);s.restore();
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(c,0,0);ctx.restore();continue;
   }
   const group=name.replace(/^under:/,'');
   const matrix=group==='feet'?p.matrices.feet:(group===b.rig.weapon_arm||group==='arm_under'||group==='weapon'?p.matrices.arm:p.matrices.body);
   stamp(ctx,b.images[name],matrix);
  }
  return p;
 }
 function draw(ctx,b,index){return drawLayers(ctx,b,index);}
 function drawOriginalDepth(ctx,b,index){
  // Used by the sheet builder to preserve the original hand/grip pixels.
  const previousOrder=b.rig.layer_order.filter(name=>name!=='weapon').concat('weapon');
  return drawLayers(ctx,b,index,previousOrder);
 }
 return{load,draw,drawOriginalDepth,pose,stamp,point,mul};
})();
