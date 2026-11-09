// Built-in image edit is sampled only inside small hidden torso polygons.
// All visible source layers are read-only; isolated leftovers are removed in copies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const idle=JSON.parse(await fs.readFile(path.join(root,'metadata/character/idle/guardian-layers.json'),'utf8'));
const source='asset/character/icon/layers/guardian/attack/source/joint-edited-atlas.png';
const atlas=await sharp(path.join(game,source)).resize(1920,640).ensureAlpha().raw().toBuffer();
const polygons={front:[[141,211],[153,214],[151,236],[133,253],[122,253],[130,233]],
 back:[[179,214],[194,216],[197,231],[191,235],[182,234],[177,229]],
 side:[[146,212],[162,215],[158,240],[139,259],[124,253],[126,232]]};
function inside(x,y,ps){let hit=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function clean(data,threshold){const seen=new Uint8Array(102400),keep=new Uint8Array(102400);
 for(let p=0;p<102400;p++){if(seen[p]||data[p*4+3]<24)continue;const q=[p];seen[p]=1;
   for(let i=0;i<q.length;i++){const k=q[i],x=k%320,y=Math.floor(k/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,s=yy*320+xx;if(xx<0||yy<0||xx>=320||yy>=320||seen[s]||data[s*4+3]<24)continue;seen[s]=1;q.push(s);}}
   if(q.length>=threshold)for(const k of q){const x=k%320,y=Math.floor(k/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(x+dx>=0&&x+dx<320&&y+dy>=0&&y+dy<320)keep[(y+dy)*320+x+dx]=1;}}
 }
 let removed=0;for(let p=0;p<102400;p++)if(!keep[p]&&data[p*4+3]){data.fill(0,p*4,p*4+4);removed++;}return removed;
}
const result={version:1,source,registration:'entire atlas resized uniformly to 1920x640, then each 640 cell uniformly to 320; no per-part fitting',views:{}};
for(const [col,v]of idle.views.entries()){
 const folder=`asset/character/icon/layers/guardian/${v.view}/attack/support`;await fs.mkdir(path.join(game,folder),{recursive:true});
 const generated=await sharp(atlas,{raw:{width:1920,height:640,channels:4}}).extract({left:col*640,top:0,width:640,height:640}).resize(320,320).raw().toBuffer();
 const restArm=await sharp(path.join(game,v.parts[v.weapon_arm])).ensureAlpha().raw().toBuffer();
 const fill=Buffer.alloc(320*320*4),mask=Buffer.alloc(fill.length);let count=0;
 for(let y=0;y<320;y++)for(let x=0;x<320;x++){
   if(!inside(x+.5,y+.5,polygons[v.view]))continue;
   let occluded=false;for(let dy=-2;dy<=2&&!occluded;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<320&&yy>=0&&yy<320&&restArm[(yy*320+xx)*4+3]>=24){occluded=true;break;}}
   if(!occluded)continue;const p=(y*320+x)*4;mask.fill(255,p,p+4);
   if(generated[p+3]>=24){generated.copy(fill,p,p,p+4);count++;}
 }
 const parts={},cleanup={};
 for(const [n,file]of Object.entries(v.parts)){
   const data=await sharp(path.join(game,file)).ensureAlpha().raw().toBuffer();
   const group=n.replace(/^under:/,''),hidden=n.startsWith('under:');
   const threshold=hidden?16:group==='head'?200:group==='shield'?100:group==='gear'?60:16;
   cleanup[n]=clean(data,threshold);
   // The static torso must not retain a sliver of the old resting sleeve.
   // Restrict replacement to the same shoulder/underarm polygon used by the fill.
   if(n==='body')for(let y=0;y<320;y++)for(let x=0;x<320;x++)if(mask[(y*320+x)*4+3]){
     const p=(y*320+x)*4;
     if(generated[p+3]>=24)generated.copy(data,p,p,p+4);else data.fill(0,p,p+4);
   }
   if(n==='under:body')for(let y=0;y<320;y++)for(let x=0;x<320;x++){
     let covered=false;for(let dy=-2;dy<=2&&!covered;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<320&&yy>=0&&yy<320&&restArm[(yy*320+xx)*4+3]>24){covered=true;break;}}
     if(covered)data.fill(0,(y*320+x)*4,(y*320+x)*4+4);
   }
   const dest=`${folder}/${n.replace(':','-')}.png`;
   await sharp(data,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,dest));parts[n]=dest;
 }
 for(const [name,data]of Object.entries({'torso-fill':fill,'torso-mask':mask}))await sharp(data,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,folder,name+'.png'));
 result.views[v.view]={parts,cleanup,fill:`${folder}/torso-fill.png`,mask:`${folder}/torso-mask.png`,polygon:polygons[v.view],fill_pixels:count};
}
await fs.writeFile(path.join(root,'metadata/character/attack/guardian-support.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.views).map(([v,r])=>[v,{fill_pixels:r.fill_pixels,removed_pixels:Object.values(r.cleanup).reduce((a,b)=>a+b,0)}]))));
