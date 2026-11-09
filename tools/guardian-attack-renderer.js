window.GuardianAttack=(()=>{
 const rad=x=>x*Math.PI/180;
 const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 function rotation([x,y],degrees){const c=Math.cos(rad(degrees)),s=Math.sin(rad(degrees));return[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}
 const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 function pose(r,i){const f=r.frames[i],body=mul([1,0,0,1,...f.translation],rotation(r.body_root,f.body));
   const arm=rotation(r.shield_root,r.arm_base_degrees+f.shield_arm),grip=point(arm,r.shield_grip);
   const follow=[1,0,0,1,grip[0]-r.plate_contact[0],grip[1]-r.plate_contact[1]];
   return{body,feet:[1,0,0,1,0,0],arm:body,shield_arm:mul(body,arm),
     shield:mul(body,mul(follow,rotation(r.plate_contact,f.shield_tilt))),head:body,cloth:body,tail:body};}
 function idlePose(r,m,seconds){
   const t=((seconds%1)+1)%1,tau=Math.PI*2,breath=t=>.5-.5*Math.cos(tau*t),delayed=(lag)=>breath(t-lag)-breath(-lag),swing=lag=>Math.sin(tau*(t-lag))-Math.sin(-tau*lag),v=r.idle_rig;
   const body=mul([1,0,0,1,0,-m.body_rise_px*breath(t)],rotation(v.body_root,m.body_sway_degrees*Math.sin(tau*t)));
   const head=mul(body,rotation(v.head_root,m.head_tilt_degrees*swing(m.head_delay_seconds)));
   const left=mul(body,rotation(v.arm_roots['arm-left'],m.arm_rotation_degrees[0]*swing(m.arm_delay_seconds[0])));
   const right=mul(body,rotation(v.arm_roots['arm-right'],-m.arm_rotation_degrees[1]*swing(m.arm_delay_seconds[1])));
   const tail=mul(head,mul([1,0,0,1,m.tail_translation_px*delayed(m.tail_delay_seconds[1]),0],rotation(v.tail_root,-m.tail_rotation_degrees*delayed(m.tail_delay_seconds[0]))));
   const cloth=mul(body,mul([1,0,0,1,m.cloth_translation_px*delayed(.16),0],rotation(v.cloth_root,-m.cloth_rotation_degrees*delayed(.13))));
   const arms={'arm-left':left,'arm-right':right};
   const shieldDelta=r.shield_arm==='arm-left'?m.arm_rotation_degrees[0]*swing(m.arm_delay_seconds[0]):-m.arm_rotation_degrees[1]*swing(m.arm_delay_seconds[1]);
   const shieldArm=rotation(r.shield_root,r.arm_base_degrees+shieldDelta),grip=point(shieldArm,r.shield_grip),follow=[1,0,0,1,grip[0]-r.plate_contact[0],grip[1]-r.plate_contact[1]];
   return{body,head,cloth,tail,feet:[1,0,0,1,0,0],arm:arms[r.weapon_arm],shield_arm:mul(body,shieldArm),shield:mul(body,mul(follow,rotation(r.plate_contact,shieldDelta)))};
 }
 async function load(b){const images={};await Promise.all(Object.entries(b.urls).map(async([name,url])=>{const im=new Image();im.src=url;await im.decode();images[name]=im;}));return{...b,images};}
 function stamp(ctx,im,m){ctx.save();ctx.setTransform(...m);ctx.drawImage(im,0,0);ctx.restore();}
 function drawLayers(ctx,b,m){ctx.clearRect(0,0,320,320);const r=b.rig;
   for(const name of r.layer_order){
     if(name==='rear_hand_grip'){
       const grip=r.rear_hand_grip;
       ctx.save();
       ctx.setTransform(...m.shield_arm);
       ctx.beginPath();
       ctx.arc(grip.center[0],grip.center[1],grip.radius,0,Math.PI*2);
       ctx.clip();
       ctx.drawImage(b.images.shield_arm_native,0,0);
       ctx.restore();
       continue;
     }
     const group=name.replace(/^under:/,'');
     const matrix=group==='legs'?m.feet:group==='shield'?m.shield:name==='shield_arm_native'?m.shield_arm:group===r.weapon_arm||group==='weapon'?m.arm:group==='head'?m.head:group==='hair-tail'?m.tail:group==='cloth-hem'?m.cloth:m.body;
     stamp(ctx,b.images[name],matrix);
   }
   return m;
 }
 function draw(ctx,b,i){return drawLayers(ctx,b,pose(b.rig,i));}
 function drawIdle(ctx,b,seconds){return drawLayers(ctx,b,idlePose(b.rig,b.idleMotion,seconds));}
 return{load,draw,drawIdle,pose,idlePose,drawLayers,mul,stamp};
})();
