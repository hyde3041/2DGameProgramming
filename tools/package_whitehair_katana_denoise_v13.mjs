// Denoise v13: candidate-only packing of twelve complete2x2 source batches.
// PNG decoding and premultiplied-area registration reuse the verified v11 routines.
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

function cut(src,[x,y,w,h]){const px=Buffer.alloc(w*h*4),l=Math.max(0,x),r=Math.min(src.w,x+w);for(let Y=0;Y<h;Y++)if(y+Y>=0&&y+Y<src.h&&r>l)src.px.copy(px,(Y*w+l-x)*4,((y+Y)*src.w+l)*4,((y+Y)*src.w+r)*4);return{w,h,px};}
function bounds(im){let l=im.w,t=im.h,r=-1,b=-1;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>=8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<0)throw Error('Empty cell');return[l,t,r+1,b+1];}
function anatomy(im,override={}){
 const x0=Math.floor(im.w*.32),x1=Math.ceil(im.w*.84),y0=Math.floor(im.h*.73),y1=Math.ceil(im.h*.99);let sole=-1;
 for(let y=y0;y<y1;y++){let count=0;for(let x=x0;x<x1;x++){const i=(y*im.w+x)*4;if(im.px[i+3]>16&&im.px[i]<170&&im.px[i]>=im.px[i+1]*1.03&&im.px[i+1]>=im.px[i+2]*.85)count++;}if(count>=8)sole=y+1;}
 if(sole<0&&!override.foot)throw Error('Boot sole not found; annotate actual anatomy.');
 let l=im.w,r=-1;for(let y=Math.max(0,sole-6);y<sole;y++)for(let x=x0;x<x1;x++){const i=(y*im.w+x)*4;if(im.px[i+3]>=160&&im.px[i]<170&&im.px[i]>=im.px[i+1]*1.03){l=Math.min(l,x);r=Math.max(r,x);}}
 let crown=-1;for(let y=Math.floor(im.h*.06);y<Math.ceil(im.h*.65);y++){let count=0;for(let x=x0;x<x1;x++){const i=(y*im.w+x)*4;if(im.px[i+3]>16)count++;}if(count>=3){crown=y;break;}}
 const foot=override.foot??[(l+r+1)/2,sole];crown=override.crown_y??crown;
 if(crown<0||foot[1]<=crown||(!override.foot&&r<l))throw Error('Invalid body anatomy; annotate crown/boots.');
 return{crown_y:crown,foot,boot_span:[l,r+1],body_height:foot[1]-crown,manual_annotation:Object.keys(override).length>0};
}
function resizeWhole(im,scale,ox,oy,outW=320,outH=320){const out=Buffer.alloc(outW*outH*4);for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){
 const x0=(x-ox)/scale,x1=(x+1-ox)/scale,y0=(y-oy)/scale,y1=(y+1-oy)/scale;if(x1<=0||y1<=0||x0>=im.w||y0>=im.h)continue;
 let A=0,R=0,G=0,B=0;const area=(x1-x0)*(y1-y0);
 for(let Y=Math.max(0,Math.floor(y0));Y<Math.min(im.h,Math.ceil(y1));Y++)for(let X=Math.max(0,Math.floor(x0));X<Math.min(im.w,Math.ceil(x1));X++){
  const weight=Math.max(0,Math.min(X+1,x1)-Math.max(X,x0))*Math.max(0,Math.min(Y+1,y1)-Math.max(Y,y0)),i=(Y*im.w+X)*4,a=im.px[i+3]/255*weight;A+=a;R+=im.px[i]*a;G+=im.px[i+1]*a;B+=im.px[i+2]*a;
 }if(A){const i=(y*outW+x)*4,alpha=Math.round(A/area*255);if(alpha){out[i]=Math.round(R/A);out[i+1]=Math.round(G/A);out[i+2]=Math.round(B/A);out[i+3]=alpha;}}
 }return out;}
const option=name=>{const flag='--'+name,i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:process.argv.find(v=>v.startsWith(flag+'='))?.slice(flag.length+1);};
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
if(process.argv.includes('--help')){console.log('Candidate only: node tools/package_whitehair_katana_denoise_v13.mjs [--view front|side|back] [--annotations JSON]. Complete views only; apply is deliberately unsupported.');process.exit(0);}
if(process.argv.includes('--apply'))throw Error('This tool never writes production. Root applies separately after art review.');
const work=path.join(root,'.build/whitehair-katana-denoise-v13'),sourceRoot=path.join(root,'game/asset/character/player/icon/source/whitehair/katana/denoise-v13');
const backup=json(path.join(work,'backup-manifest.json')),protectedFiles=[...backup.files,...backup.protected_files];
function verifyProtected(){for(const item of protectedFiles)if(hash(fs.readFileSync(path.join(root,item.path)))!==item.sha256)throw Error('Live protected file changed: '+item.path);}
verifyProtected();
const annotations=option('annotations')?json(path.resolve(root,option('annotations'))):{};
const viewOption=option('view');if(viewOption&&!['front','side','back'].includes(viewOption))throw Error('Unknown view '+viewOption);
const requested=viewOption?[viewOption]:['front','side','back'],batchNames=['00-03','04-07','08-11','12-15'];
function batchRects(src,shift){const rects=[];for(let i=0;i<4;i++){const l=Math.round(i%2*src.w/2)+shift,r=Math.round((i%2+1)*src.w/2)+shift,t=Math.round(Math.floor(i/2)*src.h/2),b=Math.round((Math.floor(i/2)+1)*src.h/2);rects.push([l,t,r-l,b-t]);}return rects;}
function checkPartition(src,rects){
 const coverage=new Uint8Array(src.w*src.h);let edgeMax=0;
 for(const[x,y,w,h]of rects){
  for(let Y=Math.max(0,y);Y<Math.min(src.h,y+h);Y++)for(let X=Math.max(0,x);X<Math.min(src.w,x+w);X++)coverage[Y*src.w+X]++;
  for(let Y=Math.max(0,y);Y<Math.min(src.h,y+h);Y++)for(const X of[x,x+w-1])if(X>=0&&X<src.w)edgeMax=Math.max(edgeMax,src.px[(Y*src.w+X)*4+3]);
  for(let X=Math.max(0,x);X<Math.min(src.w,x+w);X++)for(const Y of[y,y+h-1])if(Y>=0&&Y<src.h)edgeMax=Math.max(edgeMax,src.px[(Y*src.w+X)*4+3]);
 }
 let meaningful=0,omitted=0,duplicated=0;for(let i=0;i<coverage.length;i++)if(src.px[i*4+3]>=8){meaningful++;if(!coverage[i])omitted++;if(coverage[i]>1)duplicated++;}
 return{meaningful_pixels:meaningful,omitted_meaningful_pixels:omitted,duplicated_meaningful_pixels:duplicated,edge_alpha_max:edgeMax,valid:!omitted&&!duplicated&&edgeMax<8};
}
function partition(src,annotation){
 const choices=annotation.offset_x!==undefined?[annotation.offset_x]:[0,...Array.from({length:48},(_,i)=>-i-1),...Array.from({length:24},(_,i)=>i+1)];
 for(const shift of choices){const rects=batchRects(src,Number(shift)),check=checkPartition(src,rects);if(check.valid)return{rects,offset_x:Number(shift),...check};}
 throw Error('No safe complete2x2 partition; annotate or regenerate source.');
}
const registration={id:'whitehair-katana',version:13,cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,target_body_height:160,reference_source_cell_height:627,
 method:'Complete cells; isotropic cell-resolution normalization, optional explicitly reviewed whole-batch framing correction, then one anatomical scale shared by all16 frames per view. Foot translation only.',
 source_alpha_cleaning:false,limb_masks:false,per_frame_anatomical_scale:false,endpoint_replacement:false,production_applied:false,views:{}};
const pending={},checks={},motions={};
for(const view of requested){
 const missing=batchNames.filter(name=>!fs.existsSync(path.join(sourceRoot,view,name+'-source.png')));
 if(missing.length){pending[view]=missing;continue;}
 const batches=[],cells=[];
 for(let batchIndex=0;batchIndex<4;batchIndex++){
  const name=batchNames[batchIndex],source=path.join(sourceRoot,view,name+'-source.png'),sourceBytes=fs.readFileSync(source),sourceHash=hash(sourceBytes);
  const history=path.join(work,'source-history',view+'-'+name+'-'+sourceHash.slice(0,12)+'.png');if(!fs.existsSync(history))write(history,sourceBytes);
  const src=readPng(history),annotation=annotations.views?.[view]?.batches?.[name]??{},part=partition(src,annotation),framing=Number(annotation.framing_scale??1);
  if(!Number.isFinite(framing)||framing<=0)throw Error('Invalid framing scale '+view+'/'+name);
  if(framing!==1&&!annotation.reason)throw Error('Nonidentity batch framing scale requires reviewed anatomical evidence in reason.');
  batches.push({batch:name,first_frame:batchIndex*4,source:rel(source),source_history:rel(history),source_sha256:sourceHash,source_size:[src.w,src.h],partition:part,framing_scale:framing,framing_reason:annotation.reason??null});
  part.rects.forEach((rect,j)=>{const index=batchIndex*4+j,im=cut(src,rect),a=anatomy(im,annotations.views?.[view]?.frames?.[String(index)]??{}),resolution=627/im.h;
   cells.push({index,batch:name,sourceRect:rect,im,anatomy:a,resolutionScale:resolution,framingScale:framing,normalizedBodyHeight:a.body_height*resolution*framing});});
 }
 const reference=cells.reduce((s,c)=>s+c.normalizedBodyHeight,0)/16,anatomicalScale=160/reference,frames=[],poses=[];
 for(const c of cells){
  const scale=anatomicalScale*c.resolutionScale*c.framingScale,ox=160-c.anatomy.foot[0]*scale,oy=288-c.anatomy.foot[1]*scale;
  let clipped=0;for(let y=0;y<c.im.h;y++)for(let x=0;x<c.im.w;x++)if(c.im.px[(y*c.im.w+x)*4+3]>=8&&(ox+x*scale<0||oy+y*scale<0||ox+(x+1)*scale>320||oy+(y+1)*scale>320))clipped++;
  if(clipped)throw Error(`${view} frame${c.index} clips${clipped} meaningful pixels. Review full source cell; do not cut limbs/FX.`);
  const px=resizeWhole(c.im,scale,ox,oy);frames.push(px);write(path.join(work,'frames',view,String(c.index).padStart(2,'0')+'.png'),png(320,320,px));
  poses.push({index:c.index,rect:[c.index%4*320,Math.floor(c.index/4)*320,320,320],pico2d_rect:[c.index%4*320,(3-Math.floor(c.index/4))*320,320,320],source_batch:c.batch,source_rect:c.sourceRect,
   source_crown_y:c.anatomy.crown_y,source_body_height:c.anatomy.body_height,source_foot_pivot:c.anatomy.foot,source_boot_span:c.anatomy.boot_span,manual_annotation:c.anatomy.manual_annotation,
   source_resolution_scale:c.resolutionScale,batch_framing_scale:c.framingScale,common_anatomical_scale:anatomicalScale,effective_uniform_scale:scale,translation:[ox,oy],output_body_height:c.anatomy.body_height*scale,
   output_bounds:bounds({w:320,h:320,px}),meaningful_source_pixels_clipped:0,rgba_sha256:hash(px)});
 }
 const unique=new Set(frames.map(hash)).size;if(unique!==16)throw Error(`${view} has${unique} unique frames, expected16.`);
 const sheet=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(sheet,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
 const candidate=path.join(work,'candidates',view,'attack-sheet.png');write(candidate,png(1280,1280,sheet));const target=`game/asset/character/player/main/9-whitehair/katana/${view}/attack-sheet.png`;
 registration.views[view]={source_batches:batches,source_reference_body_height:reference,common_anatomical_scale:anatomicalScale,sheet:target,sheet_sha256:hash(fs.readFileSync(candidate)),candidate:rel(candidate),frames:poses};
 motions[view]={file:target.slice(5),width:1280,height:1280,columns:4,rows:4,loop:true,frame_duration_ms:62.5,frames:poses.map(p=>({index:p.index,rect:p.rect,pico2d_rect:p.pico2d_rect}))};
 checks[view]={frame_count:16,unique_frames:unique,common_anatomical_scale:anatomicalScale,per_frame_anatomical_scale:false,whole_batch_framing_corrections:batches.filter(b=>b.framing_scale!==1).map(b=>({batch:b.batch,scale:b.framing_scale,reason:b.framing_reason})),
  source_alpha_cleaning:false,limb_masks:false,meaningful_source_pixels_clipped:0,partition_valid:batches.every(b=>b.partition.valid),source_files_unchanged:batches.every(b=>hash(fs.readFileSync(path.join(root,b.source)))===b.source_sha256)};
}
verifyProtected();
const allReady=requested.every(view=>registration.views[view]),stable='metadata/character/whitehair-katana-denoise-v13-registration.json';
write(path.join(work,'registration.json'),JSON.stringify(registration,null,2)+'\n');
write(path.join(work,'candidate-motion-patch.json'),JSON.stringify({id:'whitehair-katana',version:13,registration:stable,motions,authoring_tool:'tools/package_whitehair_katana_denoise_v13.mjs',production_applied:false},null,2)+'\n');
if(Object.keys(motions).length){
 const runtime=json(path.join(root,'metadata/character/sprites/whitehair.json'));runtime.source_attack_version=13;Object.assign(runtime.directional_attack_sheets,motions);runtime.denoise_registration=stable;
 write(path.join(work,'candidate-runtime.json'),JSON.stringify(runtime,null,2)+'\n');
 const attack=json(path.join(root,'metadata/character/attack/whitehair-katana.json'));attack.version=13;Object.assign(attack.views,registration.views);attack.validation={...attack.validation,...checks};attack.denoise_registration=stable;
 write(path.join(work,'candidate-attack.json'),JSON.stringify(attack,null,2)+'\n');
}
const report={candidate_ready:allReady&&requested.length===3,requested_views:requested,registered_views:Object.keys(registration.views),pending,production_applied:false,protected_file_count:protectedFiles.length,protected_files_unchanged:true,
 registration:rel(path.join(work,'registration.json')),metadata_patch:rel(path.join(work,'candidate-motion-patch.json')),checks};
write(path.join(work,'package-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
