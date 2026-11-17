// Complete generated poses: fixed per-motion scale, foot translation only.
// Style v10: four complete source sheets, one fixed scale per direction/motion.
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

const work=path.join(root,'.build/whitehair-katana-style-v10');
const option=name=>{const flag='--'+name,i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:process.argv.find(v=>v.startsWith(flag+'='))?.slice(flag.length+1);};
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const apply=process.argv.includes('--apply'),keys=['front-idle','front-attack','side-idle','side-attack'];
if(process.argv.includes('--help')){console.log('node tools/package_whitehair_katana_style.mjs --front-idle PNG --front-attack PNG --side-idle PNG --side-attack PNG [--profile PNG] [--annotations JSON] [--apply]\nOptional --<key>-shift-x N chooses one common source-cell offset per sheet. Candidate-only is the default.');process.exit(0);}
const backupPath=path.join(work,'backup-manifest.json');
if(!fs.existsSync(backupPath))throw Error('Back up current production before v10 packaging.');
const backup=json(backupPath),annotations=option('annotations')?json(path.resolve(root,option('annotations'))):{};
const protectedFiles=backup.protected_files;
function verifyProtected(){for(const item of protectedFiles){if(hash(fs.readFileSync(path.join(root,item.path)))!==item.sha256)throw Error('Protected file changed: '+item.path);}}
verifyProtected();
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
 let crown=-1;for(let y=Math.floor(im.h*.06);y<Math.ceil(im.h*.38);y++){let count=0;for(let x=x0;x<x1;x++){const i=(y*im.w+x)*4;if(im.px[i+3]>16)count++;}if(count>=3){crown=y;break;}}
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
const sourceManifestPath=path.join(work,'selected-sources.json'),selected=fs.existsSync(sourceManifestPath)?json(sourceManifestPath):{};
for(const key of keys){const supplied=option(key);if(supplied)selected[key]=path.resolve(root,supplied);}
if(option('profile'))selected.profile=path.resolve(root,option('profile'));
if(keys.some(k=>!selected[k]||!fs.existsSync(selected[k])))throw Error('Await all4 source sheets: '+keys.filter(k=>!selected[k]||!fs.existsSync(selected[k])).join(', '));
write(sourceManifestPath,JSON.stringify(selected,null,2)+'\n');
const loaded={};
for(const key of keys){
 const original=fs.readFileSync(selected[key]),sha=hash(original),history=path.join(work,'source-history',key+'-'+sha.slice(0,12)+'.png');if(!fs.existsSync(history))write(history,original);
 const src=readPng(history),partition=pickPartition(src,key),cells=rects(src,partition.offset_x).map((rect,index)=>{const im=cut(src,rect);return{rect,im,anatomy:anatomy(im,annotations.sheets?.[key]?.frames?.[String(index)]??{})};});
 loaded[key]={original,source_sha256:sha,history:rel(history),src,partition,cells};
}
const registration={id:'whitehair-katana',version:10,authoring_tool:'tools/package_whitehair_katana_style.mjs',method:'Complete source cells; one fixed uniform scale per direction and motion across all16 frames, followed only by anatomical boot translation.',scale_registration_note:'Generated Idle and Attack sheets have different natural source resolutions. Each complete motion is normalized once to mean body height160; no per-frame, limb, nonuniform, or mesh rescaling.',cell_size:[320,320],pivot:[160,288],target_body_height:160,source_alpha_cleaning:false,limb_overlays:false,neutral_override:false,views:{}};
const animations={},attackViews={},attackChecks={},attackMotions={},candidatePaths={};
for(const view of['front','side']){
 const record={states:{}};registration.views[view]=record;
 for(const state of['idle','attack']){
  const key=view+'-'+state,input=loaded[key],frames=[],poses=[],stableSource=`game/asset/character/player/icon/source/whitehair/katana/${view}/${state}-style-v10-source-sheet.png`;
  const heights=input.cells.map(c=>c.anatomy.body_height),reference=heights.reduce((a,b)=>a+b,0)/heights.length,scale=160/reference;
  for(let f=0;f<16;f++){
   const {rect,im,anatomy:a}=input.cells[f],ox=160-a.foot[0]*scale,oy=288-a.foot[1]*scale;let clipped=0;
   for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>=8&&(ox+x*scale<0||oy+y*scale<0||ox+(x+1)*scale>320||oy+(y+1)*scale>320))clipped++;
   if(clipped)throw Error(key+' frame'+f+' clips '+clipped+' meaningful source pixels.');
   const out=resizeWhole(im,scale,ox,oy),outputBounds=bounds({w:320,h:320,px:out});frames.push(out);
   write(path.join(work,'frames',view,state,String(f).padStart(2,'0')+'.png'),png(320,320,out));
   poses.push({index:f,rect:[f%4*320,Math.floor(f/4)*320,320,320],pico2d_rect:[f%4*320,(3-Math.floor(f/4))*320,320,320],source_rect:rect,source_crown_y:a.crown_y,source_body_height:a.body_height,source_foot_pivot:a.foot,source_boot_span:a.boot_span,manual_annotation:a.manual_annotation,uniform_scale:scale,translation:[ox,oy],output_bounds:outputBounds,meaningful_source_pixels_clipped:0,rgba_sha256:hash(out)});
  }
  const unique=new Set(frames.map(hash)).size;if(unique!==16)throw Error(key+' has only '+unique+' unique frames; source redraw required.');
  const sheet=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)frames[f].copy(sheet,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
  const candidate=path.join(work,'candidates',view,state+'-sheet.png');write(candidate,png(1280,1280,sheet));candidatePaths[key]=candidate;
  const target=`game/asset/character/player/main/9-whitehair/katana/${view}/${state}-sheet.png`,motion={file:target.slice(5),width:1280,height:1280,columns:4,rows:4,loop:true,frame_duration_ms:62.5,frames:poses.map(p=>({index:p.index,rect:p.rect,pico2d_rect:p.pico2d_rect}))};
  record.states[state]={source:stableSource,source_history:input.history,source_sha256:input.source_sha256,source_size:[input.src.w,input.src.h],source_cell_partition:input.partition,source_reference_body_height:reference,uniform_scale:scale,scale_samples:16,sheet:target,candidate:rel(candidate),sheet_sha256:hash(fs.readFileSync(candidate)),unique_frames:unique,frames:poses};
  if(state==='idle')animations[view]=motion;
  else{attackMotions[view]=motion;attackViews[view]=record.states[state];attackChecks[view]={unique_frames:unique,frame_count:16,whole_cells_used:16,common_uniform_scale:scale,scale_fixed_for_all_frames:true,body_reference_height:reference,boot_pivot:[160,288],source_alpha_cleaning:false,meaningful_source_pixels_clipped:0};}
 }
}
const stableRegistration='metadata/character/whitehair-katana-style-v10-registration.json';
const idleMeta={id:'whitehair-katana',source_character:'whitehair',version:10,cell_size:[320,320],pivot:[160,288],fps:16,cycle_ms:1000,frames_per_direction:16,runtime_registered:true,authoring_tool:registration.authoring_tool,registration:stableRegistration,animations,notes:['All16 complete generated cells are retained; no old body/limb overlays.','Uniform scale is fixed across all16 frames within each direction/motion.']};
const attackMeta={id:'whitehair-katana',version:10,attack_style:'complete generated cel party-style slash with body follow-through and crimson sword afterglow',cell_size:[320,320],pivot:[160,288],columns:4,rows:4,frames_per_direction:16,fps:16,cycle_ms:1000,loop:true,runtime_registered:true,runtime_profile:'9-whitehair',runtime_metadata:'metadata/character/sprites/whitehair.json',authoring_tool:registration.authoring_tool,anatomical_registration:stableRegistration,rendering:registration.method,views:attackViews,validation:attackChecks,notes:['Complete generated cells including0/15; no limb masks or previous Idle overrides.','One fixed isotropic scale across all16 frames in each direction/motion, normalizing its natural source resolution.','Back remains the explicitly documented temporary front fallback.']};
const runtimeMeta=json(path.join(root,'metadata/character/sprites/whitehair.json'));runtimeMeta.source_attack_version=10;runtimeMeta.directional_attack_sheets=attackMotions;runtimeMeta.style_registration=stableRegistration;
if(selected.profile){
 const original=fs.readFileSync(selected.profile),source=readPng(selected.profile),target='game/asset/character/player/main/9-whitehair/skill/profile/deployment-square.png',existing=readPng(path.join(root,target));
 const scale=Math.min(existing.w/source.w,existing.h/source.h),offset=[(existing.w-source.w*scale)/2,(existing.h-source.h*scale)/2],candidate=path.join(work,'candidates','deployment-square.png');
 write(candidate,png(existing.w,existing.h,resizeWhole(source,scale,...offset,existing.w,existing.h)));
 const history=path.join(work,'source-history','profile-'+hash(original).slice(0,12)+'.png');if(!fs.existsSync(history))write(history,original);
 registration.profile={source:'game/asset/character/player/icon/source/whitehair/katana/style-v10-profile-source.png',source_history:rel(history),source_sha256:hash(original),source_size:[source.w,source.h],uniform_scale:scale,translation:offset,target_size:[existing.w,existing.h],file:target,candidate:rel(candidate),method:'Whole portrait uniform fit; transparent padding only if aspect ratios differ.'};
}
verifyProtected();
write(path.join(work,'registration.json'),JSON.stringify(registration,null,2)+'\n');
for(const[name,data]of Object.entries({'candidate-idle.json':idleMeta,'candidate-attack.json':attackMeta,'candidate-runtime.json':runtimeMeta}))write(path.join(work,name),JSON.stringify(data,null,2)+'\n');
if(apply){
 for(const view of['front','side'])for(const state of['idle','attack']){const item=registration.views[view].states[state],data=fs.readFileSync(candidatePaths[view+'-'+state]);write(path.join(root,item.sheet),data);write(path.join(root,item.sheet.replace(state+'-sheet.png',state+'-style-v10.png')),data);write(path.join(root,item.source),loaded[view+'-'+state].original);}
 if(registration.profile){const p=registration.profile;write(path.join(root,p.file),fs.readFileSync(path.join(root,p.candidate)));write(path.join(root,p.file.replace('deployment-square.png','deployment-style-v10.png')),fs.readFileSync(path.join(root,p.candidate)));write(path.join(root,p.source),fs.readFileSync(selected.profile));}
 write(path.join(root,stableRegistration),JSON.stringify(registration,null,2)+'\n');
 for(const[file,data]of[['metadata/character/idle/whitehair-katana.json',idleMeta],['metadata/character/attack/whitehair-katana.json',attackMeta],['metadata/character/sprites/whitehair.json',runtimeMeta]])write(path.join(root,file),JSON.stringify(data,null,2)+'\n');
 verifyProtected();
}
console.log(JSON.stringify({candidate_ready:true,applied:apply,version:10,views:Object.fromEntries(Object.entries(registration.views).map(([view,item])=>[view,{states:Object.fromEntries(Object.entries(item.states).map(([state,v])=>[state,{scale:v.uniform_scale,mean_body_height:v.source_reference_body_height,candidate:v.candidate,partition:v.source_cell_partition,unique_frames:v.unique_frames}]))}]))},null,2));
