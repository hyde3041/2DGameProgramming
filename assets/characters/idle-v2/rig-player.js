/* ImageGen-drawn cutout layers, animated continuously at display refresh rate. */
function createIdleRigPlayer(canvases, options = {}) {
  const buffers = canvases.map(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    return canvas;
  });
  const ctxs = buffers.map(c => c.getContext('2d', {willReadFrequently: true}));
  let image = null, rig = null;
  const tau = 2 * Math.PI;
  const radians = degree => degree * Math.PI / 180;

  function layer(ctx, row, column, pivot, dx, dy, angle, stretch = 1) {
    const [px, py] = pivot;
    ctx.save();
    ctx.translate(px + dx, py + dy);
    ctx.rotate(angle);
    ctx.scale(1, stretch);
    ctx.drawImage(image, column * 320, row * 320, 320, 320, -px, -py, 320, 320);
    ctx.restore();
  }

  function render(seconds) {
    if (!image || !rig) return;
    const phase = ((seconds % 2) + 2) % 2 * Math.PI;
    const breath = (1 - Math.cos(phase)) / 2;
    const sway = Math.sin(phase);
    const dx = sway * 0.85;
    const dy = -1.5 * breath;
    const angle = radians(0.4) * sway;
    const stretch = 1 + 0.02 * breath;
    const looseAngle = angle + radians(1.2) * Math.sin(phase - 0.7);
    const headAngle = angle + radians(0.35) * Math.sin(phase - 0.3);
    const co = Math.cos(angle), si = Math.sin(angle);

    ctxs.forEach((ctx, row) => {
      const {waist, neck} = rig.views[row];
      ctx.clearRect(0, 0, 320, 320);
      layer(ctx, row, 3, neck, dx + 0.35 * Math.sin(phase - 0.6), dy, looseAngle);
      // The legs are an independent fixed layer; the foot pivot never moves.
      layer(ctx, row, 0, waist, 0, 0, 0);
      layer(ctx, row, 1, waist, dx, dy, angle, stretch);
      // Attach the head to the moving neck of the torso, without stretching it.
      const nx = neck[0] - waist[0], ny = (neck[1] - waist[1]) * stretch;
      const neckDX = waist[0] + dx + nx * co - ny * si - neck[0];
      const neckDY = waist[1] + dy + nx * si + ny * co - neck[1];
      layer(ctx, row, 2, neck, neckDX, neckDY, headAngle);
      const dest = canvases[row].getContext('2d', {willReadFrequently: true});
      dest.clearRect(0, 0, canvases[row].width, canvases[row].height);
      const crop = options.crop || [0, 0, 320, 320];
      dest.drawImage(buffers[row], ...crop, 0, 0, canvases[row].width, canvases[row].height);
    });
  }

  return {
    setCharacter(nextImage, nextRig) { image = nextImage; rig = nextRig; render(0); },
    render,
    buffers,
    cycleSeconds: tau / Math.PI
  };
}
