window.CrossbowAttack=(()=>{
 async function load(bundle){const images={};await Promise.all(Object.entries(bundle.urls).map(async([name,src])=>{const im=new Image;im.src=src;await im.decode();images[name]=im;}));return{...bundle,images};}
 function draw(ctx,b,index){const{rig:r,images:i}=b,f=r.frames[index],theta=f.angle_degrees*Math.PI/180,p=r.pivot;ctx.clearRect(0,0,320,320);
  ctx.save();ctx.translate(p[0]+f.translation[0],p[1]+f.translation[1]);ctx.rotate(theta);ctx.translate(-p[0],-p[1]);ctx.drawImage(i[f.pose],0,0);ctx.restore();
  ctx.drawImage(i.feet,0,0);
  return{pose:f.pose,translation:f.translation,angle:f.angle_degrees,matrix:[Math.cos(theta),Math.sin(theta),-Math.sin(theta),Math.cos(theta)],scale:[1,1]};
 }
 return{load,draw};
})();
