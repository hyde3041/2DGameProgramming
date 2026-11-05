// Authoring only: npm packages sharp and playwright; Chrome is needed to bake.
// node tools/build_archer_idle.mjs <output-directory> [character-id]
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const sharp=require('sharp');const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply an output directory. Existing game assets are not overwritten by this tool.');
const out=path.resolve(process.argv[2]);await fs.mkdir(out,{recursive:true});
const character=process.argv[3]||'archer';
const meta=JSON.parse(await fs.readFile(root+'/metadata/character/idle/'+character+'-layers.json','utf8'));
const count=meta.frame_count,fps=meta.fps,columns=meta.columns,rows=Math.ceil(count/columns),sheetWidth=columns*320,sheetHeight=rows*320;
if(count/fps!==1)throw Error('This authoring rig uses a one-second loop');
let redrawn=false;
if(meta.anatomy_metadata){
 const anatomy=JSON.parse(await fs.readFile(root+'/'+meta.anatomy_metadata,'utf8'));
 redrawn=anatomy.version>=2&&anatomy.workflow.includes('redrawn');
 meta.layer_order=anatomy.views[0].idle_order;
 meta.views=anatomy.views.map(v=>({view:v.direction,layer_order:v.idle_order,parts:v.idle_groups,neutral:v.source,head_root:v.pivots.head,tail_root:v.pivots.hair,cloth_root:v.pivots.cloth,body_root:v.pivots.body,...v.rig}));
}
const renderer=await fs.readFile(root+'/tools/archer-idle-renderer.js','utf8');
await fs.writeFile(out+'/bake.html','<!doctype html><canvas width="320" height="320" id="c"></canvas><script>'+renderer+'</script><script>const player=makeArcherIdleRenderer(document.getElementById("c"));</script>');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();const qa=[];
try{
 await page.goto(pathToFileURL(out+'/bake.html').href);
 await page.evaluate(m=>player.configure(m),meta.motion);
 for(const view of meta.views){
  const images=await Promise.all(meta.layer_order.map(async n=>'data:image/png;base64,'+(await fs.readFile(root+'/'+view.parts[n])).toString('base64')));
  await page.evaluate(async({images,view})=>{const ims=await Promise.all(images.map(async src=>{const i=new Image();i.src=src;await i.decode();return i;}));player.load(ims,view);},{images,view});
  const geometry=await page.evaluate(()=>{
   let maxError=0;
   for(let i=0;i<=120;i++)for(const [a,b,c,d] of player.getTransforms(i/120))maxError=Math.max(maxError,Math.abs(a*a+b*b-1),Math.abs(c*c+d*d-1),Math.abs(a*c+b*d),Math.abs(a*d-b*c-1));
   return {unit_scale:true,no_shear:true,max_matrix_error:maxError};
  });
  if(geometry.max_matrix_error>1e-6)throw Error('A part transform stretches or shears');
  const samples=await page.evaluate(({count,fps})=>Array.from({length:count+1},(_,i)=>player.render(i/fps).split(',')[1]),{count,fps});
  if(samples[0]!==samples[count])throw Error('Loop endpoint mismatch');
  const legSamples=await page.evaluate(({count,fps})=>Array.from({length:count},(_,i)=>player.render(i/fps,['legs','under:legs']).split(',')[1]),{count,fps});
  if(!legSamples.every(f=>f===legSamples[0]))throw Error('Leg-layer pixels moved');
  const neutral=await sharp(root+'/'+view.neutral).ensureAlpha().raw().toBuffer();
  const footTop=redrawn?284:270;
  const legPath=view.parts.legs;
  const legPixels=legPath?await sharp(root+'/'+legPath).ensureAlpha().raw().toBuffer():neutral;
  const footMask=[];for(let y=footTop;y<320;y++)for(let x=0;x<320;x++)if(legPixels[(y*320+x)*4+3]>0)footMask.push((y*320+x)*4);
  const frames=[];const atlas=Buffer.alloc(sheetWidth*sheetHeight*4);const dir=out+'/frames/'+view.view;await fs.mkdir(dir,{recursive:true});
  for(let i=0;i<count;i++){
   const px=!redrawn&&i===0?Buffer.from(neutral):await sharp(Buffer.from(samples[i],'base64')).ensureAlpha().raw().toBuffer();
   if(!redrawn)neutral.copy(px,270*320*4,270*320*4);frames.push(px);
   for(let y=0;y<320;y++)px.copy(atlas,((Math.floor(i/columns)*320+y)*sheetWidth+i%columns*320)*4,y*320*4,(y+1)*320*4);
   await sharp(px,{raw:{width:320,height:320,channels:4}}).png().toFile(dir+'/'+String(i).padStart(2,'0')+'.png');
  }
  const unique=new Set(frames.map(f=>crypto.createHash('sha256').update(f).digest('hex'))).size;
  const mae=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)n+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);n+=Math.abs(a[i+3]-b[i+3]);}return n/a.length;};
  const steps=frames.map((f,i)=>mae(f,frames[(i+1)%count]));
  if(unique!==count)throw Error('Duplicated frames');
  if(steps[count-1]>Math.max(...steps.slice(0,count-1))*1.3)throw Error('Loop seam is larger than ordinary steps');
  const solePixelsUncovered=frames.every(f=>footMask.every(i=>f.subarray(i,i+4).equals(frames[0].subarray(i,i+4))));
  await sharp(atlas,{raw:{width:sheetWidth,height:sheetHeight,channels:4}}).png().toFile(out+'/'+view.view+'-idle-sheet.png');
  qa.push({character,direction:view.view,frame_count:count,fps,cycle_ms:1000,size:[sheetWidth,sheetHeight],unique_frames:unique,foot_layer_pixels_fixed:true,soles_unchanged_in_full_composite:solePixelsUncovered,foreground_can_occlude_shoes:!solePixelsUncovered,checked_sole_pixels:footMask.length,foot_check_from_row:footTop,neutral_source:redrawn?'original-aligned surfaces and completed hidden joints':'original visible-pixel cutouts',geometry,seam_mae:steps[count-1],max_step_mae:Math.max(...steps),steps});
 }
}finally{await browser.close();}
await fs.writeFile(out+'/bake-qa.json',JSON.stringify(qa,null,2)+'\n');console.log(JSON.stringify(qa));
