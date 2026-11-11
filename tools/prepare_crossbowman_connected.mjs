// Reuse the existing coherent character drawings, without recombining arms,
// torso and weapon from different poses. No generated replacement artwork.
import fs from'node:fs/promises';import path from'node:path';import crypto from'node:crypto';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const timing=[
 ['idle',0,0,0],['lift-1',0,-.15,-.12],['lift-2',0,-.15,-.08],['lift-3',0,-.3,-.12],
 ['aim',0,-.4,-.18],['aim',0,-.48,-.22],['aim',0,-.52,-.24],['fire',-1.3,-.35,.35],
 ['fire',-.85,-.22,.24],['aim',-.4,-.28,.12],['aim',-.1,-.25,.04],['lift-3',0,-.2,-.04],
 ['lift-2',0,-.28,-.04],['lift-1',0,-.1,-.05],['idle',0,-.07,-.03],['idle',0,-.03,-.01]
];
const metadata={id:'crossbowman',version:5,workflow:'connected original poses with three real lift in-betweens; rigid unit scale and original feet fixed',lift:'metadata/character/attack/crossbowman-lift.json',frames:16,fps:16,release_frame:7,cell_size:[320,320],views:{}};
for(const view of['front','back','side']){
 const folder=`asset/character/player/icon/layers/crossbowman/${view}/attack/connected`,dir=path.join(game,folder);await fs.mkdir(dir,{recursive:true});
 const idleFile=`asset/character/player/main/3-crossbowman/${view}/idle-sheet.png`,idle=await sharp(path.join(game,idleFile)).extract({left:0,top:0,width:320,height:320}).ensureAlpha().raw().toBuffer();
 const sourceFiles={idle:idleFile,aim:`asset/character/player/icon/source/crossbowman/${view}/attack_01.png`,fire:`asset/character/player/icon/source/crossbowman/${view}/attack_02.png`,recover:`asset/character/player/icon/source/crossbowman/${view}/attack_03.png`};
 for(let n=1;n<=3;n++)sourceFiles['lift-'+n]=`asset/character/player/icon/layers/crossbowman/${view}/attack/lift/lift-${String(n).padStart(2,'0')}.png`;
 const footBoxes=view==='front'?[[119,270,39,24],[161,270,37,24]]:view==='back'?[[127,270,28,24],[162,270,35,24]]:[[121,270,35,24],[160,270,39,24]];
 const inFoot=(x,y)=>footBoxes.some(([bx,by,w,h])=>x>=bx&&x<bx+w&&y>=by&&y<by+h);
 const feet=Buffer.alloc(idle.length),parts={},sources={};
 const legMaskFile=`asset/character/player/icon/layers/crossbowman/${view}/aligned/visible/legs.png`,legMask=await sharp(path.join(game,legMaskFile)).ensureAlpha().raw().toBuffer();
 const isScarf=(pixels,p)=>pixels[p]>130&&pixels[p]>pixels[p+1]*1.3&&pixels[p+1]>pixels[p+2]*1.45;
 for(let y=277;y<320;y++)for(let x=100;x<225;x++)if(inFoot(x,y)){const p=(y*320+x)*4;if(legMask[p+3]&&!isScarf(idle,p))idle.copy(feet,p,p,p+4);}
 for(const[name,input]of Object.entries(sourceFiles)){
  const original=name==='idle'?Buffer.from(idle):await sharp(path.join(game,input)).ensureAlpha().raw().toBuffer();
  const upper=Buffer.from(original);
  // Five pixels of overlap at the ankle: no cut through the torso, shoulders,
  // hands or weapon, and no independent fitting of the head or gun.
  for(let y=281;y<320;y++)for(let x=100;x<225;x++)if(inFoot(x,y)){const p=(y*320+x)*4;if(!isScarf(original,p)&&(legMask[p+3]||!idle[p+3]))upper.fill(0,p,p+4);}
  const file=`${folder}/${name}-upper.png`;await sharp(upper,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,file));parts[name]=file;
  let tipX=0;for(let y=195;y<235;y++)for(let x=180;x<260;x++)if(original[(y*320+x)*4+3]>180)tipX=Math.max(tipX,x);
  let sumY=0,count=0;for(let y=195;y<235;y++)for(let x=Math.max(180,tipX-2);x<=tipX;x++)if(original[(y*320+x)*4+3]>180){sumY+=y;count++;}
  sources[name]={input,original_rgba_sha256:crypto.createHash('sha256').update(original).digest('hex'),upper_pixels_unchanged_above_y:281,muzzle:[tipX,count?sumY/count:215]};
 }
 const feetFile=`${folder}/feet.png`;await sharp(feet,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,feetFile));parts.feet=feetFile;
 const bolt=await sharp(path.join(game,'asset/character/player/icon/layers/crossbowman/attack/bolt.png')).resize({width:38}).png().toBuffer(),boltFile=`${folder}/bolt.png`;await fs.writeFile(path.join(game,boltFile),bolt);parts.bolt=boltFile;
 const aim=await sharp(path.join(game,sourceFiles.aim)).ensureAlpha().raw().toBuffer();let muzzleX=0,muzzleY=215;
 for(let y=195;y<231;y++)for(let x=180;x<260;x++){const p=(y*320+x)*4;if(aim[p+3]>180&&x>muzzleX){muzzleX=x;muzzleY=y;}}
 metadata.views[view]={parts,sources,pivot:{front:[163,241],back:[163,243],side:[170,241]}[view],muzzle:[muzzleX,muzzleY],foot_reference_mask:legMaskFile,foot_boxes:footBoxes,frames:timing.map(([pose,x,y,angle],index)=>({index,pose,translation:[x,y],angle_degrees:angle,scale:[1,1]}))};
}
await fs.writeFile(path.join(root,'metadata/character/attack/crossbowman-connected.json'),JSON.stringify(metadata,null,2)+'\n');console.log('Prepared three connected native-pose sets at original 320px resolution');
