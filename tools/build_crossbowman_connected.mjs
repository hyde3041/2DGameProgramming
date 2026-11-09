// Bake original separated artwork; --apply promotes all three directions.
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game'),out=path.join(root,'.build/crossbowman-attack-connected'),apply=process.argv.includes('--apply');
await fs.mkdir(out,{recursive:true});const sources=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/crossbowman-connected.json'),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});const animations={},qa={};
// Original key poses have slightly different boot edges. Discard only tiny
// detached remnants outside the fixed feet; never reshape a connected limb.
function cleanFootRemnants(pixels,feet){const seen=new Uint8Array(102400);let removed=0;for(let i=0;i<seen.length;i++){if(seen[i]||pixels[i*4+3]<8)continue;const q=[i];seen[i]=1;for(let j=0;j<q.length;j++){const p=q[j],x=p%320,y=Math.floor(p/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,n=yy*320+xx;if(xx>=0&&xx<320&&yy>=0&&yy<320&&!seen[n]&&pixels[n*4+3]>=8){seen[n]=1;q.push(n);}}}if(q.length<=16&&q.every(p=>!feet[p*4+3])&&(q.every(p=>Math.floor(p/320)>=270)||q.length<=2&&q.every(p=>pixels[p*4+3]<64)))for(const p of q){pixels.fill(0,p*4,p*4+4);removed++;}}return removed;}
try{
 const page=await browser.newPage();await page.setContent('<canvas id="c" width="320" height="320"></canvas>');await page.addScriptTag({path:path.join(root,'tools/crossbowman-connected-renderer.js')});const bundles={};
 for(const view of ['front','back','side'].filter(v=>sources.views[v])){
  const rig=sources.views[view];
  const files=rig.parts;
  const urls={};for(const[n,p]of Object.entries(files))urls[n]='data:image/png;base64,'+(await fs.readFile(path.join(game,p))).toString('base64');bundles[view]={view,rig,urls};
 }
 await page.evaluate(async bundles=>{window.players={};for(const[v,b]of Object.entries(bundles))players[v]=await CrossbowAttack.load(b);},bundles);
 for(const view of Object.keys(bundles)){
  const folder=path.join(out,view);await fs.mkdir(folder,{recursive:true});const frames=[];
  const idle0=await sharp(path.join(game,`asset/character/main/3-crossbowman/${view}/idle-sheet.png`)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
  const feet=await sharp(path.join(game,sources.views[view].parts.feet)).ensureAlpha().raw().toBuffer();const poses=[];
  for(let f=0;f<16;f++){
   const result=await page.evaluate(({v,f})=>{const c=document.querySelector('canvas'),pose=CrossbowAttack.draw(c.getContext('2d'),players[v],f);return{url:c.toDataURL(),pose};},{v:view,f});poses.push(result.pose);
   const pixels=f?await sharp(Buffer.from(result.url.split(',')[1],'base64')).ensureAlpha().raw().toBuffer():Buffer.from(idle0);
   // Preserve original sole pixels exactly, including the antialiased edge.
   for(let y=274;y<320;y++)for(let x=100;x<225;x++){const p=(y*320+x)*4,inFoot=sources.views[view].foot_boxes.some(([bx,by,w,h])=>x>=bx&&x<bx+w&&y>=by&&y<by+h);if(feet[p+3]||y>=281&&inFoot&&!idle0[p+3])idle0.copy(pixels,p,p,p+4);}
   if(f)cleanFootRemnants(pixels,feet);
   const png=await sharp(pixels,{raw:{width:320,height:320,channels:4}}).png().toBuffer();frames.push(pixels);await fs.writeFile(path.join(folder,`${String(f).padStart(2,'0')}.png`),png);
  }
  const atlas=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(atlas,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
  const file=path.join(out,`${view}-attack-sheet.png`);await sharp(atlas,{raw:{width:1280,height:1280,channels:4}}).png().toFile(file);
  const dir=view==='side'?'right':view;animations[dir]={file:`asset/character/main/3-crossbowman/${view}/attack-sheet.png`,width:1280,height:1280,columns:4,rows:4,loop:false,return_to:`${dir}_idle`,duration_ms:1000,frame_duration_ms:62.5,frames:frames.map((_,f)=>({index:f,rect:[f%4*320,Math.floor(f/4)*320,320,320],pico2d_rect:[f%4*320,960-Math.floor(f/4)*320,320,320],duration_ms:62.5}))};
  const matrixError=Math.max(...poses.map(({matrix:[a,b,c,d]})=>Math.max(Math.abs(a*a+b*b-1),Math.abs(c*c+d*d-1),Math.abs(a*d-b*c-1))));if(matrixError>1e-8)throw Error('Body proportions changed');
  qa[view]={frames:16,unique:new Set(frames.map(x=>x.toString('base64'))).size,max_unit_matrix_error:matrixError};await fs.writeFile(path.join(out,view+'-pose-trace.json'),JSON.stringify(poses,null,2)+'\n');
 }
 const views=Object.keys(bundles);const previewWidth=views.length*400;
 const sheets={};for(const view of views)sheets[view]='data:image/png;base64,'+(await fs.readFile(path.join(out,`${view}-attack-sheet.png`))).toString('base64');
 await page.evaluate(async({sheets,views,width})=>{window.sheets={};for(const[v,src]of Object.entries(sheets)){const im=new Image;im.src=src;await im.decode();window.sheets[v]=im;}const c=document.querySelector('canvas');c.width=width;c.height=340;window.renderPreview=t=>{const ctx=c.getContext('2d');ctx.fillStyle='#e6e3dd';ctx.fillRect(0,0,c.width,c.height);views.forEach((v,n)=>{const f=t>=1?0:Math.min(15,Math.floor(t*16));ctx.drawImage(window.sheets[v],f%4*320+60,Math.floor(f/4)*320+115,250,185,n*400+6,10,375,277.5);ctx.fillStyle='#37403e';ctx.font='18px sans-serif';ctx.fillText(v.toUpperCase(),n*400+150,320);});};renderPreview(6/16);},{sheets,views,width:previewWidth});
 await fs.writeFile(path.join(out,'preview.png'),Buffer.from((await page.locator('canvas').evaluate(c=>c.toDataURL())).split(',')[1],'base64'));
 const mp4=await page.evaluate(async()=>{const c=document.querySelector('canvas'),mime='video/mp4;codecs=avc1.42001E',stream=c.captureStream(60),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();await new Promise(resolve=>{function tick(now){const sec=(now-start)/1000;renderPreview(sec%1.55);if(sec<6.2)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());return await new Promise(resolve=>{const r=new FileReader;r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:mime}));});});
 await fs.writeFile(path.join(out,'preview.mp4'),Buffer.from(mp4.split(',')[1],'base64'));
 if(apply){
  if(views.length!==3)throw Error('Prepare all three directions before applying');for(const view of views)await fs.copyFile(path.join(out,`${view}-attack-sheet.png`),path.join(game,`asset/character/main/3-crossbowman/${view}/attack-sheet.png`));
  const runtime={id:'crossbowman',name:'석궁병',version:6,workflow:'connected original poses with three painted lift in-betweens',cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,duration_ms:1000,release_frame:7,projectile_visual:false,loop:false,return_to:'idle',animations};await fs.writeFile(path.join(root,'metadata/character/attack/crossbowman.json'),JSON.stringify(runtime,null,2)+'\n');
  for(const name of['crossbowman.json','manifest.json']){const file=path.join(root,'metadata/character/sprites',name),json=JSON.parse(await fs.readFile(file,'utf8'));function update(x){if(!x||typeof x!=='object')return;if(x.id==='crossbowman'&&x.directional_attack_sheets)x.directional_attack_sheets=animations;for(const y of Object.values(x))if(y&&typeof y==='object')update(y);}update(json);await fs.writeFile(file,JSON.stringify(json,null,2)+'\n');}
  await fs.writeFile(path.join(root,'metadata/character/attack/crossbowman-rig.json'),JSON.stringify({...sources,renderer:'tools/crossbowman-connected-renderer.js'},null,2)+'\n');
  const preview=path.join(game,'asset/character/icon/preview');for(const ext of['png','mp4'])for(const name of['crossbowman-attack','crossbowman-attack-no-projectile'])await fs.copyFile(path.join(out,'preview.'+ext),path.join(preview,name+'.'+ext));
 }
 await fs.writeFile(path.join(out,'qa.json'),JSON.stringify(qa,null,2)+'\n');console.log(JSON.stringify({views,qa,applied:apply,preview:out}));
}finally{await browser.close();}

