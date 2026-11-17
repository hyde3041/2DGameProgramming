// Package upward-drawing whole-pose attacks from one source sheet per direction.
// Inspect: node tools/package_whitehair_katana_rising_attack.mjs --analyze
// Build:  node tools/package_whitehair_katana_rising_attack.mjs [--apply]
// Registration marks the actual hair crown and boot soles, never sword-inclusive bounds.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='game/asset/character/player';
const apply=process.argv.includes('--apply');
const option=name=>{const i=process.argv.indexOf(name);if(i<0)return null;if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Missing value for '+name);return process.argv[i+1];};
const registrationRel=option('--registration')||'metadata/character/attack/whitehair-katana-rising-registration.json';
const registrationFile=path.resolve(root,registrationRel);
function preservedInput(direction){const local=path.join(root,base,'icon/source/whitehair/katana',direction,'attack-rising-source-sheet.png');return fs.existsSync(local)?local:path.resolve(root,option(`--${direction}-source`)||local);}
const inputs={front:preservedInput('front'),side:preservedInput('side')};
const work=path.join(root,'.build/whitehair-katana-rising-attack');
if(process.argv.includes('--help')){console.log('Inspect --analyze; build candidates without --apply; publish sheets/metadata with --apply. Inputs are repo attack-rising-source-sheet.png, optionally bootstrapped by --front-source/--side-source. Required registration JSON: {views:{front:{source_sha256,frames:[{index,head_top_y,foot_pivot:[x,y]} x16]},side:{...}}}. Coordinates are local to each quarter cell. One median head-to-sole scale per direction, never a sword-inclusive bbox scale.');process.exit(0);}
for(const [d,p]of Object.entries(inputs))if(!fs.existsSync(p))throw Error(`Missing ${d} rising source: ${p}; no game assets changed.`);
const anatomy=fs.existsSync(registrationFile)?JSON.parse(fs.readFileSync(registrationFile,'utf8').replace(/^\uFEFF/,'')):null;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc(b){let v=0xffffffff;for(const c of b)v=crcTable[(v^c)&255]^(v>>>8);return(v^0xffffffff)>>>0;}
function chunk(type,b){const n=Buffer.alloc(4),t=Buffer.from(type),c=Buffer.alloc(4);n.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([n,t,b,c]);}
function imageHeader(w,h){const b=Buffer.alloc(13);b.writeUInt32BE(w);b.writeUInt32BE(h,4);b[8]=8;b[9]=6;return b;}
function compressedRows(w,h,px){const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)px.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return zlib.deflateSync(rows);}
function png(w,h,px){return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',imageHeader(w,h)),chunk('IDAT',compressedRows(w,h,px)),chunk('IEND',Buffer.alloc(0))]);}
function readPng(file){
 const b=fs.readFileSync(file);let w,h,ct,depth,id=[];
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);if(t==='IHDR'){w=d.readUInt32BE();h=d.readUInt32BE(4);depth=d[8];ct=d[9];if(d[12])throw Error('Interlaced PNG unsupported: '+file);}if(t==='IDAT')id.push(d);p+=n+12;}
 if(depth!==8||![2,6].includes(ct))throw Error('Expected RGB(A)8 PNG: '+file);
 const channels=ct===6?4:3,stride=w*channels,raw=zlib.inflateSync(Buffer.concat(id)),decoded=Buffer.alloc(h*stride),paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)];if(f>4)throw Error('Bad PNG filter');for(let x=0;x<stride;x++){const a=x>=channels?decoded[y*stride+x-channels]:0,u=y?decoded[(y-1)*stride+x]:0,ul=y&&x>=channels?decoded[(y-1)*stride+x-channels]:0;decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,u,(a+u)>>1,paeth(a,u,ul)][f])&255;}}
 const px=Buffer.alloc(w*h*4);for(let k=0;k<w*h;k++){decoded.copy(px,k*4,k*channels,k*channels+3);px[k*4+3]=channels===4?decoded[k*4+3]:255;}return{w,h,px,color_type:ct};
}
function crop(im,l,t,r,b){const w=r-l,h=b-t,px=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)im.px.copy(px,y*w*4,((t+y)*im.w+l)*4,((t+y)*im.w+r)*4);return{w,h,px};}
function components(im,threshold){
 const labels=new Int32Array(im.w*im.h),queue=new Int32Array(labels.length),all=[];let label=0;
 for(let p=0;p<labels.length;p++)if(!labels[p]&&im.px[p*4+3]>=threshold){label++;let head=0,tail=1,l=im.w,t=im.h,r=-1,b=-1,maxAlpha=0,sumAlpha=0;queue[0]=p;labels[p]=label;
  while(head<tail){const k=queue[head++],x=k%im.w,y=Math.floor(k/im.w),a=im.px[k*4+3];l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);maxAlpha=Math.max(maxAlpha,a);sumAlpha+=a;
   for(let yy=Math.max(0,y-1);yy<=Math.min(im.h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(im.w-1,x+1);xx++){const q=yy*im.w+xx;if(!labels[q]&&im.px[q*4+3]>=threshold){labels[q]=label;queue[tail++]=q;}}
  }all.push({label,pixels:tail,bounds:[l,t,r+1,b+1],max_alpha:maxAlpha,alpha_sum:sumAlpha});
 }all.sort((a,b)=>b.pixels-a.pixels);return{all,labels};
}
function alphaStats(im){const histogram=new Array(256).fill(0);let hiddenColor=0,visibleMagenta=0,opaqueMagenta=0;for(let i=0;i<im.px.length;i+=4){const [r,g,b,a]=im.px.subarray(i,i+4);histogram[a]++;if(!a&&(r||g||b))hiddenColor++;if(r>190&&b>140&&g<90){if(a)visibleMagenta++;if(a>=192)opaqueMagenta++;}}return{histogram,hidden_rgb_pixels:hiddenColor,visible_magenta_pixels:visibleMagenta,opaque_magenta_pixels:opaqueMagenta};}

const inspected={};
for(const direction of ['front','side']){
 const im=readPng(inputs[direction]),frames=[];
 for(let f=0;f<16;f++){const col=f%4,row=Math.floor(f/4),specified=anatomy?.views?.[direction]?.source_sha256===hash(fs.readFileSync(inputs[direction]))?anatomy.views[direction].frames.find(r=>r.index===f)?.source_rect:null,rect=specified?[specified[0],specified[1],specified[0]+specified[2],specified[1]+specified[3]]:[Math.round(col*im.w/4),Math.round(row*im.h/4),Math.round((col+1)*im.w/4),Math.round((row+1)*im.h/4)];if(rect.some(v=>!Number.isInteger(v))||rect[0]<0||rect[1]<0||rect[2]>im.w||rect[3]>im.h||rect[2]<=rect[0]||rect[3]<=rect[1])throw Error('Invalid full-pose source rectangle');const tile=crop(im,...rect),cc=components(tile,192);frames.push({index:f,rect,tile,opaque:cc.all,labels:cc.labels});}
 inspected[direction]={im,frames};
}
if(process.argv.includes('--analyze')){
 for(const [direction,{im,frames}]of Object.entries(inspected))console.log(JSON.stringify({direction,size:[im.w,im.h],source_sha256:hash(fs.readFileSync(inputs[direction])),alpha:alphaStats(im),frames:frames.map(f=>({index:f.index,rect:f.rect,opaque:f.opaque.slice(0,5),boot_candidate:footPivot(f),boot_window_candidate:bootWindow(f,direction),head_crown_candidate:crownCandidate(f)})),registration_loaded:!!anatomy?.views?.[direction]}));
 process.exit(0);
}
if(!anatomy)throw Error(`Missing inspected hair-crown/boot registration: ${registrationRel}; no game assets changed.`);
for(const [direction,{frames}]of Object.entries(inspected)){
 const view=anatomy.views?.[direction];if(!view||view.source_sha256!==hash(fs.readFileSync(inputs[direction])))throw Error('Registration must match source SHA-256: '+direction);
 if(!Array.isArray(view.frames)||view.frames.length!==16)throw Error('Need 16 body registrations: '+direction);
 for(const frame of frames){const r=view.frames.find(r=>r.index===frame.index);if(!r||!Number.isFinite(r.head_top_y)||!Array.isArray(r.foot_pivot)||r.foot_pivot.length!==2||!r.foot_pivot.every(Number.isFinite)||r.head_top_y<0||r.foot_pivot[0]<0||r.foot_pivot[0]>=frame.tile.w||r.foot_pivot[1]>frame.tile.h||r.foot_pivot[1]-r.head_top_y<30)throw Error('Invalid body registration '+direction+' '+frame.index);frame.anatomy=r;}
}

function distanceFromOpaque(im){
 const d=new Uint16Array(im.w*im.h);d.fill(30000);
 for(let p=0;p<d.length;p++)if(im.px[p*4+3]>=192)d[p]=0;
 for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++){const p=y*im.w+x;if(x)d[p]=Math.min(d[p],d[p-1]+1);if(y){d[p]=Math.min(d[p],d[p-im.w]+1);if(x)d[p]=Math.min(d[p],d[p-im.w-1]+1);if(x+1<im.w)d[p]=Math.min(d[p],d[p-im.w+1]+1);}}
 for(let y=im.h-1;y>=0;y--)for(let x=im.w-1;x>=0;x--){const p=y*im.w+x;if(x+1<im.w)d[p]=Math.min(d[p],d[p+1]+1);if(y+1<im.h){d[p]=Math.min(d[p],d[p+im.w]+1);if(x)d[p]=Math.min(d[p],d[p+im.w-1]+1);if(x+1<im.w)d[p]=Math.min(d[p],d[p+im.w+1]+1);}}
 return d;
}
function cleanFaintBackground(im){
 const px=Buffer.from(im.px),d=distanceFromOpaque(im),removedByAlpha=new Array(9).fill(0);let removedAlpha=0;
 for(let p=0;p<d.length;p++)if(px[p*4+3]>0&&px[p*4+3]<=8&&d[p]>6){const a=px[p*4+3];removedByAlpha[a]++;removedAlpha+=a;px.fill(0,p*4,p*4+4);}
 return{image:{w:im.w,h:im.h,px},report:{rule:'Only alpha <= 8 and Chebyshev distance > 6px from every alpha >= 192 source pixel; preserve all opaque and nearby antialiasing pixels.',removed_pixels:removedByAlpha.reduce((a,b)=>a+b,0),removed_by_alpha:removedByAlpha,removed_alpha_sum:removedAlpha,opaque_pixels_modified:0}};
}
function footPivot(frame){
 if(frame.anatomy)return frame.anatomy.foot_pivot;
 const main=frame.opaque[0],[l,t,r,b]=main.bounds;let fl=r,fr=l;
 // Use the soles only: a low sweep can put the sword inside the lower leg band.
 // The final 2% / at least 3 pixels is below the blade in these inspected sources.
 for(let y=b-Math.max(3,Math.ceil((b-t)*.02));y<b;y++)for(let x=l;x<r;x++)if(frame.labels[y*frame.tile.w+x]===main.label){fl=Math.min(fl,x);fr=Math.max(fr,x);}
 return[(fl+fr+1)/2,b];
}
function crownCandidate(frame){
 // Diagnostic only: the inspected sheets keep the crown near the boot axis.
 // A raised blade remains outside this narrow central strip. Manual registration
 // still controls the applied scale; this never silently selects body landmarks.
 const [fx]=footPivot(frame),left=Math.floor(fx-frame.tile.w*.20),right=Math.ceil(fx+frame.tile.w*.20);
 for(let y=0;y<frame.tile.h;y++){let count=0;for(let x=left;x<right;x++)if(frame.tile.px[(y*frame.tile.w+x)*4+3]>=192)count++;if(count>=3)return{head_top_y:y,inspected_x:[left,right],opaque_pixels_on_row:count};}return null;
}
function bootWindow(frame,direction){
 // Diagnostic for frame 11 only: its down-pointing sword extends below the soles.
 const shift=frame.rect[0]-Math.round((frame.index%4)*1254/4),l=(direction==='front'?120:132)-shift,r=(direction==='front'?225:230)-shift,t=270;let bottom=0;
 for(let y=t;y<frame.tile.h;y++)for(let x=l;x<r;x++)if(frame.tile.px[(y*frame.tile.w+x)*4+3]>=192)bottom=Math.max(bottom,y+1);
 let left=r,right=l;for(let y=bottom-5;y<bottom;y++)for(let x=l;x<r;x++)if(frame.tile.px[(y*frame.tile.w+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x+1);}
 return{window:[l,t,r,frame.tile.h],foot_pivot:[(left+right)/2,bottom],sole_span:[left,right]};
}
function headBand(frame,scale,translation){
 const main=frame.opaque[0],[l,,r]=main.bounds,t=frame.anatomy.head_top_y,b=frame.anatomy.foot_pivot[1],top=Math.floor(t+(b-t)*.05),bottom=Math.ceil(t+(b-t)*.30);let left=r,right=l;
 // The widest opaque run on each head-band row excludes a raised thin blade.
 for(let y=top;y<bottom;y++){let start=-1,best=[0,0];for(let x=l;x<=r;x++){const solid=x<r&&frame.labels[y*frame.tile.w+x]===main.label;if(solid&&start<0)start=x;if(!solid&&start>=0){if(x-start>best[1]-best[0])best=[start,x];start=-1;}}if(best[1]>best[0]){left=Math.min(left,best[0]);right=Math.max(right,best[1]);}}
 return{definition:'Widest opaque row runs across 5%-30% of head-to-sole height, excluding detached thin blade segments',source_bounds:[left,top,right,bottom],scaled_width:(right-left)*scale,canonical_center_x:(left+right)/2*scale+translation[0]};
}
function render(im,scale,pivot){
 const w=320,h=320,px=Buffer.alloc(w*h*4),ox=160-pivot[0]*scale,oy=288-pivot[1]*scale;
 // One uniform direction-wide scale. Premultiplied area sampling avoids colored transparent fringes.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const x0=(x-ox)/scale,x1=(x+1-ox)/scale,y0=(y-oy)/scale,y1=(y+1-oy)/scale;if(x1<=0||y1<=0||x0>=im.w||y0>=im.h)continue;
  let A=0,R=0,G=0,B=0;const area=(x1-x0)*(y1-y0);
  for(let sy=Math.max(0,Math.floor(y0));sy<Math.min(im.h,Math.ceil(y1));sy++)for(let sx=Math.max(0,Math.floor(x0));sx<Math.min(im.w,Math.ceil(x1));sx++){
   const weight=Math.max(0,Math.min(sx+1,x1)-Math.max(sx,x0))*Math.max(0,Math.min(sy+1,y1)-Math.max(sy,y0)),i=(sy*im.w+sx)*4,a=im.px[i+3]/255*weight;A+=a;R+=im.px[i]*a;G+=im.px[i+1]*a;B+=im.px[i+2]*a;
  }if(A){const i=(y*w+x)*4;px[i]=Math.round(R/A);px[i+1]=Math.round(G/A);px[i+2]=Math.round(B/A);px[i+3]=Math.round(A/area*255);}
 }return{w,h,px,translation:[ox,oy]};
}
function visibleBounds(im,threshold=16){let l=im.w,t=im.h,r=0,b=0,n=0;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.px[(y*im.w+x)*4+3]>=threshold){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);n++;}return{rect:n?[l,t,r-l,b-t]:null,pixels:n};}
function over(dst,i,src,j){const a=src[j+3]/255,oa=dst[i+3]/255,na=a+oa*(1-a);if(!na)return;for(let c=0;c<3;c++)dst[i+c]=Math.round((src[j+c]*a+dst[i+c]*oa*(1-a))/na);dst[i+3]=Math.round(na*255);}
function frameMae(a,b){let sum=0;for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)sum+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);sum+=Math.abs(a[i+3]-b[i+3]);}return sum/a.length;}
function apng(w,h,frames){
 const chunks=[Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',imageHeader(w,h))],actl=Buffer.alloc(8);actl.writeUInt32BE(frames.length);actl.writeUInt32BE(0,4);chunks.push(chunk('acTL',actl));let seq=0;
 frames.forEach((pixels,index)=>{const ctrl=Buffer.alloc(26);ctrl.writeUInt32BE(seq++);ctrl.writeUInt32BE(w,4);ctrl.writeUInt32BE(h,8);ctrl.writeUInt16BE(1,20);ctrl.writeUInt16BE(16,22);ctrl[24]=0;ctrl[25]=0;chunks.push(chunk('fcTL',ctrl));const data=compressedRows(w,h,pixels);if(index===0)chunks.push(chunk('IDAT',data));else{const num=Buffer.alloc(4);num.writeUInt32BE(seq++);chunks.push(chunk('fdAT',Buffer.concat([num,data])));}});chunks.push(chunk('IEND',Buffer.alloc(0)));return Buffer.concat(chunks);
}
function savePreservingExisting(file,bytes){
 if(fs.existsSync(file)){const old=fs.readFileSync(file);if(!old.equals(bytes))write(path.join(work,'backups',path.relative(root,file)),old);}
 write(file,bytes);
}

// Previous release was backed up before this authoring task. Keep an extra
// non-overwriting local copy if publishing from another checkout in the future.
if(apply)for(const rel of [`${base}/main/9-whitehair/katana/front/attack-sheet.png`,`${base}/main/9-whitehair/katana/side/attack-sheet.png`,`${base}/icon/preview/whitehair-katana-attack.png`,'metadata/character/attack/whitehair-katana.json']){const src=path.join(root,rel),backup=path.join(work,'before-apply',rel);if(fs.existsSync(src)&&!fs.existsSync(backup))write(backup,fs.readFileSync(src));}

const metadata={id:'whitehair-katana',version:3,attack_style:'low-to-high unsheathing slash',cell_size:[320,320],pivot:[160,288],columns:4,rows:4,frames_per_direction:16,fps:16,cycle_ms:1000,loop:true,runtime_registered:false,authoring_tool:'tools/package_whitehair_katana_rising_attack.mjs',anatomical_registration:registrationRel,rendering:'One complete source sheet per direction; one uniform scale from inspected hair crown to boot soles; only translation by foot pivot; no correction-strip mixing, per-frame resize, pose blending, limb manipulation, or shape clipping.',views:{},validation:{},notes:['Rising attack sources are preserved byte-for-byte; earlier attack sources remain intact.','Frames 00 and 15 copy the approved canonical neutral RGBA exactly.','Only distant near-transparent background residue is removed; opaque image content is unchanged before uniform resampling.','Front 09/10 source boundary moves from x627 to x610 through empty space to preserve the complete horizontal sword; no opaque figure or sword pixels are trimmed.','Frame 11 uses actual boot soles despite the sword extending below them.','Sword-inclusive bounding-box height is never used to set body scale.']};
const allFrames={};
for(const [direction,{im,frames}]of Object.entries(inspected)){
 const sourceRel=`${base}/icon/source/whitehair/katana/${direction}/attack-rising-source-sheet.png`,sourceFile=path.join(root,sourceRel),sourceBytes=fs.readFileSync(inputs[direction]);if(apply)savePreservingExisting(sourceFile,sourceBytes);
 const neutralFile=path.join(root,`${base}/icon/source/whitehair/katana/${direction}/idle.png`),neutral=readPng(neutralFile);if(neutral.w!==320||neutral.h!==320)throw Error('Neutral must be 320 square');
 const heights=frames.map(f=>f.anatomy.foot_pivot[1]-f.anatomy.head_top_y).sort((a,b)=>a-b),observedMedianHeight=(heights[7]+heights[8])/2,referenceHeight=anatomy.views[direction].reference_body_height??observedMedianHeight,scale=160/referenceHeight;
 if(!Number.isFinite(referenceHeight)||Math.abs(referenceHeight/observedMedianHeight-1)>.02)throw Error('Fixed reference body height must stay within 2% of measured anatomy: '+direction);
 const outputFrames=[],qa=[],registrations=[];
 for(const frame of frames){
  const frameScale=scale,bodyHeight=frame.anatomy.foot_pivot[1]-frame.anatomy.head_top_y;
  if(!frame.opaque.length)throw Error(`${direction} ${frame.index}: empty frame`);
  const people=frame.opaque.filter(c=>c.pixels>=1000);if(people.length!==1)throw Error(`${direction} ${frame.index}: expected one connected figure`);
  const main=frame.opaque[0],bounds=main.bounds;if(bounds[0]<=0||bounds[1]<=0||bounds[2]>=frame.tile.w||bounds[3]>=frame.tile.h)throw Error(`${direction} ${frame.index}: opaque source touches cell border`);
  const cleaned=cleanFaintBackground(frame.tile),pivot=footPivot(frame),rendered=render(cleaned.image,frameScale,pivot),endpoint=[0,15].includes(frame.index),out=endpoint?neutral:rendered,outBounds=visibleBounds(out),outCC=components(out,192);
  if(!outBounds.pixels||outCC.all.filter(c=>c.pixels>=500).length!==1)throw Error(`${direction} ${frame.index}: output empty or multiple figures`);
  const [x,y,w,h]=outBounds.rect;if(x<1||y<1||x+w>=319||y+h>=319)throw Error(`${direction} ${frame.index}: output clipping risk`);
  // Check every meaningful source pixel maps inside the target cell, including the sword tip.
  let clipped=0;for(let sy=0;sy<frame.tile.h;sy++)for(let sx=0;sx<frame.tile.w;sx++)if(cleaned.image.px[(sy*frame.tile.w+sx)*4+3]>=16){const xx=(sx+.5)*frameScale+rendered.translation[0],yy=(sy+.5)*frameScale+rendered.translation[1];if(xx<0||xx>=320||yy<0||yy>=320)clipped++;}if(clipped)throw Error(`${direction} ${frame.index}: ${clipped} clipped pixels`);
  const output=Buffer.from(out.px);outputFrames.push(output);write(path.join(work,'frames',direction,`${String(frame.index).padStart(2,'0')}.png`),png(320,320,output));
  registrations.push({index:frame.index,source:sourceRel,source_rect:[frame.rect[0],frame.rect[1],frame.tile.w,frame.tile.h],source_full_figure_and_sword_bounds:main.bounds,source_head_top_y:frame.anatomy.head_top_y,source_foot_pivot:pivot,uniform_scale:frameScale,translation:rendered.translation,neutral_replacement:endpoint});
  qa.push({index:frame.index,source_opaque_figures:people.length,source_opaque_pixels:main.pixels,source_body_height:bodyHeight,head_to_foot_scaled:bodyHeight*frameScale,head_registration:headBand(frame,frameScale,rendered.translation),source_opaque_bounds:main.bounds,source_edge_clear:true,source_alpha_cleanup:cleaned.report,meaningful_source_pixels_clipped:clipped,output_bounds:outBounds,opaque_output_figures:outCC.all.filter(c=>c.pixels>=500).length,neutral_exact:endpoint?output.equals(neutral.px):null,rgba_sha256:hash(output)});
 }
 const sheet=Buffer.alloc(1280*1280*4);outputFrames.forEach((p,f)=>{for(let y=0;y<320;y++)p.copy(sheet,((Math.floor(f/4)*320+y)*1280+(f%4)*320)*4,y*320*4,(y+1)*320*4);});
 const outputRel=`${base}/main/9-whitehair/katana/${direction}/attack-sheet.png`,outputFile=apply?path.join(root,outputRel):path.join(work,'candidate',direction,'attack-sheet.png'),bytes=png(1280,1280,sheet);savePreservingExisting(outputFile,bytes);const reread=readPng(outputFile);if(!reread.px.equals(sheet))throw Error('PNG roundtrip failed');
 const step=outputFrames.map((p,i)=>frameMae(p,outputFrames[(i+1)%16]));
 metadata.views[direction]={source:sourceRel,source_size:[im.w,im.h],source_sha256:hash(sourceBytes),approved_neutral:path.relative(root,neutralFile).replaceAll('\\','/'),approved_neutral_sha256:hash(fs.readFileSync(neutralFile)),sheet:outputRel,sheet_sha256:hash(bytes),source_reference_body_height:referenceHeight,observed_median_body_height:observedMedianHeight,uniform_scale:scale,frames:registrations};
 metadata.validation[direction]={source_alpha:alphaStats(im),source_images:16,output_frames:16,unique_frames:new Set(outputFrames.map(hash)).size,loop_endpoints_identical:outputFrames[0].equals(outputFrames[15]),step_premultiplied_rgba_mae:step,seam_mae:step[15],max_step_mae:Math.max(...step),png_roundtrip:true,frames:qa};allFrames[direction]=outputFrames;
}
const previewFrames=[];for(let f=0;f<16;f++){const w=640,h=360,px=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=((Math.floor(x/16)+Math.floor(y/16))%2)?224:235;px[i]=v;px[i+1]=v+1;px[i+2]=v+3;px[i+3]=255;}for(const [n,d]of ['front','side'].entries())for(let y=0;y<320;y++)for(let x=0;x<320;x++)over(px,((y+8)*w+x+n*320)*4,allFrames[d][f],(y*320+x)*4);previewFrames.push(px);write(path.join(work,'preview',`${String(f).padStart(2,'0')}.png`),png(w,h,px));}
const previewRel=`${base}/icon/preview/whitehair-katana-attack.png`;savePreservingExisting(apply?path.join(root,previewRel):path.join(work,'whitehair-katana-rising-attack.png'),apng(640,360,previewFrames));metadata.preview={file:previewRel,format:'APNG',size:[640,360],frames:16,fps:16,loop:true};
write(apply?path.join(root,'metadata/character/attack/whitehair-katana.json'):path.join(work,'validation.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({outputs:Object.fromEntries(Object.entries(metadata.views).map(([d,v])=>[d,{sheet:v.sheet,scale:v.uniform_scale,sha256:v.sheet_sha256}])),preview:metadata.preview,qa:Object.fromEntries(Object.entries(metadata.validation).map(([d,v])=>[d,{frames:v.output_frames,unique:v.unique_frames,loop:v.loop_endpoints_identical,seam:v.seam_mae,max_step:v.max_step_mae,removed_low_alpha_pixels:v.frames.reduce((a,f)=>a+f.source_alpha_cleanup.removed_pixels,0)}]))},null,2));
