import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const SIZES = [16, 32, 48, 128];
const SAMPLES_PER_AXIS = 4;
const BACKGROUND = [232, 169, 0];
const FOREGROUND = [255, 255, 255];
const CORNER_RADIUS = 0.22;
const LINES = [
  { top: 0.3, bottom: 0.38, left: 0.26, right: 0.74 },
  { top: 0.46, bottom: 0.54, left: 0.26, right: 0.74 },
  { top: 0.62, bottom: 0.7, left: 0.26, right: 0.58 },
];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const OUT_DIR = new URL("../extension/icons/", import.meta.url);

function insideRoundedSquare(u, v) {
  const dx = Math.max(CORNER_RADIUS - u, u - (1 - CORNER_RADIUS), 0);
  const dy = Math.max(CORNER_RADIUS - v, v - (1 - CORNER_RADIUS), 0);
  return dx * dx + dy * dy <= CORNER_RADIUS * CORNER_RADIUS;
}

const insideLine = (u, v) => LINES.some((line) => u >= line.left && u <= line.right && v >= line.top && v <= line.bottom);

function sampleColor(u, v) {
  if (!insideRoundedSquare(u, v)) return null;
  return insideLine(u, v) ? FOREGROUND : BACKGROUND;
}

function pixel(x, y, size) {
  const sum = [0, 0, 0];
  let covered = 0;
  for (let sy = 0; sy < SAMPLES_PER_AXIS; sy++) {
    for (let sx = 0; sx < SAMPLES_PER_AXIS; sx++) {
      const color = sampleColor((x + (sx + 0.5) / SAMPLES_PER_AXIS) / size, (y + (sy + 0.5) / SAMPLES_PER_AXIS) / size);
      if (!color) continue;
      color.forEach((channel, index) => { sum[index] += channel; });
      covered += 1;
    }
  }
  if (covered === 0) return [0, 0, 0, 0];
  return [...sum.map((channel) => channel / covered), (255 * covered) / SAMPLES_PER_AXIS ** 2].map(Math.round);
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function encodePng(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) row.push(...pixel(x, y, size));
    rows.push(Buffer.from(row));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(Buffer.concat(rows))), pngChunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) writeFileSync(new URL(`icon-${size}.png`, OUT_DIR), encodePng(size));
