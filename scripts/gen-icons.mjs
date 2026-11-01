import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BG = hexToRgb('#16a34a');
const WHITE = [255, 255, 255];

function coinIcon(size, padRatio) {
  const pad = size * padRatio;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - pad * 2) / 2;
  const barW = r * 1.1;
  const barH = r * 0.32;
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r) {
      const inBar = Math.abs(dx) <= barW / 2 && Math.abs(dy) <= barH / 2;
      const color = inBar ? BG : WHITE;
      return [...color, 255];
    }
    return [...BG, 255];
  };
}

writeFileSync(join(outDir, 'icon-192.png'), makePng(192, 192, coinIcon(192, 0.12)));
writeFileSync(join(outDir, 'icon-512.png'), makePng(512, 512, coinIcon(512, 0.12)));
writeFileSync(join(outDir, 'icon-512-maskable.png'), makePng(512, 512, coinIcon(512, 0.22)));
writeFileSync(join(outDir, 'apple-touch-icon.png'), makePng(180, 180, coinIcon(180, 0.12)));

console.log('Icons generated in', outDir);

// ---- メモアプリ用アイコン（黄色地に白い紙と罫線） ----
const MEMO_BG = hexToRgb('#f59e0b');
const memoOutDir = join(__dirname, '..', 'public', 'memo', 'icons');
mkdirSync(memoOutDir, { recursive: true });

function memoIcon(size, padRatio) {
  const pad = size * padRatio;
  const w = (size - pad * 2) * 0.78;
  const h = size - pad * 2;
  const left = (size - w) / 2;
  const top = pad;
  const radius = w * 0.12;
  const lineH = h * 0.06;
  const lineX0 = left + w * 0.18;
  const lineX1 = left + w * 0.82;
  const lines = [0.3, 0.48, 0.66].map((r) => top + h * r);
  return (x, y) => {
    const inX = x >= left && x <= left + w;
    const inY = y >= top && y <= top + h;
    if (!inX || !inY) return [...MEMO_BG, 255];
    // 角丸
    const cx = Math.min(Math.max(x, left + radius), left + w - radius);
    const cy = Math.min(Math.max(y, top + radius), top + h - radius);
    if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) return [...MEMO_BG, 255];
    const onLine = lines.some((ly, i) => {
      const end = i === lines.length - 1 ? lineX0 + (lineX1 - lineX0) * 0.6 : lineX1;
      return Math.abs(y - ly) <= lineH / 2 && x >= lineX0 && x <= end;
    });
    return onLine ? [...MEMO_BG, 255] : [...WHITE, 255];
  };
}

writeFileSync(join(memoOutDir, 'icon-192.png'), makePng(192, 192, memoIcon(192, 0.16)));
writeFileSync(join(memoOutDir, 'icon-512.png'), makePng(512, 512, memoIcon(512, 0.16)));
writeFileSync(join(memoOutDir, 'icon-512-maskable.png'), makePng(512, 512, memoIcon(512, 0.26)));
writeFileSync(join(memoOutDir, 'apple-touch-icon.png'), makePng(180, 180, memoIcon(180, 0.16)));
console.log('Memo icons generated in', memoOutDir);
