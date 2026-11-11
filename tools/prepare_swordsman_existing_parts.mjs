// Reuse the existing aligned layer files verbatim. This tool writes JSON only.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url), sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = path.join(root, 'game');
const idle = JSON.parse(await fs.readFile(path.join(root, 'metadata/character/idle/swordsman-layers.json'), 'utf8'));
const cleanupFile=path.join(root,'metadata/character/attack/swordsman-edge-cleanup.json');
let cleanup;try{cleanup=JSON.parse(await fs.readFile(cleanupFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(cleanup&&!cleanup.applied)cleanup=undefined;
let armpit;try{armpit=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/swordsman-armpit.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const shoulders = {front:[140,215], back:[182,212], side:[149,216]};
const angles = {
 front:[0,-10,-28,-55,-88,-120,-146,-165,-130,-65,5,15,12,6,2,.4],
 // User-selected cape-fixed GIF: preserve its exact attack and recovery.
 back:[0,-8,-22,-48,-80,-112,-140,-160,-125,-60,0,12,8,4,1,.2]
};
const lean = [0,-.2,-.7,-1.2,-1.9,-2.8,-3.8,-4.5,-2.3,1,4.8,5,3.3,1.5,.4,.05];
const rise = [0,-.1,-.2,-.3,-.5,-.7,-.9,-1.2,-.6,.1,.8,.6,.3,.1,0,0];
const rig = {
 id:'swordsman', version:15,
 workflow:'rear sword drawn behind head; selected motion and shoulder underside repair preserved',
 joint_mode:'whole_preseparated_arm', source_layers_unchanged:!cleanup,source_originals_preserved:true,splits_arm:false,
 cleanup:cleanup?'metadata/character/attack/swordsman-edge-cleanup.json':undefined,
 frames:16, fps:16, cell_size:[320,320], pivot:[160,288], impact_frame:10,
 lift_frames:[0,7], overhead_transition_frame:8, strike_frames:[9,11],
 wrist_locked:true, wrist_limit_degrees:0, views:{}
};
const raw = file => sharp(path.join(game, file)).ensureAlpha().raw().toBuffer();
for (const source of idle.views) {
 const view = source.view, folder = `asset/character/player/icon/layers/swordsman/${view}/attack/motion`;
 // These complete layers predate the rejected upper_arm/forearm split.
 // Refer to them in place; do not regenerate a mask, crop or replacement art.
 const parts = {
  base:`${folder}/base.png`, feet:`${folder}/feet.png`,
  head:`${folder}/head.png`, arm:`${folder}/arm.png`,
  arm_under:source.parts['under:'+source.weapon_arm],
  cape:`asset/character/player/icon/layers/swordsman/${view}/aligned/cloth-hem.png`,
  weapon:source.parts.weapon, blade:`${folder}/blade.png`
 };
 const originals={...parts};
 if(cleanup){for(const name of ['arm','weapon','blade'])parts[name]=cleanup.views[view].parts[name].file;for(const name of ['arm','weapon'])parts[name+'_mask']=cleanup.views[view].parts[name].mask;}
 if(view==='back'&&armpit?.applied)parts.armpit_fill=armpit.file;
 const [arm, weapon, body, hiddenArm] = await Promise.all([
  raw(parts.arm), raw(parts.weapon), raw(parts.base), raw(parts.arm_under)
 ]);
 const contacts = [];
 for (let p=0; p<102400; p++) if (arm[p*4+3]>64) {
  const x=p%320, y=Math.floor(p/320); let touch=false;
  for (let yy=Math.max(0,y-2); yy<=Math.min(319,y+2); yy++)
   for (let xx=Math.max(0,x-2); xx<=Math.min(319,x+2); xx++)
    if (weapon[(yy*320+xx)*4+3]>64) touch=true;
  if (touch) contacts.push([x,y]);
 }
 const hand = cleanup?cleanup.views[view].joints.hand_root:contacts.length ? contacts.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/contacts.length), [0,0]) : source.hand_roots[source.weapon_arm];
 let distance=0, tip;
 for (let p=0; p<102400; p++) if (weapon[p*4+3]>64) {
  const q=[p%320,Math.floor(p/320)], d=Math.hypot(q[0]-hand[0],q[1]-hand[1]);
  if (d>distance) { distance=d; tip=q; }
 }
 if(cleanup){tip=cleanup.views[view].joints.blade_tip;distance=cleanup.views[view].joints.blade_length;}
 const shoulder=shoulders[view], at=(shoulder[1]*320+shoulder[0])*4+3;
 if (body[at]<128||Math.max(arm[at],hiddenArm[at])<128) throw Error(view+': shoulder is outside the existing torso/arm socket');
 const hashes={};
 for (const [name,file] of Object.entries(parts)) hashes[name]=crypto.createHash('sha256').update(await fs.readFile(path.join(game,file))).digest('hex');
 const mode=view==='back'?'back':'front';
 rig.views[view]={
  view, parts, layer_order:view==='back'?['cape',...(parts.armpit_fill?['armpit_fill']:[]),'arm_under','base','feet','shoulder_socket','weapon','head','arm','shoulder_overlap']:['cape','arm_under','base','feet','head','arm','shoulder_overlap','weapon'], weapon_arm:'arm',
  attack_facing:view==='back'?'selected_cape_fixed':view==='side'?'right':'front',
  attack_sweep:view==='back'?'selected_cape_fixed':'existing',
  weapon_behind_head_only:view==='back',
  ...(view==='back'?{shoulder_socket_radius_px:13,shoulder_socket_feather_px:2,shoulder_socket_offset:[-3,-6],shoulder_socket_fade_degrees:[2,8]}:{}),
  shoulder_overlap_radius_px:6,
  shoulder_overlap_feather_px:2,
  source_hashes:hashes, original_weapon:originals.weapon,
  original_arm:originals.arm, weapon_unchanged:!cleanup,
  body_root:[160,280], arm_root:shoulder,
  previous_arm_root:source.arm_roots[source.weapon_arm],
  shoulder_raise_px:source.arm_roots[source.weapon_arm][1]-shoulder[1],
  hand_root:hand, blade_tip:tip, blade_length:distance,
  frames:angles[mode].map((angle,index)=>({
   index, arm:angle, forearm:angle, weapon:angle, wrist:0,
   body:lean[index]*(view==='back'?-.28:.36),
   translation:[index>=8&&index<=11?.6:0,rise[index]*.35]
  }))
 };
 console.log(JSON.stringify({view,shoulder,previous_shoulder:source.arm_roots[source.weapon_arm],uncut_arm:parts.arm,hand,tip}));
}
await fs.writeFile(path.join(root,'metadata/character/attack/swordsman-motion.json'),JSON.stringify(rig,null,2)+'\n');
