import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const root = fileURLToPath(new URL('../', import.meta.url));
const game = path.join(root, 'game');
const rig = JSON.parse(await fs.readFile(path.join(root, 'metadata/character/monster-motion.json'), 'utf8'));
const apply = process.argv.includes('--apply');
const build = path.join(root, '.build/monster-motion');
const [width, height] = rig.frame_size;
const radians = degrees => degrees * Math.PI / 180;

function add([x, y], [dx, dy]) {
  return [x + dx, y + dy];
}

function rotate([x, y], angle) {
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}

function offset(anchor, target, angle) {
  return add(anchor, rotate(target, angle));
}

function drawPart(ctx, part, point, angle) {
  ctx.save();
  ctx.translate(...point);
  ctx.rotate(angle);
  ctx.drawImage(part.image, -part.pivot[0], -part.pivot[1], ...part.size);
  ctx.restore();
}

function drawBone(ctx, part, joint, direction) {
  drawPart(ctx, part, joint, direction - part.axis);
  return offset(joint, [part.length, 0], direction);
}

function drawLeg(ctx, parts, hip, ankle, footAngle) {
  const thigh = parts.thigh;
  const shin = parts.shin;
  const dx = ankle[0] - hip[0];
  const dy = ankle[1] - hip[1];
  const distance = Math.min(Math.hypot(dx, dy), thigh.length + shin.length - 0.05);
  const kneeAngle = Math.acos(
    (thigh.length ** 2 + distance ** 2 - shin.length ** 2) / (2 * thigh.length * distance)
  );
  const knee = drawBone(ctx, thigh, hip, Math.atan2(dy, dx) - kneeAngle);
  drawBone(ctx, shin, knee, Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]));
  drawPart(ctx, parts.boot, ankle, radians(footAngle));
}

function step(phase, stride, lift) {
  if (phase < 0.5) return [stride * (0.5 - phase * 2), 0, 0];

  const progress = phase * 2 - 1;
  const swing = Math.sin(Math.PI * progress);
  return [-stride * 0.5 * Math.cos(Math.PI * progress), lift * swing, -18 * swing];
}

function attackAt(keys, frame) {
  const upper = keys.findIndex(key => key[0] >= frame);
  const end = keys[upper];
  if (end[0] === frame) return end.slice(1);
  const start = keys[upper - 1];
  const fraction = (frame - start[0]) / (end[0] - start[0]);
  const ease = fraction * fraction * (3 - 2 * fraction);
  return start.slice(1).map((value, i) => value + (end[i + 1] - value) * ease);
}

function render(ctx, monster, parts, frame, mode) {
  const phase = frame / rig.frame_count;
  const swing = Math.cos(phase * Math.PI * 2);
  const [x, ground] = rig.pivot;
  const ankleY = ground - parts.boot.size[1] + parts.boot.pivot[1];
  const legLength = parts.thigh.length + parts.shin.length;
  const hipY = ankleY - legLength + 6;
  const walking = mode === 'walk';
  const firstPose = monster.attack[0].slice(1);
  const [shift, drop, tilt, nod, upper, lower, weapon, foot] = walking
    ? [0, -2 * (1 - Math.abs(swing)), 3, -1, firstPose[4] + 16 * swing,
        firstPose[5] + 13 * swing, firstPose[6] + 11 * swing, 0]
    : attackAt(monster.attack, frame);
  const nearStep = walking ? step(phase, monster.stride, monster.lift) : [8 + foot, 0, 0];
  const farStep = walking ? step((phase + 0.5) % 1, monster.stride, monster.lift) : [-8, 0, 0];
  const angle = radians(tilt);
  const hip = [x + shift, hipY + drop];
  const torso = parts.torso;
  const shoulder = offset(hip, torso.joints[1], angle);
  const neck = offset(hip, torso.joints[0], angle);
  const cloth = offset(hip, torso.joints[2], angle);

  // Draw the far limbs below the torso, and use the same rig on the near side.
  ctx.save();
  ctx.filter = 'brightness(69%)';
  const farShoulder = add(shoulder, [torso.size[0] * 0.39, -1]);
  const farElbow = drawBone(ctx, parts['upper-arm'], farShoulder, radians(77 - swing * 15));
  drawBone(ctx, parts.forearm, farElbow, radians(walking ? 42 - swing * 19 : 49 + tilt));
  drawLeg(ctx, parts, add(hip, [-5, 0]), [x - 9 + farStep[0], ankleY - farStep[1]], farStep[2]);
  ctx.restore();

  drawPart(ctx, parts.cloth, cloth, radians(walking ? 28 + 12 * swing : 32 + tilt));
  drawLeg(ctx, parts, hip, [x + 4 + nearStep[0], ankleY - nearStep[1]], nearStep[2]);
  drawPart(ctx, torso, hip, angle);
  drawPart(ctx, parts.head, neck, radians(nod + tilt * 0.3));

  const arm = parts['upper-arm'];
  const elbow = drawBone(ctx, arm, shoulder, radians(upper));
  const grip = offset(elbow, [parts.forearm.length, 0], radians(lower));
  drawPart(ctx, parts.weapon, grip, radians(weapon));
  drawBone(ctx, parts.forearm, elbow, radians(lower));
}

async function loadParts(monster) {
  const parts = {};
  for (const [name, [size, ...anchors]] of Object.entries(monster.parts)) {
    const image = await loadImage(path.join(game, monster.parts_directory, name + '.png'));
    const toPixels = ([x, y]) => [x * size[0], y * size[1]];
    const pivot = toPixels(anchors[0]);
    const joints = anchors.slice(1).map(toPixels).map(([x, y]) => [x - pivot[0], y - pivot[1]]);
    const [dx, dy] = joints[0] ?? [0, 0];
    parts[name] = { image, size, pivot, joints, length: Math.hypot(dx, dy), axis: Math.atan2(dy, dx) };
  }
  return parts;
}

function checkFrame(ctx, name) {
  const { data } = ctx.getImageData(0, 0, width, height);
  let visible = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 12) continue;
      if (x < 3 || x >= width - 3 || y < 3 || y >= height - 3) {
        throw new Error(name + ' reaches a frame edge at ' + x + ',' + y);
      }
      visible++;
    }
  }
  if (visible < 1000) throw new Error(name + ' is missing visible art');
}

for (const monster of Object.values(rig.monsters)) {
  const parts = await loadParts(monster);
  for (const mode of ['walk', 'attack']) {
    const sheet = createCanvas(width * rig.columns, height * rig.frame_count / rig.columns);
    const sheetCtx = sheet.getContext('2d');
    const cell = createCanvas(width, height);
    const ctx = cell.getContext('2d');
    for (let frame = 0; frame < rig.frame_count; frame++) {
      ctx.clearRect(0, 0, width, height);
      render(ctx, monster, parts, frame, mode);
      checkFrame(ctx, `${monster.folder} ${mode} ${frame}`);
      sheetCtx.drawImage(cell, (frame % rig.columns) * width, Math.floor(frame / rig.columns) * height);
    }
    const target = apply
      ? path.join(game, monster[mode + '_sheet'])
      : path.join(build, monster.folder, mode + '-sheet.png');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, sheet.toBuffer('image/png'));
    console.log(path.relative(root, target));
  }
}
