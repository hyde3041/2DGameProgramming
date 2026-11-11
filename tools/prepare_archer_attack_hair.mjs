// Apply small painted hair-edge changes; never replace the original face.
import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const alignment=JSON.parse(await fs.readFile(path.join(root,'metadata/character/layers/archer.json'),'utf8'));
const atlasFile='asset/character/player/icon/layers/archer/attack/hair/source/edited-atlas.png';
const atlas=await sharp(path.join(game,atlasFile)).resize(1536,1024).ensureAlpha().raw().toBuffer();
const rects={front:[126,129],back:[106,128],side:[126,130]};
const protectedBoxes={front:[[136,135,30,39],[152,186,19,18],[177,187,20,18],[164,202,25,17]],back:[[156,131,23,30]],side:[[134,135,32,39],[173,184,27,21],[171,202,30,18]]};
const metadata={version:1,applied:true,frames:16,fps:16,pose_index:[0,0,0,1,1,1,1,1,2,2,2,2,1,1,0,0],source_originals_preserved:true,sources:'metadata/character/attack/archer-hair-sources.json',tail:{lag_frames:1.25,lag_strength:.7,parented_to_head:true,scale:[1,1]},views:{}};
function sample(u,v){const x=Math.floor(u),y=Math.floor(v),fx=u-x,fy=v-y;let alpha=0,rgb=[0,0,0];for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){if(x+xx<0||x+xx>=1536||y+yy<0||y+yy>=1024)continue;const k=((y+yy)*1536+x+xx)*4,a=atlas[k+3]/255*(xx?fx:1-fx)*(yy?fy:1-fy);alpha+=a;for(let c=0;c<3;c++)rgb[c]+=atlas[k+c]*a;}return alpha*255<24?[0,0,0,0]:rgb.map(v=>Math.round(v/alpha)).concat(Math.round(alpha*255));}
function blend(a,b,w){if(!w)return a;const aa=a[3]/255*(1-w),ba=b[3]/255*w,total=aa+ba;return total?[0,1,2].map(c=>Math.round((a[c]*aa+b[c]*ba)/total)).concat(Math.round(total*255)):[0,0,0,0];}
function removeLooseHairPixels(pixels,weights){const seen=new Uint8Array(102400);let removed=0;for(let n=0;n<102400;n++){if(seen[n]||pixels[n*4+3]<24)continue;const q=[n];seen[n]=1;for(let j=0;j<q.length;j++){const p=q[j],x=p%320,y=Math.floor(p/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,z=yy*320+xx;if(xx>=0&&xx<320&&yy>=0&&yy<320&&!seen[z]&&pixels[z*4+3]>=24){seen[z]=1;q.push(z);}}}if(q.length<=32)for(const p of q)if(weights[p]){pixels.fill(0,p*4,p*4+4);removed++;}}return removed;}
for(const [col,view]of['front','back','side'].entries()){
 const a=alignment.views.find(v=>v.direction===view),file=a.idle_groups.head,original=await sharp(path.join(game,file)).ensureAlpha().raw().toBuffer(),[rx,ry]=rects[view];
 const teal=new Uint8Array(102400),warm=new Uint8Array(102400),weights=new Uint8Array(102400),mask=Buffer.alloc(original.length),control=[];
 const inProtected=(x,y)=>protectedBoxes[view].some(([bx,by,w,h])=>x>=bx&&x<bx+w&&y>=by&&y<by+h);
 for(let n=0;n<102400;n++){const k=n*4,[r,g,b,alpha]=original.subarray(k,k+4);teal[n]=alpha>16&&g>=r+3&&b>=r+3?1:0;warm[n]=alpha>16&&r>55&&r>=g+5&&g>=b+2?1:0;if(alpha>180&&(warm[n]||inProtected(n%320,Math.floor(n/320))))control.push([n%320,Math.floor(n/320),k]);}
 for(let y=ry-3;y<ry+113;y++)for(let x=rx-3;x<rx+103;x++){
  if(inProtected(x,y))continue;const n=y*320+x,k=n*4;if(warm[n])continue;
  let nearHair=Infinity,boundary=Infinity,nearWarm=Infinity;
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=320||yy<0||yy>=320)continue;const q=yy*320+xx,d=dx*dx+dy*dy;if(teal[q])nearHair=Math.min(nearHair,d);if(warm[q])nearWarm=Math.min(nearWarm,d);if(original[q*4+3]<16||warm[q])boundary=Math.min(boundary,d);}
  if(nearHair>9||!teal[n]&&original[k+3]>16&&nearWarm<=4)continue;
  const weight=Math.round(Math.max(0,Math.min(1,(5-Math.sqrt(boundary))/2))*255);if(!weight)continue;weights[n]=weight;mask.fill(255,k,k+3);mask[k+3]=weight;
 }
 // The old front side-lock leaves a narrow detached outline when it bends.
 // Repaint that small hair-edge footprint too, without touching the face.
 const edgeCleanupRegions=view==='front'?[[203,200,10,12]]:[];
 for(const[bx,by,w,h]of edgeCleanupRegions)for(let y=by;y<by+h;y++)for(let x=bx;x<bx+w;x++){const n=y*320+x,k=n*4;if(warm[n]||inProtected(x,y))continue;weights[n]=255;mask.fill(255,k,k+4);}
 const folder=`asset/character/player/icon/layers/archer/${view}/attack/hair`;await fs.mkdir(path.join(game,folder),{recursive:true});await sharp(mask,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,folder,'edit-mask.png'));
 const poses=[];
 for(let row=0;row<2;row++){
  const at=(x,y,dx,dy)=>sample(col*512+56+(x-rx+.5-dx)*4-.5,row*512+36+(y-ry+.5-dy)*4-.5);let best={dx:0,dy:0,score:Infinity};
  for(let dy=-2;dy<=2;dy+=.25)for(let dx=-2;dx<=2;dx+=.25){let score=0;for(const[x,y,k]of control){const q=at(x,y,dx,dy);for(let c=0;c<3;c++)score+=Math.abs(original[k+c]*original[k+3]/255-q[c]*q[3]/255);score+=Math.abs(original[k+3]-q[3])*1.5;}score/=control.length;if(score<best.score)best={dx,dy,score};}
  const result=Buffer.from(original);let changed=0;
  for(let n=0;n<102400;n++){if(!weights[n])continue;const k=n*4,q=at(n%320,Math.floor(n/320),best.dx,best.dy);if(original[k+3]<16&&q[0]>q[1]+5&&q[1]>q[2]+3&&q[0]>80)continue;const pixel=blend(Array.from(original.subarray(k,k+4)),q,weights[n]/255);for(let c=0;c<4;c++)result[k+c]=pixel[c];if(!result.subarray(k,k+4).equals(original.subarray(k,k+4)))changed++;}
  const removedLoosePixels=removeLooseHairPixels(result,weights);changed=0;for(let n=0;n<102400;n++)if(!result.subarray(n*4,n*4+4).equals(original.subarray(n*4,n*4+4)))changed++;
  const output=`${folder}/head-${row+1}.png`;await sharp(result,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,output));poses.push({index:row+1,file:output,registration:best,changed_pixels:changed,removed_loose_pixels:removedLoosePixels});
 }
 metadata.views[view]={original:file,mask:`${folder}/edit-mask.png`,protected_boxes:protectedBoxes[view],edge_cleanup_regions:edgeCleanupRegions,poses};console.log(JSON.stringify({view,poses}));
}
await fs.writeFile(path.join(root,'metadata/character/attack/archer-hair-motion.json'),JSON.stringify(metadata,null,2)+'\n');
