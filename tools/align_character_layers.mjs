// Authoring: keep original visible surfaces at their measured coordinates;
// use the previously redrawn cutouts only to complete occluded joint surfaces.
// node tools/align_character_layers.mjs <qa-output-dir> [character-id]
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.argv[2];if(!out)throw Error('Supply a QA output directory');await fs.mkdir(out,{recursive:true});
const refs=JSON.parse(await fs.readFile(root+'/metadata/character/layers/reference-alignment.json','utf8'));
const manifest=JSON.parse(await fs.readFile(root+'/metadata/character/layers/manifest.json','utf8'));
const W=320,H=320,N=W*H,roles=['legs','body','cloth-hem','arm-left','arm-right','gear','weapon','shield','hair-tail','head'];
const coreNames=['legs','body','cloth-hem','hair-tail','head','arm-left','arm-right','equipment'];
const empty=()=>Buffer.alloc(N*4);
async function raw(p){return sharp(root+'/'+p).ensureAlpha().raw().toBuffer();}
async function png(pixels,p){await sharp(pixels,{raw:{width:W,height:H,channels:4}}).png().toFile(root+'/'+p);}
function bounds(b){let l=W,t=H,r=-1,d=-1,n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(b[(y*W+x)*4+3]>16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);d=Math.max(d,y);n++;}return n?[l,t,r-l+1,d-t+1]:null;}
function polygon(x,y,ps){let inside=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function union(...buffers){const result=empty();for(const b of buffers)for(let i=0;i<N;i++)if(b[i*4+3])b.copy(result,i*4,i*4,i*4+4);return result;}
async function inBox(file,box){if(!box)return empty();const[x,y,w,h]=box;return sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite([{input:await sharp(root+'/'+file).resize(w,h,{fit:'fill'}).png().toBuffer(),left:x,top:y}]).raw().toBuffer();}
async function armFill(file,shoulder,hand){
 const {data,info}=await sharp(root+'/'+file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let first=info.height,last=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>64){first=Math.min(first,y);last=Math.max(last,y);}
 function center(a,b){let sx=0,sy=0,n=0;for(let y=a;y<=b;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];if(alpha>64){sx+=x*alpha;sy+=y*alpha;n+=alpha;}}return[sx/n,sy/n];}
 const s=center(first,Math.min(last,first+Math.ceil((last-first)*.14))),h=center(Math.max(first,last-Math.ceil((last-first)*.10)),last);
 const dx=h[0]-s[0],dy=h[1]-s[1],tx=hand[0]-shoulder[0],ty=hand[1]-shoulder[1],den=dx*dx+dy*dy;
 const a=(tx*dx+ty*dy)/den,b=(ty*dx-tx*dy)/den,x=shoulder[0]-a*s[0]+b*s[1],y=shoulder[1]-b*s[0]-a*s[1];
 const url='data:image/png;base64,'+(await fs.readFile(root+'/'+file)).toString('base64');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><image href="${url}" width="${info.width}" height="${info.height}" transform="matrix(${a} ${b} ${-b} ${a} ${x} ${y})"/></svg>`;
 return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}
function hiddenFill(visible,art,interior){
 const under=empty();
 for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){
  const p=y*W+x,k=p*4;if(!interior[p]||visible[k+3]||y>=278)continue;
  if(art[k+3])art.copy(under,k,k,k+4);
  // Native underlap of the SAME visible part: two pixels, inside the original
  // silhouette. This protects antialiased joins without changing proportions.
  let best=10,near=-1;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const d=dx*dx+dy*dy,q=((y+dy)*W+x+dx)*4;if(d<best&&visible[q+3]>245){best=d;near=q;}
  }
  if(near>=0){visible.copy(under,k,near,near+4);under[k+3]=253;}
 }
 return under;
}
const qa=[];
for(const c of manifest.characters){
 if(process.argv[3]&&c.id!==process.argv[3])continue;
 const previous=JSON.parse(await fs.readFile(root+'/'+c.metadata,'utf8')),views=[];
 for(const direction of ['front','back','side']){
  const ref=refs.characters[c.id][direction],base=`asset/character/icon/layers/${c.id}/${direction}`,dest=base+'/aligned';
  await fs.mkdir(root+'/'+dest+'/render',{recursive:true});await fs.mkdir(root+'/'+dest+'/visible',{recursive:true});await fs.mkdir(root+'/'+dest+'/hidden',{recursive:true});
  const originalPath=`asset/character/icon/source/${c.id}/${direction}/idle.png`,original=await raw(originalPath),old={};
  for(const n of [...coreNames,'hair-front'])old[n]=await raw(base+'/anatomy/'+n+'.png');
  const visible=Object.fromEntries(roles.map(n=>[n,empty()]));
  for(const n of ['legs','body','cloth-hem','arm-left','arm-right','hair-tail'])visible[n]=old[n];
  visible.head=union(old.head,old['hair-front']);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const k=(y*W+x)*4;if(!old.equipment[k+3])continue;
   const role=polygon(x+.5,y+.5,ref.weapon_zone)?'weapon':ref.secondary_zone&&polygon(x+.5,y+.5,ref.secondary_zone)?'shield':'gear';
   old.equipment.copy(visible[role],k,k,k+4);
  }
  let mismatch=0;for(let i=0;i<N;i++){const owners=roles.filter(n=>visible[n][i*4+3]);if(owners.length!==(original[i*4+3]?1:0))mismatch++;else if(owners.length&& !visible[owners[0]].subarray(i*4,i*4+4).equals(original.subarray(i*4,i*4+4)))mismatch++;}
  if(mismatch)throw Error(c.id+'/'+direction+' visible reference mismatch: '+mismatch);
  const interior=new Uint8Array(N);for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){let ok=true;for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=1;dx++)if(original[((y+dy)*W+x+dx)*4+3]<245){ok=false;break;}interior[y*W+x]=ok?1:0;}
  const source=n=>base+'/redrawn/source/'+n+'.png';
  const art={body:await inBox(source('body'),ref.body_box),head:await inBox(source('head'),bounds(visible.head)),'cloth-hem':await inBox(source('cloth-hem'),bounds(visible['cloth-hem'])),legs:await inBox(source('legs'),bounds(visible.legs))};
  for(const n of ['arm-left','arm-right'])art[n]=await armFill(source(n),ref.shoulders[n],ref.hands[n]);
  art['hair-tail']=bounds(visible['hair-tail'])?await inBox(source('hair-tail'),bounds(visible['hair-tail'])):empty();
  const hidden={},groups={},core={},order=[],placements={};
  for(const n of roles){hidden[n]=hiddenFill(visible[n],art[n]||empty(),interior);await png(visible[n],dest+'/visible/'+n+'.png');await png(hidden[n],dest+'/hidden/'+n+'.png');
   const under='under:'+n;groups[under]=dest+'/hidden/'+n+'.png';order.push(under);
  }
  for(const n of ['legs','hair-tail','body','cloth-hem','arm-left','arm-right','gear','weapon','shield','head']){groups[n]=dest+'/visible/'+n+'.png';order.push(n);}
  for(const n of ['legs','body','cloth-hem','hair-tail','head','arm-left','arm-right']){
   const p=dest+'/'+n+'.png';await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite([{input:await sharp(hidden[n],{raw:{width:W,height:H,channels:4}}).png().toBuffer()},{input:await sharp(visible[n],{raw:{width:W,height:H,channels:4}}).png().toBuffer()}]).png().toFile(root+'/'+p);core[n]=p;
   const b=bounds(union(visible[n],hidden[n]));placements[n]={position:b?b.slice(0,2):[0,0],size:b?b.slice(2):[1,1]};
  }
  const eq=c.id==='guardian'?union(visible.gear,visible.shield):union(visible.gear,visible.weapon,visible.shield);core.equipment=dest+'/equipment.png';await png(eq,core.equipment);const eb=bounds(eq);placements.equipment={position:eb?eb.slice(0,2):[0,0],size:eb?eb.slice(2):[1,1]};
  if(c.id==='guardian'){core['equipment-secondary']=dest+'/equipment-secondary.png';await png(visible.weapon,core['equipment-secondary']);const b=bounds(visible.weapon);placements['equipment-secondary']={position:b.slice(0,2),size:b.slice(2)};}
  const neutral=dest+'/neutral.png';await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite(await Promise.all(order.map(async n=>({input:await fs.readFile(root+'/'+groups[n]),left:0,top:0})))).png().toFile(root+'/'+neutral);
  const pixels=await raw(neutral);let mae=0;for(let i=0;i<N;i++)for(let channel=0;channel<4;channel++){const a=channel===3?pixels[i*4+3]:pixels[i*4+channel]*pixels[i*4+3]/255,b=channel===3?original[i*4+3]:original[i*4+channel]*original[i*4+3]/255;mae+=Math.abs(a-b);}mae/=N*4;
  if(mae>.6)throw Error('Neutral reconstruction differs too much: '+mae);
  const validation={original_visible_pixels_exact:true,original_positions_unchanged:true,reference_neutral_premultiplied_mae:mae,complete_hidden_joints:true};
  views.push({direction,source:neutral,original_reference:originalPath,parts:core,idle_groups:groups,idle_order:order,placements,pivots:{head:ref.neck,body:ref.waist,hair:previous.views.find(v=>v.direction===direction).pivots.hair,cloth:ref.waist},rig:{arm_roots:ref.shoulders,hand_roots:ref.hands,weapon_arm:ref.weapon_arm,secondary_arm:ref.secondary_arm||'arm-left'},validation});
  qa.push({id:c.id,direction,...validation});
 }
 const meta={version:3,id:c.id,name:c.name,cell_size:[320,320],pivot:[160,288],workflow:'original reference-aligned visible surfaces with redrawn hidden joints; rigid animation',original_design_unchanged:true,alignment:'metadata/character/layers/reference-alignment.json',redrawn_atlas:previous.atlas||previous.redrawn_atlas,prompt:previous.prompt,animation_applied:true,views};
 await fs.writeFile(root+'/'+c.metadata,JSON.stringify(meta,null,2)+'\n');
 console.log(c.id+': original appearance and 3 directions aligned');
}
await fs.writeFile(path.resolve(out,'alignment-qa.json'),JSON.stringify(qa,null,2)+'\n');
