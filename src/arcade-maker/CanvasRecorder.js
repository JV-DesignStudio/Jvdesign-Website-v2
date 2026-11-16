// A2568: capture a running game canvas into a looping GIF or a spritesheet.
// Pure canvas work in the page; gifenc is pulled from the self-hosted vendor
// bundle only when a GIF is requested, so the maker stays light.

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function frameFrom(source, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export async function record(source, { seconds = 3, fps = 10, width = null, height = null } = {}) {
  if (!source) throw new Error('No canvas to record');
  const w = width || source.width || 320;
  const h = height || source.height || 240;
  const count = Math.max(1, Math.round(seconds * fps));
  const wait = Math.max(16, Math.round(1000 / fps));
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push(frameFrom(source, w, h));
    if (i < count - 1) await sleep(wait);
  }
  return frames;
}

export function spritesheet(frames, { cols = 4, pad = 0 } = {}) {
  if (!frames || !frames.length) throw new Error('No frames to pack');
  const w = frames[0].width, h = frames[0].height;
  const n = frames.length;
  const c = document.createElement('canvas');
  c.width = cols * w + pad * (cols - 1);
  c.height = Math.ceil(n / cols) * h + pad * (Math.ceil(n / cols) - 1);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  frames.forEach((f, i) => {
    const x = (i % cols) * (w + pad);
    const y = Math.floor(i / cols) * (h + pad);
    ctx.drawImage(f, x, y);
  });
  return c;
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), 'image/png'); }
    catch (e) { reject(e); }
  });
}

export async function gif(frames, { delay = 100 } = {}) {
  if (!frames || !frames.length) throw new Error('No frames to encode');
  const mod = await import('/assets/vendor/gifenc/gifenc.esm.js');
  const { GIFEncoder, quantize, applyPalette } = mod;
  const w = frames[0].width, h = frames[0].height;
  const enc = GIFEncoder();
  const format = 'rgba4444';
  frames.forEach(frame => {
    const data = frame.getContext('2d').getImageData(0, 0, w, h).data;
    const palette = quantize(data, 256, { format });
    const index = applyPalette(data, palette, format);
    enc.writeFrame(index, w, h, { palette, delay });
  });
  enc.finish();
  return new Blob([enc.bytes()], { type: 'image/gif' });
}

export const CanvasRecorder = { record, spritesheet, canvasBlob, gif };
export default CanvasRecorder;
