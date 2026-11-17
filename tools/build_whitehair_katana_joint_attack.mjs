// Candidate authoring: two rigid arm bones, zero wrist degree of freedom.
// node tools/build_whitehair_katana_joint_attack.mjs [--apply]
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

const work=path.join(root,'.build/whitehair-katana-joint-attack');
const sourceBase='game/asset/character/player/icon/source/whitehair/katana';
const registration=JSON.parse(fs.readFileSync(path.join(root,'metadata/character/idle/whitehair-katana-registration.json'),'utf8'));
const bodyFill=readPng(path.join(root,sourceBase,'joint-body-fill-pair.png'));
const swordArt=readPng(path.join(root,sourceBase,'joint-sword.png'));
const W=320,N=W*W*4,rad=Math.PI/180;
const identity=()=>[1,0,0,1,0,0];
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function rotate([x,y],deg){const c=Math.cos(deg*rad),s=Math.sin(deg*rad);return[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])/rad;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
function over(out,i,R,G,B,A){const oa=out[i+3]/255,na=A+oa*(1-A);if(!na)return;out[i]=Math.round((R+out[i]*oa*(1-A))/na);out[i+1]=Math.round((G+out[i+1]*oa*(1-A))/na);out[i+2]=Math.round((B+out[i+2]*oa*(1-A))/na);out[i+3]=Math.round(na*255);}
function sample(src,u,v){const xx=Math.floor(u),yy=Math.floor(v),dx=u-xx,dy=v-yy;let A=0,R=0,G=0,B=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const X=xx+i,Y=yy+j;if(X<0||Y<0||X>=src.w||Y>=src.h)continue;const k=(Y*src.w+X)*4,a=src.px[k+3]/255*(i?dx:1-dx)*(j?dy:1-dy);A+=a;R+=src.px[k]*a;G+=src.px[k+1]*a;B+=src.px[k+2]*a;}return[R,G,B,A];}
function draw(out,px,m){const[a,b,c,d,tx,ty]=m,src={w:W,h:W,px};for(let y=0;y<W;y++)for(let x=0;x<W;x++){const rgba=sample(src,a*(x-tx)+b*(y-ty),c*(x-tx)+d*(y-ty));if(rgba[3])over(out,(y*W+x)*4,...rgba);}}
function exactMerge(layers){const out=Buffer.alloc(N);for(const p of layers)for(let i=0;i<N;i+=4)if(p[i+3])p.copy(out,i,i,i+4);return out;}
function bounds(px){let l=W,t=W,r=-1,b=-1;for(let y=0;y<W;y++)for(let x=0;x<W;x++)if(px[(y*W+x)*4+3]>=16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}return[l,t,r+1,b+1];}
function save(file,px,w=W,h=W){write(file,png(w,h,px));}
// Static source registration only. No animated part ever changes scale or shears.
function registerFill(view){const {canonical_offset:[ox,oy],uniform_scale:s}=registration.views[view],out=Buffer.alloc(N);for(let y=0;y<W;y++)for(let x=0;x<W;x++){let A=0,R=0,G=0,B=0;for(let j=0;j<4;j++)for(let i=0;i<4;i++){const q=sample(bodyFill,(x+(i+.5)/4-ox)/s-.5,(y+(j+.5)/4-oy)/s-.5);R+=q[0]/16;G+=q[1]/16;B+=q[2]/16;A+=q[3]/16;}if(A)over(out,(y*W+x)*4,R,G,B,A);}return out;}
const specs={
 front:{shoulder:[136,198],elbow:[130,208],grip:[151.5,216.5],blade_angle:34,split:[[126,207],[133,203]],sword_prefix:[[139,209],[157,214],[178,226],[175,232],[155,226],[140,219]],upper_polygon:null,fore_polygon:null},
 side:{shoulder:[145.2174,198.7246],elbow:[136.1353,206.6473],grip:[144.8309,217.8551],blade_angle:26,split:[[130.34,208],[142.13,204.52]],sword_prefix:[[131,211],[148,212],[178,225],[174,232],[150,226],[131,224]],additional_removal:[[131,212],[141,212],[142,224],[131,224]],
 upper_polygon:[[136.91,197.37],[140.58,196.60],[144.64,196.60],[147.15,196.02],[147.54,198.53],[147.34,202.01],[145.80,203.56],[143.67,204.52],[142.13,204.52],[130.34,208],[130.14,207.03],[129.57,205.10],[129.95,202.78],[131.50,200.46],[134.01,198.53]],
 fore_polygon:[[130.34,208],[142.13,204.52],[142.90,206.84],[143.09,207.81],[144.25,208.77],[144.44,210.51],[145.41,211.86],[146.76,213.02],[148.31,213.99],[149.08,215.15],[149.47,216.70],[149.28,218.43],[148.89,220.17],[148.50,220.95],[147.73,222.30],[146.76,222.69],[145.80,222.30],[145.02,221.91],[143.86,221.91],[142.71,221.72],[141.93,221.33],[140.97,221.53],[140,220.95],[139.23,220.75],[138.45,219.98],[137.87,218.82],[137.68,217.28],[137.68,215.15],[136.91,214.18],[136.14,213.02],[134.98,212.06],[133.43,211.29],[132.08,210.32],[130.92,209.16]]}
};
const deltas=[
 [0,0],[11,0],[27,1],[43,14],[59,44],[79,89],[103,144],[124,187],
 [134,209],[137,211],[119,189],[89,134],[54,69],[25,21],[7,2],[0,0]
];
const views={},validation={},rigViews={};
for(const [view,s]of Object.entries(specs)){
 const source=`${sourceBase}/${view}/idle.png`,neutral=readPng(path.join(root,source)).px;
 const partBase=path.join(root,'game/asset/character/player/icon/layers/whitehair/katana',view,'idle');
 const old=Object.fromEntries(['legs','hair','cloth','body','arm_left','arm_right','weapon','head'].map(n=>[n,readPng(path.join(partBase,'visible',n+'.png')).px]));
 const parts={upper:Buffer.alloc(N),forearm:Buffer.alloc(N),fixed:Buffer.alloc(N),body_fill:Buffer.alloc(N),sword:Buffer.alloc(N),removed:Buffer.alloc(N),elbow_overlap:Buffer.alloc(N),shoulder_overlap:Buffer.alloc(N)};
 const fill=registerFill(view),[A,B]=s.split;
 const seam=(x,y)=>(B[0]-A[0])*(y-A[1])-(B[1]-A[1])*(x-A[0]);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4,arm=old.arm_right[i+3]>0;
  const cutWeapon=(old.weapon[i+3]>0&&inside(x+.5,y+.5,s.sword_prefix))||(s.additional_removal&&inside(x+.5,y+.5,s.additional_removal));
  if(arm||cutWeapon){neutral.copy(parts.removed,i,i,i+4);fill.copy(parts.body_fill,i,i,i+4);}
  else neutral.copy(parts.fixed,i,i,i+4);
  if(arm){const isUpper=seam(x+.5,y+.5)<0;const permitted=!s.upper_polygon||inside(x+.5,y+.5,isUpper?s.upper_polygon:s.fore_polygon);if(permitted)neutral.copy(isUpper?parts.upper:parts.forearm,i,i,i+4);}
 }
 // Hidden caps use only nearby original pixels. They never replace visible source art.
 function cap(target,source,pivot,radius){for(let y=Math.floor(pivot[1]-radius);y<=Math.ceil(pivot[1]+radius);y++)for(let x=Math.floor(pivot[0]-radius);x<=Math.ceil(pivot[0]+radius);x++){
  if(distance([x+.5,y+.5],pivot)>radius)continue;const i=(y*W+x)*4;if(source[i+3]>220)continue;let best=-1,bestD=Infinity;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const X=x+dx,Y=y+dy,k=(Y*W+X)*4,D=dx*dx+dy*dy;if(X<0||Y<0||X>=W||Y>=W||D>9||D>=bestD||source[k+3]<230)continue;best=k;bestD=D;}if(best>=0){source.copy(target,i,best,best+4);target[i+3]=255;}
 }}
 cap(parts.elbow_overlap,parts.forearm,s.elbow,2.1);cap(parts.shoulder_overlap,parts.upper,s.shoulder,2);
 // One static uniform sword registration; the entire sword shares the forearm matrix thereafter.
 const swordSourceGrip=[330,359],swordSourceTip=[2110,359],swordScale=60/(2110-550),c=Math.cos(s.blade_angle*rad),sn=Math.sin(s.blade_angle*rad);
 const swordLocalPoint=p=>[s.grip[0]+(c*(p[0]-swordSourceGrip[0])-sn*(p[1]-swordSourceGrip[1]))*swordScale,s.grip[1]+(sn*(p[0]-swordSourceGrip[0])+c*(p[1]-swordSourceGrip[1]))*swordScale];
 const swordTip=swordLocalPoint(swordSourceTip);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){let R=0,G=0,Bb=0,alpha=0;for(let j=0;j<4;j++)for(let i=0;i<4;i++){const dx=x+(i+.5)/4-s.grip[0],dy=y+(j+.5)/4-s.grip[1];const q=sample(swordArt,swordSourceGrip[0]+(c*dx+sn*dy)/swordScale,swordSourceGrip[1]+(-sn*dx+c*dy)/swordScale);R+=q[0]/16;G+=q[1]/16;Bb+=q[2]/16;alpha+=q[3]/16;}if(alpha)over(parts.sword,(y*W+x)*4,R,G,Bb,alpha);}
 const stableLayers=`game/asset/character/player/icon/layers/whitehair/katana/${view}/attack/joint`;
 for(const[n,p]of Object.entries(parts)){
  save(path.join(work,'layers',view,n+'.png'),p);
  if(process.argv.includes('--apply'))save(path.join(root,stableLayers,n+'.png'),p);
 }
 const base=Buffer.from(parts.body_fill);draw(base,parts.fixed,identity());save(path.join(work,'layers',view,'body-without-right-arm.png'),base);
 const u0=angle(s.shoulder,s.elbow),f0=angle(s.elbow,s.grip),L1=distance(s.shoulder,s.elbow),L2=distance(s.elbow,s.grip),poses=[],frames=[];
 let maxBoneError=0,maxWristError=0,maxMatrixError=0;
 for(let f=0;f<16;f++){
  const[du,df]=deltas[f],upper=rotate(s.shoulder,du),fore=mul(upper,rotate(s.elbow,df-du)),sword=fore;
  const elbow=point(upper,s.elbow),grip=point(fore,s.grip),tip=point(sword,swordTip),shoulder=s.shoulder;
  maxBoneError=Math.max(maxBoneError,Math.abs(distance(shoulder,elbow)-L1),Math.abs(distance(elbow,grip)-L2));
  maxWristError=Math.max(maxWristError,...sword.map((v,i)=>Math.abs(v-fore[i])));
  for(const m of [upper,fore,sword])maxMatrixError=Math.max(maxMatrixError,Math.abs(m[0]*m[0]+m[1]*m[1]-1),Math.abs(m[2]*m[2]+m[3]*m[3]-1),Math.abs(m[0]*m[3]-m[1]*m[2]-1));
  let out=Buffer.from(base);
  if(f===0||f===15)out=Buffer.from(neutral);
  else{
   draw(out,parts.shoulder_overlap,upper);draw(out,parts.upper,upper);
   draw(out,parts.sword,sword);draw(out,parts.elbow_overlap,fore);draw(out,parts.forearm,fore);
   // The idle left glove and scabbard remain in front at their fixed original depth.
   const sheath=Buffer.from(old.weapon);for(let y=0;y<W;y++)for(let x=0;x<W;x++)if(inside(x+.5,y+.5,s.sword_prefix))sheath.fill(0,(y*W+x)*4,(y*W+x)*4+4);
   draw(out,sheath,identity());draw(out,old.arm_left,identity());
   neutral.copy(out,282*W*4,282*W*4);
  }
  const b=bounds(out);if(b[0]<=0||b[1]<=0||b[2]>=320||b[3]>=320)throw Error('Frame clipping '+view+' '+f);
  frames.push(out);save(path.join(work,'frames',view,String(f).padStart(2,'0')+'.png'),out);
  poses.push({index:f,upper_degrees:u0+du,forearm_degrees:f0+df,elbow_relative_degrees:f0+df-u0-du,wrist_degrees:0,upper_matrix:upper,forearm_matrix:fore,sword_matrix:sword,shoulder,elbow,grip,sword_tip:tip,bounds:b,neutral_exact:f===0||f===15});
 }
 const sheet=Buffer.alloc(1280*1280*4);for(let f=0;f<16;f++)for(let y=0;y<W;y++)frames[f].copy(sheet,((Math.floor(f/4)*W+y)*1280+f%4*W)*4,y*W*4,(y+1)*W*4);
 const sheetPath=`game/asset/character/player/main/9-whitehair/katana/${view}/attack-sheet.png`,candidate=path.join(work,view+'-attack-sheet.png');save(candidate,sheet,1280,1280);
 validation[view]={unique_frames:new Set(frames.map(hash)).size,frames:16,neutral_first_and_last_exact:frames[0].equals(neutral)&&frames[15].equals(neutral),source_partition_reconstruction_exact:exactMerge([parts.fixed,parts.removed]).equals(neutral),feet_fixed:frames.every(p=>p.subarray(282*W*4).equals(neutral.subarray(282*W*4))),max_bone_length_error:maxBoneError,max_forearm_sword_matrix_error:maxWristError,max_rigid_matrix_error:maxMatrixError,elbow_branch_preserved:poses.every(p=>p.elbow_relative_degrees<0&&p.elbow_relative_degrees>-175)};
 if(maxBoneError>1e-10||maxWristError!==0||maxMatrixError>1e-10||!validation[view].elbow_branch_preserved)throw Error('Rig invariant failed: '+view);
 views[view]={source,approved_neutral:source,approved_neutral_sha256:hash(fs.readFileSync(path.join(root,source))),sheet:sheetPath,sheet_sha256:hash(fs.readFileSync(candidate)),candidate:path.relative(root,candidate).replaceAll('\\','/'),frames:poses};
 rigViews[view]={...s,layers:Object.fromEntries(Object.keys(parts).map(n=>[n,stableLayers+'/'+n+'.png'])),original_fixed_parts:path.relative(root,partBase).replaceAll('\\','/')+'/visible',upper_length:L1,forearm_length:L2,neutral_upper_degrees:u0,neutral_forearm_degrees:f0,sword_registration:{source:sourceBase+'/joint-sword.png',source_grip:swordSourceGrip,source_tip:swordSourceTip,uniform_scale:swordScale,neutral_angle:s.blade_angle,registered_tip:swordTip},body_fill_source:sourceBase+'/joint-body-fill-pair.png',poses};
}
const metadata={id:'whitehair-katana',version:4,attack_style:'fixed-wrist rising arm slash',cell_size:[320,320],pivot:[160,288],columns:4,rows:4,frames_per_direction:16,fps:16,cycle_ms:1000,loop:true,runtime_registered:false,authoring_tool:'tools/build_whitehair_katana_joint_attack.mjs',anatomical_registration:'metadata/character/attack/whitehair-katana-joint-rig.json',rendering:'Original anatomical cutout pixels, two rigid arm bones; full sword uses exactly the forearm matrix, wrist DOF=0.',views,validation};
write(path.join(work,'candidate-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
write(path.join(root,'metadata/character/attack/whitehair-katana-joint-rig.json'),JSON.stringify({id:'whitehair-katana',status:process.argv.includes('--apply')?'applied':'candidate',fps:16,cell_size:[320,320],wrist_degrees_of_freedom:0,source_registration:'metadata/character/idle/whitehair-katana-registration.json',views:rigViews,validation,limitations:['Fixed short arm and static sheath limit exact straight unsheathing travel; a brief stylized draw precedes the rising slash.','Source visible arm cutouts remain unchanged; hidden body fill is limited to original removed-arm/blade pixels.']},null,2)+'\n');
if(process.argv.includes('--apply')){
 const backup=path.join(root,'.build/backups/whitehair-katana-before-joint-'+new Date().toISOString().replace(/[:.]/g,'-'));
 for(const view of Object.keys(views)){const target=path.join(root,views[view].sheet);write(path.join(backup,view+'-attack-sheet.png'),fs.readFileSync(target));write(target,fs.readFileSync(path.join(root,views[view].candidate)));}
 const metaPath=path.join(root,'metadata/character/attack/whitehair-katana.json');write(path.join(backup,'whitehair-katana.json'),fs.readFileSync(metaPath));write(metaPath,JSON.stringify(metadata,null,2)+'\n');
 console.log(JSON.stringify({applied:true,backup}));
}
console.log(JSON.stringify({candidate_ready:true,work,validation},null,2));

