window.SwordsmanSwingEffect=(()=>{
 function at(p,r){return p.grip.map((x,i)=>x+(p.tip[i]-x)*r);}
 function safeRadius(p,wanted){let limit=wanted;for(let n=0;n<2;n++){const delta=p.tip[n]-p.grip[n];if(delta>0)limit=Math.min(limit,(307-p.grip[n])/delta);if(delta<0)limit=Math.min(limit,(12-p.grip[n])/delta);}return Math.max(.7,limit);}
 function line(ctx,points){ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);}
 function draw(ctx,b,index,config){
  config={...config,...(config.view_overrides?.[b.rig.view]||{})};
  ctx.clearRect(0,0,320,320);const opacity=config.opacity_by_frame[index]||0,ghostOpacity=config.ghost_opacity_by_frame[index]||0;if(!opacity&&!ghostOpacity)return {afterimages:[]};
  const from=Math.max(config.swing_start_frame,index-config.history_frames),outer=[],inner=[],rim=[];
  for(let n=0;n<=24;n++){const p=SwordsmanMotion.pose(b.rig,from+(index-from)*n/24),radius=safeRadius(p,Math.max(config.outer_radius,config.minimum_radius_px/b.rig.blade_length));outer.push(at(p,radius));inner.push(at(p,config.inner_radius));rim.push(at(p,radius-.09*Math.sin(Math.PI*n/24)));}
  const now=SwordsmanMotion.pose(b.rig,index);
  ctx.save();ctx.globalAlpha=opacity;
  const wash=ctx.createLinearGradient(...outer[0],...outer.at(-1));
  wash.addColorStop(0,'rgba(46,104,230,0)');wash.addColorStop(.2,'rgba(59,137,255,0.14)');
  wash.addColorStop(.55,'rgba(79,181,255,0.55)');wash.addColorStop(.85,'rgba(112,226,255,0.83)');wash.addColorStop(1,'rgba(237,255,255,0.95)');
  ctx.beginPath();line(ctx,outer);for(const p of inner.slice().reverse())ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=wash;ctx.fill();
  ctx.beginPath();line(ctx,outer);ctx.strokeStyle=wash;ctx.lineWidth=13;ctx.lineCap='butt';ctx.stroke();
  const edge=ctx.createLinearGradient(...outer[0],...outer.at(-1));edge.addColorStop(0,'rgba(230,254,255,0)');edge.addColorStop(.5,'rgba(230,254,255,.7)');edge.addColorStop(1,'rgba(255,255,255,1)');
  ctx.beginPath();line(ctx,outer);for(const p of rim.slice().reverse())ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=edge;ctx.fill();
  const leading=outer.at(-1),near=at(now,.3),v=[leading[0]-near[0],leading[1]-near[1]],length=Math.hypot(...v),normal=[-v[1]/length,v[0]/length];
  ctx.beginPath();ctx.moveTo(near[0]+normal[0]*2,near[1]+normal[1]*2);ctx.lineTo(...leading);ctx.lineTo(near[0]-normal[0]*2,near[1]-normal[1]*2);ctx.closePath();ctx.fillStyle='rgba(240,255,255,.55)';ctx.fill();
  // Actual earlier sword matrices, not duplicate bodies or arbitrary streaks.
  const ghosts=[];
  for(const ghost of config.afterimages){const p=SwordsmanMotion.pose(b.rig,Math.max(config.swing_start_frame,index-ghost.lag_frames));ctx.save();ctx.globalAlpha=ghostOpacity*ghost.opacity;SwordsmanMotion.stamp(ctx,b.images.blade,p.matrices.weapon);ctx.restore();ghosts.push({lag:ghost.lag_frames,grip:p.grip,tip:p.tip,matrix:p.matrices.weapon});}
  ctx.restore();return{outer,inner,afterimages:ghosts};
 }
 return{draw};
})();
