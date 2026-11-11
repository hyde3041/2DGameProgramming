// Recover misassigned hair from the original neutral, without repainting it.
// Remove tiny floor leftovers from feet layers, never from the assembled head/hand.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const idle=JSON.parse(await fs.readFile(path.join(root,'metadata/character/idle/guardian-layers.json'),'utf8'));
const raw=f=>sharp(path.join(game,f)).ensureAlpha().raw().toBuffer();
const write=(b,f)=>sharp(b,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,f));
function cleanFeet(data){const seen=new Uint8Array(102400),keep=new Uint8Array(102400);let removed=0;
 for(let p=0;p<102400;p++){if(seen[p]||data[p*4+3]<24)continue;const q=[p];seen[p]=1;
  for(let i=0;i<q.length;i++){const k=q[i],x=k%320,y=Math.floor(k/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,s=yy*320+xx;if(xx<0||xx>=320||yy<0||yy>=320||seen[s]||data[s*4+3]<24)continue;seen[s]=1;q.push(s);}}
  if(q.length>=24)for(const p of q){const x=p%320,y=Math.floor(p/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<320&&y+dy>=0&&y+dy<320)keep[(y+dy)*320+x+dx]=1;}
 }
 for(let p=0;p<102400;p++)if(!keep[p]&&data[p*4+3]){data.fill(0,p*4,p*4+4);removed++;}return removed;
}
const bounds={front:[106,121,218,205],back:[99,122,217,202],side:[96,123,216,207]},result={version:1,workflow:'original-pixel hair recovery and stable foot layers; no generated head or glove',views:{}};
for(const v of idle.views){
 const folder=`asset/character/player/icon/layers/guardian/${v.view}/attack/push`,head=await raw(v.parts.head),original=await raw(`asset/character/player/icon/layers/guardian/${v.view}/aligned/neutral.png`);
 const recovered=Buffer.alloc(head.length),removed=Buffer.alloc(head.length),base=Buffer.from(head),[l,t,r,b]=bounds[v.view];let recoveredCount=0,removedCount=0;
 for(let y=t;y<b;y++)for(let x=l;x<r;x++){
  const p=(y*320+x)*4;if(head[p+3]||original[p+3]<24)continue;
  if(v.view==='front'&&y>=195&&x>=150&&x<=188)continue;
  if(v.view==='side'&&y>=194&&x>=170&&x<=196)continue;
  const [red,green,blue]=original.subarray(p,p+3);
  if(red>=210||red<=green||green-blue<4||red-blue<10)continue;
  let near=false;for(let dy=-5;dy<=5&&!near;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<320&&yy>=0&&yy<320&&base[(yy*320+xx)*4+3]>=24){near=true;break;}}
  if(near){original.copy(head,p,p,p+4);recovered.fill(255,p,p+4);recoveredCount++;}
 }
 // The back-left hair edge above the shield was assigned to gear/shield.
 // This region is entirely above that plate: recover its dark outline as well
 // as the warm fill, so a color-only mask cannot leave a vertical gap.
 if(v.view==='back')for(let y=158;y<193;y++)for(let x=99;x<117;x++){
  const p=(y*320+x)*4;if(!head[p+3]&&original[p+3]>=24){original.copy(head,p,p,p+4);recovered.fill(255,p,p+4);recoveredCount++;}
 }
 // The side head cutout also contained the old shield's protruding upper edge.
 // This small non-hair tip is outside the face/chin; restore no generated pixels.
 if(v.view==='side'){
  for(let y=182;y<211;y++)for(let x=198;x<220;x++){
   const p=(y*320+x)*4,[red,green,blue]=head.subarray(p,p+3),warm=red>green&&green>blue&&red-blue>=4;
   if(head[p+3]&&!warm){head.fill(0,p,p+4);removed.fill(255,p,p+4);removedCount++;}
  }
  // Delete remaining detached bits only in that old equipment-tip region.
  const seen=new Uint8Array(102400);let main=[];
  for(let p=0;p<102400;p++){if(seen[p]||head[p*4+3]<24)continue;const q=[p];seen[p]=1;
   for(let i=0;i<q.length;i++){const k=q[i],x=k%320,y=Math.floor(k/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,s=yy*320+xx;if(xx<0||xx>=320||yy<0||yy>=320||seen[s]||head[s*4+3]<24)continue;seen[s]=1;q.push(s);}}if(q.length>main.length)main=q;
  }
  const connected=new Set(main);for(let y=182;y<211;y++)for(let x=198;x<220;x++){const p=y*320+x,k=p*4;if(head[k+3]&&!connected.has(p)){head.fill(0,k,k+4);removed.fill(255,k,k+4);removedCount++;}}
 }
 const parts={head:`${folder}/head-complete.png`,'under:head':`${folder}/head-under-empty.png`},feetRemoved={};
 for(const n of ['legs','under:legs']){const data=await raw(v.parts[n]);feetRemoved[n]=cleanFeet(data);const f=`${folder}/${n.replace(':','-')}-stable.png`;await write(data,f);parts[n]=f;}
 for(const [f,data]of [[parts.head,head],[parts['under:head'],Buffer.alloc(head.length)],[`${folder}/hair-recovery-mask.png`,recovered],[`${folder}/head-nonhair-mask.png`,removed]])await write(data,f);
 result.views[v.view]={parts,recovered_hair_pixels:recoveredCount,removed_nonhair_pixels:removedCount,recovery_mask:`${folder}/hair-recovery-mask.png`,nonhair_mask:`${folder}/head-nonhair-mask.png`,feet_removed_pixels:feetRemoved};
}
await fs.writeFile(path.join(root,'metadata/character/attack/guardian-consistency.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.views).map(([v,r])=>[v,{hair_recovered:r.recovered_hair_pixels,nonhair_removed:r.removed_nonhair_pixels}]))));
