// Register painted upper-body frames by their garment neckline, not whole-image bounds.
import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),view=process.argv[2],source=process.argv[3];
if(!['front','back','side'].includes(view)||!source)throw Error('Usage: node tools/prepare_archer_attack_v2.mjs <front|back|side> <painted-atlas.png>');
const dir=path.join(root,`game/asset/character/player/icon/layers/archer/${view}/attack/source-v2`);await fs.mkdir(dir,{recursive:true});await fs.copyFile(source,path.join(dir,'upper-body-atlas.png'));
const {width:W,height:H}=await sharp(source).metadata(),frames=[];
for(let f=0;f<16;f++){
 const col=f%4,row=Math.floor(f/4),box={left:Math.floor(col*W/4),top:Math.floor(row*H/4),width:Math.floor((col+1)*W/4)-Math.floor(col*W/4),height:Math.floor((row+1)*H/4)-Math.floor(row*H/4)};
 const {data,info}=await sharp(source).extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});const green=[];
 for(let y=0;y<info.height;y++)for(let x=Math.floor(info.width*.27);x<info.width*.63;x++){const k=(y*info.width+x)*4,[r,g,b,a]=data.subarray(k,k+4);if(a>160&&g>r*.99&&g>b*1.1&&g<180&&g>35)green.push([x,y]);}
 if(green.length<20)throw Error('Cannot identify neckline '+view+' '+f);green.sort((a,b)=>a[1]-b[1]);const band=green.filter(p=>p[1]<green[Math.floor(green.length*.015)][1]+5);
 const guess=[band.reduce((s,p)=>s+p[0],0)/band.length+(view==='back'?0:20),band.reduce((s,p)=>s+p[1],0)/band.length-1];
 // Discard near-transparent generation haze while retaining antialiased contours.
 for(let k=3;k<data.length;k+=4)if(data[k]<12)data[k]=0;
 const name=`upper-body-${String(f).padStart(2,'0')}.png`;await sharp(data,{raw:info}).png().toFile(path.join(dir,name));
 frames.push({index:f,file:`asset/character/player/icon/layers/archer/${view}/attack/source-v2/${name}`,source_neck:guess,source_cell:box});
}
const metadata=path.join(root,'metadata/character/attack/archer-v2-sources.json');let config={version:2,description:'Connected hand-painted torso/arms/bow poses; original head, hair, legs and gear remain separate.',views:{}};
try{config=JSON.parse(await fs.readFile(metadata,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
config.views[view]={atlas:`asset/character/player/icon/layers/archer/${view}/attack/source-v2/upper-body-atlas.png`,scale:.44,target_neck:{front:[169,207],back:[155,207],side:[175,207]}[view],frames};
await fs.writeFile(metadata,JSON.stringify(config,null,2)+'\n');console.log(view+': prepared 16 connected poses');
