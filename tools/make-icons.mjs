// Draws the app icons as PNG files with no extra packages.
// Design: dark square, green ring, white "play" triangle.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x11, 0x11, 0x11];
const GREEN = [0x2b, 0xd9, 0x6b];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function pixel(x, y, s) {
  const cx = s / 2, cy = s / 2;
  const d = Math.hypot(x - cx, y - cy);
  const outer = s * 0.4, inner = s * 0.32;
  if (d <= outer && d >= inner) return GREEN;
  // Play triangle pointing right, centred.
  const t = s * 0.16;
  const left = cx - t * 0.7, right = cx + t * 1.1;
  if (x >= left && x <= right) {
    const half = t * (1 - (x - left) / (right - left));
    if (Math.abs(y - cy) <= half) return WHITE;
  }
  return BG;
}

function png(size, file) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5, size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

png(180, 'public/apple-touch-icon.png');
png(192, 'public/icon-192.png');
png(512, 'public/icon-512.png');
console.log('Icons written to public/');
