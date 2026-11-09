window.CrossbowAttack=(()=>{
 const rad=x=>x*Math.PI/180,smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
 async function load(bundle){const images={};await Promise.all(Object.entries(bundle.urls).map(async([n,src])=>{const im=new Image;im.src=src;await im.decode();images[n]=im;}));return{...bundle,images};}
 function draw(ctx,b,f){
  const{images:i,rig:r,alignment:a,view}=b;ctx.clearRect(0,0,320,320);
  if(f===0){ctx.drawImage(i.idle,0,0,320,320,0,0,320,320);return;}
  const aim=smooth((f-1)/3)*(1-smooth((f-10)/5)),recoil=f>=7?Math.exp(-(f-7)*.6):0,headRecoil=f>=8?Math.exp(-(f-8)*.7):0;
  ctx.drawImage(i.legs,0,0);
  const pose=r.frames[f];ctx.save();ctx.translate(r.target_neck[0]-recoil*.9,r.target_neck[1]-.45*aim);ctx.scale(r.scale,r.scale);ctx.drawImage(i['pose-'+f],-pose.source_neck[0],-pose.source_neck[1]);ctx.restore();
  ctx.save();ctx.translate(a.pivots.head[0]-headRecoil*.5,a.pivots.head[1]-.3*aim);ctx.rotate(rad(-.4*aim+.7*headRecoil));ctx.translate(-a.pivots.head[0],-a.pivots.head[1]);ctx.drawImage(i.head,0,0);ctx.restore();
  if(f>=7&&f<=9){const release=r.frames[7],muzzle=r.source_muzzle,origin=[r.target_neck[0]+r.scale*(muzzle[0]-release.source_neck[0])-30-.9,r.target_neck[1]+r.scale*(muzzle[1]-release.source_neck[1])-.45],distance=(f-7)*48;ctx.save();ctx.translate(origin[0]+distance,origin[1]);const s=38/i.arrow.width;ctx.scale(s,s);ctx.drawImage(i.arrow,-4,-i.arrow.height/2);ctx.restore();}
 }
 return{load,draw};
})();
