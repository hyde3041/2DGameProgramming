// Prepare ONE set of limb textures per camera. All subsequent poses reuse it.
import fs from'node:fs/promises';import path from'node:path';import crypto from'node:crypto';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const refs=JSON.parse(await fs.readFile(path.join(root,'metadata/character/layers/reference-alignment.json'),'utf8')).characters.archer;
const align=JSON.parse(await fs.readFile(path.join(root,'metadata/character/layers/archer.json'),'utf8'));
const inside=(x,y,p)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const settings={
 front:{bowShoulder:[176,226],pullShoulder:[140,222],restGrip:[194,248],aimGrip:[211,220],restPull:[150,238],aimPull:[163,216],bowBranch:-1,pullBranch:-1,bowAngle:-25,tips:[[220,182],[162,277]],armMasks:[[[135,220],[144,220],[155,230],[162,237],[155,245],[142,243],[133,234]],[[172,222],[184,223],[192,233],[202,241],[203,253],[191,258],[180,248],[173,235]]],torso:[[143,208],[176,210],[190,232],[196,263],[170,276],[123,271],[132,246]]},
 side:{bowShoulder:[178,228],pullShoulder:[145,223],restGrip:[192,249],aimGrip:[213,220],restPull:[157,239],aimPull:[171,216],bowBranch:-1,pullBranch:-1,bowAngle:-20,tips:[[212,181],[163,276]],armMasks:[[[138,220],[149,219],[162,229],[169,240],[160,247],[148,241],[140,234]],[[174,224],[185,223],[195,235],[201,248],[196,257],[184,250],[176,240]]],torso:[[148,207],[177,211],[190,232],[196,263],[165,276],[126,270],[138,243]]},
 back:{bowShoulder:[139,223],pullShoulder:[180,228],restGrip:[125,253],aimGrip:[106,221],restPull:[184,244],aimPull:[164,216],bowBranch:1,pullBranch:1,bowAngle:20,tips:[[108,204],[148,271]],armMasks:[[[134,220],[144,219],[144,233],[136,246],[130,257],[120,259],[117,248],[125,234]],[[174,223],[184,223],[191,234],[190,247],[180,251],[173,242]]],torso:[[139,208],[178,208],[188,237],[199,268],[157,277],[126,270],[134,242]]}
};
const meta={id:'archer',version:4,cell_size:[320,320],frames:16,fps:16,duration_ms:1000,release_frame:7,workflow:'one fixed upper-arm, forearm, hand and bow texture per direction; translation and rotation only',views:{}};
const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage();await page.setContent('<canvas id="c" width="64" height="64"></canvas>');
 for(const view of['front','back','side']){
  const r={...settings[view],bowBranch:view==='back'?-1:1,pullBranch:view==='back'?-1:1},a=align.views.find(v=>v.direction===view),folder=`asset/character/icon/layers/archer/${view}/attack/rigid`,dir=path.join(game,folder);await fs.mkdir(dir,{recursive:true});
  const parts={},calibration={};
  const atlas=path.join(dir,'limb-atlas.png'),atlasInfo=await sharp(atlas).metadata();
  for(const[index,name]of['bow-upper','pull-upper','bow-forearm','pull-forearm','bow-hand','pull-hand'].entries()){
   const cell={left:Math.floor(index%2*atlasInfo.width/2),top:Math.floor(Math.floor(index/2)*atlasInfo.height/3),width:Math.floor(atlasInfo.width/2),height:Math.floor(atlasInfo.height/3)};
   const{data,info}=await sharp(atlas).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});let minx=info.width,miny=info.height,maxx=0,maxy=0;
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const p=(y*info.width+x)*4;if(data[p+3]<16)data.fill(0,p,p+4);if(data[p+3]>180){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}}
   const w=maxx-minx+1,h=maxy-miny+1,isHand=name.endsWith('hand'),length=isHand?7:name.endsWith('upper')?17:19;
   const cy=(miny+maxy)/2,reverse=isHand&&view==='back',start=[reverse?maxx-w*.1:minx+w*(isHand?.1:.05),cy],end=[reverse?minx+w*.22:maxx-w*(isHand?.22:.05),cy];
   const png=await sharp(data,{raw:info}).png().toBuffer(),url='data:image/png;base64,'+png.toString('base64');
   const baked=await page.evaluate(async({url,start,end,length})=>{const im=new Image;im.src=url;await im.decode();const ctx=c.getContext('2d');ctx.clearRect(0,0,64,64);ctx.save();ctx.translate(16,32);ctx.rotate(-Math.atan2(end[1]-start[1],end[0]-start[0]));const s=length/Math.hypot(end[0]-start[0],end[1]-start[1]);ctx.scale(s,s);ctx.drawImage(im,-start[0],-start[1]);ctx.restore();return c.toDataURL();},{url,start,end,length});
   const file=`${folder}/${name}.png`;await fs.writeFile(path.join(game,file),Buffer.from(baked.split(',')[1],'base64'));parts[name]=file;calibration[name]={start:[16,32],end:[16+length,32],length,source_cell:cell,source_start:start,source_end:end,source_scale_once:length/Math.hypot(end[0]-start[0],end[1]-start[1])};
  }
  const original=await sharp(path.join(game,`asset/character/main/2-archer/${view}/idle-sheet.png`)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
  const get=async name=>await sharp(path.join(game,a.idle_groups[name])).ensureAlpha().raw().toBuffer();
  const head=await get('head'),hair=await get('hair-tail'),weapon=await get('weapon'),left=await get('arm-left'),right=await get('arm-right');
  const hiddenBody=await sharp(path.join(game,`asset/character/icon/layers/archer/${view}/redrawn/source/body.png`)).resize(refs[view].body_box[2],refs[view].body_box[3],{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const legBox=[refs[view].waist[0]-30,245,60,45],hiddenLegs=await sharp(path.join(game,`asset/character/icon/layers/archer/${view}/redrawn/source/legs.png`)).resize(60,45,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const base=Buffer.from(original),under=Buffer.alloc(original.length);let removed=0;
  for(let y=0;y<320;y++)for(let x=0;x<320;x++){
   const p=(y*320+x)*4;
   if(head[p+3]||hair[p+3]){base.fill(0,p,p+4);continue;}
   const green=original[p]>20&&original[p+1]>original[p]*.98&&original[p+1]>original[p+2]*1.08,white=Math.min(...original.subarray(p,p+3))>150&&original[p]<original[p+1]*1.045&&original[p+1]<original[p+2]*1.15;
   const oldArm=!green&&!white&&r.armMasks.some(poly=>inside(x+.5,y+.5,poly));
   const oldString=view==='side'&&x>=188&&x<215&&y>=178&&y<218;
   if(weapon[p+3]&&!green&&!white||oldArm||oldString){
    if(base[p+3])removed++;base.fill(0,p,p+4);
    const[bx,by,bw,bh]=refs[view].body_box;
    if(x>=bx&&x<bx+bw&&y>=by&&y<by+bh&&inside(x+.5,y+.5,r.torso)){const q=((y-by)*bw+x-bx)*4;hiddenBody.copy(under,p,q,q+4);}
    const[lx,ly,lw,lh]=legBox;if(x>=lx&&x<lx+lw&&y>=ly&&y<ly+lh){const q=((y-ly)*lw+x-lx)*4;if(hiddenLegs[q+3]>16)hiddenLegs.copy(under,p,q,q+4);}
   }
  }
  // Preserve original garment pixels. Use the existing complete body only
  // beneath the places previously occluded by an arm or weapon.
  const bodyBox={front:[126,207,83,71],back:[120,205,80,73],side:[131,207,76,71]}[view];
  const cleanBody=await sharp(path.join(game,`asset/character/icon/layers/archer/${view}/redrawn/source/body.png`)).resize(bodyBox[2],bodyBox[3],{fit:'fill'}).png().toBuffer();
  const legPlate=Buffer.alloc(original.length),visibleLegs=await get('legs');
  for(let y=245;y<290;y++)for(let x=legBox[0];x<legBox[0]+60;x++){const p=(y*320+x)*4,q=((y-245)*60+x-legBox[0])*4;hiddenLegs.copy(legPlate,p,q,q+4);}
  for(let y=270;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;if(visibleLegs[p+3])original.copy(legPlate,p,p,p+4);}
  const completion=await sharp(legPlate,{raw:{width:320,height:320,channels:4}}).composite([{input:cleanBody,left:bodyBox[0],top:bodyBox[1]}]).ensureAlpha().raw().toBuffer();
  for(let y=0;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;if(!base[p+3]&&original[p+3]&&!head[p+3]&&!hair[p+3]&&(inside(x+.5,y+.5,r.torso)||y>=250)&&completion[p+3])completion.copy(under,p,p,p+4);}
  // Underplate is exposed only where the original arm or bow occluded cloth.
  for(const[n,data]of Object.entries({base,under,head,hair})){const file=`${folder}/${n}.png`;await sharp(data,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,file));parts[n]=file;}
  // Complete the small wood handle hidden by the original hand. It is one
  // fixed underlap, sampled from existing wood, not a different bow per pose.
  const wood=await sharp(path.join(game,'asset/character/icon/layers/archer/front/attack/source/bow-original.png')).ensureAlpha().raw().toBuffer();
  const aa=[203,240],bb=[196,254],dx=bb[0]-aa[0],dy=bb[1]-aa[1],den=dx*dx+dy*dy;
  for(let y=237;y<258;y++)for(let x=191;x<208;x++){const t=Math.max(0,Math.min(1,((x-aa[0])*dx+(y-aa[1])*dy)/den)),distance=Math.hypot(x-aa[0]-dx*t,y-aa[1]-dy*t),p=(y*320+x)*4;if(distance<2.3&&wood[p+3]<240){const q=(237*320+205)*4;for(let c=0;c<3;c++)wood[p+c]=wood[q+c];wood[p+3]=Math.round(Math.min(1,(2.3-distance)*1.5)*255);}}
  const bowFile=`${folder}/bow.png`;let bowImage=sharp(wood,{raw:{width:320,height:320,channels:4}});if(view==='back')bowImage=bowImage.flop();await bowImage.png().toFile(path.join(game,bowFile));parts.bow=bowFile;
  const arrow=await sharp(path.join(game,'asset/character/icon/layers/archer/front/attack/source/arrow.png')).resize({width:56}).png().toBuffer(),arrowFile=`${folder}/arrow.png`;await fs.writeFile(path.join(game,arrowFile),arrow);parts.arrow=arrowFile;
  const hashes={};for(const[n,file]of Object.entries(parts))hashes[n]=crypto.createHash('sha256').update(await fs.readFile(path.join(game,file))).digest('hex');
  meta.views[view]={...r,parts,calibration,hashes,removed_old_limb_pixels:removed,arm_lengths:[17,19],hand_length:7,bowPivot:view==='back'?[120,249]:[199,249],tips:view==='back'?[[99,182],[157,277]]:[[220,182],[162,277]],headPivot:a.pivots.head,hairPivot:a.pivots.hair,source_atlas:`${folder}/limb-atlas.png`,shared_limb_art:view==='side'?'front':view};
 }
}finally{await browser.close();}
await fs.writeFile(path.join(root,'metadata/character/attack/archer-rigid-rig.json'),JSON.stringify(meta,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(meta.views).map(([v,r])=>[v,{parts:Object.keys(r.parts),lengths:r.arm_lengths,hand:r.hand_length}]))));
