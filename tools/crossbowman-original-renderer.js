window.CrossbowAttack=(()=>{
 const rad=x=>x*Math.PI/180;
 const amount=[0,.08,.25,.52,.79,.95,1,1.025,.97,.99,.985,.91,.68,.4,.17,.035];
 async function load(b){const images={};await Promise.all(Object.entries(b.urls).map(async([n,src])=>{const im=new Image;im.src=src;await im.decode();images[n]=im;}));return{...b,images};}
 function draw(ctx,b,f){
  const {images:i,rig:r,view}=b;ctx.clearRect(0,0,320,320);
  if(f===0){ctx.drawImage(i.idle,0,0,320,320,0,0,320,320);return;}
  const theta=rad(view==='back'?18*(1-amount[f]):r.angle*amount[f]),p=r.pivot;
  const point=q=>[p[0]+Math.cos(theta)*(q[0]-p[0])-Math.sin(theta)*(q[1]-p[1]),p[1]+Math.sin(theta)*(q[0]-p[0])+Math.cos(theta)*(q[1]-p[1])];
  ctx.drawImage(i.under,0,0);
  ctx.drawImage(i.base,0,0);
  ctx.drawImage(i.scarf,0,0);
  ctx.save();ctx.translate(...p);ctx.rotate(theta);ctx.translate(-p[0],-p[1]);ctx.drawImage(i.moving,0,0);ctx.restore();
  // Original jaw/collar remain at their original RGBA coordinates. There is
  // no independent head fitting, scaling, or replacement torso.
  ctx.drawImage(i.head,0,0);
  if(f>=7&&f<=9){const m=point(r.muzzle),d=(f-7)*48;ctx.save();ctx.translate(m[0]+d,m[1]);const scale=38/i.arrow.width;ctx.scale(scale,scale);ctx.drawImage(i.arrow,-4,-i.arrow.height/2);ctx.restore();}
 }
 return{load,draw};
})();
