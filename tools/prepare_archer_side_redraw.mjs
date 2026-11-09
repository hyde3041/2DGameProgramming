import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const {createCanvas, loadImage} = require('@napi-rs/canvas');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = path.join(root, 'game');
const configurationFile = 'metadata/character/attack/archer-side-redraw.json';
const configuration = JSON.parse(await fs.readFile(path.join(root, configurationFile), 'utf8'));
const output = path.join(root, '.build/archer-side-redraw');
const apply = process.argv.includes('--apply');
const size = configuration.cell_size[0];
const folder = path.join(game, configuration.motion_folder);
const costume = await fs.readFile(path.join(game, configuration.shared_costume));
const costumeHash = crypto.createHash('sha256').update(costume).digest('hex');
const motion = configuration.coat_motion;
const cloth = {};
const layers = [];
const reports = [];
await fs.mkdir(output, {recursive: true});

if (costumeHash !== configuration.costume_sha256) throw Error('The approved shared costume has changed');
const costumeSize = await sharp(costume).metadata();
if (costumeSize.width !== size || costumeSize.height !== size || !costumeSize.hasAlpha) throw Error('Invalid costume cell');
if (motion.cape_angles.length !== configuration.frame_count || motion.coat_angles.length !== configuration.frame_count) {
  throw Error('Cloth motion must define an angle for every frame');
}

for (const name of ['background', 'cape', 'coat', 'waist', 'clasp']) {
  const buffer = await fs.readFile(path.join(game, motion.folder, `${name}.png`));
  const metadata = await sharp(buffer).metadata();
  if (metadata.width !== size || metadata.height !== size || !metadata.hasAlpha) throw Error(`Invalid cloth layer: ${name}`);
  cloth[name] = {buffer, image: await loadImage(buffer)};
}

function rotateLayer(image, angle, pivot, yOffset = 0) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.translate(pivot[0], pivot[1] + yOffset);
  context.rotate(angle * Math.PI / 180);
  context.drawImage(image, -pivot[0], -pivot[1]);
  return canvas;
}

function bottomPixel(canvas) {
  const pixels = canvas.getContext('2d').getImageData(0, 0, size, size).data;
  let bottom = 0;
  for (let pixel = 0; pixel < size * size; pixel++) {
    if (pixels[pixel * 4 + 3] >= 128) bottom = Math.floor(pixel / size);
  }
  return bottom;
}

const neutralCoatBottom = bottomPixel(rotateLayer(cloth.coat.image, 0, motion.coat_pivot));

for (let frame = 0; frame < configuration.frame_count; frame++) {
  const name = String(frame).padStart(2, '0');
  const capeAngle = motion.cape_angles[frame];
  const coatAngle = motion.coat_angles[frame];
  const rotatedCoat = rotateLayer(cloth.coat.image, coatAngle, motion.coat_pivot);
  const coatBottom = bottomPixel(rotatedCoat);
  // Keep the approved hem height when the coat swings back after release.
  const coatOffset = -Math.max(0, coatBottom - neutralCoatBottom);
  let movingCostume = costume;
  if (capeAngle || coatAngle) {
    const coatImage = coatAngle
      ? rotateLayer(cloth.coat.image, coatAngle, motion.coat_pivot, coatOffset).toBuffer('image/png')
      : cloth.coat.buffer;
    const capeImage = capeAngle
      ? rotateLayer(cloth.cape.image, capeAngle, motion.cape_pivot).toBuffer('image/png')
      : cloth.cape.buffer;
    movingCostume = await sharp(cloth.background.buffer).composite([
      {input: coatImage}, {input: cloth.waist.buffer}, {input: capeImage}, {input: cloth.clasp.buffer}
    ]).png().toBuffer();
  }
  await fs.writeFile(path.join(output, `costume-frame-${name}.png`), movingCostume);
  const read = part => fs.readFile(path.join(folder, `${part}-${name}.png`));
  const [string, weapon, arms, head] = await Promise.all(['string', 'weapon', 'arms', 'head'].map(read));
  const image = await sharp(movingCostume).composite([
    {input: string}, {input: weapon}, {input: arms}, {input: head}
  ]).png().toBuffer();
  await fs.writeFile(path.join(output, `frame-${name}.png`), image);
  layers.push({input: image, left: frame % configuration.columns * size, top: Math.floor(frame / configuration.columns) * size});
  reports.push({
    frame, costume_sha256: costumeHash, costume_translation: [0, 0], costume_scale: [1, 1], arm_scale: [1, 1],
    cape_angle: capeAngle, coat_angle: coatAngle, coat_y_offset: coatOffset, coat_bottom: coatBottom + coatOffset
  });
}

await sharp({create: {width: size * configuration.columns, height: size * configuration.rows, channels: 4, background: '#00000000'}})
  .composite(layers).png().toFile(path.join(output, 'source-sheet.png'));
await fs.writeFile(path.join(output, 'qa.json'), JSON.stringify({mode: configuration.mode, neutral_coat_bottom: neutralCoatBottom, reports}, null, 2) + '\n');

if (apply) {
  const destination = path.join(game, configuration.prepared_folder);
  await fs.mkdir(destination, {recursive: true});
  for (let frame = 0; frame < configuration.frame_count; frame++) {
    const file = `frame-${String(frame).padStart(2, '0')}.png`;
    await fs.copyFile(path.join(output, file), path.join(destination, file));
  }
  await fs.copyFile(path.join(output, 'source-sheet.png'), path.join(destination, 'source-sheet.png'));
  const importFile = path.join(root, 'metadata/character/attack/archer-import.json');
  const imports = JSON.parse(await fs.readFile(importFile, 'utf8'));
  delete imports.views.side.body_alignment;
  Object.assign(imports.views.side, {
    source_sheet: configuration.approved_sheet ?? configuration.prepared_folder + '/source-sheet.png',
    source_size: [size * configuration.columns, size * configuration.rows],
    uniform_scale: 1, preserve_source_alpha: true, body_redraw: configurationFile
  });
  await fs.writeFile(importFile, JSON.stringify(imports, null, 2) + '\n');
}
console.log(JSON.stringify({applied: apply, output, costume_sha256: costumeHash, frame_count: configuration.frame_count}));
