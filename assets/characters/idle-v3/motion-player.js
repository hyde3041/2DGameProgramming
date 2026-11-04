/* Animate a complete painted sprite so its proportions and occlusion stay intact. */
function createIdleMotionPlayer(canvases, options = {}) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 320;
  const gl = surface.getContext('webgl', {
    alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true
  });
  if (!gl) throw new Error('WebGL is unavailable. Use the MP4 or GIF preview.');
  const vertexSource = `
    precision highp float;
    attribute vec2 a_pixel;
    uniform float u_phase;
    uniform float u_view;
    uniform vec3 u_body;
    uniform vec4 u_hair;
    uniform vec4 u_cloth;
    varying vec2 v_uv;
    float zone(vec2 p, vec4 z) {
      return 1.0-smoothstep(0.3,1.0,length((p-z.xy)/z.zw));
    }
    void main() {
      vec2 p=a_pixel;
      float breath=(1.0-cos(u_phase))*0.5;
      float upper=1.0-smoothstep(u_body.y,u_body.z,p.y);
      vec2 displacement=vec2(1.2*sin(u_phase),-4.5*breath)*upper;
      float head=1.0-smoothstep(u_body.y-2.0,u_body.y+9.0,p.y);
      vec2 q=p-vec2(u_body.x,u_body.y);
      float angle=0.0104719755*sin(u_phase);
      vec2 turned=vec2(cos(angle)*q.x-sin(angle)*q.y,sin(angle)*q.x+cos(angle)*q.y);
      displacement+=(turned-q)*head;
      float feet=1.0-smoothstep(255.0,270.0,p.y);
      float hairWave=sin(u_phase-0.65)+sin(0.65);
      float clothWave=sin(u_phase-0.9)+sin(0.9);
      displacement+=vec2(2.25*hairWave,0.35*(cos(u_phase)-1.0))*zone(p,u_hair)*feet;
      displacement+=vec2(1.6*clothWave,0.45*(cos(u_phase)-1.0))*zone(p,u_cloth)*feet;
      vec2 position=p+displacement;
      gl_Position=vec4(position.x/160.0-1.0,1.0-position.y/160.0,0.0,1.0);
      v_uv=vec2((a_pixel.x+u_view*320.0)/960.0,a_pixel.y/320.0);
    }`;
  const fragmentSource = `
    precision highp float;
    uniform sampler2D u_image;
    varying vec2 v_uv;
    void main(){gl_FragColor=texture2D(u_image,v_uv);}`;
  function shader(type, source) {
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const divisions=40,vertices=[],indices=[];
  for(let y=0;y<=divisions;y++)for(let x=0;x<=divisions;x++)vertices.push(x*320/divisions,y*320/divisions);
  for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){
    const a=y*(divisions+1)+x,b=a+1,c=a+divisions+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  const attribute=gl.getAttribLocation(program,'a_pixel');
  gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  const locations=Object.fromEntries(['phase','view','body','hair','cloth'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program,'u_image'),0);
  gl.viewport(0,0,320,320);
  const buffers=canvases.map(()=>{const c=document.createElement('canvas');c.width=c.height=320;return c;});
  let rig=null;
  function render(seconds){
    if(!rig)return;
    const phase=(((seconds%2)+2)%2)*Math.PI;
    gl.uniform1f(locations.phase,phase);
    for(let view=0;view<3;view++){
      const setting=rig.views[view];
      gl.uniform1f(locations.view,view);
      gl.uniform3fv(locations.body,setting.body);
      gl.uniform4fv(locations.hair,setting.hair);
      gl.uniform4fv(locations.cloth,setting.cloth);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      const ctx=buffers[view].getContext('2d',{willReadFrequently:true});
      ctx.clearRect(0,0,320,320);ctx.drawImage(surface,0,0);
      const canvas=canvases[view],dest=canvas.getContext('2d',{willReadFrequently:true});
      dest.clearRect(0,0,canvas.width,canvas.height);
      dest.drawImage(buffers[view],...(options.crop||[0,0,320,320]),0,0,canvas.width,canvas.height);
    }
  }
  return {
    buffers,render,cycleSeconds:2,
    setCharacter(image,nextRig){
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      rig=nextRig;render(0);
    }
  };
}
