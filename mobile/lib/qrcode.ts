/**
 * High-Performance, Zero-Dependency QR Code Generator for Mobile (React Native / Expo)
 * Produces boolean matrix for SVG / View rendering.
 */

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function getRSECCoefficients(numECCodewords: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < numECCodewords; i++) {
    poly = polyMul(poly, new Uint8Array([1, GF256_EXP[i]])) as Uint8Array;
  }
  return poly;
}

function calculateRS(data: Uint8Array, numECCodewords: number): Uint8Array {
  const genPoly = getRSECCoefficients(numECCodewords);
  const remainder = new Uint8Array(numECCodewords);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < numECCodewords - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(genPoly[j + 1], factor);
    }
    remainder[numECCodewords - 1] = gfMul(genPoly[numECCodewords], factor);
  }
  return remainder;
}

interface QRVersion {
  version: number;
  totalCodewords: number;
  ecCodewords: number;
  dataCodewords: number;
  align: number[];
}

const QR_TABLE_M: (QRVersion | null)[] = [
  null,
  { version: 1, totalCodewords: 26, ecCodewords: 10, dataCodewords: 16, align: [] },
  { version: 2, totalCodewords: 44, ecCodewords: 16, dataCodewords: 28, align: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewords: 26, dataCodewords: 44, align: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewords: 36, dataCodewords: 64, align: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewords: 48, dataCodewords: 86, align: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewords: 64, dataCodewords: 108, align: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewords: 72, dataCodewords: 124, align: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewords: 88, dataCodewords: 154, align: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewords: 110, dataCodewords: 182, align: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewords: 130, dataCodewords: 216, align: [6, 28, 50] },
];

function stringToUtf8ByteArray(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0xd800 || c >= 0xe000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function encodeData(text: string, versionInfo: QRVersion): Uint8Array {
  const utf8 = stringToUtf8ByteArray(text);
  const dataLen = utf8.length;
  const bits: number[] = [];

  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4);
  pushBits(dataLen, versionInfo.version <= 9 ? 8 : 16);
  for (let i = 0; i < dataLen; i++) {
    pushBits(utf8[i], 8);
  }

  const maxBits = versionInfo.dataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const codewords = new Uint8Array(versionInfo.dataCodewords);
  for (let i = 0; i < codewords.length; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    codewords[i] = byteVal;
  }

  return codewords;
}

export function generateQRMatrix(text: string): boolean[][] {
  const utf8 = stringToUtf8ByteArray(text);
  const utf8Len = utf8.length;
  let versionInfo: QRVersion | null = null;

  for (let v = 1; v <= 10; v++) {
    const table = QR_TABLE_M[v];
    if (!table) continue;
    const headerBytes = v <= 9 ? 2 : 3;
    if (utf8Len + headerBytes <= table.dataCodewords) {
      versionInfo = table;
      break;
    }
  }

  if (!versionInfo) {
    versionInfo = QR_TABLE_M[10]!;
  }

  const dataCodewords = encodeData(text, versionInfo);
  const ecCodewords = calculateRS(dataCodewords, versionInfo.ecCodewords);

  const allCodewords = new Uint8Array(dataCodewords.length + ecCodewords.length);
  allCodewords.set(dataCodewords, 0);
  allCodewords.set(ecCodewords, dataCodewords.length);

  const size = 17 + versionInfo.version * 4;
  const matrix: (number | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r: number, c: number, val: boolean | number, func = false) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val ? 1 : 0;
      if (func) isFunction[r][c] = true;
    }
  }

  function addFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (row + r < 0 || row + r >= size || col + c < 0 || col + c >= size) continue;
        const isBlack =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setModule(row + r, col + c, isBlack, true);
      }
    }
  }
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  if (versionInfo.align.length > 0) {
    const coords = versionInfo.align;
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const r = coords[i];
        const c = coords[j];
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, isBlack, true);
          }
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (!isFunction[6][i]) setModule(6, i, val, true);
    if (!isFunction[i][6]) setModule(i, 6, val, true);
  }

  setModule(size - 8, 8, true, true);

  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) setModule(8, i, 0, true);
    if (!isFunction[i][8]) setModule(i, 8, 0, true);
    if (!isFunction[8][size - 1 - i]) setModule(8, size - 1 - i, 0, true);
    if (!isFunction[size - 1 - i][8]) setModule(size - 1 - i, 8, 0, true);
  }

  const bitArray: number[] = [];
  for (let i = 0; i < allCodewords.length; i++) {
    const byte = allCodewords[i];
    for (let b = 7; b >= 0; b--) {
      bitArray.push((byte >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      const row = upwards ? size - 1 - vert : vert;
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = right - colOffset;
        if (!isFunction[row][col]) {
          const bitVal = bitIdx < bitArray.length ? bitArray[bitIdx++] : 0;
          matrix[row][col] = bitVal;
        }
      }
    }
    upwards = !upwards;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c]) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] = matrix[r][c] === 1 ? 0 : 1;
        }
      }
    }
  }

  const FORMAT_M_MASK0 = 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = (FORMAT_M_MASK0 >> i) & 1;
    if (i < 6) setModule(i, 8, bit, true);
    else if (i === 6) setModule(7, 8, bit, true);
    else if (i === 7) setModule(8, 8, bit, true);
    else if (i === 8) setModule(8, 7, bit, true);
    else setModule(8, 14 - i, bit, true);

    if (i < 8) setModule(8, size - 1 - i, bit, true);
    else setModule(size - 15 + i, 8, bit, true);
  }

  return matrix.map((row) => row.map((v) => v === 1));
}
