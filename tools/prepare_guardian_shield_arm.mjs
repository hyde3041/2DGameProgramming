// Use this character's COMPLETE native arm, never the little hidden joint fill.
// The fixed registration mirrors/translates pixels only. Each pose is rigid.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const idle=JSON.parse(await fs.readFile(path.join(root,'metadata/character/idle/guardian-layers.json'),'utf8'));
const repaired=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-reach.json'),'utf8'));
const outlines=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-shield-outline.json'),'utf8'));
const raw=f=>sharp(path.join(game,f)).ensureAlpha().raw().toBuffer();
// The plate's central grip, not its rim, must meet the native hand. These fixed
// source coordinates are registered against shield-full.png in each view.
const configs={front:{source:[140,215],target:[184,214],base:-25,grip:[198,228]},back:{source:[182,215],target:[138,214],base:25,grip:[111,230]},side:{source:[149,215],target:[184,214],base:-25,grip:[202,228]}};
function nearest(p,predicate,radius){let best=Infinity,found;for(let y=p[1]-radius;y<=p[1]+radius;y++)for(let x=p[0]-radius;x<=p[0]+radius;x++){if(x<2||y<2||x>317||y>317||!predicate(x,y))continue;const d=(x-p[0])**2+(y-p[1])**2;if(d<best){best=d;found=[x,y];}}if(!found)throw Error('No opaque shoulder socket near '+p);return found;}
function rotatePoint(p,root,angle){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p[0]-root[0],y=p[1]-root[1];return[root[0]+c*x-s*y,root[1]+s*x+c*y];}
function largest(data){const seen=new Uint8Array(102400);let main=[];for(let p=0;p<102400;p++){if(seen[p]||data[p*4+3]<128)continue;const q=[p];seen[p]=1;for(let i=0;i<q.length;i++){const k=q[i],x=k%320,y=Math.floor(k/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,s=yy*320+xx;if(xx<0||xx>=320||yy<0||yy>=320||seen[s]||data[s*4+3]<128)continue;seen[s]=1;q.push(s);}}if(q.length>main.length)main=q;}return new Set(main);}
const result={version:2,workflow:'complete native reference arm at scale 1; opaque torso socket and central shield handle contact',views:{}};
for(const v of idle.views){
 const cfg=configs[v.view],source=`asset/character/player/icon/layers/guardian/${v.view}/aligned/${v.weapon_arm}.png`,arm=await raw(source),weapon=await raw(v.parts.weapon);
 const sourceMain=largest(arm),sourceRoot=nearest(cfg.source,(x,y)=>sourceMain.has(y*320+x)&&arm[(y*320+x)*4+3]>=224,3);
 const parts={...v.parts,...repaired.views[v.view].parts},torso=Buffer.alloc(arm.length);
 for(const n of ['under:body','torso_patch','body']){const b=await raw(parts[n]);for(let p=0;p<102400;p++)torso[p*4+3]=Math.max(torso[p*4+3],b[p*4+3]);}
 const torsoMain=largest(torso);for(let p=0;p<102400;p++)if(!torsoMain.has(p))torso[p*4+3]=0;
 const target=nearest(cfg.target,(x,y)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(torso[((y+dy)*320+x+dx)*4+3]<224)return false;return true;},9);
 // Locate the hand in the original drawing by its contact with the original mace.
 const contacts=[];for(let p=0;p<102400;p++)if(arm[p*4+3]>=128){const x=p%320,y=Math.floor(p/320);let touch=false;for(let dy=-2;dy<=2&&!touch;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<320&&yy>=0&&yy<320&&weapon[(yy*320+xx)*4+3]>=128){touch=true;break;}}if(touch)contacts.push([x,y]);}
 if(!contacts.length)throw Error(v.view+': original hand is not connected to mace');
 const hand=contacts.reduce((s,p)=>[s[0]+p[0]/contacts.length,s[1]+p[1]/contacts.length],[0,0]);
 const removedMask=Buffer.alloc(arm.length);let removed=0;
 // The side arm layer contains a cape corner well outside the forearm axis.
 // Clear that misplaced cloak only, leaving the native sleeve/gauntlet width.
 if(v.view==='side'){
  const dx=hand[0]-sourceRoot[0],dy=hand[1]-sourceRoot[1],length=Math.hypot(dx,dy);
  for(let y=0;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4;if(!arm[p+3])continue;const a=x-sourceRoot[0],b=y-sourceRoot[1],t=(a*dx+b*dy)/(length*length),outer=(a*dy-b*dx)/length;
   if(t>.3&&outer>11){arm.fill(0,p,p+4);removedMask.fill(255,p,p+4);removed++;}
  }
 }
 const mirrorX=target[0]+sourceRoot[0],shiftY=target[1]-sourceRoot[1],registered=Buffer.alloc(arm.length);let clipped=0;
 for(let y=0;y<320;y++)for(let x=0;x<320;x++){const p=(y*320+x)*4,xx=mirrorX-x,yy=y+shiftY;if(xx>=0&&xx<320&&yy>=0&&yy<320)arm.copy(registered,(yy*320+xx)*4,p,p+4);else if(arm[p+3])clipped++;}
 if(clipped)throw Error(v.view+': native arm was cropped');
 const armHand=[mirrorX-hand[0],hand[1]+shiftY],restHand=rotatePoint(armHand,target,cfg.base);
 const plateContact=cfg.grip,shield=await raw(outlines.views[v.view].file);
 if(shield[(plateContact[1]*320+plateContact[0])*4+3]<224)throw Error(v.view+': central handle must be inside the shield');
 const folder=`asset/character/player/icon/layers/guardian/${v.view}/attack/push`,file=`${folder}/arm-native.png`,mask=`${folder}/arm-nonlimb-mask.png`;
 for(const[f,data]of [[file,registered],[mask,removedMask]])await sharp(data,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,f));
 result.views[v.view]={file,source,source_shoulder:sourceRoot,shoulder:target,source_hand:hand,arm_hand:armHand,base_degrees:cfg.base,plate_contact:plateContact,contact_kind:'center_handle',neutral_hand:restHand,neutral_plate_translation:restHand.map((n,i)=>n-plateContact[i]),registration:{mirror_x:mirrorX,translate_y:shiftY,scale:[1,1]},removed_nonlimb_pixels:removed,nonlimb_mask:mask,clipped_pixels:clipped};
}
await fs.writeFile(path.join(root,'metadata/character/attack/guardian-shield-arm.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.views).map(([v,r])=>[v,{source_root:r.source_shoulder,body_socket:r.shoulder,neutral_hand:r.neutral_hand,plate_contact:r.plate_contact,scale:r.registration.scale,nonlimb_removed:r.removed_nonlimb_pixels}]))));
