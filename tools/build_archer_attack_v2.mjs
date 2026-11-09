// Bake connected attack drawings. --apply promotes the verified three-direction set.
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game'),out=path.join(root,'.build/archer-attack-v2'),apply=process.argv.includes('--apply');
await fs.mkdir(out,{recursive:true});const sources=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-v2-sources.json'),'utf8')),alignment=JSON.parse(await fs.readFile(path.join(root,'metadata/character/layers/archer.json'),'utf8'));
const cleanup=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-cleanup.json'),'utf8'));
const proportions=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-arm-proportions.json'),'utf8'));
const headMotion=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-head-motion.json'),'utf8'));
const hairMotion=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-hair-motion.json'),'utf8'));
const importedDirections={};
const importMetadata='metadata/character/attack/archer-import.json';
try{
 const imported=JSON.parse(await fs.readFile(path.join(root,importMetadata),'utf8'));
 if(imported.enabled){
  for(const [view,input] of Object.entries(imported.views)){
   if(input.enabled)importedDirections[view]={file:input.file,metadata:importMetadata};
  }
 }
}catch(error){
 if(error.code!=='ENOENT')throw error;
}
try{
 const imported=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-back-import.json'),'utf8'));
 if(imported.enabled&&!importedDirections.back)importedDirections.back={file:imported.file,metadata:'metadata/character/attack/archer-back-import.json'};
}catch(error){
 if(error.code!=='ENOENT')throw error;
}
const directionOverrides=Object.fromEntries(Object.entries(importedDirections).map(([view,input])=>[view==='side'?'right':view,input.metadata]));
const browser=await chromium.launch({headless:true,channel:'chrome'});const animations={},qa={};
try{
 const page=await browser.newPage();await page.setContent('<canvas id="c" width="320" height="320"></canvas>');await page.addScriptTag({path:path.join(root,'tools/archer-attack-v2-renderer.js')});const bundles={};
 for(const view of ['front','back','side'].filter(v=>sources.views[v])){
  const rig={...sources.views[view],head_motion:headMotion,hair_motion:{...hairMotion.views[view],pose_index:hairMotion.pose_index},hair_follow:hairMotion.tail};
  const a=alignment.views.find(x=>x.direction===view),files={idle:`asset/character/main/archer/${view}/idle-sheet.png`,arrow:'asset/character/icon/layers/archer/front/attack/source/arrow.png'};
  for(const n of['under:legs','legs','under:hair-tail','hair-tail','head','gear'])files[n]=a.idle_groups[n];
  for(const f of rig.frames)files['pose-'+f.index]=f.file;
  Object.assign(files,cleanup.overrides[view]);
  Object.assign(files,proportions.overrides[view]);
  for(const pose of hairMotion.views[view].poses)files['head-pose-'+pose.index]=pose.file;
  const urls={};for(const[n,p]of Object.entries(files))urls[n]='data:image/png;base64,'+(await fs.readFile(path.join(game,p))).toString('base64');bundles[view]={view,rig,alignment:a,urls};
 }
 await page.evaluate(async bundles=>{window.players={};for(const[v,b]of Object.entries(bundles))players[v]=await ArcherAttackV2.load(b);},bundles);
 for(const view of Object.keys(bundles)){
  const folder=path.join(out,view);await fs.mkdir(folder,{recursive:true});const frames=[];
  const idle0=await sharp(path.join(game,`asset/character/main/archer/${view}/idle-sheet.png`)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
  for(let f=0;f<16;f++){
   const url=await page.evaluate(({v,f})=>{const c=document.querySelector('canvas');ArcherAttackV2.draw(c.getContext('2d'),players[v],f);return c.toDataURL();},{v:view,f});
   const pixels=f?await sharp(Buffer.from(url.split(',')[1],'base64')).ensureAlpha().raw().toBuffer():Buffer.from(idle0);
   // Ease the painted guard into the exact existing Idle artwork. Blend in
   // premultiplied space so transparent contours do not develop dark fringes.
   const idleWeight=f===1?.18:f===14?.22:f===15?.75:0;
   if(idleWeight)for(let p=0;p<pixels.length;p+=4){const a=pixels[p+3]/255*(1-idleWeight),b=idle0[p+3]/255*idleWeight,total=a+b;for(let c=0;c<3;c++)pixels[p+c]=total?Math.round((pixels[p+c]*a+idle0[p+c]*b)/total):0;pixels[p+3]=Math.round(total*255);}
   // Preserve original sole pixels exactly, including the antialiased edge.
   for(let y=284;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;idle0.copy(pixels,p,p,p+4);}
   for(const repair of cleanup.output_pixel_removals||[])if(repair.view===view&&repair.frame===f)for(const[x,y]of repair.pixels)pixels.fill(0,(y*320+x)*4,(y*320+x)*4+4);
   const png=await sharp(pixels,{raw:{width:320,height:320,channels:4}}).png().toBuffer();frames.push(pixels);await fs.writeFile(path.join(folder,`${String(f).padStart(2,'0')}.png`),png);
  }
  const atlas=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(atlas,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
  const file=path.join(out,`${view}-attack-sheet.png`);await sharp(atlas,{raw:{width:1280,height:1280,channels:4}}).png().toFile(file);
  const dir=view==='side'?'right':view;animations[dir]={file:`asset/character/main/archer/${view}/attack-sheet.png`,width:1280,height:1280,columns:4,rows:4,loop:false,return_to:`${dir}_idle`,duration_ms:1000,frame_duration_ms:62.5,frames:frames.map((_,f)=>({index:f,rect:[f%4*320,Math.floor(f/4)*320,320,320],pico2d_rect:[f%4*320,960-Math.floor(f/4)*320,320,320],duration_ms:62.5}))};
  qa[view]={frames:16,unique:new Set(frames.map(x=>x.toString('base64'))).size};
 }
 for(const [view,input] of Object.entries(importedDirections)){
  const importedFile=path.join(game,input.file);
  const importedMetadata=await sharp(importedFile).metadata();
  if(importedMetadata.width!==1280||importedMetadata.height!==1280||!importedMetadata.hasAlpha)throw Error('Invalid imported attack sheet '+view);
  const hashes=[];
  for(let frame=0;frame<16;frame++){
   const image=await sharp(importedFile).extract({left:frame%4*320,top:Math.floor(frame/4)*320,width:320,height:320}).png().toBuffer();
   hashes.push(image.toString('base64'));
   await fs.writeFile(path.join(out,view,String(frame).padStart(2,'0')+'.png'),image);
  }
  await fs.copyFile(importedFile,path.join(out,view+'-attack-sheet.png'));
  qa[view]={frames:16,unique:new Set(hashes).size,source:input.metadata};
 }
 const views=Object.keys(bundles);const previewWidth=views.length*400;
 const sheets={};for(const view of views)sheets[view]='data:image/png;base64,'+(await fs.readFile(path.join(out,`${view}-attack-sheet.png`))).toString('base64');
 await page.evaluate(async({sheets,views,width})=>{window.sheets={};for(const[v,src]of Object.entries(sheets)){const im=new Image;im.src=src;await im.decode();window.sheets[v]=im;}const c=document.querySelector('canvas');c.width=width;c.height=340;window.renderPreview=t=>{const ctx=c.getContext('2d');ctx.fillStyle='#e6e3dd';ctx.fillRect(0,0,c.width,c.height);views.forEach((v,n)=>{const f=t>=1?0:Math.min(15,Math.floor(t*16));ctx.drawImage(window.sheets[v],f%4*320+60,Math.floor(f/4)*320+115,250,185,n*400+6,10,375,277.5);ctx.fillStyle='#37403e';ctx.font='18px sans-serif';ctx.fillText(v.toUpperCase(),n*400+150,320);});};renderPreview(6/16);},{sheets,views,width:previewWidth});
 await fs.writeFile(path.join(out,'preview.png'),Buffer.from((await page.locator('canvas').evaluate(c=>c.toDataURL())).split(',')[1],'base64'));
 const mp4=await page.evaluate(async()=>{const c=document.querySelector('canvas'),mime='video/mp4;codecs=avc1.42001E',stream=c.captureStream(60),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();await new Promise(resolve=>{function tick(now){const sec=(now-start)/1000;renderPreview(sec%1.55);if(sec<6.2)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());return await new Promise(resolve=>{const r=new FileReader;r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:mime}));});});
 await fs.writeFile(path.join(out,'preview.mp4'),Buffer.from(mp4.split(',')[1],'base64'));
 if(apply){
  if(views.length!==3)throw Error('Prepare all three directions before applying');for(const view of views)await fs.copyFile(path.join(out,`${view}-attack-sheet.png`),path.join(game,`asset/character/main/archer/${view}/attack-sheet.png`));
  const runtime={id:'archer',name:'궁수',version:importedDirections.front?7:importedDirections.back?6:5,cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,duration_ms:1000,release_frame:7,projectile_visual:false,loop:false,return_to:'idle',direction_overrides:Object.keys(directionOverrides).length?directionOverrides:undefined,animations};await fs.writeFile(path.join(root,'metadata/character/attack/archer.json'),JSON.stringify(runtime,null,2)+'\n');
  for(const name of['archer.json','manifest.json']){const file=path.join(root,'metadata/character/sprites',name),json=JSON.parse(await fs.readFile(file,'utf8'));function update(x){if(!x||typeof x!=='object')return;if(x.id==='archer'&&x.directional_attack_sheets)x.directional_attack_sheets=animations;for(const y of Object.values(x))if(y&&typeof y==='object')update(y);}update(json);await fs.writeFile(file,JSON.stringify(json,null,2)+'\n');}
  let exportedRig={...sources,frames:16,fps:16,release_frame:7,head_motion:'metadata/character/attack/archer-head-motion.json',hair_motion:'metadata/character/attack/archer-hair-motion.json',idle_transition_weights:{1:.18,14:.22,15:.75},cleanup:'metadata/character/attack/archer-cleanup.json',arm_proportions:'metadata/character/attack/archer-arm-proportions.json',renderer:'tools/archer-attack-v2-renderer.js',direction_overrides:directionOverrides};
  if(views.every(view=>importedDirections[view]))exportedRig={id:'archer',version:7,frames:16,fps:16,cell_size:[320,320],pivot:[160,288],renderer:'whole_sheet',direction_overrides:directionOverrides,views:importedDirections};
  await fs.writeFile(path.join(root,'metadata/character/attack/archer-rig.json'),JSON.stringify(exportedRig,null,2)+'\n');
  const preview=path.join(game,'asset/character/icon/preview');for(const ext of['png','mp4'])for(const name of['archer-attack','archer-attack-no-projectile'])await fs.copyFile(path.join(out,'preview.'+ext),path.join(preview,name+'.'+ext));
 }
 await fs.writeFile(path.join(out,'qa.json'),JSON.stringify(qa,null,2)+'\n');console.log(JSON.stringify({views,qa,applied:apply,preview:out}));
}finally{await browser.close();}
