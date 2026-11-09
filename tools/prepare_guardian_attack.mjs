// Reuse the existing, registered parts. Never crop or rescale an arm or weapon.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const idle=JSON.parse(await fs.readFile(path.join(root,'metadata/character/idle/guardian-layers.json'),'utf8'));
const support=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-support.json'),'utf8'));
const repaired=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-reach.json'),'utf8'));
const outlines=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-shield-outline.json'),'utf8'));
await import('./prepare_guardian_consistency.mjs');
const consistency=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-consistency.json'),'utf8'));
await import('./prepare_guardian_shield_arm.mjs');
const shieldArms=JSON.parse(await fs.readFile(path.join(root,'metadata/character/attack/guardian-shield-arm.json'),'utf8'));
// Small anticipation, one clear shield-first shove, then a gradual return.
const push=[0,-.01,-.035,-.08,-.14,-.18,-.08,.26,.78,1,.78,.48,.24,.09,.02,.001];
const reach=[0,-.04,-.14,-.30,-.40,-.22,.22,.82,1,.78,.50,.29,.14,.055,.012,.001];
const movement={front:{lean:2.4,shift:[6,2]},back:{lean:-2.4,shift:[-5,-2.5]},side:{lean:3.2,shift:[8,0]}};
const rig={id:'guardian',version:8,attack_type:'shield_push',frames:16,fps:16,cell_size:[320,320],pivot:[160,288],impact_frame:8,
  workflow:'shield pulls back then leads a stronger shove, following the gripping hand; torso follows one frame later',
  source_layers_unchanged:true,splits_arm:false,mace_wrist_locked:true,shield_grip_follows_hand:true,idle_motion:idle.motion,views:{}};
for(const v of idle.views){
 const hashes={};
 for(const [n,f] of Object.entries(v.parts))hashes[n]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'game',f))).digest('hex');
 // Keep the original visible armor and arm geometry. Only use already cleaned
 // gear/shield copies for the tiny leftovers hidden in the neutral silhouette.
 const parts={...v.parts};
 for(const n of ['gear','under:gear','shield','under:shield'])parts[n]=support.views[v.view].parts[n];
 Object.assign(parts,repaired.views[v.view].parts);
 parts.shield=outlines.views[v.view].file;
 Object.assign(parts,consistency.views[v.view].parts);
 const shieldArm=v.weapon_arm==='arm-left'?'arm-right':'arm-left',order=[...v.layer_order],nativeArm=shieldArms.views[v.view];
 parts.shield_arm_native=nativeArm.file;
 delete parts[shieldArm];delete parts['under:'+shieldArm];
 order.splice(Math.min(order.indexOf('under:arm-left'),order.indexOf('under:arm-right')),0,'torso_patch');
 // The rear grip reveals the original glove over the inner handle. Torso,
 // cape and head still occlude the shield and gripping hand afterwards.
 const omit=['under:'+shieldArm,shieldArm,'under:shield','shield','under:head','head'];
 const bodyLayers=order.filter(n=>!omit.includes(n));
 const plateLayers=['under:shield','shield'],headLayers=['under:head','head'];
 order.splice(0,order.length,...(v.view==='back'?['shield_arm_native',...plateLayers,'rear_hand_grip',...bodyLayers,...headLayers]:[...bodyLayers,'shield_arm_native',...plateLayers,...headLayers]));
 const m=movement[v.view];
 rig.views[v.view]={view:v.view,parts,layer_order:order,source_hashes:hashes,
   weapon_arm:v.weapon_arm,shield_arm:v.weapon_arm==='arm-left'?'arm-right':'arm-left',
   body_root:[160,280],arm_root:v.arm_roots[v.weapon_arm],shield_root:nativeArm.shoulder,
   shield_grip:nativeArm.arm_hand,plate_contact:nativeArm.plate_contact,grip_location:nativeArm.contact_kind,arm_base_degrees:nativeArm.base_degrees,
   head_root:v.head_root,hand_root:v.hand_roots[v.weapon_arm],
   weapon_behind_head:v.view==='back',
   shield_behind_body:v.view==='back',arm_behind_shield:true,native_arm_scale:[1,1],
   ...(v.view==='back'?{rear_hand_grip:{center:nativeArm.arm_hand,radius:18}}:{}),
   idle_rig:{body_root:v.body_root,head_root:v.head_root,tail_root:v.tail_root,cloth_root:v.cloth_root,arm_roots:v.arm_roots},
   frames:push.map((amount,i)=>({index:i,body:m.lean*amount,
     translation:m.shift.map(x=>x*amount),arm:0,
     shield_arm:(v.view==='back'?50:-50)*reach[i],
     shield_tilt:(v.view==='back'?-12:12)*reach[i],head:0,cloth:0}))};
}
await fs.writeFile(path.join(root,'metadata/character/attack/guardian-motion.json'),JSON.stringify(rig,null,2)+'\n');
console.log('Guardian: existing layers registered, 16 frames at 16 FPS.');
