// Keep the original art intact; add only the missing hidden joint surface.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const folder='asset/character/icon/layers/swordsman/back/attack/armpit';
const source=`${folder}/source/body-edit-generated-v2.png`;
const atlas=await sharp(path.join(game,source)).resize(1024,1024).ensureAlpha().raw().toBuffer();
// Native coordinates: compact, tapered underside, ending above the waist.
const outline='M176 210 Q184 208 189 212 Q192 215 189 219 Q185 223 180 225 L175 221 Z';
const mask=await sharp(Buffer.from(`<svg width="320" height="320"><path d="${outline}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
const output=Buffer.alloc(320*320*4);let count=0;
for(let y=0;y<320;y++)for(let x=0;x<320;x++){
 const p=(y*320+x)*4;if(!mask[p+3])continue;
 // Register the generated cloth surface inside the missing socket only.
 const u=Math.round(192+(x-8-132+.5)*8-.5),v=Math.round(192+(y-2-194+.5)*8-.5),k=(v*1024+u)*4;
 if(atlas[k+3]<180)continue;
 for(let c=0;c<3;c++)output[p+c]=Math.round(atlas[k+c]*.84);
 output[p+3]=mask[p+3];count++;
}
await fs.mkdir(path.join(game,folder),{recursive:true});
await sharp(output,{raw:{width:320,height:320,channels:4}}).png().toFile(path.join(game,folder,'armpit-fill.png'));
const metadata={version:1,applied:true,mode:'built-in image_gen surface with native local mask',part:'armpit_fill',file:`${folder}/armpit-fill.png`,source,source_originals_preserved:true,motion_unchanged:true,mask_path:outline,texture_offset:[8,2],tone_multiplier:.84,pixels:count,sources:'metadata/character/attack/swordsman-armpit-sources.json'};
await fs.writeFile(path.join(root,'metadata/character/attack/swordsman-armpit.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata));
