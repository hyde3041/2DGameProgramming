// Lossless visible-pixel cutouts from character-specific anatomical outlines.
// node tools/split_character_layers.mjs <QA-output-directory> [character-id]
import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {refineLabels} from './refine_layer_labels.mjs';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply a QA output directory.');
const out=path.resolve(process.argv[2]);await fs.mkdir(out,{recursive:true});
const order=['legs','body','cloth-hem','hair-tail','head','arm-left','arm-right','equipment','hair-front'];
const colours=[[150,100,65],[60,160,100],[80,120,205],[150,80,175],[224,115,165],[230,155,65],[235,200,65],[65,185,195],[185,125,205]];
const inside=(x,y,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [a,b]=poly[i],[c,d]=poly[j];if(((b>y)!==(d>y))&&(x<(c-a)*(y-b)/(d-b)+a))hit=!hit;}return hit;};
const any=(x,y,polys=[])=>polys.some(p=>inside(x,y,p));
function near(x,y,polys=[],radius=3){if(any(x,y,polys))return true;for(const p of polys)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy||1)));if((x-a[0]-t*vx)**2+(y-a[1]-t*vy)**2<=radius*radius)return true;}return false;}
function hairMaterial(id,r,g,b){if(id==='archer')return b+8>=r&&b+8>=g;if(id==='herbalist')return r>g*1.25&&g>b*1.12&&!(r>205&&g>145&&b>100);return true;}
function equipmentMaterial(kind,r,g,b){if(kind==='cleric-staff')return g>r*1.22||(r-b>18&&g-b>10&&r>=g)||(r<80&&g<90&&b<90);if(kind==='frost-staff')return b-r>72||(r<115&&g<145&&b<190);return true;}
const ids=(await fs.readdir(root+'/metadata/character/layers')).filter(f=>f.endsWith('.json')&&f!=='manifest.json').map(f=>f.slice(0,-5));
const report=[];
for(const id of ids.filter(id=>!process.argv[3]||id===process.argv[3])){
 const file=root+'/metadata/character/layers/'+id+'.json',meta=JSON.parse(await fs.readFile(file,'utf8'));
 for(const view of meta.views){
  const source=await sharp(root+'/'+view.source).ensureAlpha().raw().toBuffer(),regions=view.regions;let owner=new Uint8Array(320*320);
  const headAllowed=new Uint8Array(320*320),hairAllowed=new Uint8Array(320*320),armLeftAllowed=new Uint8Array(320*320),armRightAllowed=new Uint8Array(320*320),legAllowed=new Uint8Array(320*320),force=new Uint8Array(320*320),headExtras=new Uint8Array(320*320),bodySeeds=new Uint8Array(320*320);
  const parts=Object.fromEntries(order.map(n=>[n,Buffer.alloc(source.length)]));
  for(let y=0;y<320;y++)for(let x=0;x<320;x++){
   const k=y*320+x,i=k*4;if(!source[i+3])continue;const [r,g,b]=source.subarray(i,i+3),px=x+.5,py=y+.5;
   const guard=inside(px,py,regions.torso_guard);
   const eq=(regions.equipment_material?near(px,py,regions.equipment,7):any(px,py,regions.equipment))&&equipmentMaterial(regions.equipment_material,r,g,b);
   const hair=any(px,py,regions.hair)&&hairMaterial(id,r,g,b);
   const extraHair=any(px,py,regions.head_hair_extra)&&((id==='archer'&&hairMaterial(id,r,g,b))||(id==='frost-mage'&&r>80&&b>r&&Math.abs(r-g)<25));
   let head=(inside(px,py,regions.head)||any(px,py,regions.head_extra)||extraHair)&&!guard;
   if(eq&&regions.equipment_material)head=false;
   if(id==='archer'&&eq&&!hairMaterial(id,r,g,b)&&y>199)head=false;
   if(id==='guardian'&&eq&&(r<115||(r>g*1.35&&r>b*1.2)))head=false;
   const cutYs={swordsman:{front:208,back:201,side:208},guardian:{front:204,back:201,side:206},crossbowman:{front:208,back:202,side:209},'shadow-thief':{front:211,back:201,side:209},'frost-mage':{front:206,back:201,side:207}};
   const collar=cutYs[id]&&y>=cutYs[id][view.direction]&&Math.abs(x-regions.neck[0])<29&&Math.max(r,g,b)<105&&Math.max(r,g,b)-Math.min(r,g,b)<16;
   const shoulderMaterial=collar||(id==='guardian'&&y>=200&&r>g*1.25&&r>b*1.05)||(id==='herbalist'&&y>=195&&g>r*1.08)||(id==='cleric'&&y>=195&&g>r*1.15&&b>r*1.1);
   if(shoulderMaterial)head=false;
   const archerString=id==='archer'&&y>212&&!(b>=g&&b>r+2);
   const guardianRail=id==='guardian'&&near(px,py,regions.equipment,5)&&x>183&&y>190&&!(r-b>18&&r-g>6);
   const clericMetal=id==='cleric'&&(view.direction==='front'?(x<140&&y<196):(x>198))&&(Math.max(r,g,b)-Math.min(r,g,b)>24||Math.max(r,g,b)<110);
   const herbalistLeaf=id==='herbalist'&&(view.direction==='back'?(x<134&&y>184):(x>195&&y>188))&&!hairMaterial(id,r,g,b);
   const excludedHead=any(px,py,regions.head_exclude);
   const archerEquipment=id==='archer'&&eq&&y>198&&!(b>=g&&b>r+3);
   headAllowed[k]=!guard&&!shoulderMaterial&&!archerString&&!guardianRail&&!clericMetal&&!herbalistLeaf&&!excludedHead&&!archerEquipment&&!(eq&&regions.equipment_material)&&near(px,py,[regions.head,...(regions.head_extra||[]),...(extraHair?(regions.head_hair_extra||[]):[])],2);
   headExtras[k]=any(px,py,regions.head_extra);
   hairAllowed[k]=near(px,py,regions.hair,4);
   armLeftAllowed[k]=near(px,py,regions.arm_left.length?[regions.arm_left]:[],6);
   armRightAllowed[k]=near(px,py,regions.arm_right.length?[regions.arm_right]:[],6);
   legAllowed[k]=y>=245&&near(px,py,regions.legs,9);
   if(eq&&regions.equipment_material)force[k]=8;
   if(guardianRail)force[k]=8;
   if(clericMetal||herbalistLeaf)force[k]=8;
   if(excludedHead)force[k]=8;
   if(archerEquipment)force[k]=8;
   bodySeeds[k]=x>=regions.neck[0]-19&&x<=regions.neck[0]+15&&y>=Math.min(...regions.torso_guard.map(p=>p[1]))-1&&y<=246;
   if(guard&&head)head=false;
   let part='body';
   if(head&&!hair)part='head';
   else if(hair)part='hair-tail';
   else if(eq)part='equipment';
   else if(inside(px,py,regions.arm_left))part='arm-left';
   else if(inside(px,py,regions.arm_right))part='arm-right';
   else if(any(px,py,regions.cloth))part='cloth-hem';
   else if(any(px,py,regions.legs))part='legs';
   owner[k]=order.indexOf(part)+1;
  }
  owner=refineLabels(source,owner,{headAllowed,hairAllowed,armLeftAllowed,armRightAllowed,legAllowed,force,headExtras,bodySeeds,bodyBounds:[115,Math.min(...regions.torso_guard.map(p=>p[1]))-4,213,259]});
  if(id==='archer')for(let y=125;y<262;y++)for(let x=80;x<232;x++){
   const k=y*320+x,i=k*4;if(!source[i+3])continue;
   const r=source[i],g=source[i+1],b=source[i+2],blue=b>=g&&b>r+3;
   if(!blue)continue;
   if(owner[k]===2||owner[k]===5){
    const pony=any(x+.5,y+.5,regions.hair)||(view.direction==='back'?x>190:x<136);
    if(pony)owner[k]=4;else if(y>206)owner[k]=9;
   }
  }
  if(id==='herbalist')for(let y=198;y<240;y++)for(let x=100;x<216;x++){
   const k=y*320+x,i=k*4;if(!source[i+3])continue;const r=source[i],g=source[i+1],b=source[i+2];
   const braidArea=view.direction==='back'?x>171:(view.direction==='side'?x<171:x<160);
   const skin=r>205&&g>145&&b>100;
   if(braidArea&&r>110&&r-g>45&&g-b>15&&!skin)owner[k]=4;
   if(owner[k]===4&&skin)owner[k]=headAllowed[k]?5:armLeftAllowed[k]?6:armRightAllowed[k]?7:2;
  }
  for(let k=0;k<320*320;k++)if(owner[k]===5&&!headAllowed[k])owner[k]=force[k]||2;
  for(let k=0;k<320*320;k++)if(source[k*4+3])source.copy(parts[order[owner[k]-1]],k*4,k*4,k*4+4);
  const base=`asset/character/icon/layers/${id}/${view.direction}/anatomy`;await fs.mkdir(root+'/'+base+'/render',{recursive:true});
  view.parts={};view.render_parts={};view.pixel_counts={};
  let visible=0,headGuard=0;const rebuilt=Buffer.alloc(source.length),labels=Buffer.alloc(source.length);
  for(const [j,n] of order.entries()){
   let count=0;for(let k=0;k<320*320;k++){const i=k*4;if(parts[n][i+3]){count++;visible++;parts[n].copy(rebuilt,i,i,i+4);labels[i]=colours[j][0];labels[i+1]=colours[j][1];labels[i+2]=colours[j][2];labels[i+3]=255;if(n==='head'&&inside(k%320+.5,Math.floor(k/320)+.5,regions.torso_guard))headGuard++;}}
   view.pixel_counts[n]=count;
   const rel=base+'/'+n+'.png';await sharp(parts[n],{raw:{width:320,height:320,channels:4}}).png().toFile(root+'/'+rel);view.parts[n]=rel;
  }
  let expected=0;for(let i=0;i<source.length;i+=4)if(source[i+3]){expected++;if(!source.subarray(i,i+4).equals(rebuilt.subarray(i,i+4)))throw Error('Original pixel lost: '+id+' '+view.direction);}
  if(visible!==expected||headGuard)throw Error('Incorrect ownership or shoulder pixels in head');
  const render=Object.fromEntries(Object.entries(parts).map(([k,b])=>[k,Buffer.from(b)]));
  let underpaint=null,paintCount=0;
  if(view.underpainting)underpaint=await sharp(root+'/'+view.underpainting).ensureAlpha().raw().toBuffer();
  const overlap=(target,covered,radius)=>{
   for(let y=radius;y<320-radius;y++)for(let x=radius;x<320-radius;x++){
    const k=y*320+x,i=k*4;if(owner[k]!==order.indexOf(covered)+1||source[i+3]<245)continue;
    let nearest=-1,best=radius*radius+1;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
     const nk=(y+dy)*320+x+dx,j=nk*4,d=dx*dx+dy*dy;
     const sameMaterial=!(id==='archer'&&target==='head'&&covered==='hair-tail')||(source[j+2]>=source[j+1]&&source[j+2]>source[j]+3);
     if(d<best&&parts[target][j+3]>=245&&sameMaterial){nearest=j;best=d;}
    }
    if(nearest<0)continue;
    if(target==='body'&&underpaint&&underpaint[i+3]>245){underpaint.copy(render[target],i,i,i+4);paintCount++;}
    else parts[target].copy(render[target],i,nearest,nearest+4);
   }
  };
  overlap('body','head',4);overlap('body','hair-tail',3);overlap('body','cloth-hem',3);
  overlap('body','arm-left',2);overlap('body','arm-right',2);
  overlap('legs','body',2);overlap('legs','cloth-hem',3);overlap('body','legs',2);
  for(const n of order){const rel=base+'/render/'+n+'.png';await sharp(render[n],{raw:{width:320,height:320,channels:4}}).png().toFile(root+'/'+rel);view.render_parts[n]=rel;}
  // Pieces with the same pose must be combined before texture filtering.
  // Filtering separate alpha cutouts would expose an artificial white seam.
  if(id==='archer'){
   view.idle_groups={};view.idle_order=['joints','legs','body','cloth-hem','hair-tail','head'];
   const groups={legs:['legs'],body:['body','arm-left','arm-right','equipment'],'cloth-hem':['cloth-hem'],'hair-tail':['hair-tail'],head:['head','hair-front']};
   await fs.mkdir(root+'/'+base+'/idle',{recursive:true});
   const joints=Buffer.alloc(source.length),poseIds={legs:1,body:2,'arm-left':2,'arm-right':2,equipment:2,'cloth-hem':3,'hair-tail':4,head:5,'hair-front':5};
   for(let y=4;y<316;y++)for(let x=4;x<316;x++){
    const k=y*320+x,i=k*4;if(source[i+3]<245)continue;const pose=poseIds[order[owner[k]-1]];
    let interior=true,boundary=false;
    for(let dy=-3;dy<=3&&interior;dy++)for(let dx=-3;dx<=3;dx++){const q=(y+dy)*320+x+dx;if(source[q*4+3]<240){interior=false;break;}if(poseIds[order[owner[q]-1]]!==pose)boundary=true;}
    if(interior&&boundary)source.copy(joints,i,i,i+4);
   }
   const jointFile=base+'/idle/joints.png';await sharp(joints,{raw:{width:320,height:320,channels:4}}).png().toFile(root+'/'+jointFile);view.idle_groups.joints=jointFile;
   for(const [pose,names] of Object.entries(groups)){
    const pixels=Buffer.alloc(source.length);
    for(const n of names)for(let i=0;i<source.length;i+=4)if(render[n][i+3])render[n].copy(pixels,i,i,i+4);
    for(let k=0;k<320*320;k++)if(names.includes(order[owner[k]-1]))source.copy(pixels,k*4,k*4,k*4+4);
    const rel=base+'/idle/'+pose+'.png';await sharp(pixels,{raw:{width:320,height:320,channels:4}}).png().toFile(root+'/'+rel);view.idle_groups[pose]=rel;
   }
  }
  view.label_map=base+'/labels.png';await sharp(labels,{raw:{width:320,height:320,channels:4}}).png().toFile(root+'/'+view.label_map);
  view.layer_order=order;view.validation={visible_pixels:expected,exact_visible_pixel_reconstruction:true,single_owner:true,head_pixels_in_torso_guard:headGuard,hidden_body_underpainting_pixels:paintCount};
  report.push({id,direction:view.direction,...view.validation});
 }
 meta.version=1;meta.layer_order=order;meta.geometry='Original visible pixels, anatomical outlines; motion must use unit-scale rotation and translation.';
 await fs.writeFile(file,JSON.stringify(meta,null,2)+'\n');console.log('Split '+id+': front/back/side.');
}
await fs.writeFile(out+'/split-qa.json',JSON.stringify(report,null,2)+'\n');
