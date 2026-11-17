// Bake the approved neutral cutouts using rigid transforms only. No dependencies.
// node tools/build_whitehair_idle.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc(b){let v=0xffffffff;for(const c of b)v=crcTable[(v^c)&255]^(v>>>8);return(v^0xffffffff)>>>0;}
function chunk(type,b){const n=Buffer.alloc(4),t=Buffer.from(type),c=Buffer.alloc(4);n.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([n,t,b,c]);}
function png(w,h,px){const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)px.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
function readPng(file){const b=fs.readFileSync(file);let w,h,ct,depth,id=[];for(let p=8;p<b.length;){let n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);if(t==='IHDR'){w=d.readUInt32BE();h=d.readUInt32BE(4);depth=d[8];ct=d[9];if(d[12])throw Error('Interlaced PNG unsupported');}if(t==='IDAT')id.push(d);p+=n+12;}if(depth!==8||![2,6].includes(ct))throw Error('Expected RGB(A) 8-bit PNG: '+file);const channels=ct===6?4:3,stride=w*channels,raw=zlib.inflateSync(Buffer.concat(id)),decoded=Buffer.alloc(h*stride),paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};for(let y=0;y<h;y++){const f=raw[y*(stride+1)];for(let x=0;x<stride;x++){const a=x>=channels?decoded[y*stride+x-channels]:0,u=y?decoded[(y-1)*stride+x]:0,ul=y&&x>=channels?decoded[(y-1)*stride+x-channels]:0;decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,u,(a+u)>>1,paeth(a,u,ul)][f])&255;}}const px=Buffer.alloc(w*h*4);for(let k=0;k<w*h;k++){decoded.copy(px,k*4,k*channels,k*channels+3);px[k*4+3]=channels===4?decoded[k*4+3]:255;}return{w,h,px};}
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
const any=(x,y,polys)=>polys.some(p=>inside(x,y,p));
const size=320,count=16,fps=16,TAU=Math.PI*2,rad=Math.PI/180;
const names=['legs','hair','cloth','body','arm_left','arm_right','head'];
const colours=[[132,95,55],[142,84,177],[77,148,207],[72,177,129],[238,151,66],[232,202,65],[227,105,142]];
const identity=()=>[1,0,0,1,0,0];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function rotate([x,y],angle){const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}
function matrices(t,p){t=((t%1)+1)%1;if(t<1e-10)return Object.fromEntries(names.map(n=>[n,identity()]));const wave=lag=>Math.sin(TAU*(t-lag))-Math.sin(-TAU*lag),breath=.5-.5*Math.cos(TAU*t);const body=multiply([1,0,0,1,0,-1.05*breath],rotate(p.body,.24*rad*Math.sin(TAU*t)));const head=multiply(body,rotate(p.head,.26*rad*wave(.04)));return{legs:identity(),body,head,hair:multiply(head,rotate(p.hair,.95*rad*wave(.14))),cloth:multiply(body,rotate(p.cloth,-.65*rad*wave(.19))),arm_left:multiply(body,rotate(p.arm_left,.45*rad*wave(.08))),arm_right:multiply(body,rotate(p.arm_right,-.45*rad*wave(.12)))};}
function over(out,i,r,g,b,a){const oa=out[i+3]/255,na=a+oa*(1-a);if(!na)return;out[i]=Math.round((r+out[i]*oa*(1-a))/na);out[i+1]=Math.round((g+out[i+1]*oa*(1-a))/na);out[i+2]=Math.round((b+out[i+2]*oa*(1-a))/na);out[i+3]=Math.round(na*255);}
function draw(out,src,m){const[a,b,c,d,tx,ty]=m;for(let y=115;y<295;y++)for(let x=85;x<225;x++){const u=a*(x-tx)+b*(y-ty),v=c*(x-tx)+d*(y-ty),xx=Math.floor(u),yy=Math.floor(v),dx=u-xx,dy=v-yy;let A=0,R=0,G=0,B=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const X=xx+i,Y=yy+j;if(X<0||Y<0||X>=size||Y>=size)continue;const k=(Y*size+X)*4,wa=src[k+3]/255*(i?dx:1-dx)*(j?dy:1-dy);A+=wa;R+=src[k]*wa;G+=src[k+1]*wa;B+=src[k+2]*wa;}if(A>0)over(out,(y*size+x)*4,R,G,B,A);}}
const meta=json('metadata/character/layers/whitehair.json'),qa=[],views={},allFrames={};
const outRoot=path.join(root,'.build/whitehair-idle');
for(const direction of ['front','side','back']){
 const spec=json(`metadata/character/idle/whitehair-${direction}-regions.json`),v=meta.views[direction];
 const sourceFile=path.join(root,'game',v.neutral),source=readPng(sourceFile).px,neutral=Buffer.from(source);
 const s=v.uniform_scale,ox=160+(v.source_crop[0]-v.original_foot_pivot[0])*s,oy=288+(v.source_crop[1]-v.original_foot_pivot[1])*s;
 const pt=([x,y])=>[ox+x*s,oy+y*s];const pivots=Object.fromEntries(Object.entries(spec.pivots).map(([k,p])=>[k,pt(p)]));
 const priority=spec.label_priority||(direction==='back'?['arm_left','arm_right','head','hair','legs','cloth','body']:['legs','arm_left','arm_right','head','cloth','hair','body']);
 const order=direction==='back'?['legs','body','cloth','arm_left','arm_right','hair','head']:names;
 const owner=new Int8Array(size*size).fill(-1),parts=Object.fromEntries(names.map(n=>[n,Buffer.alloc(source.length)])),under=Object.fromEntries(names.map(n=>[n,Buffer.alloc(source.length)])),labels=Buffer.alloc(source.length);
 let removed=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const k=y*size+x,i=k*4;if(!source[i+3])continue;const X=(x+.5-ox)/s,Y=(y+.5-oy)/s;if(!any(X,Y,spec.keep_polygons)){neutral.fill(0,i,i+4);removed++;continue;}let role=priority.find(n=>n==='body'||any(X,Y,spec.regions[n]||[]));if(y>=282)role='legs';owner[k]=names.indexOf(role);source.copy(parts[role],i,i,i+4);const col=colours[owner[k]];labels[i]=col[0];labels[i+1]=col[1];labels[i+2]=col[2];labels[i+3]=source[i+3];}
 // Hidden 2px underlaps sample this same surface only, inside another opaque
 // source part. They never expand the outside silhouette or repaint visible art.
 for(const name of names){if(name==='head')continue;const rank=order.indexOf(name),idx=names.indexOf(name),p=parts[name];for(let y=120;y<282;y++)for(let x=85;x<225;x++){const k=y*size+x,i=k*4;if(owner[k]<0||owner[k]===idx||source[i+3]<240||order.indexOf(names[owner[k]])<=rank)continue;let nearest=-1,dist=Infinity;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const D=dx*dx+dy*dy,X=x+dx,Y=y+dy,K=Y*size+X;if(D>6||D>=dist||X<0||X>=size||Y<0||Y>=size||owner[K]!==idx||p[K*4+3]<240)continue;nearest=K;dist=D;}if(nearest>=0){p.copy(under[name],i,nearest*4,nearest*4+4);under[name][i+3]=255;}}}
 const layerBase=`game/asset/character/player/icon/layers/whitehair/${direction}/idle`;
 const geometry={max_unit_error:0,max_determinant_error:0};
 for(const name of names){write(path.join(root,layerBase,'visible',name+'.png'),png(size,size,parts[name]));write(path.join(root,layerBase,'hidden',name+'.png'),png(size,size,under[name]));}
 write(path.join(outRoot,`${direction}-labels.png`),png(size,size,labels));
 write(path.join(root,layerBase,'neutral.png'),png(size,size,neutral));
 function render(t){if(Math.abs(t-Math.round(t))<1e-10)return Buffer.from(neutral);const m=matrices(t,pivots),out=Buffer.alloc(source.length);for(const n of order){const[a,b,c,d]=m[n];geometry.max_unit_error=Math.max(geometry.max_unit_error,Math.abs(a*a+b*b-1),Math.abs(c*c+d*d-1),Math.abs(a*c+b*d));geometry.max_determinant_error=Math.max(geometry.max_determinant_error,Math.abs(a*d-b*c-1));draw(out,under[n],m[n]);draw(out,parts[n],m[n]);}neutral.copy(out,282*size*4,282*size*4);return out;}
 const reconstructed=Buffer.alloc(source.length);for(const n of names)for(let i=0;i<source.length;i+=4)if(parts[n][i+3])parts[n].copy(reconstructed,i,i,i+4);
 let neutralErrors=0;for(let i=0;i<source.length;i+=4)if(neutral[i+3]&&!neutral.subarray(i,i+4).equals(reconstructed.subarray(i,i+4)))neutralErrors++;
 if(neutralErrors)throw Error('Neutral surface ownership lost pixels: '+direction);
 const frames=Array.from({length:count},(_,i)=>render(i/count));allFrames[direction]=frames;
 const sheet=Buffer.alloc(1280*1280*4);for(let i=0;i<count;i++){write(path.join(outRoot,'frames',direction,String(i).padStart(2,'0')+'.png'),png(size,size,frames[i]));for(let y=0;y<size;y++)frames[i].copy(sheet,((Math.floor(i/4)*size+y)*1280+(i%4)*size)*4,y*size*4,(y+1)*size*4);}
 const target=`asset/character/player/main/9-whitehair/${direction}/idle-sheet.png`;write(path.join(root,'game',target),png(1280,1280,sheet));
 const mae=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)n+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);n+=Math.abs(a[i+3]-b[i+3]);}return n/a.length;};
 const steps=frames.map((f,i)=>mae(f,frames[(i+1)%count]));const unique=new Set(frames.map(hash)).size;
 const feetFixed=frames.every(f=>f.subarray(282*size*4).equals(neutral.subarray(282*size*4)));
 const endpointEqual=render(0).equals(render(1));if(unique!==16||!feetFixed||!endpointEqual||geometry.max_unit_error>1e-10)throw Error('Motion checks failed: '+direction);
 qa.push({direction,frame_count:count,unique_frames:unique,fps,cycle_ms:1000,neutral_visible_pixels_changed:neutralErrors,excluded_neighbor_pixels:removed,feet_fixed:feetFixed,loop_endpoints_identical:endpointEqual,...geometry,seam_mae:steps[15],max_step_mae:Math.max(...steps),steps,source_sha256:hash(fs.readFileSync(sourceFile))});
 views[direction]={file:target,width:1280,height:1280,columns:4,rows:4,loop:true,frame_duration_ms:62.5,frames:Array.from({length:count},(_,i)=>({index:i,rect:[i%4*320,Math.floor(i/4)*320,320,320],pico2d_rect:[i%4*320,(3-Math.floor(i/4))*320,320,320]}))};
 write(path.join(root,layerBase,'rig.json'),JSON.stringify({source:v.neutral,region_spec:`metadata/character/idle/whitehair-${direction}-regions.json`,pixel_coordinates:'canonical_320_top_left',pivots,order,parts:names.map(n=>({name:n,visible:`${layerBase}/visible/${n}.png`,hidden:`${layerBase}/hidden/${n}.png`})),animation:'unit-scale translation and rotation only',motion:{body_rise_px:1.05,body_rotation_deg:.24,head_rotation_deg:.26,hair_rotation_deg:.95,cloth_rotation_deg:.65,arm_rotation_deg:.45}},null,2)+'\n');
}
views.right=views.side;delete views.side;views.left={...views.right,flip_x:true};
write(path.join(root,'metadata/character/idle/whitehair.json'),JSON.stringify({id:'whitehair',name:'백발 캐릭터',cell_size:[320,320],pivot:[160,288],fps,cycle_ms:1000,frames_per_direction:16,animations:views,runtime_registered:false,notes:['Idle art only; class, weapon, attack and battle stats remain unspecified.','Visible pixels preserve the approved neutral except neighboring-figure fragments excluded from side crop.','Rigid part rotation and translation; fixed feet; no scale, shear, mesh or frame blending.']},null,2)+'\n');
// Large three-view preview frames, drawn from the actual exported sheet frames.
for(let f=0;f<count;f++){const W=960,H=400,px=Buffer.alloc(W*H*4);for(let i=0;i<px.length;i+=4){px[i]=231;px[i+1]=233;px[i+2]=236;px[i+3]=255;}for(const[d,view]of ['front','side','back'].entries()){const src=allFrames[view][f];for(let y=0;y<340;y++)for(let x=0;x<280;x++){const sx=90+Math.floor(x/2),sy=122+Math.floor(y/2),i=(sy*size+sx)*4,k=((y+28)*W+d*320+x+20)*4,a=src[i+3]/255;if(a)over(px,k,src[i]*a,src[i+1]*a,src[i+2]*a,a);}}write(path.join(outRoot,'preview',String(f).padStart(2,'0')+'.png'),png(W,H,px));}
write(path.join(outRoot,'validation.json'),JSON.stringify(qa,null,2)+'\n');
meta.version=2;
meta.status='idle_cutouts_and_sheets_ready';
meta.motion_ready=true;
meta.layer_assembly_validated=true;
meta.idle={metadata:'metadata/character/idle/whitehair.json',frames:16,fps:16,cycle_ms:1000,
 preview:'asset/character/player/icon/preview/whitehair-idle.gif',
 validation:'metadata/character/idle/whitehair-validation.json',
 authoring_tool:'tools/build_whitehair_idle.mjs',runtime_registered:false};
meta.notes=[
 'Approved neutral and generated atlas originals remain unchanged.',
 'The original independently drawn atlas parts remain draft sources; they are not substituted for visible approved artwork.',
 'Idle uses approved visible-pixel anatomical cutouts under each direction/idle/visible, with separate hidden seam overlaps.',
 'Visible cutouts reconstruct the neutral exactly; side neighboring-figure fragments are excluded only in the idle copy.',
 'Only rigid translations and rotations are used; no scale, shear, mesh deformation or pose blending.',
 'No class, weapon, attack, skill, deployment cost or runtime party slot has been assigned.'
];
for(const direction of ['front','side','back'])meta.views[direction].idle_rig=`asset/character/player/icon/layers/whitehair/${direction}/idle/rig.json`;
write(path.join(root,'metadata/character/layers/whitehair.json'),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify(qa.map(({steps,...v})=>v),null,2));
