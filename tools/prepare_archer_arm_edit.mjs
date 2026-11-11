// Assemble only the locally edited arms into the original editable source
// layers. No scaling of the character, runtime pose warping, or new body.
import fs from'node:fs/promises';import path from'node:path';import crypto from'node:crypto';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const sources=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-v2-sources.json'),'utf8')),edits=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-arm-edit-sources.json'),'utf8')),cleanup=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-cleanup.json'),'utf8'));
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const metadata={id:'archer',version:2,workflow:edits.workflow,overrides:{front:{},back:{},side:{}},views:{}};
for(const[view,vr]of Object.entries(sources.views)){
 const atlasInfo=await sharp(path.join(game,vr.atlas)).metadata(),editedAtlas=await sharp(path.join(game,edits.views[view].edited_atlas)).resize(atlasInfo.width,atlasInfo.height,{fit:'fill'}).png().toBuffer();metadata.views[view]=[];
 for(const f of edits.views[view].frames){
  const pose=vr.frames[f.index],input=cleanup.overrides[view]?.['pose-'+f.index]||pose.file;
  const{data:original,info}=await sharp(path.join(game,input)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const edited=await sharp(editedAtlas).extract(pose.source_cell).ensureAlpha().raw().toBuffer(),output=Buffer.from(original),mask=Buffer.alloc(info.width*info.height*4);let changed=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   let weight=0;
   for(const arm of f.arms){
    const[e,h]=[arm.elbow,arm.hand],dx=h[0]-e[0],dy=h[1]-e[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
    const t=(x-e[0])*ux+(y-e[1])*uy,n=Math.abs(-(x-e[0])*uy+(y-e[1])*ux);
    const start=arm.arm==='bow'?-20:-15,end=length-8;
    const m=smooth((t-start)/7)*smooth((end-t)/7)*smooth((25-n)/3);
    // Original bow, grip and knuckles are restored by excluding the far edge.
    const bowLimit=arm.arm==='bow'?(view==='back'?smooth((x-h[0]-5)/5):smooth((h[0]-x-5)/5)):1;
    weight=Math.max(weight,m*bowLimit);
   }
   const p=(y*info.width+x)*4;mask[p]=mask[p+1]=mask[p+2]=255;mask[p+3]=Math.round(weight*255);if(!mask[p+3])continue;
   const a=original[p+3]/255*(1-weight),b=(edited[p+3]<12?0:edited[p+3]/255)*weight,total=a+b;
   for(let c=0;c<3;c++)output[p+c]=total?Math.round((original[p+c]*a+edited[p+c]*b)/total):0;output[p+3]=Math.round(total*255);
   if(!output.subarray(p,p+4).equals(original.subarray(p,p+4)))changed++;
  }
  for(let p=0;p<output.length;p+=4)if(!mask[p+3]&&!original.subarray(p,p+4).equals(output.subarray(p,p+4)))throw Error('Pixels changed outside arm mask');
  const folder=`asset/character/player/icon/layers/archer/${view}/attack/arm-edit`,file=`${folder}/upper-body-${String(f.index).padStart(2,'0')}.png`,maskFile=`${folder}/mask-${String(f.index).padStart(2,'0')}.png`;
  await sharp(output,{raw:info}).png().toFile(path.join(game,file));await sharp(mask,{raw:info}).png().toFile(path.join(game,maskFile));metadata.overrides[view]['pose-'+f.index]=file;metadata.views[view].push({frame:f.index,input,file,mask:maskFile,source_cell:pose.source_cell,arms:f.arms,source_sha256:crypto.createHash('sha256').update(original).digest('hex'),changed_pixels:changed,outside_arm_mask_identical:true});
 }
}
await fs.writeFile(path.join(root,'metadata/character/attack/archer-arm-proportions.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(metadata.views).map(([v,f])=>[v,{frames:f.length,changed_pixels:f.reduce((s,x)=>s+x.changed_pixels,0),outside_masks_unchanged:true}]))));
