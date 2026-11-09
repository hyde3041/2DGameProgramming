// Fit connected torso drawings uniformly around the original waist; head/feet stay fixed.
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const view=process.argv[2],source=process.argv[3];if(!['front','back','side'].includes(view)||!source)throw Error('Usage: <front|back|side> <painted-atlas.png>');
const dir=path.join(root,`game/asset/character/icon/layers/crossbowman/${view}/attack/source-v2`);await fs.mkdir(dir,{recursive:true});await fs.copyFile(source,path.join(dir,'upper-body-atlas.png'));
function scarfAnchor(data,w,h,original=false){
 const points=[];for(let y=original?205:0;y<(original?250:h);y++)for(let x=Math.floor(w*(original?.38:.20));x<w*(original?.68:.72);x++){const p=(y*w+x)*4,[r,g,b,a]=data.subarray(p,p+4);if(a>180&&r>155&&g>65&&g<190&&b<95&&r>g*1.3&&g>b*1.55)points.push([x,y]);}
 if(points.length<12)throw Error('Orange scarf registration missing');points.sort((a,b)=>a[1]-b[1]);const top=points[Math.floor(points.length*.02)][1],band=points.filter(p=>p[1]>=top&&p[1]<top+(original?4:8));return[band.reduce((s,p)=>s+p[0],0)/band.length,band.reduce((s,p)=>s+p[1],0)/band.length];
}
const original=await sharp(path.join(root,`game/asset/character/icon/source/crossbowman/${view}/idle.png`)).ensureAlpha().raw().toBuffer();const target=scarfAnchor(original,320,320,true);
function collarAnchor(data,w,h){const ps=[];for(let y=0;y<h;y++)for(let x=Math.floor(w*.25);x<w*.65;x++){const k=(y*w+x)*4;if(data[k+3]>220&&data[k]<100&&data[k+1]<100&&data[k+2]<100)ps.push([x,y]);}ps.sort((a,b)=>a[1]-b[1]);const top=ps[Math.floor(ps.length*.005)][1],band=ps.filter(p=>p[1]>=top&&p[1]<top+5);return[band.reduce((s,p)=>s+p[0],0)/band.length,band.reduce((s,p)=>s+p[1],0)/band.length];}
function cleanAlphaIslands(data,w,h){const seen=new Uint8Array(w*h);for(let p=3;p<data.length;p+=4)if(data[p]<24)data[p]=0;for(let p=0;p<w*h;p++){if(seen[p]||data[p*4+3]<24)continue;const q=[p];seen[p]=1;for(let n=0;n<q.length;n++){const k=q[n],x=k%w,y=Math.floor(k/w);for(const[xx,yy]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx>=0&&xx<w&&yy>=0&&yy<h){const j=yy*w+xx;if(!seen[j]&&data[j*4+3]>=24){seen[j]=1;q.push(j);}}}if(q.length<64)for(const j of q)data[j*4+3]=0;}}
const{width:W,height:H}=await sharp(source).metadata(),frames=[];
for(let f=0;f<16;f++){
 const c=f%4,r=Math.floor(f/4),box={left:Math.floor(c*W/4),top:Math.floor(r*H/4),width:Math.floor((c+1)*W/4)-Math.floor(c*W/4),height:Math.floor((r+1)*H/4)-Math.floor(r*H/4)};
 const{data,info}=await sharp(source).extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});cleanAlphaIslands(data,info.width,info.height);const anchor=collarAnchor(data,info.width,info.height);
 const name=`upper-body-${String(f).padStart(2,'0')}.png`;await sharp(data,{raw:info}).png().toFile(path.join(dir,name));frames.push({index:f,file:`asset/character/icon/layers/crossbowman/${view}/attack/source-v2/${name}`,source_neck:anchor,source_cell:box});
}
const metadata=path.join(root,'metadata/character/attack/crossbowman-v2-sources.json');let config={version:2,description:'Connected torso, arms, crossbow and scarf drawings; original head and legs.',registration:'Original orange scarf attachment',views:{}};
try{config=JSON.parse(await fs.readFile(metadata,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
config.registration='Uniform body fit around the original waist; original head and foot coordinates stay fixed';
const sourceWaist={front:[132,180],back:[162,188],side:[151,185]}[view],targetWaist={front:[163,241],back:[163,243],side:[170,241]}[view],scale=.50;
const targetNeck=sourceWaist.map((value,axis)=>targetWaist[axis]+scale*(frames[6].source_neck[axis]-value));
const shotFrame=await sharp(path.join(dir,'upper-body-07.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});let tipX=0;
for(let y=Math.floor(frames[7].source_neck[1]+15);y<frames[7].source_neck[1]+65;y++)for(let x=0;x<shotFrame.info.width;x++)if(shotFrame.data[(y*shotFrame.info.width+x)*4+3]>180)tipX=Math.max(tipX,x);
let tipY0=shotFrame.info.height,tipY1=0;for(let y=Math.floor(frames[7].source_neck[1]+15);y<frames[7].source_neck[1]+65;y++)for(let x=tipX-2;x<=tipX;x++)if(shotFrame.data[(y*shotFrame.info.width+x)*4+3]>180){tipY0=Math.min(tipY0,y);tipY1=Math.max(tipY1,y);}
config.views[view]={atlas:`asset/character/icon/layers/crossbowman/${view}/attack/source-v2/upper-body-atlas.png`,scale,target_neck:targetNeck,source_muzzle:[tipX,(tipY0+tipY1)/2],waist_registration:{source_frame6:sourceWaist,target_original:targetWaist},original_scarf_anchor:target,frames};await fs.writeFile(metadata,JSON.stringify(config,null,2)+'\n');console.log(JSON.stringify({view,scale,target_neck:targetNeck}));
