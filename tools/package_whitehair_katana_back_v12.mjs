// Back v12 candidate packer. PNG and complete-cell primitives adapted from v11.
// Only .build outputs are written. No production apply, limb masks or alpha edits.
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


const work=path.join(root,'.build/whitehair-katana-complete-v12');
const option=name=>{const flag='--'+name,i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:process.argv.find(v=>v.startsWith(flag+'='))?.slice(flag.length+1);};
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
if(process.argv.includes('--help')){
 console.log('node tools/package_whitehair_katana_back_v12.mjs --idle-source PNG [--attack-source PNG] [--annotations JSON] [--idle-shift-x N] [--attack-shift-x N]');
 console.log('Candidate-only. Cached sources permit registering idle first, then adding attack. Optional annotations: {sheets:{idle|attack:{offset_x,frames:{0:{foot:[x,y],crown_y}}}}}.');
 process.exit(0);
}
if(process.argv.includes('--apply'))throw Error('This tool is candidate-only; production application is a separate reviewed step.');
const annotations=option('annotations')?json(path.resolve(root,option('annotations'))):{};
const protectedPaths=[
 ...['front','side'].flatMap(view=>['idle','attack'].map(state=>`game/asset/character/player/main/9-whitehair/katana/${view}/${state}-sheet.png`)),
 'metadata/character/idle/whitehair-katana.json','metadata/character/attack/whitehair-katana.json',
 'metadata/character/sprites/whitehair.json','game/asset/character/player/main/9-whitehair/skill/profile/deployment-square.png'
];
const protectedBefore=Object.fromEntries(protectedPaths.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]));
function verifyProtected(){for(const [p,sha]of Object.entries(protectedBefore))if(hash(fs.readFileSync(path.join(root,p)))!==sha)throw Error('Live asset changed during candidate packaging: '+p);}
function cut(src,[x,y,w,h]){const px=Buffer.alloc(w*h*4),l=Math.max(0,x),r=Math.min(src.w,x+w);for(let Y=0;Y<h;Y++)if(y+Y>=0&&y+Y<src.h&&r>l)src.px.copy(px,(Y*w+l-x)*4,((y+Y)*src.w+l)*4,((y+Y)*src.w+r)*4);return{w,h,px};}
function bounds(im){let l=im.w,t=im.h,r=-1,b=-1;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>=8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<0)throw Error('Empty cell');return[l,t,r+1,b+1];}
function rects(src,shift){return Array.from({length:16},(_,f)=>[Math.round(f%4*src.w/4)+shift,Math.round(Math.floor(f/4)*src.h/4),Math.ceil(src.w/4),Math.ceil(src.h/4)]);}
function partitionCheck(src,shift){
 const cells=rects(src,shift),coverage=new Uint8Array(src.w*src.h);let edgeMax=0;
 for(const [x,y,w,h]of cells){for(let Y=Math.max(0,y);Y<Math.min(src.h,y+h);Y++)for(let X=Math.max(0,x);X<Math.min(src.w,x+w);X++)coverage[Y*src.w+X]++;
  for(let Y=Math.max(0,y);Y<Math.min(src.h,y+h);Y++)for(const X of[x,x+w-1])if(X>=0&&X<src.w)edgeMax=Math.max(edgeMax,src.px[(Y*src.w+X)*4+3]);
  for(let X=Math.max(0,x);X<Math.min(src.w,x+w);X++)for(const Y of[y,y+h-1])if(Y>=0&&Y<src.h)edgeMax=Math.max(edgeMax,src.px[(Y*src.w+X)*4+3]);
 }
 let count=0,omitted=0,duplicated=0,omittedMax=0;
 for(let k=0;k<coverage.length;k++){const a=src.px[k*4+3];if(!coverage[k])omittedMax=Math.max(omittedMax,a);if(a>=8){count++;if(!coverage[k])omitted++;if(coverage[k]>1)duplicated++;}}
 return{offset_x:shift,common_cell_width:Math.ceil(src.w/4),common_cell_height:Math.ceil(src.h/4),edge_alpha_max:edgeMax,meaningful_pixels:count,omitted_meaningful_pixels:omitted,duplicated_meaningful_pixels:duplicated,omitted_alpha_max:omittedMax,valid:!omitted&&!duplicated&&edgeMax<8};
}
function pickPartition(src,key){
 const explicit=option(key+'-shift-x')??annotations.sheets?.[key]?.offset_x;
 if(explicit!==undefined){const check=partitionCheck(src,Number(explicit));if(!check.valid)throw Error(key+' selected partition cuts/duplicates art: '+JSON.stringify(check));return check;}
 const shifts=[0,...Array.from({length:48},(_,i)=>-i-1),...Array.from({length:24},(_,i)=>i+1)];
 for(const shift of shifts){const check=partitionCheck(src,shift);if(check.valid)return check;}
 throw Error(key+' has no safe complete-cell partition. Source placement needs review; no alpha cleanup is performed.');
}
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

const selectedFile=path.join(work,'back-selected-sources.json');
const selected=fs.existsSync(selectedFile)?json(selectedFile):{};
for(const state of ['idle','attack'])if(option(state+'-source'))selected[state]=path.resolve(root,option(state+'-source'));
const states=['idle','attack'].filter(state=>selected[state]);
if(!states.length)throw Error('Supply --idle-source and/or --attack-source.');
for(const state of states)if(!fs.existsSync(selected[state]))throw Error('Missing '+state+' source: '+selected[state]);
write(selectedFile,JSON.stringify(selected,null,2)+'\n');
const registration={id:'whitehair-katana',version:12,direction:'back',cell_size:[320,320],pivot:[160,288],fps:16,frames_per_direction:16,target_body_height:160,
 method:'Complete generated cells; one isotropic scale fixed for all16 frames per motion and boot-pivot translation only.',
 source_alpha_cleaning:false,limb_masks:false,per_frame_scale:false,endpoint_replacement:false,production_applied:false,motions:{}};
const motions={},checks={};
for(const state of states){
 const original=fs.readFileSync(selected[state]),sourceHash=hash(original);
 const history=path.join(work,'back-source-history',state+'-'+sourceHash.slice(0,12)+'.png');
 if(!fs.existsSync(history))write(history,original);
 const src=readPng(history),partition=pickPartition(src,state);
 const cells=rects(src,partition.offset_x).map((rect,index)=>{const im=cut(src,rect);return{rect,im,anatomy:anatomy(im,annotations.sheets?.[state]?.frames?.[String(index)]??{})};});
 const reference=cells.reduce((sum,c)=>sum+c.anatomy.body_height,0)/16,scale=160/reference;
 const frames=[],poses=[];
 for(let f=0;f<16;f++){
  const {rect,im,anatomy:a}=cells[f],ox=160-a.foot[0]*scale,oy=288-a.foot[1]*scale;
  let clipped=0;
  for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>=8&&(ox+x*scale<0||oy+y*scale<0||ox+(x+1)*scale>320||oy+(y+1)*scale>320))clipped++;
  if(clipped)throw Error('Back '+state+' frame'+f+' clips '+clipped+' meaningful source pixels. Review source/grid.');
  const px=resizeWhole(im,scale,ox,oy);frames.push(px);
  write(path.join(work,'frames','back',state,String(f).padStart(2,'0')+'.png'),png(320,320,px));
  poses.push({index:f,rect:[f%4*320,Math.floor(f/4)*320,320,320],pico2d_rect:[f%4*320,(3-Math.floor(f/4))*320,320,320],
   source_rect:rect,source_crown_y:a.crown_y,source_body_height:a.body_height,source_foot_pivot:a.foot,source_boot_span:a.boot_span,
   manual_annotation:a.manual_annotation,uniform_scale:scale,translation:[ox,oy],output_bounds:bounds({w:320,h:320,px}),meaningful_source_pixels_clipped:0,rgba_sha256:hash(px)});
 }
 const unique=new Set(frames.map(hash)).size;
 if(unique!==16)throw Error('Back '+state+' has '+unique+' unique frames; expected16 generated poses.');
 const sheet=Buffer.alloc(1280*1280*4);
 for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(sheet,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
 const candidate=path.join(work,'candidates','back',state+'-sheet.png');write(candidate,png(1280,1280,sheet));
 const target=`game/asset/character/player/main/9-whitehair/katana/back/${state}-sheet.png`;
 registration.motions[state]={source:rel(selected[state]),source_history:rel(history),source_sha256:sourceHash,source_size:[src.w,src.h],source_reference_body_height:reference,
  uniform_scale:scale,source_cell_partition:partition,sheet:target,sheet_sha256:hash(fs.readFileSync(candidate)),candidate:rel(candidate),frames:poses};
 motions[state]={file:target.slice(5),width:1280,height:1280,columns:4,rows:4,loop:true,frame_duration_ms:62.5,facing:'back',
  frames:poses.map(p=>({index:p.index,rect:p.rect,pico2d_rect:p.pico2d_rect}))};
 checks[state]={frame_count:16,unique_frames:unique,common_uniform_scale:scale,source_alpha_cleaning:false,limb_masks:false,meaningful_source_pixels_clipped:0,
  partition_valid:partition.valid,source_file_unchanged:hash(fs.readFileSync(selected[state]))===sourceHash};
}
const stableRegistration='metadata/character/whitehair-katana-back-v12-registration.json';
const patch={id:'whitehair-katana',version:12,registration:stableRegistration,direction:'back',motions,authoring_tool:'tools/package_whitehair_katana_back_v12.mjs',production_applied:false};
if(motions.idle){
 const idle=json(path.join(root,'metadata/character/idle/whitehair-katana.json'));
 idle.version=12;idle.animations.back=motions.idle;idle.back_registration=stableRegistration;
 write(path.join(work,'candidate-idle.json'),JSON.stringify(idle,null,2)+'\n');
}
if(motions.attack){
 const attack=json(path.join(root,'metadata/character/attack/whitehair-katana.json'));
 attack.version=12;attack.views.back=registration.motions.attack;attack.validation={...attack.validation,back:checks.attack};attack.back_registration=stableRegistration;
 write(path.join(work,'candidate-attack.json'),JSON.stringify(attack,null,2)+'\n');
}
if(motions.idle&&motions.attack){
 const runtime=json(path.join(root,'metadata/character/sprites/whitehair.json'));
 runtime.source_attack_version=12;runtime.directional_attack_sheets.back=motions.attack;
 if(runtime.direction_aliases)delete runtime.direction_aliases.back;
 runtime.direction_notes={...runtime.direction_notes,back:'Authored rear idle and attack, anatomical right sword arm on screen-right; original left/right side behavior preserved.'};
 runtime.back_registration=stableRegistration;
 write(path.join(work,'candidate-runtime.json'),JSON.stringify(runtime,null,2)+'\n');
}
verifyProtected();
write(path.join(work,'back-registration.json'),JSON.stringify(registration,null,2)+'\n');
write(path.join(work,'candidate-back-motion-patch.json'),JSON.stringify(patch,null,2)+'\n');
const report={candidate_ready:!!(motions.idle&&motions.attack),registered_states:states,production_applied:false,front_side_and_live_metadata_unchanged:true,protected_files:protectedBefore,
 registration:rel(path.join(work,'back-registration.json')),metadata_patch:rel(path.join(work,'candidate-back-motion-patch.json')),checks,
 notes:['No limb/head edits, masks, alpha cleanup, endpoint replacement or per-frame resizing.','Body/skull proportions and rear handedness require visual approval; equal160px height alone is not sufficient.','Idle and attack use independent fixed motion scales derived from their actual source body heights.']};
write(path.join(work,'back-package-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
