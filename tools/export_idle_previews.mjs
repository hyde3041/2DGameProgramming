// Export the actual game sheets as playable, three-direction MP4 previews.
// Authoring dependencies: sharp, playwright, Chrome. Runtime stays pico2d.
// node tools/export_idle_previews.mjs <character-id> [character-id ...]
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const game=path.join(root,'game');
const ids=process.argv.slice(2);if(!ids.length)throw Error('Supply character ids');
const dest=path.join(game,'asset/character/player/icon/preview'),reports=[];
await fs.mkdir(dest,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 for(const id of ids){
  if(!/^[a-z-]+$/.test(id))throw Error('Invalid character id');
  const meta=JSON.parse(await fs.readFile(`${root}/metadata/character/idle/${id}.json`,'utf8'));
  const views=[];
  for(const direction of ['front','back','side']){
   const a=meta.animations[direction==='side'?'right':direction];
   const bytes=await fs.readFile(path.join(game,a.file));
   views.push({direction,columns:a.columns,count:a.frames.length,image:'data:image/png;base64,'+bytes.toString('base64'),file:a.file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  await page.setContent('<style>body{margin:0}</style><canvas width="1056" height="384"></canvas>');
  const encoded=await page.evaluate(async({views,fps})=>{
   const images=await Promise.all(views.map(async v=>{const i=new Image();i.src=v.image;await i.decode();return i;}));
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),seen=new Set();
   function draw(seconds){ctx.fillStyle='#e6e3dd';ctx.fillRect(0,0,1056,384);ctx.fillStyle='#252b30';ctx.font='18px "Malgun Gothic",sans-serif';ctx.textAlign='center';
    for(let i=0;i<3;i++){const v=views[i],frame=Math.floor(seconds*fps)%v.count;if(!Number.isFinite(frame))throw Error('Invalid frame');seen.add(frame);ctx.fillText(['앞','뒤','옆'][i],176+i*352,24);ctx.drawImage(images[i],frame%v.columns*320+72,Math.floor(frame/v.columns)*320+120,176,176,i*352,32,352,352);}
   }
   draw(0);const poster=canvas.toDataURL('image/png').split(',')[1],type='video/mp4;codecs=avc1.42001E';
   if(!MediaRecorder.isTypeSupported(type))throw Error('H.264 recording unavailable');
   const stream=canvas.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:1000000}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(resolve=>recorder.onstop=resolve);
   recorder.start();const start=performance.now();
   await new Promise(resolve=>{function tick(){const elapsed=(performance.now()-start)/1000;draw(elapsed);if(elapsed<6)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
   recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
   const bytes=new Uint8Array(await new Blob(chunks,{type}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return {video:btoa(binary),poster,seenFrames:seen.size};
  },{views,fps:meta.fps});
  if(encoded.seenFrames<Math.ceil(views[0].count*.8))throw Error('Preview skipped too many poses');
  const file=dest+'/'+id+'-aligned-idle.mp4';await fs.writeFile(file,Buffer.from(encoded.video,'base64'));await fs.writeFile(dest+'/'+id+'-aligned.png',Buffer.from(encoded.poster,'base64'));
  await page.setContent('<video muted autoplay controls></video>');
  const info=await page.evaluate(async src=>{const v=document.querySelector('video');v.src='data:video/mp4;base64,'+src;await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject;});await v.play();return{width:v.videoWidth,height:v.videoHeight,duration:v.duration};},encoded.video);
  await page.waitForTimeout(300);const played=await page.evaluate(()=>document.querySelector('video').currentTime);
  if(played<.1||info.width!==1056||info.height!==384||info.duration<5.8)throw Error('Video playback failed');
  const panels=[];
  for(let i=0;i<3;i++)for(let row=0;row<2;row++){
   const v=views[i],p=row===0?path.join(game,`asset/character/player/icon/source/${id}/${v.direction}/idle.png`):path.join(game,v.file);
   panels.push({input:await sharp(p).extract({left:65,top:115,width:200,height:182}).resize(400,364).png().toBuffer(),left:i*400,top:row*390+26});
   panels.push({input:Buffer.from(`<svg width="400" height="26"><text x="8" y="20" font-size="18">${row===0?'Original':'Corrected'} / ${v.direction}</text></svg>`),left:i*400,top:row*390});
  }
  await sharp({create:{width:1200,height:780,channels:4,background:'#e6e3dd'}}).composite(panels).png().toFile(dest+'/'+id+'-original-comparison.png');
  for(const v of views){const now=crypto.createHash('sha256').update(await fs.readFile(path.join(game,v.file))).digest('hex');if(now!==v.sha256)throw Error('Source sheet changed while exporting');}
  const report={id,name:meta.name,file,fps:meta.fps,frames:views[0].count,cycle_ms:meta.cycle_ms,...info,seen_frames:encoded.seenFrames,played_seconds:played,source_sheets_unchanged:true};reports.push(report);console.log(JSON.stringify(report));
 }
}finally{await browser.close();}
console.log(JSON.stringify({exported:reports.length,directions:reports.length*3,all_playable:true}));
