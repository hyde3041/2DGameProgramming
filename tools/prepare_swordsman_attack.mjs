// Register coherent original poses once. Do not resize or fit separate limbs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url), sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = path.join(root, 'game');
const timing = [
  ['idle', -.00, .00], ['idle', -.10, -.20], ['idle', -.30, -.60],
  ['windup', -.50, -.60], ['windup', -.65, -1.00],
  ['windup', -.80, -1.25], ['windup', -.65, -1.10],
  ['strike', .00, 1.80], ['strike', .10, 1.15],
  ['strike', .00, .55], ['strike', -.05, .15],
  ['recover', -.10, .60], ['recover', -.10, .32],
  ['recover', -.07, .15], ['idle', -.04, .08], ['idle', -.01, .02],
];
// Integer translation of the whole original pose, including its head and weapon.
// These offsets correct the original atlas' uneven cell placement, not anatomy.
const registration = {
  front: {idle: 0, windup: 14, strike: 12, recover: -2},
  back:  {idle: 0, windup: -1, strike: 32, recover: 1},
  side:  {idle: 0, windup: 9, strike: 19, recover: 0},
};
// Native boot regions before registration. Different stances remain intact;
// only the soles are held during each pose's small follow-through movement.
const boots = {
  front: {
    idle: [[115,277,30,16],[161,277,24,16]],
    windup: [[90,277,26,16],[156,277,27,16]],
    strike: [[77,277,28,16],[146,277,29,16]],
    recover: [[122,277,25,16],[168,277,25,16]],
  },
  back: {
    idle: [[115,277,28,16],[169,277,28,16]],
    windup: [[116,277,29,16],[176,277,29,16]],
    strike: [[80,274,27,16],[149,277,30,16]],
    recover: [[115,277,27,16],[169,277,28,16]],
  },
  side: {
    idle: [[122,277,27,16],[166,277,29,16]],
    windup: [[94,277,28,16],[152,277,30,16]],
    strike: [[73,277,28,16],[145,277,31,16]],
    recover: [[116,277,27,16],[164,277,30,16]],
  },
};
const metadata = {
  id: 'swordsman', version: 1,
  workflow: 'four original connected poses, integer registration, rigid follow-through',
  cell_size: [320,320], pivot: [160,288], frames: 16, fps: 16,
  impact_frame: 7, scale: [1,1], views: {},
};
for (const view of ['front','back','side']) {
  const folder = `asset/character/icon/layers/swordsman/${view}/attack/connected`;
  await fs.mkdir(path.join(game, folder), {recursive: true});
  const poses = {};
  for (const [pose, filename] of Object.entries({idle:'idle-sheet',windup:'attack_01',strike:'attack_02',recover:'attack_03'})) {
    const input = pose === 'idle'
      ? `asset/character/main/swordsman/${view}/idle-sheet.png`
      : `asset/character/icon/source/swordsman/${view}/${filename}.png`;
    let image = sharp(path.join(game, input));
    if (pose === 'idle') image = image.extract({left:0,top:0,width:320,height:320});
    const original = await image.ensureAlpha().raw().toBuffer();
    const pixels = Buffer.alloc(original.length), dx = registration[view][pose];
    for (let y=0;y<320;y++) for (let x=0;x<320;x++) {
      const targetX = x+dx, p=(y*320+x)*4;
      if (targetX>=0 && targetX<320) original.copy(pixels,(y*320+targetX)*4,p,p+4);
      else if (original[p+3]) throw Error(`${view}/${pose}: registration clips original artwork`);
    }
    const boxes = boots[view][pose].map(([x,y,w,h])=>[x+dx,y,w,h]);
    const upper = Buffer.from(pixels), feet = Buffer.alloc(pixels.length);
    const inBoot = (x,y)=>boxes.some(([bx,by,w,h])=>x>=bx&&x<bx+w&&y>=by&&y<by+h);
    for (let y=274;y<320;y++) for (let x=60;x<260;x++) if (inBoot(x,y)) {
      const p=(y*320+x)*4;
      pixels.copy(feet,p,p,p+4);
      if (y>=281 || view==='back'&&pose==='strike'&&x<145&&y>=277) upper.fill(0,p,p+4);
    }
    const files={reference:`${folder}/${pose}.png`,upper:`${folder}/${pose}-upper.png`,feet:`${folder}/${pose}-feet.png`};
    for (const [name,b] of Object.entries({reference:pixels,upper,feet}))
      await sharp(b,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,files[name]));
    poses[pose]={input,original_rgba_sha256:crypto.createHash('sha256').update(original).digest('hex'),registration:[dx,0],files,boot_boxes:boxes};
  }
  metadata.views[view]={poses,pivot:[160,288],frames:timing.map(([pose,y,angle],index)=>({index,pose,translation:[0,y],angle_degrees:angle,scale:[1,1]}))};
}
await fs.writeFile(path.join(root,'metadata/character/attack/swordsman-connected.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Prepared original swordsman poses: no resizing, repainting or independent limb registration.');
