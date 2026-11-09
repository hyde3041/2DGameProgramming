// Restore only surfaces exposed by the stronger shield motion. Sources stay intact.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const idle=JSON.parse(await fs.readFile(path.join(root,'metadata/character/idle/guardian-layers.json'),'utf8'));
const clean=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-support.json'),'utf8'));
const source='asset/character/icon/layers/guardian/attack/reach-source/edited-atlas.png';
const atlas=await sharp(path.join(game,source)).resize(1280,1280).ensureAlpha().raw().toBuffer();
const raw=f=>sharp(path.join(game,f)).ensureAlpha().raw().toBuffer();
const write=(b,f)=>sharp(b,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,f));
const boxes={front:[173,205,211,267],back:[112,205,143,267],side:[176,205,206,267]};
function translate(data,dx,dy){const b=Buffer.alloc(data.length);for(let y=0;y<320;y++)for(let x=0;x<320;x++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<320&&yy>=0&&yy<320)data.copy(b,(yy*320+xx)*4,(y*320+x)*4,(y*320+x)*4+4);}return b;}
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
const result={version:1,source,mode:'built-in image_gen localized hidden torso and rear plate edit',views:{}};
for(const [i,v]of idle.views.entries()){
 const folder=`asset/character/icon/layers/guardian/${v.view}/attack/push`;await fs.mkdir(path.join(game,folder),{recursive:true});
 let generated=await sharp(atlas,{raw:{width:1280,height:1280,channels:4}}).extract({left:i%2*640,top:Math.floor(i/2)*640,width:640,height:640}).resize(320,320).raw().toBuffer();
 // Register the entire generated view using the unchanged head silhouette.
 const original=await raw(`asset/character/icon/layers/guardian/${v.view}/aligned/neutral.png`);
 let best=Infinity,shift=[0,0];for(let dy=-16;dy<=16;dy++)for(let dx=-16;dx<=16;dx++){
   let error=0;for(let y=112;y<200;y+=2)for(let x=90;x<230;x+=2){const xx=x-dx,yy=y-dy,a=original[(y*320+x)*4+3]>128,b=xx>=0&&xx<320&&yy>=0&&yy<320&&generated[(yy*320+xx)*4+3]>128;error+=a!==b?1:0;}
   if(error<best){best=error;shift=[dx,dy];}
 }
 generated=translate(generated,...shift);
 const sa=v.weapon_arm==='arm-left'?'arm-right':'arm-left',plate=await raw(v.parts.shield),arm=await raw(v.parts['under:'+sa]);
 const mask=Buffer.alloc(320*320*4),fill=Buffer.alloc(mask.length),[l,t,r,b]=boxes[v.view];let pixels=0;
 for(let y=t;y<b;y++)for(let x=l;x<r;x++){
   let covered=false;for(let dy=-2;dy<=2&&!covered;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=320||yy<0||yy>=320)continue;const p=(yy*320+xx)*4;if(plate[p+3]>24||arm[p+3]>24){covered=true;break;}}
   if(!covered)continue;const k=(y*320+x)*4;mask.fill(255,k,k+4);pixels++;
   if(generated[k+3]>=24)generated.copy(fill,k,k,k+4);
 }
 const parts={};
 for(const n of ['body','under:body','cloth-hem','under:cloth-hem','gear','under:gear']){
   const data=await raw(n.includes('gear')?clean.views[v.view].parts[n]:v.parts[n]);
   for(let p=0;p<102400;p++)if(mask[p*4+3])data.fill(0,p*4,p*4+4);
   const f=`${folder}/base-${n.replace(':','-')}.png`;await write(data,f);parts[n]=f;
 }
 for(const [n,data]of Object.entries({'torso-patch':fill,'torso-mask':mask,'under-shield':Buffer.alloc(mask.length)}))await write(data,`${folder}/${n}.png`);
 parts.torso_patch=`${folder}/torso-patch.png`;parts['under:shield']=`${folder}/under-shield.png`;
 if(v.view==='back'){
   // Keep the plate outline and source pixels, remove the attached cape, and
   // restore the little region formerly covered by the old sleeve/glove.
   const polygon=[[98,193],[134,204],[112,275],[84,264]];
   let edited=await sharp(atlas,{raw:{width:1280,height:1280,channels:4}}).extract({left:640,top:640,width:640,height:640}).resize(320,320).raw().toBuffer();
   const data=Buffer.alloc(plate.length),plateMask=Buffer.alloc(plate.length);
   for(let y=0;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;if(!inside(x+.5,y+.5,polygon))continue;
     const repair=x>=110&&y>=210&&y<=272;
     if(repair){plateMask.fill(255,p,p+4);if(edited[p+3]>=24)edited.copy(data,p,p,p+4);}
     else plate.copy(data,p,p,p+4);
   }
   await write(data,`${folder}/shield-clean.png`);await write(plateMask,`${folder}/shield-repair-mask.png`);parts.shield=`${folder}/shield-clean.png`;
 }
 result.views[v.view]={parts,torso_mask:`${folder}/torso-mask.png`,fixed_translation:shift,mask_pixels:pixels,
   ...(v.view==='back'?{plate_fixed_translation:[0,0],plate_polygon:[[98,193],[134,204],[112,275],[84,264]],plate_repair_mask:`${folder}/shield-repair-mask.png`}:{})};
}
await fs.writeFile(path.join(root,'metadata/character/attack/guardian-reach.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.views).map(([v,r])=>[v,{translation:r.fixed_translation,mask_pixels:r.mask_pixels}]))));
// The polygon above records the old plate reference for its intact interior.
// Complete surfaces from this final stage are the only shields used in-game.
await import('./prepare_guardian_shield_outline.mjs');
