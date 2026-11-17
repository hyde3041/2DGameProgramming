// Complete generated poses: one shared scale per view, foot translation only.
// node tools/package_whitehair_katana_wholepose_attack.mjs [--version 6|7|8|9] [--front-source PNG] [--side-source PNG] [--view front|side] [--apply]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc(b){let v=0xffffffff;for(const c of b)v=crcTable[(v^c)&255]^(v>>>8);return(v^0xffffffff)>>>0;}
function chunk(type,b){const n=Buffer.alloc(4),t=Buffer.from(type),c=Buffer.alloc(4);n.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([n,t,b,c]);}
function png(w,h,px){const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)px.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
function readPng(file){const b=fs.readFileSync(file);let w,h,ct,depth,id=[];for(let p=8;p<b.length;){let n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);if(t==='IHDR'){w=d.readUInt32BE();h=d.readUInt32BE(4);depth=d[8];ct=d[9];if(d[12])throw Error('Interlaced PNG unsupported');}if(t==='IDAT')id.push(d);p+=n+12;}if(depth!==8||![2,6].includes(ct))throw Error('Expected RGB(A)8 PNG');const channels=ct===6?4:3,stride=w*channels,raw=zlib.inflateSync(Buffer.concat(id)),decoded=Buffer.alloc(h*stride),paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};for(let y=0;y<h;y++){const f=raw[y*(stride+1)];for(let x=0;x<stride;x++){const a=x>=channels?decoded[y*stride+x-channels]:0,u=y?decoded[(y-1)*stride+x]:0,ul=y&&x>=channels?decoded[(y-1)*stride+x-channels]:0;decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,u,(a+u)>>1,paeth(a,u,ul)][f])&255;}}const px=Buffer.alloc(w*h*4);for(let k=0;k<w*h;k++){decoded.copy(px,k*4,k*channels,k*channels+3);px[k*4+3]=channels===4?decoded[k*4+3]:255;}return{w,h,px};}

const option=name=>{const flag='--'+name,index=process.argv.indexOf(flag);return index>=0?process.argv[index+1]:process.argv.find(a=>a.startsWith(flag+'='))?.slice(flag.length+1);};
const version=Number(option('version')||6);if(![6,7,8,9].includes(version))throw Error('Supported whole-pose versions are 6, 7, 8 and 9.');
const work=path.join(root,version===9?'.build/whitehair-katana-body-fx-v9':version===8?'.build/whitehair-katana-shoulder-v8':version===7?'.build/whitehair-katana-elbow-v7':'.build/whitehair-katana-wholepose-attack');
const sourceName=version===9?'attack-body-fx-v9-source-sheet.png':version===8?'attack-shoulder-v8-source-sheet.png':version===7?'attack-elbow-v7-source-sheet.png':'attack-wholepose-source-sheet.png';
const aliasName=version===9?'attack-body-fx-v9.png':version===8?'attack-shoulder-v8.png':version===7?'attack-elbow-v7.png':'attack-wholepose-v6.png';
const generated='C:/Users/zx304/.codex/generated_images/01a1b983-80ad-75c1-81b9-7f401620b7fe/';
const inputs={front:'exec-fbd57cd3-889c-464f-bc3e-f1a4d8cf8d66.png',side:'exec-10dce4c7-d3d2-4880-b254-192ba2fab390.png'};
const apply=process.argv.includes('--apply'),rel=p=>path.relative(root,p).replaceAll('\\','/');
const selectedView=option('view'),directions=selectedView?[selectedView]:['front','side'];
if(directions.some(d=>!['front','side'].includes(d)))throw Error('--view must be front or side.');
if(apply&&directions.length!==2)throw Error('Apply requires both complete direction sheets; --view is candidate-only.');
const preservedV6=version>=7?[
 ...['front','side'].flatMap(d=>[`game/asset/character/player/main/9-whitehair/katana/${d}/attack-wholepose-v6.png`,`game/asset/character/player/icon/source/whitehair/katana/${d}/attack-wholepose-source-sheet.png`]),
 'metadata/character/attack/whitehair-katana-wholepose-registration.json',
 ...['png','gif'].map(ext=>'game/asset/character/player/icon/preview/whitehair-katana-wholepose-v6.'+ext)
]:[];
const preservedV7=version>=8?[
 ...['front','side'].flatMap(d=>[`game/asset/character/player/main/9-whitehair/katana/${d}/attack-elbow-v7.png`,`game/asset/character/player/icon/source/whitehair/katana/${d}/attack-elbow-v7-source-sheet.png`]),
 'metadata/character/attack/whitehair-katana-elbow-v7-registration.json','metadata/character/whitehair-katana-elbow-v7-generation.json','metadata/character/whitehair-katana-elbow-v7-validation.json',
 ...['png','gif'].flatMap(ext=>['game/asset/character/player/icon/preview/whitehair-katana-elbow-v7.'+ext,'game/asset/character/player/icon/preview/whitehair-katana-elbow-v7-motions.'+ext])
]:[];
const preservedV8=version>=9?[
 ...['front','side'].flatMap(d=>[`game/asset/character/player/main/9-whitehair/katana/${d}/attack-shoulder-v8.png`,`game/asset/character/player/icon/source/whitehair/katana/${d}/attack-shoulder-v8-source-sheet.png`]),
 'metadata/character/attack/whitehair-katana-shoulder-v8-registration.json','metadata/character/whitehair-katana-shoulder-v8-generation.json','metadata/character/whitehair-katana-shoulder-v8-validation.json',
 ...['png','gif'].flatMap(ext=>['game/asset/character/player/icon/preview/whitehair-katana-shoulder-v8.'+ext,'game/asset/character/player/icon/preview/whitehair-katana-shoulder-v8-motions.'+ext])
]:[];
const protectedFiles=['game/code/main.py',...['front','side'].flatMap(d=>[`game/asset/character/player/main/9-whitehair/katana/${d}/idle-sheet.png`,`game/asset/character/player/icon/source/whitehair/katana/${d}/idle.png`]),...preservedV6,...preservedV7,...preservedV8].filter(p=>fs.existsSync(path.join(root,p))).map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))}));
if(version>=7&&!fs.existsSync(path.join(work,'backup-manifest.json')))throw Error('Prepare the previous production backup before creating v'+version+'.');
function cut(src,[x,y,w,h]){const px=Buffer.alloc(w*h*4),left=Math.max(0,x),right=Math.min(src.w,x+w);for(let row=0;row<h;row++)if(row+y>=0&&row+y<src.h&&right>left)src.px.copy(px,(row*w+left-x)*4,((row+y)*src.w+left)*4,((row+y)*src.w+right)*4);return{w,h,px};}
function bounds(im,threshold=8){let l=im.w,t=im.h,r=-1,b=-1;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>threshold){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}return[l,t,r+1,b+1];}
function anatomy(im){
 // V8 onward shifts the body left in its cell; include both real boots.
 const x0=Math.floor(im.w*(version>=8?.32:.48)),x1=Math.ceil(im.w*(version>=8?.78:.76)),y0=Math.floor(im.h*.81),y1=Math.ceil(im.h*.97);
 let sole=-1;
 for(let y=y0;y<y1;y++){let count=0;for(let x=x0;x<x1;x++){const i=(y*im.w+x)*4;if(im.px[i+3]>16&&im.px[i]<170&&im.px[i]>=im.px[i+1]*1.03&&im.px[i+1]>=im.px[i+2]*.85)count++;}if(count>=8)sole=y+1;}
 if(sole<0)throw Error('Boot sole not found');
 let l=im.w,r=-1;
 for(let y=sole-6;y<sole;y++)for(let x=x0;x<x1;x++){const i=(y*im.w+x)*4;if(im.px[i+3]>=160&&im.px[i]<170&&im.px[i]>=im.px[i+1]*1.03){l=Math.min(l,x);r=Math.max(r,x);}}
 let crown=-1;
 for(let y=Math.floor(im.h*.10);y<Math.ceil(im.h*.27);y++){let count=0;for(let x=Math.floor(im.w*(version>=8?.32:.48));x<Math.ceil(im.w*(version>=8?.78:.76));x++){const i=(y*im.w+x)*4;if(im.px[i+3]>16)count++;}if(count>=3){crown=y;break;}}
 if(crown<0)throw Error('Hair crown not found');return{crown_y:crown,boot_sole_y:sole,boot_span:[l,r+1],foot:[(l+r+1)/2,sole],body_height:sole-crown};
}
function resizeWhole(im,scale,ox,oy){const out=Buffer.alloc(320*320*4);for(let y=0;y<320;y++)for(let x=0;x<320;x++){
 const x0=(x-ox)/scale,x1=(x+1-ox)/scale,y0=(y-oy)/scale,y1=(y+1-oy)/scale;if(x1<=0||y1<=0||x0>=im.w||y0>=im.h)continue;
 let A=0,R=0,G=0,B=0;const area=(x1-x0)*(y1-y0);
 for(let Y=Math.max(0,Math.floor(y0));Y<Math.min(im.h,Math.ceil(y1));Y++)for(let X=Math.max(0,Math.floor(x0));X<Math.min(im.w,Math.ceil(x1));X++){
  const weight=Math.max(0,Math.min(X+1,x1)-Math.max(X,x0))*Math.max(0,Math.min(Y+1,y1)-Math.max(Y,y0)),i=(Y*im.w+X)*4,a=im.px[i+3]/255*weight;A+=a;R+=im.px[i]*a;G+=im.px[i+1]*a;B+=im.px[i+2]*a;
 }if(A){const i=(y*320+x)*4,alpha=Math.round(A/area*255);if(alpha){out[i]=Math.round(R/A);out[i+1]=Math.round(G/A);out[i+2]=Math.round(B/A);out[i+3]=alpha;}}
 }return out;}
const views={},checks={},registration={id:'whitehair-katana',version:version>=7?version:1,method:'Whole generated cells; one fixed uniform scale per view and per-frame boot translation only.',cell_size:[320,320],pivot:[160,288],source_alpha_cleaning:false,old_arm_masks:false,neutral_override:false,views:{}};
for(const view of directions){
 const source=`game/asset/character/player/icon/source/whitehair/katana/${view}/${sourceName}`,stablePath=path.join(root,source),suppliedPath=option(view+'-source');
 const selectedPath=suppliedPath?path.resolve(root,suppliedPath):fs.existsSync(stablePath)?stablePath:version===6?path.join(generated,inputs[view]):null;
 if(!selectedPath||!fs.existsSync(selectedPath))throw Error(`Await v${version} ${view} source: provide --${view}-source PNG or ${source}`);
 const original=fs.readFileSync(selectedPath);
 if(fs.existsSync(stablePath)&&hash(fs.readFileSync(stablePath))!==hash(original))throw Error('Selected source differs from preserved stable source; preserve the prior revision before replacing it: '+source);
 if(!fs.existsSync(stablePath))write(stablePath,original);
 const src=readPng(path.join(root,source)),cells=[],cropShiftX=version===9?(view==='front'?-24:-16):0;
 // V9 FX extends left of the old grid. All cells in each view share its offset;
 // measured empty gutters separate complete poses, without masking any art.
 const cropWidth=version>=9?Math.ceil(src.w/4):null;
 for(let f=0;f<16;f++){const col=f%4,row=Math.floor(f/4),x=Math.round(col*src.w/4)+cropShiftX,y=Math.round(row*src.h/4),r=Math.round((col+1)*src.w/4)+cropShiftX,b=Math.round((row+1)*src.h/4),rect=[x,y,cropWidth??r-x,b-y],im=cut(src,rect);cells.push({rect,im,anatomy:anatomy(im)});}
 const heights=cells.map(c=>c.anatomy.body_height).sort((a,b)=>a-b),referenceHeight=version>=9?heights.reduce((a,b)=>a+b,0)/heights.length:(heights[7]+heights[8])/2,scale=160/referenceHeight,frames=[],poses=[];
 for(let f=0;f<16;f++){
  const {rect,im,anatomy:a}=cells[f],ox=160-a.foot[0]*scale,oy=288-a.foot[1]*scale,out=resizeWhole(im,scale,ox,oy),b=bounds({w:320,h:320,px:out});
  let clipped=0;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>8&&(ox+x*scale<0||oy+y*scale<0||ox+(x+1)*scale>320||oy+(y+1)*scale>320))clipped++;
  if(clipped)throw Error('Whole-pose content clipped: '+view+' '+f+' '+clipped);
  write(path.join(work,'frames',view,String(f).padStart(2,'0')+'.png'),png(320,320,out));frames.push(out);
  poses.push({index:f,source_rect:rect,source_crown_y:a.crown_y,source_body_height:a.body_height,source_foot_pivot:a.foot,source_boot_span:a.boot_span,uniform_scale:scale,translation:[ox,oy],output_bounds:b,meaningful_source_pixels_clipped:clipped,neutral_override:false,rgba_sha256:hash(out)});
 }
 const sheet=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(sheet,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
 const candidate=path.join(work,view+'-attack-sheet.png');write(candidate,png(1280,1280,sheet));
 const target=`game/asset/character/player/main/9-whitehair/katana/${view}/attack-sheet.png`;
 views[view]={source,source_sha256:hash(original),source_size:[src.w,src.h],sheet:target,sheet_sha256:hash(fs.readFileSync(candidate)),candidate:rel(candidate),frames:poses};
 checks[view]={unique_frames:new Set(frames.map(hash)).size,frame_count:16,whole_cells_used:16,common_uniform_scale:scale,body_reference_height:referenceHeight,min_observed_body_height:heights[0],max_observed_body_height:heights[15],boot_pivot:[160,288],old_masks_or_body_overlays:false,source_alpha_cleaning:false,idle_endpoint_override:false,idle_endpoint_equality_guaranteed:false,meaningful_source_pixels_clipped:0};
 registration.views[view]={source,source_sha256:hash(original),source_size:[src.w,src.h],source_reference_body_height:referenceHeight,uniform_scale:scale,frames:poses};
 if(version>=9)registration.views[view].source_cell_partition={offset_x:cropShiftX,common_width:cropWidth,method:'Common whole-cell crop, with transparent padding outside the source image; no art or alpha cleanup.'};
}
const stableRegistration=version===9?'metadata/character/attack/whitehair-katana-body-fx-v9-registration.json':version===8?'metadata/character/attack/whitehair-katana-shoulder-v8-registration.json':version===7?'metadata/character/attack/whitehair-katana-elbow-v7-registration.json':'metadata/character/attack/whitehair-katana-wholepose-registration.json';
const metadata={id:'whitehair-katana',version,attack_style:version===9?'complete generated cel slash with body follow-through and short sword afterglow':version===8?'complete generated cel slash with extended-arm shoulder follow-through':version===7?'complete generated cel low-to-high slash with corrected elbow bend':'complete generated cel low-to-high slash poses',cell_size:[320,320],pivot:[160,288],columns:4,rows:4,frames_per_direction:16,fps:16,cycle_ms:1000,loop:true,runtime_registered:false,authoring_tool:'tools/package_whitehair_katana_wholepose_attack.mjs',anatomical_registration:stableRegistration,rendering:registration.method,views,validation:checks,notes:['All sixteen complete generated poses are retained, including frames 00 and 15.','No old arm masks, limb cutouts, artificial joint caps, glove overlays, body composites or old Idle endpoint substitutions are used.','Uniform scale is constant within each direction; only anatomical boot-pivot translation changes per frame.','The attack may have a small visual transition to the preserved original Idle; pixel equality with Idle is not claimed.','Near-transparent source pixels are preserved; alpha <=8 is ignored only during bounds/clip analysis.']};
if(version>=9){registration.scale_reference='Mean anatomical body height across all sixteen poses, fixed once per direction.';metadata.notes.push(registration.scale_reference,'Generated sword afterglow is preserved as part of each complete source cell.');}
for(const p of protectedFiles)if(hash(fs.readFileSync(path.join(root,p.path)))!==p.sha256)throw Error('Protected file changed: '+p.path);
registration.protected_files_unchanged=protectedFiles;
write(path.join(work,'candidate-metadata.json'),JSON.stringify(metadata,null,2)+'\n');write(path.join(work,'wholepose-registration.json'),JSON.stringify(registration,null,2)+'\n');
if(apply){
 for(const view of ['front','side']){const target=path.join(root,views[view].sheet),data=fs.readFileSync(path.join(root,views[view].candidate));write(target,data);write(target.replace('attack-sheet.png',aliasName),data);}
 write(path.join(root,stableRegistration),JSON.stringify(registration,null,2)+'\n');write(path.join(root,'metadata/character/attack/whitehair-katana.json'),JSON.stringify(metadata,null,2)+'\n');
}
console.log(JSON.stringify({candidate_ready:true,version,applied:apply,views:checks},null,2));


