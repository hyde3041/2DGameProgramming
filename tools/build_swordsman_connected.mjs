// Bake the four coherent native poses with rigid follow-through into 16 cells.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url), sharp=require('sharp');
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const game=path.join(root,'game'), out=path.join(root,'.build/swordsman-attack');
const apply=process.argv.includes('--apply'), views=['front','back','side'];
const sources=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/swordsman-connected.json'),'utf8'));
const slash=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/swordsman-slash.json'),'utf8'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const animations={}, qa={};
try {
  const page=await browser.newPage();
  await page.setContent('<canvas id="c" width="320" height="320"></canvas>');
  await page.addScriptTag({path:path.join(root,'tools/swordsman-attack-renderer.js')});
  await page.addScriptTag({path:path.join(root,'tools/swordsman-slash-renderer.js')});
  await page.evaluate(config=>{
    window.slashConfig=config;
    window.effectCanvas=document.createElement('canvas');
    effectCanvas.width=effectCanvas.height=320;
  },slash);
  const bundles={};
  for(const view of views) {
    const rig=sources.views[view], urls={};
    for(const [pose,data] of Object.entries(rig.poses)) for(const part of ['upper','feet'])
      urls[pose+'-'+part]='data:image/png;base64,'+(await fs.readFile(path.join(game,data.files[part]))).toString('base64');
    bundles[view]={view,rig,urls};
  }
  await page.evaluate(async bundles=>{
    window.players={};
    for(const[v,b]of Object.entries(bundles)) players[v]=await SwordsmanAttack.load(b);
  },bundles);
  for(const view of views) {
    const folder=path.join(out,view); await fs.mkdir(folder,{recursive:true});
    const originals={}, feet={};
    for(const [pose,data] of Object.entries(sources.views[view].poses)) {
      originals[pose]=await sharp(path.join(game,data.files.reference)).ensureAlpha().raw().toBuffer();
      feet[pose]=await sharp(path.join(game,data.files.feet)).ensureAlpha().raw().toBuffer();
    }
    const frames=[], effects=[], traces=[];
    const effectFolder=path.join(folder,'effect');
    await fs.mkdir(effectFolder,{recursive:true});
    for(let index=0;index<16;index++) {
      const result=await page.evaluate(({view,index})=>{
        const c=document.querySelector('canvas');
        const trace=SwordsmanAttack.draw(c.getContext('2d'),players[view],index);
        SwordsmanSlash.draw(effectCanvas.getContext('2d'),slashConfig,view,index,players[view].rig);
        return {url:c.toDataURL(),effect:effectCanvas.toDataURL(),trace};
      },{view,index});
      const pose=result.trace.pose, original=originals[pose], foot=feet[pose];
      const pixels=index===0?Buffer.from(original):await sharp(Buffer.from(result.url.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
      // Restore native sole RGBA exactly, without freezing the nearby sword tip.
      for(const [bx,by,w,h] of sources.views[view].poses[pose].boot_boxes) {
        const lockY=view==='back'&&pose==='strike'&&bx<145?277:281;
        for(let y=by;y<by+h;y++) for(let x=bx;x<bx+w;x++) {
          const p=(y*320+x)*4;
          if(foot[p+3] || y>=lockY) original.copy(pixels,p,p,p+4);
        }
      }
      const effect=await sharp(Buffer.from(result.effect.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
      // Keep every original character RGBA pixel exact, including its edge.
      // The ribbon occupies only previously transparent background pixels.
      for(let p=0;p<pixels.length;p+=4) if(!pixels[p+3]&&effect[p+3]) effect.copy(pixels,p,p,p+4);
      effects.push(effect);
      await sharp(effect,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(effectFolder,String(index).padStart(2,'0')+'.png'));
      frames.push(pixels); traces.push(result.trace);
      await sharp(pixels,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(folder,String(index).padStart(2,'0')+'.png'));
    }
    const atlas=Buffer.alloc(1280*1280*4), effectAtlas=Buffer.alloc(1280*1280*4);
    for(let f=0;f<16;f++) for(let y=0;y<320;y++)
      for(const [input,output] of [[frames,atlas],[effects,effectAtlas]])
        input[f].copy(output,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
    await sharp(atlas,{raw:{width:1280,height:1280,channels:4}}).png().toFile(path.join(out,view+'-attack-sheet.png'));
    await sharp(effectAtlas,{raw:{width:1280,height:1280,channels:4}}).png().toFile(path.join(effectFolder,'slash-sheet.png'));
    const direction=view==='side'?'right':view;
    animations[direction]={file:`asset/character/main/0-swordsman/${view}/attack-sheet.png`,width:1280,height:1280,columns:4,rows:4,loop:false,return_to:direction+'_idle',duration_ms:1000,frame_duration_ms:62.5,
      frames:frames.map((_,f)=>({index:f,rect:[f%4*320,Math.floor(f/4)*320,320,320],pico2d_rect:[f%4*320,960-Math.floor(f/4)*320,320,320],duration_ms:62.5}))};
    const error=Math.max(...traces.map(({matrix:[a,b,c,d]})=>Math.max(Math.abs(a*a+b*b-1),Math.abs(c*c+d*d-1),Math.abs(a*d-b*c-1))));
    qa[view]={frames:16,unique:new Set(frames.map(b=>b.toString('base64'))).size,max_unit_matrix_error:error,original_key_poses:4};
    if(error>1e-8 || qa[view].unique!==16) throw Error(view+': invalid frame transforms');
    await fs.writeFile(path.join(out,view+'-pose-trace.json'),JSON.stringify(traces,null,2)+'\n');
  }
  const sheets={}, idles={};
  for(const view of views) {
    sheets[view]='data:image/png;base64,'+(await fs.readFile(path.join(out,view+'-attack-sheet.png'))).toString('base64');
    idles[view]='data:image/png;base64,'+(await fs.readFile(path.join(game,`asset/character/main/0-swordsman/${view}/idle-sheet.png`))).toString('base64');
  }
  await page.evaluate(async({sheets,idles,views})=>{
    window.sheets={}; window.idles={};
    for(const [name,urls] of Object.entries({sheets,idles})) for(const [v,url] of Object.entries(urls)) {
      const image=new Image(); image.src=url; await image.decode(); window[name][v]=image;
    }
    const c=document.querySelector('canvas'); c.width=1200; c.height=340;
    window.renderPreview=t=>{
      const ctx=c.getContext('2d');ctx.fillStyle='#e6e3dd';ctx.fillRect(0,0,c.width,c.height);
      views.forEach((v,n)=>{
        const attacking=t<1, f=attacking?Math.min(15,Math.floor(t*16)):Math.floor((t-1)*16)%16;
        ctx.drawImage((attacking?window.sheets:window.idles)[v],f%4*320+40,Math.floor(f/4)*320+110,280,190,n*400+6,10,375,190*375/280);
        ctx.fillStyle='#37403e';ctx.font='18px sans-serif';ctx.fillText(v.toUpperCase(),n*400+150,320);
      });
    };renderPreview(7/16);
  },{sheets,idles,views});
  await fs.writeFile(path.join(out,'preview.png'),Buffer.from((await page.locator('canvas').evaluate(c=>c.toDataURL())).split(',')[1],'base64'));
  const movie=await page.evaluate(async()=>{
    const c=document.querySelector('canvas'), mime='video/mp4;codecs=avc1.42001E';
    const stream=c.captureStream(60), recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000}), chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);
    const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    const start=performance.now();
    await new Promise(resolve=>{
      function tick(now) {const sec=(now-start)/1000;renderPreview(sec%1.55);if(sec<6.2)requestAnimationFrame(tick);else resolve();}
      requestAnimationFrame(tick);
    });recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());
    return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:mime}));});
  });
  await fs.writeFile(path.join(out,'preview.mp4'),Buffer.from(movie.split(',')[1],'base64'));
  if(apply) {
    for(const view of views) {
      await fs.copyFile(path.join(out,view+'-attack-sheet.png'),path.join(game,`asset/character/main/0-swordsman/${view}/attack-sheet.png`));
      const destination=path.join(game,`asset/character/icon/layers/swordsman/${view}/attack/effect`);
      await fs.mkdir(destination,{recursive:true});
      for(const name of await fs.readdir(path.join(out,view,'effect')))
        await fs.copyFile(path.join(out,view,'effect',name),path.join(destination,name));
    }
    const runtime={id:'swordsman',name:'검사',version:4,workflow:'connected original poses with wide blue-white crescent sweep',cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,duration_ms:1000,impact_frame:7,loop:false,return_to:'idle',effect:{id:slash.id,baked_into_sheet:true,active_frames:Object.keys(slash.frames_active).map(Number),metadata:'metadata/character/attack/swordsman-slash.json',sheets:slash.sheets},animations};
    await fs.writeFile(path.join(root,'metadata/character/attack/swordsman.json'),JSON.stringify(runtime,null,2)+'\n');
    for(const name of ['swordsman.json','manifest.json']) {
      const file=path.join(root,'metadata/character/sprites',name), data=JSON.parse(await fs.readFile(file,'utf8'));
      const entry=name==='manifest.json'?data.assets.find(item=>item.id==='swordsman'):data;
      entry.directional_attack_sheets=animations;
      await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
    }
    for(const ext of ['png','mp4']) for(const name of ['swordsman-attack','swordsman-attack-blade-flash','swordsman-attack-wide-slash'])
      await fs.copyFile(path.join(out,'preview.'+ext),path.join(game,'asset/character/icon/preview',name+'.'+ext));
  }
  await fs.writeFile(path.join(out,'qa.json'),JSON.stringify(qa,null,2)+'\n');
  console.log(JSON.stringify({views,qa,applied:apply,preview:out}));
} finally {await browser.close();}
