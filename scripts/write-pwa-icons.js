import fs from 'node:fs';
import zlib from 'node:zlib';

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + length);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + length);
  return chunk;
}

function buildPng(width, height, isMaskable) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const stride = 1 + width * 4;
  const rawData = Buffer.alloc(height * stride);

  const minX = Math.round(width * 0.1);
  const maxX = Math.round(width * 0.9);
  const minY = Math.round(height * 0.1);
  const maxY = Math.round(height * 0.9);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const inside = x >= minX && x < maxX && y >= minY && y < maxY;
      if (inside) {
        rawData[pixelOffset] = 0x1d;
        rawData[pixelOffset + 1] = 0x4e;
        rawData[pixelOffset + 2] = 0xd8;
        rawData[pixelOffset + 3] = 0xff;
      } else if (isMaskable) {
        rawData[pixelOffset] = 0x11;
        rawData[pixelOffset + 1] = 0x11;
        rawData[pixelOffset + 2] = 0x13;
        rawData[pixelOffset + 3] = 0xff;
      } else {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = new URL('../icons/', import.meta.url);
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(new URL('../icons/icon-192.png', import.meta.url), buildPng(192, 192, false));
fs.writeFileSync(new URL('../icons/icon-512.png', import.meta.url), buildPng(512, 512, false));
fs.writeFileSync(new URL('../icons/icon-maskable-192.png', import.meta.url), buildPng(192, 192, true));
fs.writeFileSync(new URL('../icons/icon-maskable-512.png', import.meta.url), buildPng(512, 512, true));
console.log('PWA icons generated successfully.');
