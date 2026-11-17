// Connected-arm redraw preparation. The approved rigid motion is reference only.
// node tools/prepare_whitehair_katana_connected_attack.mjs
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

const work=path.join(root,'.build/whitehair-katana-connected-attack');
const rig=JSON.parse(fs.readFileSync(path.join(root,'metadata/character/attack/whitehair-katana-joint-rig.json'),'utf8'));
const crop=[88,145,188,245],cell=300,scale=3,atlasSize=1200,nativeSize=320;
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const backupManifest=path.join(work,'backup-manifest.json');
if(!fs.existsSync(backupManifest)){
 const backup=path.join(root,'.build/backups/whitehair-katana-before-connected-'+new Date().toISOString().replace(/[:.]/g,'-'));
 const files=[
  ...['front','side'].map(d=>`game/asset/character/player/main/9-whitehair/katana/${d}/attack-sheet.png`),
  ...['whitehair-katana-attack.png','whitehair-katana-wrist-fixed.gif','whitehair-katana-wrist-fixed.png','whitehair-katana-joint-motions.gif','whitehair-katana-joint-motions.png','whitehair-katana-motions.gif','whitehair-katana-motions.png'].map(n=>'game/asset/character/player/icon/preview/'+n),
  'metadata/character/attack/whitehair-katana.json','metadata/character/attack/whitehair-katana-joint-rig.json','metadata/character/whitehair-katana-motion-validation.json','metadata/character/whitehair-katana-joint-generation.json'
 ].filter(p=>fs.existsSync(path.join(root,p)));
 const records=files.map(p=>{const b=fs.readFileSync(path.join(root,p));write(path.join(backup,p),b);return{path:p,sha256:hash(b)};});
 const protectedFiles=['game/code/main.py',...['front','side'].flatMap(d=>[`game/asset/character/player/main/9-whitehair/katana/${d}/idle-sheet.png`,`game/asset/character/player/icon/source/whitehair/katana/${d}/idle.png`])].filter(p=>fs.existsSync(path.join(root,p))).map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))}));
 write(backupManifest,JSON.stringify({backup:rel(backup),files:records,protected_files:protectedFiles},null,2)+'\n');
}
function alphaTransform(src,m){const out=new Uint8Array(320*320),[a,b,c,d,tx,ty]=m;for(let y=0;y<320;y++)for(let x=0;x<320;x++){
 const u=a*(x-tx)+b*(y-ty),v=c*(x-tx)+d*(y-ty),xx=Math.floor(u),yy=Math.floor(v),dx=u-xx,dy=v-yy;let A=0;
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){const X=xx+i,Y=yy+j;if(X>=0&&Y>=0&&X<320&&Y<320)A+=src[(Y*320+X)*4+3]*(i?dx:1-dx)*(j?dy:1-dy);}out[y*320+x]=Math.round(A);
 }return out;}
const identity=[1,0,0,1,0,0];
function nativeMaskPng(mask){const px=Buffer.alloc(320*320*4);for(let k=0;k<mask.length;k++){px[k*4]=px[k*4+1]=px[k*4+2]=mask[k];px[k*4+3]=255;}return png(320,320,px);}
function bounds(mask){let l=320,t=320,r=-1,b=-1;for(let y=0;y<320;y++)for(let x=0;x<320;x++)if(mask[y*320+x]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}return r<0?null:[l,t,r+1,b+1];}
const snapshot=JSON.parse(fs.readFileSync(backupManifest,'utf8'));
const report={purpose:'Natural continuous right-arm artwork redrawn per pose; current cutout edges are not retained inside the full-arm mask.',native_cell:[320,320],atlas_size:[atlasSize,atlasSize],atlas_grid:[4,4],atlas_cell:[cell,cell],native_crop:crop,integer_scale:scale,frame_order:'left-to-right, top-to-bottom',views:{}};
for(const view of ['front','side']){
 const r=rig.views[view],sheetPath=`game/asset/character/player/main/9-whitehair/katana/${view}/attack-sheet.png`,snapshotSheet=path.join(root,snapshot.backup,sheetPath),sheet=readPng(snapshotSheet);
 const parts=Object.fromEntries(['upper','forearm','sword','elbow_overlap','shoulder_overlap'].map(n=>[n,readPng(path.join(root,r.layers[n])).px]));
 const fixedHair=readPng(path.join(root,r.original_fixed_parts,'hair.png')).px,fixedHead=readPng(path.join(root,r.original_fixed_parts,'head.png')).px;
 // These reference-only masks select the whole sleeve/elbow/forearm silhouette.
 // They are never drawn as cutout pieces in the connected-art output.
 const sourceGlove=Buffer.alloc(parts.forearm.length);
 for(let y=0;y<320;y++)for(let x=0;x<320;x++)if(Math.hypot(x+.5-r.grip[0],y+.5-r.grip[1])<=7.5)parts.forearm.copy(sourceGlove,(y*320+x)*4,(y*320+x)*4,(y*320+x)*4+4);
 const atlas=Buffer.alloc(atlasSize*atlasSize*4),maskAtlas=Buffer.alloc(atlas.length),context=Buffer.alloc(atlas.length),frames=[];
 for(let f=0;f<16;f++){
  const pose=r.poses[f],native=Buffer.alloc(320*320*4);
  for(let y=0;y<320;y++)sheet.px.copy(native,y*320*4,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,((Math.floor(f/4)*320+y)*1280+(f%4+1)*320)*4);
  const union=new Uint8Array(320*320),protect=new Uint8Array(320*320);
  for(const n of ['upper','forearm','elbow_overlap','shoulder_overlap']){const a=alphaTransform(parts[n],n==='upper'||n==='shoulder_overlap'?pose.upper_matrix:pose.forearm_matrix);for(let k=0;k<union.length;k++)union[k]=Math.max(union[k],a[k]);}
  const hand=alphaTransform(sourceGlove,pose.forearm_matrix),sword=alphaTransform(parts.sword,pose.sword_matrix);
  for(let k=0;k<union.length;k++)protect[k]=Math.max(hand[k],sword[k]);
  const mask=new Uint8Array(320*320);
  if(f!==0&&f!==15)for(let y=0;y<320;y++)for(let x=0;x<320;x++){
   const k=y*320+x;if(protect[k]>4)continue;
   let near=union[k]>4;
   // Hair beneath the full arm's two-pixel contour allowance may be occluded
   // by the redrawn continuous silhouette. Face/head outside the old arm stay protected.
   if(!near&&fixedHead[k*4+3]<16)for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++){const X=x+dx,Y=y+dy;if(dx*dx+dy*dy<=4&&X>=0&&Y>=0&&X<320&&Y<320&&union[Y*320+X]>16){near=true;break;}}
   if(near)mask[k]=255;
  }
  const armBounds=bounds(union),editBounds=bounds(mask);
  if(armBounds&&(armBounds[0]<crop[0]||armBounds[1]<crop[1]||armBounds[2]>crop[2]||armBounds[3]>crop[3]))throw Error('Arm outside common crop '+view+' '+f+' '+armBounds);
  write(path.join(work,'reference-frames',view,String(f).padStart(2,'0')+'.png'),png(320,320,native));
  write(path.join(work,'masks',view,String(f).padStart(2,'0')+'.png'),nativeMaskPng(mask));
  write(path.join(work,'protected-masks',view,String(f).padStart(2,'0')+'.png'),nativeMaskPng(protect));
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
   const nx=crop[0]+Math.floor(x/scale),ny=crop[1]+Math.floor(y/scale),i=(ny*320+nx)*4,k=((Math.floor(f/4)*cell+y)*atlasSize+f%4*cell+x)*4;
   native.copy(atlas,k,i,i+4);const a=native[i+3]/255;for(let c=0;c<3;c++)context[k+c]=Math.round(native[i+c]*a+235*(1-a));context[k+3]=255;
   maskAtlas[k]=maskAtlas[k+1]=maskAtlas[k+2]=mask[ny*320+nx];maskAtlas[k+3]=255;
  }
  const toAtlas=p=>[(f%4)*cell+(p[0]-crop[0])*scale,Math.floor(f/4)*cell+(p[1]-crop[1])*scale];
  frames.push({index:f,atlas_rect:[f%4*cell,Math.floor(f/4)*cell,cell,cell],native_crop:crop,arm_bounds:armBounds,edit_bounds:editBounds,edit_pixels:mask.reduce((a,v)=>a+(v?1:0),0),preserve_neutral:f===0||f===15,shoulder_native:pose.shoulder,elbow_native:pose.elbow,grip_native:pose.grip,grip_atlas:toAtlas(pose.grip),shoulder_atlas:toAtlas(pose.shoulder),elbow_atlas:toAtlas(pose.elbow),wrist_degrees:0,sword_matrix:pose.sword_matrix});
 }
 const files={reference:rel(path.join(work,view+'-arm-edit-reference.png')),context:rel(path.join(work,view+'-arm-edit-context.png')),mask:rel(path.join(work,view+'-arm-edit-mask.png'))};
 write(path.join(root,files.reference),png(atlasSize,atlasSize,atlas));write(path.join(root,files.context),png(atlasSize,atlasSize,context));write(path.join(root,files.mask),png(atlasSize,atlasSize,maskAtlas));
 report.views[view]={source_sheet:sheetPath,snapshot_source:rel(snapshotSheet),source_sha256:hash(fs.readFileSync(snapshotSheet)),files,frames};
}
write(path.join(work,'registration.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ready:true,registration:rel(path.join(work,'registration.json')),crop,atlas_size:[atlasSize,atlasSize],views:Object.fromEntries(Object.entries(report.views).map(([k,v])=>[k,v.files]))},null,2));

// A single generated atlas supplies a connected sleeve/elbow/forearm drawing
// for each complete pose. No bone cutouts or synthetic caps are used here.
if(process.argv.includes('--build')||process.argv.includes('--apply')){
 const currentMeta=JSON.parse(fs.readFileSync(path.join(root,snapshot.backup,'metadata/character/attack/whitehair-katana.json'),'utf8'));
 const stableRegistration='metadata/character/attack/whitehair-katana-connected-registration.json';
 const outMeta={...currentMeta,version:5,attack_style:'connected-arm rising slash with fixed original grip and sword',authoring_tool:'tools/prepare_whitehair_katana_connected_attack.mjs',anatomical_registration:stableRegistration,rendering:'Per-pose connected sleeve, elbow and forearm artwork inside the complete arm edit mask; the approved sheet remains pixel-identical outside that mask, including hands, grips, swords, face and feet. No segmented limb cutouts or joint caps are animated.',views:{},validation:{}};
 const importReport={backup:snapshot.backup,input_registration:rel(path.join(work,'registration.json')),views:{},protected_files_unchanged:true};
 function areaPixel(im,x0,y0,x1,y1){let A=0,R=0,G=0,B=0;const area=(x1-x0)*(y1-y0);for(let y=Math.floor(y0);y<Math.ceil(y1);y++)for(let x=Math.floor(x0);x<Math.ceil(x1);x++){
  if(x<0||y<0||x>=im.w||y>=im.h)continue;const weight=Math.max(0,Math.min(x+1,x1)-Math.max(x,x0))*Math.max(0,Math.min(y+1,y1)-Math.max(y,y0)),i=(y*im.w+x)*4,a=im.px[i+3]/255*weight;A+=a;R+=im.px[i]*a;G+=im.px[i+1]*a;B+=im.px[i+2]*a;
 }if(!A)return[0,0,0,0];const alpha=Math.round(A/area*255);return alpha?[Math.round(R/A),Math.round(G/A),Math.round(B/A),alpha]:[0,0,0,0];}
 for(const view of ['front','side']){
  const artPath=path.join(work,view+'-arm-redrawn.png'),stableSource=`game/asset/character/player/icon/source/whitehair/katana/${view}/attack-connected-arm-atlas.png`;if(!fs.existsSync(artPath))throw Error('Await connected-arm artwork: '+rel(artPath));
  const art=readPng(artPath);if(art.w!==art.h)throw Error('Connected-arm atlas must retain the square 4x4 layout.');
  const inputScale=art.w/atlasSize,sequence=[],frameChecks=[],targetBase=`game/asset/character/player/icon/layers/whitehair/katana/${view}/attack/connected`;
  for(let f=0;f<16;f++){
   const key=String(f).padStart(2,'0'),original=readPng(path.join(work,'reference-frames',view,key+'.png')).px,mask=readPng(path.join(work,'masks',view,key+'.png')).px,protectedMask=readPng(path.join(work,'protected-masks',view,key+'.png')).px;
   const out=Buffer.from(original),connected=Buffer.alloc(out.length);let changed=0,outsideChanged=0,protectedChanged=0;
   if(f!==0&&f!==15)for(let y=crop[1];y<crop[3];y++)for(let x=crop[0];x<crop[2];x++){
    const i=(y*320+x)*4;if(!mask[i])continue;
    const ax=f%4*cell+(x-crop[0])*scale,ay=Math.floor(f/4)*cell+(y-crop[1])*scale;
    const rgba=areaPixel(art,ax*inputScale,ay*inputScale,(ax+scale)*inputScale,(ay+scale)*inputScale);
    for(let c=0;c<4;c++){out[i+c]=rgba[c];connected[i+c]=rgba[c];}
   }
   for(let i=0;i<out.length;i+=4){const different=!out.subarray(i,i+4).equals(original.subarray(i,i+4));if(different){changed++;if(!mask[i])outsideChanged++;if(protectedMask[i]>4)protectedChanged++;}}
   if(outsideChanged||protectedChanged)throw Error('Protected pixels changed: '+view+' '+f);
   if((f===0||f===15)&&!out.equals(original))throw Error('Neutral frame changed');
   write(path.join(work,'frames',view,key+'.png'),png(320,320,out));
   write(path.join(work,'connected-art',view,key+'.png'),png(320,320,connected));
   if(process.argv.includes('--apply'))write(path.join(root,targetBase,key+'.png'),png(320,320,connected));
   sequence.push(out);frameChecks.push({index:f,changed_pixels:changed,outside_mask_changed_pixels:outsideChanged,protected_hand_sword_changed_pixels:protectedChanged,neutral_exact:f===0||f===15?out.equals(original):null,rgba_sha256:hash(out)});
  }
  const sheet=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<320;y++)sequence[f].copy(sheet,((Math.floor(f/4)*320+y)*1280+f%4*320)*4,y*320*4,(y+1)*320*4);
  const candidate=path.join(work,view+'-attack-sheet.png');write(candidate,png(1280,1280,sheet));
  outMeta.views[view]={...currentMeta.views[view],source:stableSource,source_sha256:hash(fs.readFileSync(artPath)),source_size:[art.w,art.h],connected_arm_frames:targetBase,sheet_sha256:hash(fs.readFileSync(candidate)),candidate:rel(candidate)};
  outMeta.validation[view]={unique_frames:new Set(sequence.map(hash)).size,frames:frameChecks,neutral_first_and_last_exact:sequence[0].equals(sequence[15]),outside_arm_mask_changed_pixels:0,hand_sword_pixels_preserved:true,feet_fixed:true};
  importReport.views[view]={source:rel(artPath),source_sha256:hash(fs.readFileSync(artPath)),common_source_to_reference_scale:inputScale,candidate:rel(candidate),checks:frameChecks};
  if(process.argv.includes('--apply'))write(path.join(root,stableSource),fs.readFileSync(artPath));
 }
 for(const p of snapshot.protected_files)if(hash(fs.readFileSync(path.join(root,p.path)))!==p.sha256)throw Error('Protected file changed: '+p.path);
 write(path.join(work,'candidate-metadata.json'),JSON.stringify(outMeta,null,2)+'\n');write(path.join(work,'import-validation.json'),JSON.stringify(importReport,null,2)+'\n');
 if(process.argv.includes('--apply')){
  for(const view of ['front','side'])write(path.join(root,outMeta.views[view].sheet),fs.readFileSync(path.join(work,view+'-attack-sheet.png')));
  const durableRegistration={...report,applied_sources:Object.fromEntries(['front','side'].map(view=>[view,{path:outMeta.views[view].source,sha256:outMeta.views[view].source_sha256,size:outMeta.views[view].source_size}]))};
  write(path.join(root,stableRegistration),JSON.stringify(durableRegistration,null,2)+'\n');
  write(path.join(root,'metadata/character/attack/whitehair-katana.json'),JSON.stringify(outMeta,null,2)+'\n');
 }
 console.log(JSON.stringify({connected_candidate_ready:true,applied:process.argv.includes('--apply'),views:Object.fromEntries(Object.entries(outMeta.validation).map(([k,v])=>[k,{unique_frames:v.unique_frames,neutral_exact:v.neutral_first_and_last_exact,outside_arm_mask_changed_pixels:v.outside_arm_mask_changed_pixels,hand_sword_pixels_preserved:v.hand_sword_pixels_preserved}]))},null,2));
}


