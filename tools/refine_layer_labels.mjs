// Grow trustworthy interior labels to the real sprite edges. Colour barriers
// and anatomical bounds prevent coarse outline leftovers in unrelated parts.
export function refineLabels(source,initial,{headAllowed,hairAllowed,bodyBounds,bodySeeds,armLeftAllowed,armRightAllowed,legAllowed,force,headExtras=[]}) {
 const size=320*320,dist=new Float64Array(size).fill(Infinity),labels=new Uint8Array(size),heap=[];
 function push(item){let i=heap.length;heap.push(item);while(i){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;}
 function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
 function allowed(k,label){const y=Math.floor(k/320),x=k%320;if(force[k]&&force[k]!==label)return false;if(label===5)return headAllowed[k];if(label===4)return hairAllowed[k];if(label===2)return x>=bodyBounds[0]&&x<=bodyBounds[2]&&y>=bodyBounds[1]&&y<=bodyBounds[3];if(label===6)return armLeftAllowed[k];if(label===7)return armRightAllowed[k];if(label===1)return legAllowed[k];if(label===3)return y>=204;return true;}
 const seedCount=new Uint32Array(9);
 for(let y=2;y<318;y++)for(let x=2;x<318;x++){
  const k=y*320+x,l=force[k]||initial[k];if(!l||source[k*4+3]<160||!allowed(k,l)||(l===2&&(!bodySeeds[k]||hairAllowed[k])))continue;
  let safe=true;for(let dy=-2;dy<=2&&safe;dy++)for(let dx=-2;dx<=2;dx++){const q=(y+dy)*320+x+dx;if(source[q*4+3]>80&&initial[q]!==l){safe=false;break;}}
  if(force[k]||safe){dist[k]=0;labels[k]=l;push([0,k,l]);seedCount[l]++;}
 }
 // Preserve a thin original feature when its interior is under five pixels.
 for(let k=0;k<size;k++){const l=initial[k];if(l&&seedCount[l]===0&&source[k*4+3]>200&&allowed(k,l)&&(l!==2||bodySeeds[k])){labels[k]=l;dist[k]=.1;push([.1,k,l]);}}
 while(heap.length){
  const [d,k,l]=pop();if(d!==dist[k]||l!==labels[k])continue;
  const x=k%320,y=Math.floor(k/320),i=k*4;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;const q=ny*320+nx,j=q*4;if(!source[j+3]||!allowed(q,l))continue;
   const colour=(Math.abs(source[i]-source[j])+Math.abs(source[i+1]-source[j+1])+Math.abs(source[i+2]-source[j+2]))/35;
   const nd=d+1+colour*colour+(l===2?.12:0);
   if(nd<dist[q]){dist[q]=nd;labels[q]=l;push([nd,q,l]);}
  }
 }
 // Tiny detached ink/AA islands have no connected seed. Attach them to their
 // closest already-labelled part rather than dumping them into the torso.
 for(let k=0;k<size;k++)if(source[k*4+3]&&!labels[k]){
  const x=k%320,y=Math.floor(k/320);let chosen=initial[k]||2,best=Infinity;
  for(let radius=1;radius<=30&&best===Infinity;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.abs(dx)!==radius&&Math.abs(dy)!==radius)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;
   const q=ny*320+nx,l=labels[q];if(l&&allowed(k,l)){const d=dx*dx+dy*dy;if(d<best){best=d;chosen=l;}}
  }
  labels[k]=force[k]||chosen;
 }
 // A floating piece of shield, staff or bow string cannot be part of a head.
 const seen=new Uint8Array(size),groups=[];
 for(let k=0;k<size;k++)if(labels[k]===5&&!seen[k]){
  const stack=[k],pixels=[];seen[k]=1;
  while(stack.length){const q=stack.pop();pixels.push(q);const x=q%320,y=Math.floor(q/320);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;const n=ny*320+nx;if(labels[n]===5&&!seen[n]){seen[n]=1;stack.push(n);}}}
  groups.push(pixels);
 }
 groups.sort((a,b)=>b.length-a.length);
 for(const group of groups.slice(1))if(!group.some(k=>headExtras[k]))for(const k of group){
  let choice=initial[k]===5?8:initial[k],best=Infinity;const x=k%320,y=Math.floor(k/320);
  for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;const l=labels[ny*320+nx],d=dx*dx+dy*dy;if(l&&l!==5&&d<best){best=d;choice=l;}}
  labels[k]=choice||8;
 }
 const bodySeen=new Uint8Array(size);
 for(let k=0;k<size;k++)if(labels[k]===2&&!bodySeen[k]){
  const stack=[k],group=[];let touchesTorso=false;bodySeen[k]=1;
  while(stack.length){const q=stack.pop();group.push(q);const x=q%320,y=Math.floor(q/320);for(let dy=-4;dy<=4&&!touchesTorso;dy++)for(let dx=-4;dx<=4;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<320&&ny>=0&&ny<320&&bodySeeds[ny*320+nx]){touchesTorso=true;break;}}for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;const n=ny*320+nx;if(labels[n]===2&&!bodySeen[n]){bodySeen[n]=1;stack.push(n);}}}
  if(touchesTorso)continue;
  const votes=new Float64Array(9);
  for(const q of group){const x=q%320,y=Math.floor(q/320);for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;const l=labels[ny*320+nx];if(l&&l!==2)votes[l]+=1/(1+dx*dx+dy*dy);}}
  let chosen=8;for(let l=1;l<=8;l++)if(l!==2&&votes[l]>votes[chosen])chosen=l;
  for(const q of group)labels[q]=allowed(q,chosen)?chosen:8;
 }
 return labels;
}
