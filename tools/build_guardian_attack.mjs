import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const out=path.join(root,'.build/guardian-motion'),apply=process.argv.includes('--apply');
const rig=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-motion.json'),'utf8'));
const views=['front','back','side'],animations={},qa={},sheets={},idleSheets={};
async function pack(frames,file){
 const packed=Buffer.alloc(1280*1280*4);
 for(let i=0;i<16;i++)for(let y=0;y<320;y++)frames[i].copy(packed,((Math.floor(i/4)*320+y)*1280+i%4*320)*4,y*320*4,(y+1)*320*4);
 await sharp(packed,{raw:{width:1280,height:1280,channels:4}}).png().toFile(file);
}
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage();await page.setContent('<canvas width="320" height="320"></canvas>');
 await page.addScriptTag({path:path.join(root,'tools/guardian-attack-renderer.js')});
 const bundles={};
 for(const v of views){const urls={};for(const[n,f]of Object.entries(rig.views[v].parts))urls[n]='data:image/png;base64,'+(await fs.readFile(path.join(game,f))).toString('base64');bundles[v]={rig:rig.views[v],idleMotion:rig.idle_motion,urls};}
 await page.evaluate(async bundles=>{window.players={};for(const[v,b]of Object.entries(bundles))players[v]=await GuardianAttack.load(b);},bundles);
 for(const v of views){
   const frames=[],traces=[],idleFrames=[],idleTraces=[];
   const dir=path.join(out,v);await fs.mkdir(dir,{recursive:true});
   for(let i=0;i<16;i++){
     const r=await page.evaluate(({v,i})=>{const c=document.querySelector('canvas'),m=GuardianAttack.drawIdle(c.getContext('2d'),players[v],i/16);return{image:c.toDataURL(),matrices:m};},{v,i});
     const data=await sharp(Buffer.from(r.image.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();idleFrames.push(data);idleTraces.push(r.matrices);
     await sharp(data,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(dir,`idle-frame-${String(i).padStart(2,'0')}.png`));
   }
   idleSheets[v]=path.join(out,v+'-idle-sheet.png');await pack(idleFrames,idleSheets[v]);
   for(let i=0;i<16;i++){
     const r=await page.evaluate(({v,i})=>{const c=document.querySelector('canvas'),m=GuardianAttack.draw(c.getContext('2d'),players[v],i);return{image:c.toDataURL(),matrices:m};},{v,i});
     const raw=await sharp(Buffer.from(r.image.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
     // Idle and attack use the same parts/order. No old neutral replacement,
     // and no assembled-image island removal that can erase hair or fingertips.
     frames.push(raw);traces.push(r.matrices);
     await sharp(raw,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(dir,`frame-${String(i).padStart(2,'0')}.png`));
   }
   const file=path.join(out,v+'-attack-sheet.png');await pack(frames,file);sheets[v]=file;
   qa[v]={unique_frames:new Set(frames.map(b=>crypto.createHash('sha256').update(b).digest('hex'))).size,idle_unique_frames:new Set(idleFrames.map(b=>crypto.createHash('sha256').update(b).digest('hex'))).size,neutral_matches_idle:frames[0].equals(idleFrames[0]),feet_fixed:[...traces,...idleTraces].every(m=>m.feet.every((n,i)=>n===[1,0,0,1,0,0][i])),traces,idle_traces:idleTraces};
   if(qa[v].unique_frames!==16||qa[v].idle_unique_frames!==16||!qa[v].neutral_matches_idle||!qa[v].feet_fixed)throw Error(v+': frame/feet/transition validation failed');
   animations[v==='side'?'right':v]={file:`asset/character/main/guardian/${v}/attack-sheet.png`,sheet_size:[1280,1280],columns:4,rows:4,loop:false,frames:frames.map((_,i)=>({index:i,rect:[i%4*320,Math.floor(i/4)*320,320,320],pico2d_rect:[i%4*320,960-Math.floor(i/4)*320,320,320]}))};
 }
 // Actual attack and Idle sheets share the same shield, glove and hair pixels.
 const preview=[];
 for(let i=0;i<32;i++){
   const tiles=[];
   for(const[v,col]of views.map((v,i)=>[v,i])){
     const file=i<16?sheets[v]:idleSheets[v],f=i<16?i:i-16;
     const tile=await sharp(file).extract({left:f%4*320,top:Math.floor(f/4)*320+80,width:320,height:240}).resize(400,300).png().toBuffer();
     tiles.push({input:tile,left:col*400,top:0});
   }
   preview.push(await sharp({create:{width:1200,height:300,channels:4,background:'#e6e3dd'}}).composite(tiles).raw().toBuffer());
 }
 const gif=path.join(out,'guardian-attack-16.gif');
 await sharp(Buffer.concat(preview),{raw:{width:1200,height:300*32,channels:4,pageHeight:300}}).gif({delay:Array.from({length:32},(_,i)=>i%4===3?70:60),loop:0,effort:7}).toFile(gif);
 await sharp(preview[rig.impact_frame],{raw:{width:1200,height:300,channels:4}}).png().toFile(path.join(out,'guardian-attack-16.png'));
 for(const v of views){const tiles=[];for(let i=0;i<16;i++){
   const im=await sharp(path.join(out,v,`frame-${String(i).padStart(2,'0')}.png`)).extract({left:55,top:105,width:220,height:190}).resize(330,285).png().toBuffer();
   tiles.push({input:im,left:i%4*330,top:Math.floor(i/4)*300});
 }await sharp({create:{width:1320,height:1200,channels:4,background:'#e6e3dd'}}).composite(tiles).png().toFile(path.join(out,v+'-poses.png'));}
 if(apply){
   for(const v of views){await fs.copyFile(sheets[v],path.join(game,`asset/character/main/guardian/${v}/attack-sheet.png`));await fs.copyFile(idleSheets[v],path.join(game,`asset/character/main/guardian/${v}/idle-sheet.png`));}
   const metadata={id:'guardian',name:'수호기사',version:8,attack_type:'shield_push',action_label:'방패 밀기',cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,duration_ms:1000,impact_frame:rig.impact_frame,loop:false,return_to:'idle',mace_wrist_locked:true,shield_grip_follows_hand:true,grip_location:'center_handle',rear_shield_behind_body:true,arm_behind_shield:true,native_complete_arm:true,complete_shield_outline:true,shared_idle_appearance:true,rear_hand_visible:true,hair_last:true,shield_arm:'metadata/character/attack/guardian-shield-arm.json',shield_outline:'metadata/character/attack/guardian-shield-outline.json',consistency:'metadata/character/attack/guardian-consistency.json',source_layers_unchanged:true,motion:'metadata/character/attack/guardian-motion.json',animations};
   await fs.writeFile(path.join(root,'metadata/character/attack/guardian.json'),JSON.stringify(metadata,null,2)+'\n');
   const idleFile=path.join(root,'metadata/character/idle/guardian.json'),idleMeta=JSON.parse(await fs.readFile(idleFile,'utf8'));idleMeta.shared_rig='metadata/character/attack/guardian-motion.json';idleMeta.neutral_matches_attack=true;idleMeta.complete_shield_outline=true;await fs.writeFile(idleFile,JSON.stringify(idleMeta,null,2)+'\n');
   for(const name of ['guardian.json','manifest.json']){const f=path.join(root,'metadata/character/sprites',name),data=JSON.parse(await fs.readFile(f,'utf8')),item=name==='manifest.json'?data.assets.find(a=>a.id==='guardian'):data;item.directional_attack_sheets=animations;await fs.writeFile(f,JSON.stringify(data,null,2)+'\n');}
   const dest=path.join(game,'asset/character/icon/preview');for(const ext of ['gif','png'])for(const name of ['guardian-attack-16','guardian-back-hand-visible'])await fs.copyFile(path.join(out,'guardian-attack-16.'+ext),path.join(dest,name+'.'+ext));
 }
 await fs.writeFile(path.join(out,'qa.json'),JSON.stringify(qa,null,2)+'\n');
 console.log(JSON.stringify({applied:apply,qa:Object.fromEntries(views.map(v=>[v,{unique_frames:qa[v].unique_frames,feet_fixed:qa[v].feet_fixed}])),preview:gif}));
}finally{await browser.close();}
