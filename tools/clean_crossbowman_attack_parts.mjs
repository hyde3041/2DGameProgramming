// Attack-only underlayers: remove old coat/scarf fragments from the legacy leg
// mask and old shirt-collar fragments from the head. Original Idle files stay intact.
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'game/asset/character/icon/layers/crossbowman/attack');await fs.mkdir(destination,{recursive:true});
function feet(data,w,h){let bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>64)bottom=y;const sums=[[0,0],[0,0]];for(let y=bottom-3;y<=bottom;y++)for(let x=0;x<w;x++){const alpha=data[(y*w+x)*4+3];if(alpha>64){const s=sums[x<w/2?0:1];s[0]+=x*alpha;s[1]+=alpha;}}return{bottom,x:sums.map(s=>s[0]/s[1])};}
const report=[];
for(const view of['front','back','side']){
 const base=path.join(root,`game/asset/character/icon/layers/crossbowman/${view}`),original=await sharp(base+'/aligned/visible/legs.png').ensureAlpha().raw().toBuffer(),sourcePath=base+'/redrawn/source/legs.png';
 const{data,info}=await sharp(sourcePath).ensureAlpha().raw().toBuffer({resolveWithObject:true}),from=feet(data,info.width,info.height),to=feet(original,320,320);
 let sourceTop=info.height;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>64)sourceTop=Math.min(sourceTop,y);
 const waist={front:[163,241],back:[163,243],side:[170,241]}[view],fits=[];
 const url='data:image/png;base64,'+(await fs.readFile(sourcePath)).toString('base64');let svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><defs>';
 for(let leg=0;leg<2;leg++)svg+=`<clipPath id="leg${leg}"><rect x="${leg*info.width/2}" y="0" width="${info.width/2}" height="${info.height}"/></clipPath>`;
 svg+='</defs>';for(let leg=0;leg<2;leg++){
  let sx=0,sy=0,n=0;for(let y=sourceTop;y<sourceTop+12;y++)for(let x=Math.floor(leg*info.width/2);x<(leg+1)*info.width/2;x++){const alpha=data[(y*info.width+x)*4+3];if(alpha>64){sx+=x*alpha;sy+=y*alpha;n+=alpha;}}sx/=n;sy/=n;
  const hip=[waist[0]+(leg?10:-10),waist[1]+4],dx=from.x[leg]-sx,dy=from.bottom-sy,tx=to.x[leg]-hip[0],ty=to.bottom-hip[1],den=dx*dx+dy*dy,a=(tx*dx+ty*dy)/den,b=(ty*dx-tx*dy)/den,px=hip[0]-a*sx+b*sy,py=hip[1]-b*sx-a*sy;
  svg+=`<g transform="matrix(${a} ${b} ${-b} ${a} ${px} ${py})"><image href="${url}" width="${info.width}" height="${info.height}" clip-path="url(#leg${leg})"/></g>`;fits.push({hip,sole:[to.x[leg],to.bottom],scale:Math.hypot(a,b)});
 }svg+='</svg>';
 const legs=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
 // The visible boots retain original RGBA and their exact ground contacts.
 for(let y=273;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;legs.fill(0,p,p+4);if(to.x.some(c=>Math.abs(x-c)<17)&&original[p+3])original.copy(legs,p,p,p+4);}
 await sharp(legs,{raw:{width:320,height:320,channels:4}}).png().toFile(destination+`/legs-${view}.png`);
 const originalHead=await sharp(base+'/aligned/visible/head.png').ensureAlpha().raw().toBuffer(),head=Buffer.from(originalHead);let removed=0;
 for(let y=view==='back'?200:202;y<217;y++)for(let x=130;x<(view==='front'?171:175);x++){
  const p=(y*320+x)*4;if(!head[p+3]||Math.max(...head.subarray(p,p+3))>=80)continue;let nearHead=false;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const q=((y+dy)*320+x+dx)*4,[r,g,b,a]=originalHead.subarray(q,q+4);if(a>160&&(Math.min(r,g,b)>95||r>160&&g>110&&b>90))nearHead=true;}
  if(!nearHead){head[p+3]=0;removed++;}
 }
 for(let p=0;p<head.length;p+=4){if(p<(view==='back'?200:202)*320*4||Math.min(...originalHead.subarray(p,p+3))>95||originalHead[p]>160&&originalHead[p+1]>110&&originalHead[p+2]>90)if(!head.subarray(p,p+4).equals(originalHead.subarray(p,p+4)))throw Error('Face/hair changed');}
 await sharp(head,{raw:{width:320,height:320,channels:4}}).png().toFile(destination+`/head-${view}.png`);report.push({view,feet:to,leg_fits:fits,removed_shirt_collar_pixels:removed,face_hair_pixels_preserved:true});
}
await fs.writeFile(path.join(root,'metadata/character/attack/crossbowman-underlayers.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
