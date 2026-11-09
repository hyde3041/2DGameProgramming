import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const game=path.join(root,'game');
const output=path.join(root,'.build/archer-user-sheets');
const metadataPath='metadata/character/attack/archer-import.json';
const configuration=JSON.parse(await fs.readFile(path.join(root,metadataPath),'utf8'));
const apply=process.argv.includes('--apply');
const views=['front','back','side'];
const qa={};
const allFrames={};
await fs.mkdir(output,{recursive:true});

for(const view of views){
 const input=configuration.views[view];
 const sourceFile=path.join(game,input.source_sheet);
 const sourceMetadata=await sharp(sourceFile).metadata();
 const pixels=await sharp(sourceFile).resize(1280,1280).ensureAlpha().raw().toBuffer();
 const cutoff=input.background_key.maximum_channel;
 if(!(input.preserve_source_alpha&&sourceMetadata.hasAlpha)){
  for(let offset=0;offset<pixels.length;offset+=4){
   if(Math.max(pixels[offset],pixels[offset+1],pixels[offset+2])<=cutoff)pixels.fill(0,offset,offset+4);
  }
 }
 const file=path.join(output,`${view}-attack-sheet.png`);
 await sharp(pixels,{raw:{width:1280,height:1280,channels:4}}).png().toFile(file);
 const frames=[];
 for(let frame=0;frame<16;frame++){
  const image=await sharp(pixels,{raw:{width:1280,height:1280,channels:4}}).extract({left:frame%4*320,top:Math.floor(frame/4)*320,width:320,height:320}).raw().toBuffer();
  for(const pixel of [0,319,320*319,320*320-1])if(image[pixel*4+3])throw Error(view+': background corner is opaque');
  frames.push(image);
 }
 const unique=new Set(frames.map(frame=>crypto.createHash('sha256').update(frame).digest('hex'))).size;
 if(unique!==16)throw Error(view+': duplicated frames');
 qa[view]={frames:16,unique_frames:unique,source_size:input.source_size,uniform_scale:input.uniform_scale,transparent_corners:true};
 allFrames[view]=frames;
}

const preview=[];
for(let frame=0;frame<16;frame++){
 const layers=[];
 for(const [column,view] of views.entries()){
  const image=await sharp(allFrames[view][frame],{raw:{width:320,height:320,channels:4}}).extract({left:30,top:95,width:260,height:215}).png().toBuffer();
  layers.push({input:image,left:column*260,top:0});
 }
 preview.push(await sharp({create:{width:780,height:215,channels:4,background:'#706a61'}}).composite(layers).png().toBuffer());
}
await sharp(preview,{join:{animated:true}}).gif({delay:preview.map((_,frame)=>frame%4===3?70:60),loop:0,effort:7}).toFile(path.join(output,'preview.gif'));
await fs.writeFile(path.join(output,'preview.png'),preview[7]);

if(apply){
 for(const view of views){
  const file=path.join(output,`${view}-attack-sheet.png`);
  await fs.copyFile(file,path.join(game,configuration.views[view].file));
  await fs.copyFile(file,path.join(game,`asset/character/main/2-archer/${view}/attack-sheet.png`));
 }
 const runtimeFile=path.join(root,'metadata/character/attack/archer.json');
 const runtime=JSON.parse(await fs.readFile(runtimeFile,'utf8'));
 const overrides=Object.fromEntries(views.map(view=>[view==='side'?'right':view,metadataPath]));
 runtime.version=7;
 runtime.direction_overrides=overrides;
 await fs.writeFile(runtimeFile,JSON.stringify(runtime,null,2)+'\n');
 await fs.writeFile(path.join(root,'metadata/character/attack/archer-rig.json'),JSON.stringify({id:'archer',version:7,frames:16,fps:16,cell_size:[320,320],pivot:[160,288],renderer:'whole_sheet',direction_overrides:overrides,views:configuration.views},null,2)+'\n');
 await fs.copyFile(path.join(output,'preview.gif'),path.join(game,'asset/character/icon/preview/archer-user-three-directions.gif'));
}
await fs.writeFile(path.join(output,'qa.json'),JSON.stringify({applied:apply,views:qa},null,2)+'\n');
console.log(JSON.stringify({applied:apply,views:qa,output}));
