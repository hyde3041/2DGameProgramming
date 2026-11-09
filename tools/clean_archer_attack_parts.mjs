// Attack-only repairs. Keep all aligned/ and generated pose originals intact.
import fs from'node:fs/promises';
import path from'node:path';
import {fileURLToPath}from'node:url';
import {createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'game');
const manifest={id:'archer',purpose:'remove confirmed attack-only layer remnants; retain original character, bow and projectile',overrides:{front:{},back:{},side:{}},repairs:[],output_pixel_removals:[{view:'back',frame:2,pixels:[[128,220]],reason:'isolated low-alpha pixel above the wrist'}]};
for(const[view,key,source,name,rect]of[
 ['front','under:hair-tail','aligned/hidden/hair-tail.png','hair-tail-under.png',[0,247,320,73]],
 ['back','under:hair-tail','aligned/hidden/hair-tail.png','hair-tail-under.png',[0,235,320,85]],
 ['side','gear','aligned/visible/gear.png','gear.png',[188,178,27,40]],
 ['back','pose-4','attack/source-v2/upper-body-04.png','upper-body-04.png',[0,0,315,20]]
]){
 const input=`asset/character/icon/layers/archer/${view}/${source}`,output=`asset/character/icon/layers/archer/${view}/attack/cleanup/${name}`;
 const {data,info}=await sharp(path.join(game,input)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let removed=0;
 for(let y=rect[1];y<rect[1]+rect[3];y++)for(let x=rect[0];x<rect[0]+rect[2];x++){const p=(y*info.width+x)*4;if(data[p+3])removed++;data.fill(0,p,p+4);}
 await fs.mkdir(path.dirname(path.join(game,output)),{recursive:true});await sharp(data,{raw:info}).png().toFile(path.join(game,output));manifest.overrides[view][key]=output;manifest.repairs.push({view,key,input,output,removed_pixels:removed,cleared_source_rect:rect});
}
await fs.writeFile(path.join(root,'metadata/character/attack/archer-cleanup.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.repairs));
