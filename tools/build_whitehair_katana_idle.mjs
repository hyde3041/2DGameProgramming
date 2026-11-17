// Authoring only: preserve the approved weapon pose and use rigid idle motion.
// node tools/build_whitehair_katana_idle.mjs [--neutral-only]
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
const sourceBase='game/asset/character/player/icon/source/whitehair/katana';
const sourceFile=path.join(root,sourceBase,'approved-pair.png');
if(!fs.existsSync(sourceFile))write(sourceFile,fs.readFileSync('C:/Users/zx304/.codex/generated_images/01a1b983-80ad-75c1-81b9-7f401620b7fe/exec-8563fa5c-06ab-4b27-aa18-70b69c1f0031.png'));
const image=readPng(sourceFile),directions=['front','side'],viewInfo={},neutrals={};
function bounds(left,right){let l=right,t=image.h,r=-1,b=-1;for(let y=0;y<image.h;y++)for(let x=left;x<right;x++)if(image.px[(y*image.w+x)*4+3]>16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}return[l,t,r+1,b+1];}
const boxes=[bounds(0,image.w/2),bounds(image.w/2,image.w)];
const scale=160/Math.max(...boxes.map(b=>b[3]-b[1]));
for(const [index,direction]of directions.entries()){
 const [l,t,r,b]=boxes[index];let fl=r,fr=l;
 for(let y=Math.floor(b-(b-t)*.12);y<b;y++)for(let x=l;x<r;x++)if(image.px[(y*image.w+x)*4+3]>16){fl=Math.min(fl,x);fr=Math.max(fr,x);}
 const foot=[(fl+fr+1)/2,b],ox=160-foot[0]*scale,oy=288-foot[1]*scale;
 const crop=[Math.max(0,l-3),Math.max(0,t-3),Math.min(image.w,r+3),Math.min(image.h,b+3)];
 const [cx,cy,cr,cb]=crop,cw=cr-cx,ch=cb-cy,raw=Buffer.alloc(cw*ch*4);
 for(let y=0;y<ch;y++)image.px.copy(raw,y*cw*4,((cy+y)*image.w+cx)*4,((cy+y)*image.w+cr)*4);
 write(path.join(root,sourceBase,direction,'idle-source.png'),png(cw,ch,raw));
 // One shared uniform downsample, premultiplied area average; never stretch parts.
 const pixels=Buffer.alloc(320*320*4);
 for(let y=0;y<320;y++)for(let x=0;x<320;x++){
  const x0=(x-ox)/scale,x1=(x+1-ox)/scale,y0=(y-oy)/scale,y1=(y+1-oy)/scale;
  if(x1<=cx||x0>=cr||y1<=cy||y0>=cb)continue;
  let A=0,R=0,G=0,B=0;const area=(x1-x0)*(y1-y0);
  for(let sy=Math.max(cy,Math.floor(y0));sy<Math.min(cb,Math.ceil(y1));sy++)for(let sx=Math.max(cx,Math.floor(x0));sx<Math.min(cr,Math.ceil(x1));sx++){
   const weight=Math.max(0,Math.min(sx+1,x1)-Math.max(sx,x0))*Math.max(0,Math.min(sy+1,y1)-Math.max(sy,y0));
   const k=(sy*image.w+sx)*4,a=image.px[k+3]/255*weight;A+=a;R+=image.px[k]*a;G+=image.px[k+1]*a;B+=image.px[k+2]*a;
  }
  if(A){const i=(y*320+x)*4,alpha=Math.round(A/area*255);if(alpha){pixels[i]=Math.round(R/A);pixels[i+1]=Math.round(G/A);pixels[i+2]=Math.round(B/A);pixels[i+3]=alpha;}}
 }
 write(path.join(root,sourceBase,direction,'idle.png'),png(320,320,pixels));neutrals[direction]=pixels;
 viewInfo[direction]={source_bounds:[l,t,r-l,b-t],source_crop:[cx,cy,cw,ch],original_foot_pivot:foot,uniform_scale:scale,canonical_offset:[ox,oy],canonical_foot_pivot:[160,288],canonical_source:`asset/character/player/icon/source/whitehair/katana/${direction}/idle.png`,source_crop_file:`asset/character/player/icon/source/whitehair/katana/${direction}/idle-source.png`,facing:direction==='side'?'screen-left-three-quarter':'front'};
}
write(path.join(root,'metadata/character/idle/whitehair-katana-registration.json'),JSON.stringify({id:'whitehair-katana',source:sourceBase+'/approved-pair.png',source_size:[image.w,image.h],source_sha256:hash(fs.readFileSync(sourceFile)),cell_size:[320,320],pivot:[160,288],shared_uniform_scale:scale,views:viewInfo},null,2)+'\n');
console.log(JSON.stringify({registration:viewInfo,shared_scale:scale}));
if(process.argv.includes('--neutral-only'))process.exit(0);
const spec=JSON.parse(fs.readFileSync(path.join(root,'metadata/character/idle/whitehair-katana-regions.json'),'utf8'));
const roles=['legs','hair','cloth','body','arm_left','arm_right','weapon','head'];
const colours=[[132,95,55],[142,84,177],[77,148,207],[72,177,129],[238,151,66],[232,202,65],[65,180,185],[227,105,142]];
const order=['legs','hair','cloth','upper','head'];
const identity=()=>[1,0,0,1,0,0],TAU=Math.PI*2,rad=Math.PI/180;
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function rotate([x,y],a){const c=Math.cos(a),s=Math.sin(a);return[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
const any=(x,y,polys)=>(polys||[]).some(p=>inside(x,y,p));
function matrices(seconds,p){const t=((seconds%1)+1)%1,wave=lag=>Math.sin(TAU*(t-lag))-Math.sin(-TAU*lag),breath=.5-.5*Math.cos(TAU*t);const body=multiply([1,0,0,1,0,-breath],rotate(p.body,.22*rad*Math.sin(TAU*t))),head=multiply(body,rotate(p.head,.25*rad*wave(.04)));return{legs:identity(),upper:body,head,hair:multiply(head,rotate(p.hair,.95*rad*wave(.14))),cloth:multiply(body,rotate(p.cloth,-.60*rad*wave(.18)))};}
function over(out,i,r,g,b,a){const oa=out[i+3]/255,na=a+oa*(1-a);if(!na)return;out[i]=Math.round((r+out[i]*oa*(1-a))/na);out[i+1]=Math.round((g+out[i+1]*oa*(1-a))/na);out[i+2]=Math.round((b+out[i+2]*oa*(1-a))/na);out[i+3]=Math.round(na*255);}
function draw(out,src,m){const[a,b,c,d,tx,ty]=m;for(let y=115;y<295;y++)for(let x=70;x<250;x++){const u=a*(x-tx)+b*(y-ty),v=c*(x-tx)+d*(y-ty),xx=Math.floor(u),yy=Math.floor(v),dx=u-xx,dy=v-yy;let A=0,R=0,G=0,B=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const X=xx+i,Y=yy+j;if(X<0||Y<0||X>=320||Y>=320)continue;const k=(Y*320+X)*4,wa=src[k+3]/255*(i?dx:1-dx)*(j?dy:1-dy);A+=wa;R+=src[k]*wa;G+=src[k+1]*wa;B+=src[k+2]*wa;}if(A>0)over(out,(y*320+x)*4,R,G,B,A);}}
const work=path.join(root,'.build/whitehair-katana-idle'),qa=[],motionViews={},allFrames={};
for(const direction of directions){
 const neutral=neutrals[direction],v=viewInfo[direction],s=spec.views[direction];
 const [ox,oy]=v.canonical_offset,pt=([x,y])=>[ox+x*scale,oy+y*scale];
 const pivots=Object.fromEntries(Object.entries(s.pivots).map(([k,p])=>[k,pt(p)]));
 const owner=new Int8Array(320*320).fill(-1),parts=Object.fromEntries(roles.map(n=>[n,Buffer.alloc(neutral.length)])),labels=Buffer.alloc(neutral.length);
 for(let y=0;y<320;y++)for(let x=0;x<320;x++){
  const k=y*320+x,i=k*4;if(!neutral[i+3])continue;
  const X=(x+.5-ox)/scale,Y=(y+.5-oy)/scale;
  let role=spec.label_priority.find(n=>n==='body'||any(X,Y,s.regions[n]));if(y>=282)role='legs';
  owner[k]=roles.indexOf(role);neutral.copy(parts[role],i,i,i+4);const col=colours[owner[k]];labels[i]=col[0];labels[i+1]=col[1];labels[i+2]=col[2];labels[i+3]=neutral[i+3];
 }
 const base=`game/asset/character/player/icon/layers/whitehair/katana/${direction}/idle`;
 const reconstructed=Buffer.alloc(neutral.length),partCounts={};
 for(const name of roles){partCounts[name]=0;for(let k=0;k<320*320;k++){const i=k*4;if(parts[name][i+3]){parts[name].copy(reconstructed,i,i,i+4);partCounts[name]++;}}write(path.join(root,base,'visible',name+'.png'),png(320,320,parts[name]));}
 if(!neutral.equals(reconstructed))throw Error('Original neutral reconstruction differs: '+direction);
 // Arms, hands, hilt, blade and scabbard share one unchanging rigid surface.
 // Independent PNGs remain available, but coupled rendering avoids subpixel cracks.
 const groups=Object.fromEntries(order.map(n=>[n,n==='upper'?Buffer.alloc(neutral.length):parts[n]]));
 for(const name of ['body','arm_left','arm_right','weapon'])for(let k=0;k<320*320;k++){const i=k*4;if(parts[name][i+3])parts[name].copy(groups.upper,i,i,i+4);}
 const groupOwner=new Int8Array(320*320).fill(-1);
 for(let k=0;k<320*320;k++)if(owner[k]>=0){const n=roles[owner[k]];groupOwner[k]=order.indexOf(['body','arm_left','arm_right','weapon'].includes(n)?'upper':n);}
 const hidden=Object.fromEntries(order.map(n=>[n,Buffer.alloc(neutral.length)]));
 for(const [rank,name]of order.entries()){
  if(name==='head')continue;
  for(let y=120;y<282;y++)for(let x=70;x<250;x++){
   const k=y*320+x,i=k*4;if(groupOwner[k]<=rank||neutral[i+3]<240)continue;
   let nearest=-1,dist=Infinity;
   for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const D=dx*dx+dy*dy,X=x+dx,Y=y+dy,K=Y*320+X;if(D>6||D>=dist||X<0||X>=320||Y<0||Y>=320||groupOwner[K]!==rank||groups[name][K*4+3]<240)continue;nearest=K;dist=D;}
   if(nearest>=0){groups[name].copy(hidden[name],i,nearest*4,nearest*4+4);hidden[name][i+3]=255;}
  }
  write(path.join(root,base,'hidden',name+'.png'),png(320,320,hidden[name]));
 }
 write(path.join(root,base,'coupled-upper.png'),png(320,320,groups.upper));
 write(path.join(root,base,'neutral.png'),png(320,320,neutral));
 write(path.join(work,`${direction}-labels.png`),png(320,320,labels));
 const geometry={max_unit_error:0,max_determinant_error:0};
 function render(t){if(Math.abs(t-Math.round(t))<1e-10)return Buffer.from(neutral);const transforms=matrices(t,pivots),out=Buffer.alloc(neutral.length);for(const name of order){const[a,b,c,d]=transforms[name];geometry.max_unit_error=Math.max(geometry.max_unit_error,Math.abs(a*a+b*b-1),Math.abs(c*c+d*d-1),Math.abs(a*c+b*d));geometry.max_determinant_error=Math.max(geometry.max_determinant_error,Math.abs(a*d-b*c-1));draw(out,hidden[name],transforms[name]);draw(out,groups[name],transforms[name]);}neutral.copy(out,282*320*4,282*320*4);return out;}
 const frames=Array.from({length:16},(_,i)=>render(i/16));allFrames[direction]=frames;
 const sheet=Buffer.alloc(1280*1280*4);
 for(let i=0;i<16;i++){write(path.join(work,'frames',direction,String(i).padStart(2,'0')+'.png'),png(320,320,frames[i]));for(let y=0;y<320;y++)frames[i].copy(sheet,((Math.floor(i/4)*320+y)*1280+i%4*320)*4,y*320*4,(y+1)*320*4);}
 const target=`asset/character/player/main/9-whitehair/katana/${direction}/idle-sheet.png`;
 write(path.join(root,'game',target),png(1280,1280,sheet));
 const mae=(a,b)=>{let total=0;for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)total+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);total+=Math.abs(a[i+3]-b[i+3]);}return total/a.length;};
 const steps=frames.map((f,i)=>mae(f,frames[(i+1)%16])),unique=new Set(frames.map(hash)).size;
 const feetFixed=frames.every(f=>f.subarray(282*320*4).equals(neutral.subarray(282*320*4))),loopEqual=render(0).equals(render(1));
 if(unique!==16||!feetFixed||!loopEqual||geometry.max_unit_error>1e-10)throw Error('Idle geometry/frame verification failed: '+direction);
 if(steps[15]>Math.max(...steps.slice(0,15))*1.3)throw Error('Loop boundary larger than ordinary frame change: '+direction);
 const poses=Array.from({length:16},(_,i)=>matrices(i/16,pivots));
 const rig={id:'whitehair-katana',direction,source:v.canonical_source,pixel_coordinates:'320 top-left',pivots,hand_grips:Object.fromEntries(Object.entries(s.grips).map(([k,p])=>[k,pt(p)])),part_counts:partCounts,roles,order,coupled_roles:['body','arm_left','arm_right','weapon'],motion:{body_rise_px:1,body_rotation_degrees:.22,head_rotation_degrees:.25,hair_rotation_degrees:.95,cloth_rotation_degrees:.60,arm_and_weapon_transform:'same body matrix'},animation:'rigid translation/rotation only',frames:poses};
 write(path.join(root,base,'rig.json'),JSON.stringify(rig,null,2)+'\n');
 qa.push({direction,frame_count:16,unique_frames:unique,fps:16,cycle_ms:1000,original_neutral_reconstruction_identical:true,feet_fixed:feetFixed,loop_endpoints_identical:loopEqual,hand_weapon_transforms_identical:true,...geometry,seam_mae:steps[15],max_step_mae:Math.max(...steps),sheet_sha256:hash(fs.readFileSync(path.join(root,'game',target))),source_sha256:hash(fs.readFileSync(path.join(root,'game',v.canonical_source)))});
 motionViews[direction]={file:target,width:1280,height:1280,columns:4,rows:4,loop:true,frame_duration_ms:62.5,facing:v.facing,frames:Array.from({length:16},(_,i)=>({index:i,rect:[i%4*320,Math.floor(i/4)*320,320,320],pico2d_rect:[i%4*320,(3-Math.floor(i/4))*320,320,320]}))};
}
const metadata={id:'whitehair-katana',source_character:'whitehair',version:1,cell_size:[320,320],pivot:[160,288],fps:16,cycle_ms:1000,frames_per_direction:16,animations:motionViews,runtime_registered:false,source_registration:'metadata/character/idle/whitehair-katana-registration.json',regions:'metadata/character/idle/whitehair-katana-regions.json',notes:['Approved front and screen-left three-quarter directions only; side is not canonical screen-right.','Separate arms and weapon PNGs share the same body transform and are sampled as one surface to keep hand contacts closed.','Original unarmed whitehair assets are preserved.']};
write(path.join(root,'metadata/character/idle/whitehair-katana.json'),JSON.stringify(metadata,null,2)+'\n');
write(path.join(root,'metadata/character/idle/whitehair-katana-validation.json'),JSON.stringify(qa,null,2)+'\n');
write(path.join(work,'validation.json'),JSON.stringify(qa,null,2)+'\n');
const previews=[];
for(let f=0;f<16;f++){const W=640,H=400,px=Buffer.alloc(W*H*4);for(let i=0;i<px.length;i+=4){px[i]=231;px[i+1]=233;px[i+2]=236;px[i+3]=255;}for(const[d,view]of directions.entries()){const src=allFrames[view][f];for(let y=0;y<340;y++)for(let x=0;x<300;x++){const sx=85+Math.floor(x/2),sy=122+Math.floor(y/2),i=(sy*320+sx)*4,k=((y+28)*W+d*320+x+10)*4,a=src[i+3]/255;if(a)over(px,k,src[i]*a,src[i+1]*a,src[i+2]*a,a);}}previews.push(px);write(path.join(work,'preview',String(f).padStart(2,'0')+'.png'),png(W,H,px));}
// Lossless APNG has exact 1/16-second delays (GIF cannot represent 62.5ms).
function apng(W,H,frames){const first=png(W,H,frames[0]),ih=first.subarray(16,29),actl=Buffer.alloc(8);actl.writeUInt32BE(frames.length);const result=[first.subarray(0,8),chunk('IHDR',ih),chunk('acTL',actl)];let seq=0;for(const[f,px]of frames.entries()){const ctl=Buffer.alloc(26);ctl.writeUInt32BE(seq++);ctl.writeUInt32BE(W,4);ctl.writeUInt32BE(H,8);ctl.writeUInt16BE(1,20);ctl.writeUInt16BE(16,22);result.push(chunk('fcTL',ctl));const rows=Buffer.alloc(H*(W*4+1));for(let y=0;y<H;y++)px.copy(rows,y*(W*4+1)+1,y*W*4,(y+1)*W*4);const compressed=zlib.deflateSync(rows);if(f===0)result.push(chunk('IDAT',compressed));else{const s=Buffer.alloc(4);s.writeUInt32BE(seq++);result.push(chunk('fdAT',Buffer.concat([s,compressed])));}}result.push(chunk('IEND',Buffer.alloc(0)));return Buffer.concat(result);}
write(path.join(root,'game/asset/character/player/icon/preview/whitehair-katana-idle.png'),apng(640,400,previews));
console.log(JSON.stringify({passed:true,views:qa,preview:'game/asset/character/player/icon/preview/whitehair-katana-idle.png'},null,2));
