/**
 * Zero-dependency PKZIP Archive Builder (CSP-safe, UTF-8 support, Deflate + Store fallback)
 *
 * Replaces external CDN JSZip injection so Backup Export works strictly under `script-src 'self'`
 * and offline / school LAN environments.
 */

export interface ZipFileEntry {
  name: string;
  content: string | Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function tryDeflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined' || data.length < 64) {
    return null;
  }
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    await writer.write(data as unknown as BufferSource);
    await writer.close();

    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    const reader = cs.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLen += value.byteLength;
      }
    }

    if (totalLen >= data.byteLength) {
      return null;
    }

    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  return { dosTime, dosDate };
}

export async function buildZipBytes(files: ZipFileEntry[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const now = new Date();
  const { dosTime, dosDate } = toDosDateTime(now);

  interface PreparedEntry {
    nameBytes: Uint8Array;
    compressedBytes: Uint8Array;
    uncompressedSize: number;
    crc: number;
    method: number; // 0 = STORE, 8 = DEFLATE
    localHeaderOffset: number;
  }

  const prepared: PreparedEntry[] = [];
  const localParts: Uint8Array[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const rawBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(rawBytes);
    const deflated = await tryDeflateRaw(rawBytes);
    const method = deflated ? 8 : 0;
    const compressedBytes = deflated ?? rawBytes;

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // General purpose bit flag: UTF-8 filename
    lv.setUint16(8, method, true); // Compression method
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressedBytes.length, true);
    lv.setUint32(22, rawBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    prepared.push({
      nameBytes,
      compressedBytes,
      uncompressedSize: rawBytes.length,
      crc,
      method,
      localHeaderOffset: currentOffset,
    });

    localParts.push(localHeader, compressedBytes);
    currentOffset += localHeader.length + compressedBytes.length;
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;

  for (const entry of prepared) {
    // Central Directory File Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
    cv.setUint16(10, entry.method, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, entry.crc, true);
    cv.setUint32(20, entry.compressedBytes.length, true);
    cv.setUint32(24, entry.uncompressedSize, true);
    cv.setUint16(28, entry.nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, entry.localHeaderOffset, true);
    centralHeader.set(entry.nameBytes, 46);

    centralParts.push(centralHeader);
    centralSize += centralHeader.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, prepared.length, true);
  ev.setUint16(10, prepared.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, currentOffset, true);
  ev.setUint16(20, 0, true);

  const totalSize = currentOffset + centralSize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localParts) {
    archive.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, pos);
    pos += part.length;
  }
  archive.set(eocd, pos);

  return archive;
}

export async function buildZipBlob(files: ZipFileEntry[]): Promise<Blob> {
  const bytes = await buildZipBytes(files);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/zip' });
}

