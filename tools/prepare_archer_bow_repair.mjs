import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const {chromium} = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = path.join(root, 'game');

async function polygonMask(points) {
  const coordinates = points.map(point => point.join(',')).join(' ');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><polygon points="${coordinates}" fill="white"/></svg>`);
  return sharp(svg).ensureAlpha().raw().toBuffer();
}

function protectHand(pixels, box) {
  const mask = new Uint8Array(320 * 320);
  const [left, top, width, height] = box;
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
    const offset = (y * 320 + x) * 4;
    const [red, green, blue, alpha] = pixels.subarray(offset, offset + 4);
    if (!(alpha && red > 170 && green > 130 && blue > 115 && red > green && blue / green > 0.73)) continue;
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) mask[yy * 320 + xx] = 1;
  }
  return mask;
}

export async function prepareArcherBowRepair(sourceSheet, movingCapes, legs, configuration) {
  const output = path.join(game, configuration.folder);
  await fs.mkdir(output, {recursive: true});
  const prepared = {layers: {}, eraseMasks: {}, handMasks: {}, reports: []};
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage();
    await page.setContent('<canvas width="320" height="320"></canvas>');
    for (const [frameText, repair] of Object.entries(configuration.frames)) {
      const frame = Number(frameText);
      const current = await sharp(sourceSheet, {raw: {width: 1280, height: 1280, channels: 4}})
        .extract({left: frame % 4 * 320, top: Math.floor(frame / 4) * 320, width: 320, height: 320}).raw().toBuffer();
      const upperMask = await polygonMask(repair.upper_outline);
      const erase = await polygonMask(repair.erase_outline);
      const hand = protectHand(current, repair.hand_box);
      const upper = Buffer.alloc(current.length);
      const occluder = new Float64Array(320 * 320);
      const cape = movingCapes[frame];
      let upperExtent = 0;
      let top = 320;
      let bottom = 0;
      const [pivotX, pivotY] = repair.grip;
      for (let pixel = 0; pixel < 320 * 320; pixel++) {
        const offset = pixel * 4;
        const x = pixel % 320;
        const y = Math.floor(pixel / 320);
        occluder[pixel] = 1 - (1 - cape[offset + 3] / 255) * (1 - legs[offset + 3] / 255);
        if (y >= 282) erase.fill(0, offset, offset + 4);
        const [red, green, blue, alpha] = current.subarray(offset, offset + 4);
        if (!upperMask[offset + 3] || !alpha || hand[pixel] || blue > red + 2) continue;
        current.copy(upper, offset, offset, offset + 4);
        upper[offset + 3] = Math.round(alpha * upperMask[offset + 3] / 255);
        if (upper[offset + 3] >= 96) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          upperExtent = Math.max(upperExtent, Math.hypot(x + 0.5 - pivotX, y + 0.5 - pivotY));
        }
      }
      const angle = repair.reflection_axis_degrees * Math.PI / 180;
      const a = Math.cos(2 * angle);
      const b = Math.sin(2 * angle);
      const c = b;
      const d = -a;
      const tx = pivotX - a * pivotX - c * pivotY;
      const ty = pivotY - b * pivotX - d * pivotY;
      let hiddenAfter = null;
      let coveredRows = 0;
      for (let y = bottom; y >= top; y--) {
        let count = 0;
        let covered = 0;
        for (let x = 0; x < 320; x++) {
          if (upper[(y * 320 + x) * 4 + 3] < 96) continue;
          count++;
          const xx = Math.floor(a * (x + 0.5) + c * (y + 0.5) + tx);
          const yy = Math.floor(b * (x + 0.5) + d * (y + 0.5) + ty);
          if (xx >= 0 && xx < 320 && yy >= 0 && yy < 320 && occluder[yy * 320 + xx] >= 0.7) covered++;
        }
        coveredRows = count >= 2 && covered === count ? coveredRows + 1 : 0;
        if (coveredRows === 2) {
          hiddenAfter = y + 1;
          break;
        }
      }
      if (hiddenAfter === null) throw Error(`Lower bow never enters clothing in frame ${frame}`);
      const exposed = Buffer.from(upper);
      exposed.fill(0, 0, (hiddenAfter + 1) * 320 * 4);
      const toPng = pixels => sharp(pixels, {raw: {width: 320, height: 320, channels: 4}}).png().toBuffer();
      const inputs = await Promise.all([toPng(upper), toPng(exposed)]);
      const images = await page.evaluate(async ({sources, matrix}) => {
        const canvas = document.querySelector('canvas');
        const context = canvas.getContext('2d');
        const result = [];
        for (const source of sources) {
          const sprite = new Image();
          sprite.src = source;
          await sprite.decode();
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, 320, 320);
          context.setTransform(...matrix);
          context.drawImage(sprite, 0, 0);
          result.push(canvas.toDataURL());
        }
        return result;
      }, {sources: inputs.map(png => 'data:image/png;base64,' + png.toString('base64')), matrix: [a, b, c, d, tx, ty]});
      const complete = await sharp(Buffer.from(images[0].split(',')[1], 'base64')).ensureAlpha().raw().toBuffer();
      const visible = await sharp(Buffer.from(images[1].split(',')[1], 'base64')).ensureAlpha().raw().toBuffer();
      for (let pixel = 0; pixel < 320 * 320; pixel++) visible[pixel * 4 + 3] = Math.round(visible[pixel * 4 + 3] * (1 - occluder[pixel]));
      for (const [name, pixels] of Object.entries({upper, 'lower-complete': complete, 'lower-visible': visible, 'erase-mask': erase})) {
        await sharp(pixels, {raw: {width: 320, height: 320, channels: 4}}).png().toFile(path.join(output, `${name}-${frame}.png`));
      }
      prepared.layers[frame] = visible;
      prepared.eraseMasks[frame] = erase;
      prepared.handMasks[frame] = hand;
      prepared.reports.push({frame, grip: repair.grip, scale: [1, 1], reflection_matrix: [a, b, c, d, tx, ty], upper_length_pixels: upperExtent, lower_length_pixels: upperExtent, hidden_after_upper_source_y: hiddenAfter});
    }
  } finally {
    await browser.close();
  }
  return prepared;
}
