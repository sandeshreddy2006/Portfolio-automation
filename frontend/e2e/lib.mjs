// Shared helpers for the browser tests. See e2e/README.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { chromium } from "playwright-core";

export const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
// fileURLToPath (not .pathname) so folders with spaces in their name, like "my projects", work.
export const OUT = fileURLToPath(new URL("./output", import.meta.url));
mkdirSync(OUT, { recursive: true });

/** Uses the browser already installed on the machine. Set E2E_BROWSER=chrome if you don't have Edge. */
export const launch = () => chromium.launch({ channel: process.env.E2E_BROWSER ?? "msedge", headless: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Writes a real 1200x800 PNG photo and a fake "image" (plain text) for the upload tests. */
export function makeImages() {
  const width = 1200, height = 800;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      rows[start + 1 + x * 3] = (x * 255) / width;
      rows[start + 2 + x * 3] = (y * 255) / height;
      rows[start + 3 + x * 3] = 160;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(`${OUT}/photo.png`, png);
  writeFileSync(`${OUT}/fake.png`, "this is not an image at all");
}
