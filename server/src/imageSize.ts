import fs from "node:fs";

export function readPngSize(filePath: string): { width: number; height: number } {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    if (buffer.toString("ascii", 1, 4) !== "PNG") {
      throw new Error("Not a PNG");
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } finally {
    fs.closeSync(fd);
  }
}

export function readJpegSize(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath);
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  throw new Error("JPEG size not found");
}

export function readImageSize(
  filePath: string,
  mime: string,
): { width: number; height: number } {
  if (mime === "image/png" || filePath.toLowerCase().endsWith(".png")) {
    return readPngSize(filePath);
  }
  if (
    mime === "image/jpeg" ||
    filePath.toLowerCase().endsWith(".jpg") ||
    filePath.toLowerCase().endsWith(".jpeg")
  ) {
    return readJpegSize(filePath);
  }
  if (mime === "image/webp" || filePath.toLowerCase().endsWith(".webp")) {
    return readWebpSize(filePath);
  }
  throw new Error(`Unsupported image type: ${mime}`);
}

function readWebpSize(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Not a WEBP");
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  throw new Error("Unsupported WEBP variant");
}
