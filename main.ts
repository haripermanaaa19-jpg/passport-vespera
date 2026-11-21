// Writes this entry's passport-spread image to /output/entry.png.
// The image lives in the repository as spread.png, typeset from
// spread.html and rendered in a headless browser; this program
// validates it against the gate's caps and then places it where
// the grader looks for it.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1_048_576; // the gate's cap: 1 MiB
const MAX_SIDE = 1024; // the gate's cap: 1024 by 1024 pixels

// Reads the pixel dimensions out of a PNG or JPEG buffer, or
// returns null when the bytes are neither format.
function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, then the IHDR chunk carries width and
  // height as big-endian uint32 at offsets 16 and 20.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: walk the marker segments until a start-of-frame marker
  // (C0-CF except C4, C8, CC) turns up; its payload is precision,
  // height, width.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 4 <= buf.length) {
      if (buf[off] !== 0xff) return null;
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
      }
      off += 2 + len;
    }
  }
  return null;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const buf = readFileSync(join(here, "spread.png"));
  if (buf.length > MAX_BYTES) {
    throw new Error(`spread.png is ${buf.length} bytes; the cap is ${MAX_BYTES}`);
  }
  const size = imageSize(buf);
  if (size === null) {
    throw new Error("spread.png is not a whole PNG or JPEG image");
  }
  if (size.width > MAX_SIDE || size.height > MAX_SIDE) {
    throw new Error(`spread.png is ${size.width}x${size.height}; the cap is ${MAX_SIDE}x${MAX_SIDE}`);
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), buf);
}

main();
