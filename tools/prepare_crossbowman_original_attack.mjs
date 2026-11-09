// Partition the existing Idle pixels. No generated or resized body artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), game=path.join(root,'game');
const inside=(x,y,p)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const configs={
 front:{pivot:[136,216],support:[181,226],elbow:[185,245],muzzle:[209,261],angle:-27,
  masks:[[[124,211],[140,211],[143,223],[153,229],[163,239],[158,248],[143,250],[127,242],[120,234],[122,223]],[[173,222],[183,222],[191,233],[196,253],[193,264],[181,257],[176,240]],[[141,232],[157,231],[177,238],[197,247],[212,256],[218,265],[214,273],[202,273],[185,265],[173,260],[151,248],[140,243]]],
  torso:[[144,217],[171,218],[184,233],[190,258],[155,267],[132,260],[144,244]],
  connector:[[173,222],[182,222],[189,230],[191,245],[183,248],[176,237]]},
 back:{pivot:[180,216],support:[142,223],elbow:[145,238],muzzle:[212,207],angle:0,
  masks:[[[174,211],[186,212],[194,221],[198,235],[188,244],[178,241],[173,229]],[[133,220],[145,219],[153,228],[155,241],[143,245],[134,238]],[[124,214],[142,208],[166,209],[185,214],[200,221],[202,232],[191,239],[172,230],[150,225],[128,227]]],
  torso:[[146,209],[175,209],[183,236],[201,262],[160,269],[135,257],[146,236]],
  connector:[[134,219],[144,219],[151,227],[153,241],[142,243],[136,234]]},
 side:{pivot:[150,217],support:[183,225],elbow:[190,241],muzzle:[215,248],angle:-22,
  masks:[[[143,211],[155,211],[161,219],[169,225],[179,234],[177,244],[162,248],[148,241],[143,230]],[[176,222],[186,222],[196,232],[207,239],[217,245],[215,254],[200,253],[183,244],[177,233]],[[163,230],[176,228],[192,232],[212,241],[224,246],[225,256],[213,262],[199,256],[188,249],[169,246],[159,242]]],
  torso:[[157,214],[178,218],[191,239],[201,261],[175,269],[142,263],[155,241]],
  connector:[[176,221],[186,222],[194,231],[198,242],[187,248],[180,235]]}
};
const meta={id:'crossbowman',version:3,workflow:'original Idle head/neck RGBA fixed; original Idle and existing attack artwork cutouts; no generated or resized torso',cell_size:[320,320],frames:16,fps:16,release_frame:7,views:{}};
for(const[view,c]of Object.entries(configs)){
 const rel=`asset/character/icon/layers/crossbowman/${view}/attack/original-rig`,dir=path.join(game,rel);await fs.mkdir(dir,{recursive:true});
 const source=`asset/character/main/crossbowman/${view}/idle-sheet.png`;
 const neutral=await sharp(path.join(game,source)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
 const attack=await sharp(path.join(game,`asset/character/icon/source/crossbowman/${view}/attack_01.png`)).ensureAlpha().raw().toBuffer();
 const layer=async n=>await sharp(path.join(game,`asset/character/icon/layers/crossbowman/${view}/aligned/visible/${n}.png`)).ensureAlpha().raw().toBuffer();
 const headMask=await layer('head'),gunMask=await layer('weapon'),armMask=await layer(view==='back'?'arm-right':'arm-left');
 const base=Buffer.alloc(neutral.length),moving=Buffer.alloc(neutral.length),head=Buffer.alloc(neutral.length),under=Buffer.alloc(neutral.length),connector=Buffer.alloc(neutral.length),scarfLayer=Buffer.alloc(neutral.length);
 // Scarf stays fixed. It must not be mistaken for the wooden weapon.
 const scarf=(p)=>neutral[p]>145&&neutral[p]>neutral[p+1]*1.42&&neutral[p+1]>neutral[p+2]*1.45;
 let originalPixels=0,movingPixels=0,hiddenPixels=0;
 for(let y=0;y<320;y++)for(let x=0;x<320;x++){
  const p=(y*320+x)*4;if(!neutral[p+3])continue;originalPixels++;
  const isHead=headMask[p+3]>0;
  const isMoving=!isHead&&!scarf(p)&&(gunMask[p+3]>0||armMask[p+3]>0);
  const dest=isHead?head:isMoving?moving:base;neutral.copy(dest,p,p,p+4);
  if(isMoving){movingPixels++;
   // Only fill the old arm/weapon footprint INSIDE the torso. Use an existing
   // original coat/torso sample, never new visible AI artwork.
   if(inside(x+.5,y+.5,c.torso)){
    let best=-1,distance=Infinity;
    for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){
     const xx=x+dx,yy=y+dy,q=(yy*320+xx)*4;if(xx<0||xx>=320||yy<0||yy>=320||!neutral[q+3])continue;
     if(!inside(xx+.5,yy+.5,c.torso)||c.masks.some(poly=>inside(xx+.5,yy+.5,poly))||headMask[q+3]||scarf(q))continue;
     const d=dx*dx+dy*dy;if(d<distance){distance=d;best=q;}
    }
    if(attack[p+3]&&y>=231){attack.copy(under,p,p,p+4);hiddenPixels++;}
    else if(best>=0){neutral.copy(under,p,best,best+4);hiddenPixels++;}
   }
  }
  if(inside(x+.5,y+.5,c.connector)&&!isHead&&!scarf(p))neutral.copy(connector,p,p,p+4);
 }
 // Every visible source pixel belongs to exactly one original layer.
 for(let p=0;p<neutral.length;p+=4){const layers=[base,moving,head].filter(b=>b[p+3]);if(neutral[p+3]&&(layers.length!==1||!layers[0].subarray(p,p+4).equals(neutral.subarray(p,p+4))))throw Error('RGBA ownership mismatch');}
 if(view==='front'){
  const tail=[[170,228],[190,235],[206,243],[217,252],[222,263],[217,280],[208,288],[202,279],[198,264],[180,251],[173,241]];
  for(let y=222;y<294;y++)for(let x=169;x<225;x++){const p=(y*320+x)*4;
   if(scarf(p)&&y>=227)base.fill(0,p,p+4);
   if(inside(x+.5,y+.5,tail)&&attack[p+3])attack.copy(scarfLayer,p,p,p+4);
  }
 }
 if(view==='back'){
  moving.fill(0);
  const gun=[[119,195],[155,192],[183,195],[214,199],[217,210],[210,220],[196,228],[176,225],[153,220],[125,222]];
  const arm=[[174,210],[186,209],[198,214],[202,223],[194,234],[178,230],[172,221]];
  for(let y=190;y<269;y++)for(let x=115;x<220;x++){const p=(y*320+x)*4;
   if(attack[p+3]&&!headMask[p+3]&&(inside(x+.5,y+.5,gun)||inside(x+.5,y+.5,arm)))attack.copy(moving,p,p,p+4);
   if(under[p+3]&&attack[p+3]&&y>=220)attack.copy(under,p,p,p+4);
  }
 }
 // The old crossbow occluded cloth and left narrow bowstring fragments in
 // other legacy ownership groups. Restore only that footprint from the
 // EXISTING original raised-weapon drawing. Keep jaw/collar and feet intact.
 const reveal=view==='front'?[[142,235],[162,236],[181,242],[199,250],[216,256],[219,275],[210,295],[196,295],[188,269],[169,259],[149,250]]:
  view==='side'?[[165,230],[183,230],[206,239],[226,246],[228,265],[209,269],[190,259],[178,249]]:
  [[115,222],[160,222],[165,260],[115,264]];
 for(let y=222;y<296;y++)for(let x=115;x<230;x++){
  if(!inside(x+.5,y+.5,reveal))continue;const p=(y*320+x)*4;
  if(headMask[p+3])continue;
  base.fill(0,p,p+4);under.fill(0,p,p+4);
  attack.copy(base,p,p,p+4);
 }
 // Restore the COMPLETE old scarf footprint, including its dark antialias
 // outline, rather than leaving disconnected orange islands or hollow rims.
 if(view==='front'){
  scarfLayer.fill(0);
  const tail=[[172,228],[198,228],[219,239],[227,264],[218,296],[193,296],[187,262],[174,246]];
  for(let y=228;y<296;y++)for(let x=172;x<228;x++)if(inside(x+.5,y+.5,tail)){
   const p=(y*320+x)*4;base.fill(0,p,p+4);under.fill(0,p,p+4);attack.copy(base,p,p,p+4);
  }
 }
 const parts={};for(const[n,buf]of Object.entries({neutral,base,moving,head,under,connector,scarf:scarfLayer})){await sharp(buf,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(dir,n+'.png'));parts[n]=`${rel}/${n}.png`;}
 meta.views[view]={...c,parts,source,original_pixels:originalPixels,moving_pixels:movingPixels,hidden_fill_pixels:hiddenPixels,scale:1};
}
await fs.writeFile(path.join(root,'metadata/character/attack/crossbowman-original-rig.json'),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(meta.views).map(([v,r])=>[v,{original:r.original_pixels,moving:r.moving_pixels,hidden:r.hidden_fill_pixels}]))));
