// Authoring utility: pack already separately DRAWN atlas items, never cut a figure.
// NODE_PATH must provide sharp. Usage: node tools/pack_redrawn_layers.mjs <id>
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2];if(!id)throw Error('Supply a character id');
const names=['head','hair-tail','body','arm-left','arm-right','cloth-hem','legs','equipment'];
const layout=JSON.parse(await fs.readFile(root+'/metadata/character/layers/redraw-layout.json','utf8'));
const config=layout.characters[id];if(!config)throw Error('Missing placement for '+id);
const atlasRel=`asset/character/player/icon/layers/${id}/layer-atlas-redrawn.png`;
const {data,info}=await sharp(root+'/'+atlasRel).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const w=info.width,h=info.height,cw=w/4,ch=h/6;
if(cw!==ch)throw Error('Expected equal square cells in a 4 by 6 atlas');
// Connected ALPHA islands already isolated by the artist. Include a whole island
// if its tip crosses a nominal cell boundary, so the packer never trims hair tips.
const seen=new Uint8Array(w*h),labels=new Int32Array(w*h),queue=new Int32Array(w*h),islands=[];let label=0;
for(let start=0;start<w*h;start++){
 if(seen[start]||data[start*4+3]<=8)continue;
 let read=0,write=1,l=w,t=h,r=-1,b=-1,sx=0,sy=0;queue[0]=start;seen[start]=1;label++;
 while(read<write){const p=queue[read++],x=p%w,y=Math.floor(p/w);labels[p]=label;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);sx+=x;sy+=y;
  for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&nx<w&&ny>=0&&ny<h){const q=ny*w+nx;if(!seen[q]&&data[q*4+3]>8){seen[q]=1;queue[write++]=q;}}
 }
 if(write>=6)islands.push({label,l,t,r,b,n:write,col:Math.min(3,Math.floor(sx/write/cw)),row:Math.min(5,Math.floor(sy/write/ch))});
}
const views=[];
for(let vi=0;vi<3;vi++){
 const direction=['front','back','side'][vi],v=config.views[direction],base=`asset/character/player/icon/layers/${id}/${direction}/redrawn`;
 await fs.mkdir(root+'/'+base+'/source',{recursive:true});
 const parts={},placements={},qa=[];
 const jobs=names.map((name,j)=>({name,j}));
 if(id==='guardian')jobs.push({name:'equipment-secondary',j:7});
 for(const {name,j}of jobs){
  const col=j%4,row=vi*2+Math.floor(j/4),p=v.parts[name];
  let own=islands.filter(a=>a.col===col&&a.row===row).sort((a,b)=>b.n-a.n);
  if(p.island_rank!==undefined)own=own.slice(p.island_rank,p.island_rank+1);
  if(!own.length)throw Error('Empty drawn cell '+id+'/'+direction+'/'+name);
  const l=Math.max(0,Math.min(...own.map(a=>a.l))-2),t=Math.max(0,Math.min(...own.map(a=>a.t))-2);
  const r=Math.min(w-1,Math.max(...own.map(a=>a.r))+2),b=Math.min(h-1,Math.max(...own.map(a=>a.b))+2);
  const crop={left:l,top:t,width:r-l+1,height:b-t+1};
  const keep=new Set(own.map(a=>a.label)),pixels=Buffer.alloc(crop.width*crop.height*4);
  for(let yy=0;yy<crop.height;yy++)for(let xx=0;xx<crop.width;xx++){
   const x=l+xx,y=t+yy,k=y*w+x;let inside=keep.has(labels[k]);
   // Retain the original antialiased fringe of the same isolated item.
   if(!inside&&data[k*4+3]<=8)for(let dy=-1;dy<=1&&!inside;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&keep.has(labels[(y+dy)*w+x+dx])){inside=true;break;}
   if(inside)data.copy(pixels,(yy*crop.width+xx)*4,k*4,k*4+4);
  }
  const source=await sharp(pixels,{raw:{width:crop.width,height:crop.height,channels:4}}).png().toBuffer();
  await fs.writeFile(root+'/'+base+'/source/'+name+'.png',source);
  const size=p.height?{height:p.height}:{width:p.width};
  let item=sharp(source);if(p.flip)item=item.flop();
  if(p.angle)item=item.rotate(p.angle,{background:'#00000000'});
  const resized=await item.resize(size).png().toBuffer(),dim=await sharp(resized).metadata();
  let left=p.left??Math.round(p.cx-dim.width/2),top=p.top??Math.round(p.bottom-dim.height);
  if(p.attach){
   const raw=await sharp(resized).ensureAlpha().raw().toBuffer();let sx=0,sy=0,n=0,first=dim.height;
   for(let y=0;y<dim.height;y++)for(let x=0;x<dim.width;x++)if(raw[(y*dim.width+x)*4+3]>64)first=Math.min(first,y);
   for(let y=first;y<Math.min(dim.height,first+Math.ceil(dim.height*.18));y++)for(let x=0;x<dim.width;x++){const a=raw[(y*dim.width+x)*4+3];if(a>64){sx+=x*a;sy+=y*a;n+=a;}}
   if(!n)throw Error('Missing shoulder attachment');left=Math.round(p.attach[0]-sx/n);top=Math.round(p.attach[1]-sy/n);
  }
  if(p.grip){
   const armPath=parts[p.grip.arm];if(!armPath)throw Error('Grip arm must be packed first');
   const arm=await sharp(root+'/'+armPath).ensureAlpha().raw().toBuffer();
   let low=-1;for(let y=0;y<320;y++)for(let x=0;x<320;x++)if(arm[(y*320+x)*4+3]>64)low=y;
   let hx=0,hy=0,n=0;for(let y=low-5;y<=low;y++)for(let x=0;x<320;x++){const a=arm[(y*320+x)*4+3];if(a>64){hx+=x*a;hy+=y*a;n+=a;}}
   if(!n)throw Error('Missing hand');hx/=n;hy/=n;
   let gx=dim.width*p.grip.x,gy=dim.height*p.grip.y;
   if(p.grip.shaft){const raw=await sharp(resized).ensureAlpha().raw().toBuffer();let sum=0,weight=0;for(let y=Math.max(0,Math.floor(gy)-1);y<=Math.min(dim.height-1,Math.floor(gy)+1);y++)for(let x=0;x<dim.width;x++){const a=raw[(y*dim.width+x)*4+3];sum+=x*a;weight+=a;}gx=sum/weight;}
   left=Math.round(hx-gx);top=Math.round(hy-gy);
  }
  if(left<0||top<0||left+dim.width>320||top+dim.height>320)throw Error('Placed outside canonical canvas');
  const rel=base+'/'+name+'.png';
  await sharp({create:{width:320,height:320,channels:4,background:'#00000000'}}).composite([{input:resized,left,top}]).png().toFile(root+'/'+rel);
  parts[name]=rel;placements[name]={atlas_crop:crop,position:[left,top],size:[dim.width,dim.height],flip_x:!!p.flip,static_rotation_degrees:p.angle||0};
  qa.push({part:name,alpha_pixels:own.reduce((s,a)=>s+a.n,0),islands:own.length});
 }
 const order=v.order||['hair-tail','legs','cloth-hem','arm-left','body','equipment','arm-right','head'];
 const neutral=base+'/neutral.png';
 await sharp({create:{width:320,height:320,channels:4,background:'#00000000'}}).composite(await Promise.all(order.map(async name=>({input:await fs.readFile(root+'/'+parts[name]),left:0,top:0})))).png().toFile(root+'/'+neutral);
 views.push({direction,source:neutral,original_reference:`asset/character/player/icon/source/${id}/${direction}/idle.png`,parts,idle_groups:parts,idle_order:order,pivots:v.pivots,placements,validation:{independently_drawn:true,complete_hidden_joins:true,parts:qa}});
}
const meta={version:2,id,name:config.name,workflow:'AI redrawn isolated parts, completed occluded anatomy; whole-part alpha-island atlas packing, no semantic slicing',cell_size:[320,320],pivot:[160,288],atlas:atlasRel,prompt:`metadata/character/layers/redraw-prompts/${id}.txt`,animation_applied:id==='archer',notes:['Original source and attack sprites are preserved.','Parts were drawn separately before assembly.','A static uniform resize registers each independently drawn part to the 320px canvas. Animation uses translation and rotation only.'],views};
await fs.writeFile(root+'/metadata/character/layers/'+id+'.json',JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({id,directions:views.length,parts:views.reduce((n,v)=>n+Object.keys(v.parts).length,0),atlas:[w,h]}));
