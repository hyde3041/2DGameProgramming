import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let currentImport;
try{
 currentImport=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/archer-import.json'),'utf8'));
}catch(error){
 if(error.code!=='ENOENT')throw error;
}
if(currentImport?.enabled){
 await import('./import_archer_attack_sheets.mjs');
 process.exit(0);
}
const output=path.join(root,'.build/archer-back-import');
const apply=process.argv.includes('--apply');
const assetFolder='asset/character/player/icon/layers/archer/back/attack/imported';
const metadataFile=path.join(root,'metadata/character/attack/archer-back-import.json');
const record=JSON.parse(await fs.readFile(metadataFile,'utf8'));
const input=path.join(root,'game',record.source_sheet);
await fs.mkdir(output,{recursive:true});

const whiteFrames=[];
// The committed source already contains the localized hair repair.
for(let index=0;index<16;index++){
 const pixels=await sharp(input).extract({left:index%4*256,top:Math.floor(index/4)*256,width:256,height:256}).removeAlpha().raw().toBuffer();
 whiteFrames.push(pixels);
}

function transparentMatte(rgb){
 const result=Buffer.alloc(256*256*4);
 const background=new Uint8Array(256*256);
 const exterior=new Uint8Array(256*256);
 const queue=[];
 function visit(pixel){
  if(exterior[pixel])return;
  const color=rgb.subarray(pixel*3,pixel*3+3);
  if(Math.min(...color)<210)return;
  exterior[pixel]=1;
  queue.push(pixel);
 }
 for(let coordinate=0;coordinate<256;coordinate++){
  visit(coordinate);visit(255*256+coordinate);
  visit(coordinate*256);visit(coordinate*256+255);
 }
 for(let pixel=0;pixel<256*256;pixel++){
  if(Math.min(...rgb.subarray(pixel*3,pixel*3+3))>=246)visit(pixel);
 }
 for(let index=0;index<queue.length;index++){
  const pixel=queue[index],x=pixel%256,y=Math.floor(pixel/256);
  if(x>0)visit(pixel-1);
  if(x<255)visit(pixel+1);
  if(y>0)visit(pixel-256);
  if(y<255)visit(pixel+256);
 }
 for(let pixel=0;pixel<256*256;pixel++){
  const color=rgb.subarray(pixel*3,pixel*3+3);
  const minimum=Math.min(...color);
  const maximum=Math.max(...color);
  background[pixel]=exterior[pixel]||minimum>=246&&maximum-minimum<=12?1:0;
  rgb.copy(result,pixel*4,pixel*3,pixel*3+3);
  result[pixel*4+3]=background[pixel]?0:255;
 }
 // Recover edge alpha against the original white matte using nearby ink color.
 for(let y=1;y<255;y++)for(let x=1;x<255;x++){
  const pixel=y*256+x;
  if(background[pixel])continue;
  const color=rgb.subarray(pixel*3,pixel*3+3);
  const minimum=Math.min(...color);
  if(minimum<80)continue;
  const touchesBackground=[-257,-256,-255,-1,1,255,256,257].some(offset=>background[pixel+offset]);
  if(!touchesBackground)continue;
  let inkMinimum=minimum;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const xx=x+dx,yy=y+dy;
   if(xx<0||xx>=256||yy<0||yy>=256)continue;
   const neighbor=(yy*256+xx)*3;
   inkMinimum=Math.min(inkMinimum,...rgb.subarray(neighbor,neighbor+3));
  }
  const alpha=(255-minimum)/(255-inkMinimum);
  result[pixel*4+3]=Math.round(alpha*255);
  for(let channel=0;channel<3;channel++)result[pixel*4+channel]=Math.max(0,Math.round(255+(color[channel]-255)/alpha));
 }
 return result;
}

const nativeFrames=[];
for(const pixels of whiteFrames){
 const transparent=transparentMatte(pixels);
 nativeFrames.push(await sharp(transparent,{raw:{width:256,height:256,channels:4}}).resize(320,320).ensureAlpha().raw().toBuffer());
}
const sourceSheet=Buffer.alloc(1024*1024*3);
const gameSheet=Buffer.alloc(1280*1280*4);
for(let index=0;index<16;index++){
 for(let y=0;y<256;y++)whiteFrames[index].copy(sourceSheet,((Math.floor(index/4)*256+y)*1024+index%4*256)*3,y*256*3,(y+1)*256*3);
 for(let y=0;y<320;y++)nativeFrames[index].copy(gameSheet,((Math.floor(index/4)*320+y)*1280+index%4*320)*4,y*320*4,(y+1)*320*4);
}
const cleanFile=path.join(output,'source-clean.png');
const sheetFile=path.join(output,'current-sheet.png');
await sharp(sourceSheet,{raw:{width:1024,height:1024,channels:3}}).png().toFile(cleanFile);
await sharp(gameSheet,{raw:{width:1280,height:1280,channels:4}}).png().toFile(sheetFile);
await sharp(nativeFrames[15],{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(output,'frame-15.png'));
const preview=[];
for(const pixels of nativeFrames)preview.push(await sharp(pixels,{raw:{width:320,height:320,channels:4}}).flatten({background:'#59534b'}).png().toBuffer());
await sharp(preview,{join:{animated:true}}).gif({delay:preview.map((_,index)=>index%4===3?70:60),loop:0,effort:7}).toFile(path.join(output,'preview.gif'));

const unique=new Set(nativeFrames.map(frame=>crypto.createHash('sha256').update(frame).digest('hex'))).size;
if(unique!==16)throw Error('Imported frames must remain distinct');
for(const pixels of nativeFrames){
 for(const pixel of [0,319,320*319,320*320-1])if(pixels[pixel*4+3])throw Error('Background corner is not transparent');
}
if(apply){
 const assets=path.join(root,'game',assetFolder);
 await fs.mkdir(assets,{recursive:true});
 await fs.copyFile(cleanFile,path.join(assets,'source-clean.png'));
 await fs.copyFile(sheetFile,path.join(assets,'current-sheet.png'));
 await fs.copyFile(sheetFile,path.join(root,'game/asset/character/player/main/2-archer/back/attack-sheet.png'));
 await fs.writeFile(metadataFile,JSON.stringify(record,null,2)+'\n');
 const runtimeFile=path.join(root,'metadata/character/attack/archer.json');
 const runtime=JSON.parse(await fs.readFile(runtimeFile,'utf8'));
 runtime.version=6;
 runtime.direction_overrides={...runtime.direction_overrides,back:'metadata/character/attack/archer-back-import.json'};
 await fs.writeFile(runtimeFile,JSON.stringify(runtime,null,2)+'\n');
 const rigFile=path.join(root,'metadata/character/attack/archer-rig.json');
 const rig=JSON.parse(await fs.readFile(rigFile,'utf8'));
 rig.direction_overrides={...rig.direction_overrides,back:'metadata/character/attack/archer-back-import.json'};
 await fs.writeFile(rigFile,JSON.stringify(rig,null,2)+'\n');
 await fs.copyFile(path.join(output,'preview.gif'),path.join(root,'game/asset/character/player/icon/preview/archer-back-imported-no-logo.gif'));
}
await fs.writeFile(path.join(output,'qa.json'),JSON.stringify({applied:apply,frames:16,unique_frames:unique,source_logo_repair_frame:15,logo_repair_pixels:record.logo_repair.source_frame_mask_pixels,background_corners_transparent:true,uniform_scale:1.25},null,2)+'\n');
console.log(JSON.stringify({applied:apply,frames:unique,output}));
