const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, "..", "icons");

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makePng(size) {
  const pixels = Buffer.alloc(size * size * 4);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    const index = (y * size + x) * 4;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = color[3];
  }

  function fillRect(x, y, width, height, color) {
    for (let yy = y; yy < y + height; yy += 1) {
      for (let xx = x; xx < x + width; xx += 1) {
        setPixel(xx, yy, color);
      }
    }
  }

  const navy = [17, 24, 39, 255];
  const white = [255, 255, 255, 255];
  const green = [34, 197, 94, 255];
  const unit = Math.max(1, Math.round(size / 16));

  fillRect(0, 0, size, size, navy);
  fillRect(0, size - unit * 3, size, unit * 3, green);

  fillRect(unit * 2, unit * 4, unit * 2, unit * 7, white);
  fillRect(unit * 4, unit * 4, unit * 4, unit, white);
  fillRect(unit * 4, unit * 10, unit * 4, unit, white);

  fillRect(unit * 9, unit * 4, unit * 2, unit * 7, white);
  fillRect(unit * 11, unit * 5, unit, unit * 2, white);
  fillRect(unit * 12, unit * 7, unit, unit * 2, white);
  fillRect(unit * 13, unit * 5, unit, unit * 2, white);
  fillRect(unit * 14, unit * 4, unit * 2, unit * 7, white);

  const rawRows = [];
  for (let y = 0; y < size; y += 1) {
    rawRows.push(Buffer.from([0]));
    rawRows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rawRows))),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(outDir, { recursive: true });
for (const size of sizes) {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), makePng(size));
}
