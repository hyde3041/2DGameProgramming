// Register image_gen edits and apply only blade-edge / shoulder-cap masks.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath}from'node:url';import {createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const registration=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/swordsman-edge-cleanup-registration.json'),'utf8'));
const out=path.join(root,'.build/swordsman-edge-cleanup'),apply=process.argv.includes('--apply');await fs.mkdir(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),raw=f=>sharp(f).ensureAlpha().raw().toBuffer();
const manifest={version:1,mode:'built-in image_gen with local edit masks',applied:apply,source_originals_preserved:true,motion_unchanged:true,views:{}};
function sample(atlas,w,h,u,v){let a=0,colour=[0,0,0];const x=Math.floor(u),y=Math.floor(v),fx=u-x,fy=v-y;for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){if(x+xx<0||x+xx>=w||y+yy<0||y+yy>=h)continue;const k=((y+yy)*w+x+xx)*4,weight=(xx?fx:1-fx)*(yy?fy:1-fy),alpha=atlas[k+3]/255;a+=alpha*weight;for(let c=0;c<3;c++)colour[c]+=atlas[k+c]*alpha*weight;}if(a*255<16)return[0,0,0,0];return[...colour.map(v=>Math.round(v/a)),Math.round(a*255)];}
function blend(a,b,w){if(!w)return a;const aa=a[3]/255*(1-w),ba=b[3]/255*w,alpha=aa+ba;if(!alpha)return[0,0,0,0];return[0,1,2].map(c=>Math.round((a[c]*aa+b[c]*ba)/alpha)).concat(Math.round(alpha*255));}
for(const kind of ['weapon','arm']){
 const file=path.join(game,`asset/character/player/icon/layers/swordsman/attack/cleanup/source/${kind}-edited-atlas.png`),info=await sharp(file).metadata(),atlas=await raw(file);if(info.width!==1536||info.height!==1024)throw Error('Unexpected source atlas size');
 for(const [view,v]of Object.entries(registration.views)){
  const spec=v[kind],joint=registration.joints[view],original=await raw(path.join(game,spec.file)),axis=joint.blade_tip.map((v,i)=>(v-joint.hand_root[i])/joint.blade_length);
  const coordinates=(x,y,dx,dy)=>[spec.placement[0]+(x-spec.rect.left+.5-dx)*spec.scale-.5,spec.placement[1]+(y-spec.rect.top+.5-dy)*spec.scale-.5];
  const control=[];for(let y=0;y<320;y++)for(let x=0;x<320;x++){const k=(y*320+x)*4;if(original[k+3]<100)continue;const along=(x-joint.hand_root[0])*axis[0]+(y-joint.hand_root[1])*axis[1];if(kind==='weapon'?along<13&&along>-7:Math.hypot(x-joint.arm_root[0],y-joint.arm_root[1])>16)control.push([x,y,k]);}
  let best={dx:0,dy:0,score:Infinity};for(let dy=-3;dy<=3;dy+=.25)for(let dx=-3;dx<=3;dx+=.25){let score=0;for(const[x,y,k]of control){const q=sample(atlas,info.width,info.height,...coordinates(x,y,dx,dy));for(let c=0;c<3;c++)score+=Math.abs(original[k+c]*original[k+3]/255-q[c]*q[3]/255);score+=Math.abs(original[k+3]-q[3])*1.5;}score/=control.length;if(score<best.score)best={dx,dy,score};}
  const result=Buffer.from(original),mask=Buffer.alloc(original.length);let changed=0,masked=0;
  for(let y=0;y<320;y++)for(let x=0;x<320;x++){
   const k=(y*320+x)*4;let weight=0;
   if(kind==='arm'){const d=Math.hypot(x-joint.arm_root[0],y-joint.arm_root[1]);weight=Math.max(0,Math.min(1,(13-d)/2));}
   else{const px=x-joint.hand_root[0],py=y-joint.hand_root[1],along=px*axis[0]+py*axis[1],across=Math.abs(-px*axis[1]+py*axis[0]);if(along>=16&&along<=joint.blade_length+4&&across<=18)weight=along>=joint.blade_length-20?1:Math.max(0,Math.min(1,(across-1.7)/1.3));}
   weight=Math.round(weight*255)/255;if(!weight)continue;masked++;const q=sample(atlas,info.width,info.height,...coordinates(x,y,best.dx,best.dy)),pixel=blend(Array.from(original.subarray(k,k+4)),q,weight);for(let c=0;c<4;c++)result[k+c]=pixel[c];mask[k]=mask[k+1]=mask[k+2]=255;mask[k+3]=Math.round(weight*255);if(!original.subarray(k,k+4).equals(result.subarray(k,k+4)))changed++;
  }
  const dir=path.join(out,view);await fs.mkdir(dir,{recursive:true});for(const[n,b]of[[kind,result],[kind+'-mask',mask]])await sharp(b,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(dir,n+'.png'));
  manifest.views[view]??={joints:joint,parts:{}};const dest=`asset/character/player/icon/layers/swordsman/${view}/attack/cleanup/${kind}.png`;
  manifest.views[view].parts[kind]={original:spec.file,original_sha256:hash(await fs.readFile(path.join(game,spec.file))),file:dest,mask:dest.replace('.png','-mask.png'),translation:[best.dx,best.dy],registration_error:best.score,masked_pixels:masked,changed_pixels:changed,original_outside_mask_preserved:true};
  if(kind==='weapon'){const blade=Buffer.alloc(result.length);for(let p=0;p<102400;p++){const along=(p%320-joint.hand_root[0])*axis[0]+(Math.floor(p/320)-joint.hand_root[1])*axis[1];if(along>=14)result.copy(blade,p*4,p*4,p*4+4);}await sharp(blade,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(dir,'blade.png'));manifest.views[view].parts.blade={file:`asset/character/player/icon/layers/swordsman/${view}/attack/cleanup/blade.png`};}
  console.log(JSON.stringify({view,kind,translation:[best.dx,best.dy],changed_pixels:changed}));
 }
}
if(apply){for(const [view,v]of Object.entries(manifest.views)){const dest=path.join(game,`asset/character/player/icon/layers/swordsman/${view}/attack/cleanup`);await fs.mkdir(dest,{recursive:true});for(const f of await fs.readdir(path.join(out,view)))await fs.copyFile(path.join(out,view,f),path.join(dest,f));}await fs.writeFile(path.join(root,'metadata/character/attack/swordsman-edge-cleanup.json'),JSON.stringify(manifest,null,2)+'\n');}
await fs.writeFile(path.join(out,'prepared.json'),JSON.stringify(manifest,null,2)+'\n');
