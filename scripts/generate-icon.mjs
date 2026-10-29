import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "resources");
fs.mkdirSync(out, { recursive: true });

const size = 1024;

function pixel(x, y) {
  const cx = size / 2;
  const cy = size / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const ivory = [244, 239, 230, 255];
  const sage = [95, 127, 102, 255];
  const brass = [166, 133, 77, 255];
  const ink = [44, 42, 38, 255];
  const max = size * 0.42;
  const inner = size * 0.34;
  if (r > max + 8) return ivory;
  if (r > max) return brass;
  if (r > inner) return sage;
  // Simple serif-like A
  const nx = (x - cx) / inner;
  const ny = (y - cy) / inner;
  const left = ny > -0.55 && Math.abs(nx + 0.28 * (ny + 0.2)) < 0.08;
  const right = ny > -0.55 && Math.abs(nx - 0.28 * (ny + 0.2)) < 0.08;
  const bar = ny > 0.05 && ny < 0.18 && Math.abs(nx) < 0.22;
  if (left || right || bar) return ink;
  return ivory;
}

const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  const row = y * (size * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < size; x += 1) {
    const [r, g, b, a] = pixel(x, y);
    const i = row + 1 + x * 4;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
    raw[i + 3] = a;
  }
}

function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4);
  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([header, data, footer]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c ^ 0xffffffff;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync(path.join(out, "icon.png"), png);
fs.writeFileSync(
  path.join(out, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#f4efe6"/>
  <circle cx="64" cy="64" r="44" fill="#5f7f66"/>
  <circle cx="64" cy="64" r="34" fill="#f4efe6"/>
  <path d="M64 34 L86 94 H76 L71 80 H57 L52 94 H42 Z M60 70 H68 L64 58 Z" fill="#2c2a26"/>
</svg>`,
);
console.log("Wrote resources/icon.png");
