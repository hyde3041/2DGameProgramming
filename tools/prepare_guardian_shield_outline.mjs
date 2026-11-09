// Complete shield surfaces, without clipping them to the old occlusion polygon.
// Keep the old interior paint where both shields have a reliable solid surface.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const old=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-support.json'),'utf8'));
const reach=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-reach.json'),'utf8'));
const source='asset/character/icon/layers/guardian/attack/outline-source/edited-atlas.png';
const atlas=await sharp(path.join(game,source)).resize(1536,512).ensureAlpha().raw().toBuffer();
const backAtlas=await sharp(path.join(game,reach.source)).resize(1280,1280).ensureAlpha().raw().toBuffer();
const crops={front:[171,180],back:[78,183],side:[179,180]};
function translate(data,dx,dy){const b=Buffer.alloc(data.length);for(let y=0;y<320;y++)for(let x=0;x<320;x++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<320&&yy>=0&&yy<320)data.copy(b,(yy*320+xx)*4,(y*320+x)*4,(y*320+x)*4+4);}return b;}
function mainComponent(data){
 const seen=new Uint8Array(102400);let main=[];
 for(let p=0;p<102400;p++){
  if(seen[p]||data[p*4+3]<24)continue;const q=[p];seen[p]=1;
  for(let i=0;i<q.length;i++){const k=q[i],x=k%320,y=Math.floor(k/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,s=yy*320+xx;if(xx<0||xx>=320||yy<0||yy>=320||seen[s]||data[s*4+3]<24)continue;seen[s]=1;q.push(s);}}
  if(q.length>main.length)main=q;
 }
 const result=Buffer.alloc(data.length);for(const p of main)data.copy(result,p*4,p*4,p*4+4);return result;
}
const result={version:1,source,workflow:'complete shield outline; existing surface retained inside an eroded mask; no polygon clips the game shield',views:{}};
for(const [i,v]of ['front','back','side'].entries()){
 const reference=v==='back'?reach.views.back.parts.shield:old.views[v].parts.shield;
 const original=await sharp(path.join(game,reference)).ensureAlpha().raw().toBuffer();
 let candidate;
 if(v==='back'){
  candidate=await sharp(backAtlas,{raw:{width:1280,height:1280,channels:4}}).extract({left:640,top:640,width:640,height:640}).resize(320,320).ensureAlpha().raw().toBuffer();
 }else{
  const local=await sharp(atlas,{raw:{width:1536,height:512,channels:4}}).extract({left:i*512+106,top:26,width:300,height:460}).resize(75,115).raw().toBuffer();
  candidate=Buffer.alloc(original.length);const [left,top]=crops[v];
  for(let y=0;y<115;y++)for(let x=0;x<75;x++)local.copy(candidate,((y+top)*320+x+left)*4,(y*75+x)*4,(y*75+x)*4+4);
 }
 candidate=mainComponent(candidate);const interior=[];
 for(let y=4;y<316;y++)for(let x=4;x<316;x++){
  let solid=true;for(let dy=-3;dy<=3&&solid;dy++)for(let dx=-3;dx<=3;dx++)if(original[((y+dy)*320+x+dx)*4+3]<224){solid=false;break;}
  if(solid)interior.push([x,y]);
 }
 let shift=[0,0],best=Infinity;
 if(v!=='back')for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
  let error=0;for(let k=0;k<interior.length;k+=2){const[x,y]=interior[k],p=(y*320+x)*4,q=((y-dy)*320+x-dx)*4;if(candidate[q+3]<128)error+=255*3;else for(let c=0;c<3;c++)error+=Math.abs(original[p+c]-candidate[q+c]);}
  if(error<best){best=error;shift=[dx,dy];}
 }
 candidate=translate(candidate,...shift);const protectedMask=Buffer.alloc(candidate.length);let protectedPixels=0;
 for(const[x,y]of interior){const p=(y*320+x)*4;if(candidate[p+3]>=128){original.copy(candidate,p,p,p+4);protectedMask.fill(255,p,p+4);protectedPixels++;}}
 const folder=`asset/character/icon/layers/guardian/${v}/attack/push`;
 const file=`${folder}/shield-full.png`,mask=`${folder}/shield-interior-mask.png`;
 for(const[f,data]of [[file,candidate],[mask,protectedMask]])await sharp(data,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,f));
 result.views[v]={file,reference,protected_mask:mask,protected_pixels:protectedPixels,fixed_translation:shift,
  native_frame_scale:[1,1],...(v==='back'?{full_source:reach.source,source_cell:[640,640,640,640],old_polygon_not_applied:true}:{input_crop:[i*512+106,26,300,460],native_position:crops[v]})};
}
await fs.writeFile(path.join(root,'metadata/character/attack/guardian-shield-outline.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.views).map(([v,r])=>[v,{protected_pixels:r.protected_pixels,fixed_translation:r.fixed_translation}]))));
