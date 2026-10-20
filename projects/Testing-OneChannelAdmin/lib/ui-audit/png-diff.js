const zlib = require("zlib");

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

/**
 * Decode an 8-bit RGB or RGBA PNG into { width, height, data } RGBA bytes.
 * @param {Buffer | Uint8Array} buffer
 */
function decodePng(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Not a PNG");
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG color type ${colorType} depth ${bitDepth}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  /** @type {Buffer[]} */
  const idats = [];
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    if (type === "IDAT") idats.push(buf.subarray(start, start + length));
    offset = start + length + 4;
    if (type === "IEND") break;
  }
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const stride = width * channels;
  const data = Buffer.alloc(width * height * 4);
  let src = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const row = inflated.subarray(src, src + stride);
    src += stride;
    const recon = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? recon[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      let value = row[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      recon[i] = value & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const dest = (y * width + x) * 4;
      data[dest] = recon[source];
      data[dest + 1] = recon[source + 1];
      data[dest + 2] = recon[source + 2];
      data[dest + 3] = channels === 4 ? recon[source + 3] : 255;
    }
    previous = recon;
  }
  return { width, height, data };
}

/**
 * Fraction of pixels whose channels differ by more than `tolerance`.
 * Returns 1 when dimensions differ.
 */
function diffRatio(left, right, tolerance = 24) {
  if (!left || !right || left.width !== right.width || left.height !== right.height) {
    return 1;
  }
  const pixels = left.width * left.height;
  if (!pixels) return 0;
  let different = 0;
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4;
    if (
      Math.abs(left.data[offset] - right.data[offset]) > tolerance ||
      Math.abs(left.data[offset + 1] - right.data[offset + 1]) > tolerance ||
      Math.abs(left.data[offset + 2] - right.data[offset + 2]) > tolerance ||
      Math.abs(left.data[offset + 3] - right.data[offset + 3]) > tolerance
    ) {
      different += 1;
    }
  }
  return different / pixels;
}

module.exports = { decodePng, diffRatio };
