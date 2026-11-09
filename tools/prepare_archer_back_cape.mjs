import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sharp=require('sharp');
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const game=path.join(root,'game');
const output=path.join(root,'.build/archer-back-cape');
const apply=process.argv.includes('--apply');
const source='asset/character/icon/layers/archer/back/attack/user-sheet/source.png';
const layerRoot='asset/character/icon/layers/archer/back/aligned';
const raw=file=>sharp(path.join(game,file)).ensureAlpha().raw().toBuffer();
await fs.mkdir(output,{recursive:true});

function contains(x,y,vertices){
 let inside=false;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const [xi,yi]=vertices[i],[xj,yj]=vertices[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}

// Use the complete cloth surface so the old lowered arm cannot leave a hole.
// Its outline excludes the glove and boot pixels bundled into this legacy part.
const cape=await raw(layerRoot+'/cloth-hem.png');
const capeOutline=[
 [139,240],[168,240],[175,238],[186,241],[193,247],[196,253],
 [204,259],[205,265],[202,273],[198,279],[192,274],[190,269],
 [188,274],[162,263],[161,275],[143,266],[128,277],[130,269],
 [133,260],[137,253],[141,247],[138,245],
];
for(let pixel=0;pixel<320*320;pixel++)if(!contains(pixel%320,Math.floor(pixel/320),capeOutline))cape.fill(0,pixel*4,pixel*4+4);
const visited=new Uint8Array(320*320);
let largest=[];
for(let pixel=0;pixel<320*320;pixel++){
 if(visited[pixel]||cape[pixel*4+3]<16)continue;
 const component=[pixel];
 visited[pixel]=1;
 for(let index=0;index<component.length;index++){
  const current=component[index],x=current%320,y=Math.floor(current/320);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy,next=yy*320+xx;
   if(xx<0||xx>=320||yy<0||yy>=320||visited[next]||cape[next*4+3]<16)continue;
   visited[next]=1;
   component.push(next);
  }
 }
 if(component.length>largest.length)largest=component;
}
const mainCloth=new Set(largest);
for(let pixel=0;pixel<320*320;pixel++)if(!mainCloth.has(pixel))cape.fill(0,pixel*4,pixel*4+4);
await sharp(cape,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(output,'cape-reference.png'));
const capePivot=[160,241];
const capeAngles=Array.from({length:16},(_,frame)=>2*Math.sin(2*Math.PI*frame/16));
const movingCapes=[];
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage();
 await page.setContent('<canvas width="320" height="320"></canvas>');
 const png=await sharp(cape,{raw:{width:320,height:320,channels:4}}).png().toBuffer();
 const rendered=await page.evaluate(async ({image,angles,pivot})=>{
  const sprite=new Image();
  sprite.src=image;
  await sprite.decode();
  const canvas=document.querySelector('canvas');
  const context=canvas.getContext('2d');
  return angles.map(angle=>{
   context.setTransform(1,0,0,1,0,0);
   context.clearRect(0,0,320,320);
   context.translate(pivot[0],pivot[1]);
   context.rotate(angle*Math.PI/180);
   context.translate(-pivot[0],-pivot[1]);
   context.drawImage(sprite,0,0);
   return canvas.toDataURL();
  });
 },{image:'data:image/png;base64,'+png.toString('base64'),angles:capeAngles,pivot:capePivot});
 for(let frame=0;frame<16;frame++){
  const pixels=Math.abs(capeAngles[frame])<1e-10?cape:await sharp(Buffer.from(rendered[frame].split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
  movingCapes.push(pixels);
  await sharp(pixels,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(output,`cape-${String(frame).padStart(2,'0')}.png`));
 }
}finally{
 await browser.close();
}
const legs=await raw(layerRoot+'/legs.png');
const sourceSheet=await sharp(path.join(game,source)).resize(1280,1280).ensureAlpha().raw().toBuffer();
for(let offset=0;offset<sourceSheet.length;offset+=4){
 if(Math.max(...sourceSheet.subarray(offset,offset+3))<=12)sourceSheet.fill(0,offset,offset+4);
}
// Match the two limbs with a rigid reflection and hide the lower one in cloth.
const {prepareArcherBowRepair}=await import('./prepare_archer_bow_repair.mjs');
const tipConfiguration='metadata/character/attack/archer-back-bow-edit.json';
const tipEdits=JSON.parse(await fs.readFile(path.join(root,tipConfiguration),'utf8'));
const tipRepairs=tipEdits.frames;
const bowRepair=await prepareArcherBowRepair(sourceSheet,movingCapes,legs,tipEdits);
const tipLayers=bowRepair.layers;
const polygon=[[138,239],[177,239],[214,260],[208,282],[110,282],[108,262]];
function composite(destination,source,pixel){
 const offset=pixel*4,alpha=source[offset+3]/255;
 if(!alpha)return;
 const oldAlpha=destination[offset+3]/255;
 const total=alpha+oldAlpha*(1-alpha);
 for(let channel=0;channel<3;channel++)destination[offset+channel]=Math.round((source[offset+channel]*alpha+destination[offset+channel]*oldAlpha*(1-alpha))/total);
 destination[offset+3]=Math.round(total*255);
}

// Follow the original lower bow limb, including its dark border and highlights.
// The end rows separate each bow tip from the boots underneath it.
const bowEndRows=[260,269,264,270,269,266,268,269,271,273,273,273,276,269,268,259];
function bowForegroundMask(pixels,frame){
 const rows=[];
 const mask=new Uint8Array(320*320);
 for(let y=230;y<=bowEndRows[frame];y++){
  const candidates=[];
  for(let x=84;x<153;x++){
   const offset=(y*320+x)*4;
   const [red,green,blue]=pixels.subarray(offset,offset+3);
   if(pixels[offset+3]&&red>60&&red>green*1.05&&green>blue*1.05){
    candidates.push(x);
    // Preserve the adjacent glove as well as the bow's leftmost curve.
    if(x<138)for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)mask[yy*320+xx]=1;
   }
  }
  if(candidates.length){
   const left=candidates[0];
   const right=candidates.filter(x=>x<=left+15).at(-1);
   rows.push({y,left,right});
  }
 }
 for(let y=230;y<=bowEndRows[frame];y++){
  const lower=rows.findLast(row=>row.y<=y)||rows[0];
  const upper=rows.find(row=>row.y>=y)||rows.at(-1);
  if(!lower||!upper)throw Error('No bow contour found in frame '+frame);
  const fraction=upper.y===lower.y?0:(y-lower.y)/(upper.y-lower.y);
  const left=Math.floor(lower.left+(upper.left-lower.left)*fraction)-3;
  const right=Math.ceil(lower.right+(upper.right-lower.right)*fraction)+3;
  for(let yy=y-3;yy<=y+3;yy++)for(let x=left;x<=right;x++)mask[yy*320+x]=1;
 }
 return mask;
}

const frames=[],reports=[],bowMasks=[];
for(let frame=0;frame<16;frame++){
 const movingCape=movingCapes[frame];
 const current=await sharp(sourceSheet,{raw:{width:1280,height:1280,channels:4}}).extract({left:frame%4*320,top:Math.floor(frame/4)*320,width:320,height:320}).raw().toBuffer();
 const bowMask=bowForegroundMask(current,frame);
 const hair=new Uint8Array(320*320);
 const foreground=new Uint8Array(320*320);
 const mask=new Uint8Array(320*320);
 for(let y=236;y<285;y++)for(let x=104;x<217;x++){
  const pixel=y*320+x,offset=pixel*4;
  if(!current[offset+3])continue;
  const [red,green,blue]=current.subarray(offset,offset+3);
  hair[pixel]=blue>red+8&&blue>green+2?1:0;
  const greenCloth=green>red*1.04&&green>blue*1.04;
  foreground[pixel]=hair[pixel]||y<247?1:0;
  // The padded contour also crosses the old green hem in the source sheet.
  // Keep that garment out of the foreground bow layer.
  if(greenCloth)bowMask[pixel]=0;
 }
 const tipRepair=tipRepairs[frame];
 if(tipRepair)for(let pixel=0;pixel<320*320;pixel++)if(bowRepair.eraseMasks[frame][pixel*4+3]&&!bowRepair.handMasks[frame][pixel])bowMask[pixel]=0;
 for(let y=236;y<285;y++)for(let x=104;x<217;x++){
  const pixel=y*320+x;
  if(contains(x,y,polygon))mask[pixel]=1;
 }
 const result=Buffer.from(current);
 for(let pixel=0;pixel<320*320;pixel++){
  if(!mask[pixel])continue;
  result.fill(0,pixel*4,pixel*4+4);
  composite(result,legs,pixel);
 }
 for(let pixel=0;pixel<320*320;pixel++){
  composite(result,movingCape,pixel);
  if((foreground[pixel]||bowMask[pixel])&&current[pixel*4+3]&&(mask[pixel]||movingCape[pixel*4+3]))current.copy(result,pixel*4,pixel*4,pixel*4+4);
 }
 if(tipRepair){
  const tipLayer=tipLayers[frame];
  for(let pixel=0;pixel<320*320;pixel++){
   if(bowRepair.eraseMasks[frame][pixel*4+3]&&!bowRepair.handMasks[frame][pixel]){
    result.fill(0,pixel*4,pixel*4+4);
    composite(result,legs,pixel);
    composite(result,movingCape,pixel);
   }
   if(tipLayer[pixel*4+3]){
    composite(result,tipLayer,pixel);
    bowMask[pixel]=1;
   }
   if(bowRepair.handMasks[frame][pixel]&&current[pixel*4+3])current.copy(result,pixel*4,pixel*4,pixel*4+4);
  }
 }
 const maskPixels=Buffer.alloc(current.length);
 const bowMaskPixels=Buffer.alloc(current.length);
 let changed=0;
 for(let pixel=0;pixel<320*320;pixel++){
  if(mask[pixel]||movingCape[pixel*4+3]||tipLayers[frame]?.[pixel*4+3]||bowRepair.eraseMasks[frame]?.[pixel*4+3])maskPixels.fill(255,pixel*4,pixel*4+4);
  if(bowMask[pixel])bowMaskPixels.fill(255,pixel*4,pixel*4+4);
  if(!current.subarray(pixel*4,pixel*4+4).equals(result.subarray(pixel*4,pixel*4+4)))changed++;
 }
 await sharp(result,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(output,`frame-${String(frame).padStart(2,'0')}.png`));
 await sharp(maskPixels,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(output,`mask-${String(frame).padStart(2,'0')}.png`));
 await sharp(bowMaskPixels,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(output,`bow-mask-${String(frame).padStart(2,'0')}.png`));
 frames.push(result);
 bowMasks.push(bowMaskPixels);
 reports.push({frame,changed_pixels:changed,cape_rotation_degrees:capeAngles[frame]});
}
const sheet=Buffer.alloc(1280*1280*4);
const bowMaskSheet=Buffer.alloc(sheet.length);
for(let frame=0;frame<16;frame++)for(let y=0;y<320;y++){
 const destination=((Math.floor(frame/4)*320+y)*1280+frame%4*320)*4;
 frames[frame].copy(sheet,destination,y*320*4,(y+1)*320*4);
 bowMasks[frame].copy(bowMaskSheet,destination,y*320*4,(y+1)*320*4);
}
await sharp(sheet,{raw:{width:1280,height:1280,channels:4}}).png().toFile(path.join(output,'source-sheet.png'));
await sharp(bowMaskSheet,{raw:{width:1280,height:1280,channels:4}}).png().toFile(path.join(output,'bow-foreground-mask.png'));
const tiles=[];
for(const [column,frame] of [0,4,8,12,15].entries()){
 const image=await sharp(frames[frame],{raw:{width:320,height:320,channels:4}}).extract({left:110,top:220,width:110,height:80}).resize(330,240).png().toBuffer();
 tiles.push({input:image,left:column*330,top:0});
}
await sharp({create:{width:1650,height:240,channels:4,background:'#706a61'}}).composite(tiles).png().toFile(path.join(output,'after-cloth.png'));
await fs.writeFile(path.join(output,'qa.json'),JSON.stringify({cape:layerRoot+'/cloth-hem.png',cape_outline:capeOutline,source,reports},null,2)+'\n');
if(apply){
 const folder='asset/character/icon/layers/archer/back/attack/cape-consistent';
 await fs.mkdir(path.join(game,folder),{recursive:true});
 await fs.copyFile(path.join(output,'source-sheet.png'),path.join(game,folder,'source-sheet.png'));
 await fs.copyFile(path.join(output,'cape-reference.png'),path.join(game,folder,'cape-reference.png'));
 await fs.copyFile(path.join(output,'bow-foreground-mask.png'),path.join(game,folder,'bow-foreground-mask.png'));
 const metadataFile=path.join(root,'metadata/character/attack/archer-import.json');
 const metadata=JSON.parse(await fs.readFile(metadataFile,'utf8'));
 Object.assign(metadata.views.back,{source_sheet:folder+'/source-sheet.png',source_size:[1280,1280],uniform_scale:1,preserve_source_alpha:true,cape_assembly:'metadata/character/attack/archer-back-cape.json'});
 await fs.writeFile(metadataFile,JSON.stringify(metadata,null,2)+'\n');
 const assembly={id:'archer',direction:'back',frames:16,fps:16,base_source:source,cape:folder+'/cape-reference.png',original_cape:layerRoot+'/cloth-hem.png',cape_outline:capeOutline,legs_fill:layerRoot+'/legs.png',repair_polygon:polygon,composition:'native legs and complete cape occlude equal-length lower bow limbs',bow_foreground:{mask:folder+'/bow-foreground-mask.png',source:source,end_rows:bowEndRows,edge_padding_pixels:3,exclude_old_green_hem:true},bow_tip_repair:{configuration:tipConfiguration,mode:tipEdits.mode,frames:tipRepairs,measurements:bowRepair.reports},motion:{scale:[1,1],translation:[0,0],pivot:capePivot,amplitude_degrees:2,period_frames:16,rotation_degrees:capeAngles},prepared_sheet:folder+'/source-sheet.png'};
 await fs.writeFile(path.join(root,'metadata/character/attack/archer-back-cape.json'),JSON.stringify(assembly,null,2)+'\n');
}
console.log(output);
