window.SwordsmanAttack = (() => {
  async function load(bundle) {
    const images={};
    await Promise.all(Object.entries(bundle.urls).map(async([name,src])=>{
      const image=new Image(); image.src=src; await image.decode(); images[name]=image;
    }));
    return {...bundle,images};
  }
  function draw(ctx,bundle,index) {
    const {rig,images}=bundle, frame=rig.frames[index];
    const angle=frame.angle_degrees*Math.PI/180, [x,y]=rig.pivot;
    ctx.clearRect(0,0,320,320);
    ctx.save();
    ctx.translate(x+frame.translation[0],y+frame.translation[1]);
    ctx.rotate(angle); ctx.translate(-x,-y);
    ctx.drawImage(images[frame.pose+'-upper'],0,0);
    ctx.restore();
    ctx.drawImage(images[frame.pose+'-feet'],0,0);
    return {pose:frame.pose,translation:frame.translation,angle:frame.angle_degrees,
      matrix:[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle)],scale:[1,1]};
  }
  return {load,draw};
})();
