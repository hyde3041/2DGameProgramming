// Bake original separated artwork; --apply promotes all three directions.
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game'),out=path.join(root,'.build/archer-attack-rigid'),apply=process.argv.includes('--apply');
await fs.mkdir(out,{recursive:true});const sources=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-rigid-rig.json'),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});const animations={},qa={};
// Trim only tiny disconnected raster remnants. Limb textures and dimensions
// remain fixed; this does not resize or interpolate any character part.
function trimDust(pixels){const seen=new Uint8Array(320*320);let removed=0;for(let i=0;i<seen.length;i++){if(seen[i]||pixels[i*4+3]<8)continue;const q=[i];seen[i]=1;for(let j=0;j<q.length;j++){const p=q[j],x=p%320,y=Math.floor(p/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,n=yy*320+xx;if(xx>=0&&xx<320&&yy>=0&&yy<320&&!seen[n]&&pixels[n*4+3]>=8){seen[n]=1;q.push(n);}}}if(q.length<=3){for(const p of q){pixels.fill(0,p*4,p*4+4);removed++;}}}return removed;}
try{
 const page=await browser.newPage();await page.setContent('<canvas id="c" width="320" height="320"></canvas>');await page.addScriptTag({path:path.join(root,'tools/archer-rigid-renderer.js')});const bundles={};
 for(const view of ['front','back','side'].filter(v=>sources.views[v])){
  const rig=sources.views[view];
  const files=rig.parts;
  const urls={};for(const[n,p]of Object.entries(files))urls[n]='data:image/png;base64,'+(await fs.readFile(path.join(game,p))).toString('base64');bundles[view]={view,rig,urls};
 }
 await page.evaluate(async bundles=>{window.players={};for(const[v,b]of Object.entries(bundles))players[v]=await ArcherRigid.load(b);},bundles);
 for(const view of Object.keys(bundles)){
  const folder=path.join(out,view);await fs.mkdir(folder,{recursive:true});const frames=[];
  const idle0=await sharp(path.join(game,`asset/character/main/archer/${view}/idle-sheet.png`)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
  const rigChecks=[];let trimmed=0;
  for(let f=0;f<16;f++){
   const result=await page.evaluate(({v,f})=>{const c=document.querySelector('canvas'),rig=ArcherRigid.draw(c.getContext('2d'),players[v],f);return{url:c.toDataURL(),rig};},{v:view,f});
   const pixels=await sharp(Buffer.from(result.url.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();rigChecks.push(result.rig);
   trimmed+=trimDust(pixels);
   // Preserve original sole pixels exactly, including the antialiased edge.
   for(let y=284;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;idle0.copy(pixels,p,p,p+4);}
   const png=await sharp(pixels,{raw:{width:320,height:320,channels:4}}).png().toBuffer();frames.push(pixels);await fs.writeFile(path.join(folder,`${String(f).padStart(2,'0')}.png`),png);
  }
  const atlas=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(atlas,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
  const file=path.join(out,`${view}-attack-sheet.png`);await sharp(atlas,{raw:{width:1280,height:1280,channels:4}}).png().toFile(file);
  const dir=view==='side'?'right':view;animations[dir]={file:`asset/character/main/archer/${view}/attack-sheet.png`,width:1280,height:1280,columns:4,rows:4,loop:false,return_to:`${dir}_idle`,duration_ms:1000,frame_duration_ms:62.5,frames:frames.map((_,f)=>({index:f,rect:[f%4*320,Math.floor(f/4)*320,320,320],pico2d_rect:[f%4*320,960-Math.floor(f/4)*320,320,320],duration_ms:62.5}))};
  let maxMatrixError=0,maxBoneError=0;
  for(const frame of rigChecks){for(const t of frame.transforms)maxMatrixError=Math.max(maxMatrixError,Math.abs(t.a*t.a+t.b*t.b-1),Math.abs(t.c*t.c+t.d*t.d-1),Math.abs(t.a*t.d-t.b*t.c-1));for(const arm of[frame.pose.bow,frame.pose.drawing])maxBoneError=Math.max(maxBoneError,Math.abs(Math.hypot(arm.elbow[0]-arm.shoulder[0],arm.elbow[1]-arm.shoulder[1])-17),Math.abs(Math.hypot(arm.wrist[0]-arm.elbow[0],arm.wrist[1]-arm.elbow[1])-19),Math.abs(Math.hypot(arm.grip[0]-arm.wrist[0],arm.grip[1]-arm.wrist[1])-7));}
  if(maxMatrixError>1e-8||maxBoneError>1e-8)throw Error('Part scale or limb length changed');
  qa[view]={frames:16,unique:new Set(frames.map(x=>x.toString('base64'))).size,max_unit_transform_error:maxMatrixError,max_bone_length_error:maxBoneError,trimmed_isolated_raster_pixels:trimmed};await fs.writeFile(path.join(out,view+'-rig-frames.json'),JSON.stringify(rigChecks,null,2)+'\n');
 }
 const views=Object.keys(bundles);const previewWidth=views.length*400;
 const sheets={};for(const view of views)sheets[view]='data:image/png;base64,'+(await fs.readFile(path.join(out,`${view}-attack-sheet.png`))).toString('base64');
 await page.evaluate(async({sheets,views,width})=>{window.sheets={};for(const[v,src]of Object.entries(sheets)){const im=new Image;im.src=src;await im.decode();window.sheets[v]=im;}const c=document.querySelector('canvas');c.width=width;c.height=340;window.renderPreview=t=>{const ctx=c.getContext('2d');ctx.fillStyle='#e6e3dd';ctx.fillRect(0,0,c.width,c.height);views.forEach((v,n)=>{const f=t>=1?0:Math.min(15,Math.floor(t*16));ctx.drawImage(window.sheets[v],f%4*320+60,Math.floor(f/4)*320+115,250,185,n*400+6,10,375,277.5);ctx.fillStyle='#37403e';ctx.font='18px sans-serif';ctx.fillText(v.toUpperCase(),n*400+150,320);});};renderPreview(6/16);},{sheets,views,width:previewWidth});
 await fs.writeFile(path.join(out,'preview.png'),Buffer.from((await page.locator('canvas').evaluate(c=>c.toDataURL())).split(',')[1],'base64'));
 const mp4=await page.evaluate(async()=>{const c=document.querySelector('canvas'),mime='video/mp4;codecs=avc1.42001E',stream=c.captureStream(60),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();await new Promise(resolve=>{function tick(now){const sec=(now-start)/1000;renderPreview(sec%1.55);if(sec<6.2)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());return await new Promise(resolve=>{const r=new FileReader;r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:mime}));});});
 await fs.writeFile(path.join(out,'preview.mp4'),Buffer.from(mp4.split(',')[1],'base64'));
 if(apply){
  if(views.length!==3)throw Error('Prepare all three directions before applying');for(const view of views)await fs.copyFile(path.join(out,`${view}-attack-sheet.png`),path.join(game,`asset/character/main/archer/${view}/attack-sheet.png`));
  const runtime={id:'archer',name:'궁수',version:4,cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,duration_ms:1000,release_frame:7,loop:false,return_to:'idle',first_frame:'rig-rest',animations};await fs.writeFile(path.join(root,'metadata/character/attack/archer.json'),JSON.stringify(runtime,null,2)+'\n');
  for(const name of['archer.json','manifest.json']){const file=path.join(root,'metadata/character/sprites',name),json=JSON.parse(await fs.readFile(file,'utf8'));function update(x){if(!x||typeof x!=='object')return;if(x.id==='archer'&&x.directional_attack_sheets)x.directional_attack_sheets=animations;for(const y of Object.values(x))if(y&&typeof y==='object')update(y);}update(json);await fs.writeFile(file,JSON.stringify(json,null,2)+'\n');}
  await fs.writeFile(path.join(root,'metadata/character/attack/archer-rig.json'),JSON.stringify({...sources,renderer:'tools/archer-rigid-renderer.js'},null,2)+'\n');
  const preview=path.join(game,'asset/character/icon/preview');for(const ext of['png','mp4'])for(const name of['archer-attack-rigid','archer-attack'])await fs.copyFile(path.join(out,'preview.'+ext),path.join(preview,name+'.'+ext));
 }
 await fs.writeFile(path.join(out,'qa.json'),JSON.stringify(qa,null,2)+'\n');console.log(JSON.stringify({views,qa,applied:apply,preview:out}));
}finally{await browser.close();}

