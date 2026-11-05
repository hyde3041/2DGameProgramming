// Every cutout uses a single rotation + translation matrix with unit scale.
// There are no per-vertex weights, stretching, shearing or mesh deformation.
function makeArcherIdleRenderer(canvas) {
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
 if(!gl)throw new Error('WebGL is unavailable');
 const vertex=`precision highp float;
 attribute vec2 a_pixel;uniform mat3 u_transform;varying vec2 v_uv;
 void main(){vec2 q=(u_transform*vec3(a_pixel,1.)).xy;
 gl_Position=vec4(q.x/160.-1.,1.-q.y/160.,0.,1.);v_uv=a_pixel/320.;}`;
 const fragment=`precision highp float;uniform sampler2D u_image;varying vec2 v_uv;
 void main(){gl_FragColor=texture2D(u_image,v_uv);}`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0,320,320,0,320,0,0,320,320,320]),gl.STATIC_DRAW);
 const at=gl.getAttribLocation(program,'a_pixel');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
 const transformLocation=gl.getUniformLocation(program,'u_transform');gl.uniform1i(gl.getUniformLocation(program,'u_image'),0);
 gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 const TAU=Math.PI*2,rad=Math.PI/180;
 const identity=()=>[1,0,0,1,0,0],translate=(x,y)=>[1,0,0,1,x,y];
 const breath=t=>.5-.5*Math.cos(TAU*t),delayed=(t,lag)=>breath(t-lag)-breath(-lag);
 function rotate(p,angle){const c=Math.cos(angle),s=Math.sin(angle),[x,y]=p;return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}
 function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
 let textures=[],rig,motion;
 function transforms(seconds){
  const t=((seconds%1)+1)%1,b=breath(t),m=motion;
  const bodyAngle=m.body_sway_degrees*rad*Math.sin(TAU*t);
  const body=multiply(translate(0,-m.body_rise_px*b),rotate(rig.body_root||[160,242],bodyAngle));
  const neck=rig.head_root||[160,212];
  const swing=(lag)=>Math.sin(TAU*(t-lag))-Math.sin(-TAU*lag);
  const head=multiply(body,rotate(neck,m.head_tilt_degrees*rad*swing(m.head_delay_seconds)));
  const roots=rig.arm_roots||{'arm-left':[145,222],'arm-right':[184,222]};
  const armLeft=multiply(body,rotate(roots['arm-left'],(m.arm_rotation_degrees?.[0]||0)*rad*swing(m.arm_delay_seconds?.[0]||0)));
  const armRight=multiply(body,rotate(roots['arm-right'],-(m.arm_rotation_degrees?.[1]||0)*rad*swing(m.arm_delay_seconds?.[1]||0)));
  const hairLocal=multiply(translate(m.tail_translation_px*delayed(t,m.tail_delay_seconds[1]),0),rotate(rig.tail_root,-m.tail_rotation_degrees*rad*delayed(t,m.tail_delay_seconds[0])));
  const clothLocal=multiply(translate(m.cloth_translation_px*delayed(t,.16),0),rotate(rig.cloth_root,-m.cloth_rotation_degrees*rad*delayed(t,.13)));
  const poses={joints:identity(),legs:identity(),body,'cloth-hem':multiply(body,clothLocal),'hair-tail':multiply(head,hairLocal),head,'arm-left':armLeft,'arm-right':armRight,equipment:body,gear:body,'hair-front':head};
  poses.weapon=poses[rig.weapon_arm]||body;
  poses.shield=poses[rig.secondary_arm]||body;
  return (rig.layer_order||['legs','body','cloth-hem','hair-tail','head','equipment']).map(name=>poses[name.replace(/^under:/,'')]);
 }
 return {
  configure(m){motion=m;},
  load(images,view){rig=view;for(const t of textures)gl.deleteTexture(t);textures=images.map(im=>{
   const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);return t;
  });},
  getTransforms:transforms,
  render(seconds,onlyRoles){
   const poses=transforms(seconds);gl.viewport(0,0,320,320);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
   textures.forEach((texture,i)=>{if(onlyRoles&&!onlyRoles.includes(rig.layer_order[i]))return;const [a,b,c,d,x,y]=poses[i];
    gl.uniformMatrix3fv(transformLocation,false,new Float32Array([a,b,0,c,d,0,x,y,1]));
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.drawArrays(gl.TRIANGLES,0,6);
   });return canvas.toDataURL('image/png');
  }
 };
}
