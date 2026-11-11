// Register real painted in-betweens without rescaling the native character.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const regions={
 front:[[109,205],[182,202],[209,208],[273,201],[278,245],[238,270],[211,280],[109,280],[107,223]],
 back:[[94,201],[215,200],[264,204],[267,246],[219,279],[94,279],[92,223]],
 side:[[94,204],[204,204],[272,204],[279,250],[238,280],[94,280],[92,225]]
};
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function sample(data,u,v){const x=Math.floor(u),y=Math.floor(v),fx=u-x,fy=v-y;let alpha=0,rgb=[0,0,0];for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){if(x+xx<0||x+xx>=1536||y+yy<0||y+yy>=1024)continue;const k=((y+yy)*1536+x+xx)*4,w=(xx?fx:1-fx)*(yy?fy:1-fy),a=data[k+3]/255*w;alpha+=a;for(let c=0;c<3;c++)rgb[c]+=data[k+c]*a;}if(alpha*255<24)return[0,0,0,0];return rgb.map(v=>Math.round(v/alpha)).concat(Math.round(alpha*255));}
const metadata={id:'crossbowman',version:1,applied:true,mode:'built-in image_gen in-betweens with fixed 2x registration',source_originals_preserved:true,no_pose_crossfade:true,sources:'metadata/character/attack/crossbowman-lift-sources.json',views:{}};
for(const view of ['front','back','side']){
 const folder=`asset/character/player/icon/layers/crossbowman/${view}/attack/lift`,atlas=await sharp(path.join(game,folder,'source/edited-atlas.png')).ensureAlpha().raw().toBuffer();
 const idle=await sharp(path.join(game,`asset/character/player/main/3-crossbowman/${view}/idle-sheet.png`)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
 const head=await sharp(path.join(game,`asset/character/player/icon/layers/crossbowman/${view}/aligned/visible/head.png`)).ensureAlpha().raw().toBuffer();
 const control=[];for(let y=120;y<207;y++)for(let x=105;x<219;x++){const k=(y*320+x)*4;if(head[k+3]>160&&idle[k+3]>180)control.push([x,y,k]);}
 const allowed=new Uint8Array(102400),mask=Buffer.alloc(idle.length);
 for(let y=0;y<281;y++)for(let x=0;x<320;x++){
  if(!inside(x+.5,y+.5,regions[view]))continue;let protectedHead=false;
  for(let yy=Math.max(0,y-2);yy<=Math.min(319,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(319,x+2);xx++)if(head[(yy*320+xx)*4+3]>16)protectedHead=true;
  if(protectedHead)continue;const n=y*320+x;allowed[n]=1;mask.fill(255,n*4,n*4+4);
 }
 await sharp(mask,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,folder,'edit-mask.png'));
 const poses=[];
 for(let col=0;col<3;col++){
  const at=(x,y,dx,dy)=>sample(atlas,col*512+36+(x-70+.5-dx)*2-.5,71+(y-110+.5-dy)*2-.5);
  let best={dx:0,dy:0,score:Infinity};
  for(let dy=-3;dy<=3;dy+=.5)for(let dx=-3;dx<=3;dx+=.5){let score=0;for(const[x,y,k]of control){const q=at(x,y,dx,dy);for(let c=0;c<3;c++)score+=Math.abs(idle[k+c]*idle[k+3]/255-q[c]*q[3]/255);score+=Math.abs(idle[k+3]-q[3])*1.5;}score/=control.length;if(score<best.score)best={dx,dy,score};}
  const result=Buffer.from(idle);let changed=0;
  for(let y=0;y<281;y++)for(let x=0;x<320;x++){const k=(y*320+x)*4;if(!allowed[y*320+x])continue;const q=at(x,y,best.dx,best.dy);for(let c=0;c<4;c++)result[k+c]=q[c];if(!result.subarray(k,k+4).equals(idle.subarray(k,k+4)))changed++;}
  const file=`${folder}/lift-${String(col+1).padStart(2,'0')}.png`;
  await sharp(result,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,file));
  poses.push({name:'lift-'+(col+1),file,registration:best,scale:[1,1],changed_pixels:changed,original_pixels_outside_mask_preserved:true,rgba_sha256:crypto.createHash('sha256').update(result).digest('hex')});
 }
 metadata.views[view]={mask:`${folder}/edit-mask.png`,edit_region:regions[view],poses};
 console.log(JSON.stringify({view,registrations:poses.map(p=>p.registration),changed:poses.map(p=>p.changed_pixels)}));
}
await fs.writeFile(path.join(root,'metadata/character/attack/crossbowman-lift.json'),JSON.stringify(metadata,null,2)+'\n');
