import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END = 0x06064b50;

const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;

export type ZipEntry = {
  name: string;
  bytes: Buffer;
};

/**
 * Reads stored and deflated ZIP entries. Official SSA `names.zip` files fit this reader.
 * Zip64 archives are rejected rather than partially read.
 */
export function readZip(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  let total = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) === ZIP64_END) {
      throw new Error("Zip64 archives are not supported for the SSA import.");
    }

    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY) {
      throw new Error("SSA zip central directory is unreadable.");
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!name || name.endsWith("/")) {
      continue;
    }

    const bytes = readLocalEntry(buffer, localOffset, method, compressedSize, uncompressedSize);
    total += bytes.length;

    if (total > MAX_ARCHIVE_BYTES) {
      throw new Error("SSA zip expands past the 256MB import limit.");
    }

    entries.push({ name, bytes });
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 22 - 65_535);

  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    const signature = buffer.readUInt32LE(offset);

    if (signature === ZIP64_END) {
      throw new Error("Zip64 archives are not supported for the SSA import.");
    }

    if (signature === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }

  throw new Error("SSA zip is missing an end-of-central-directory record.");
}

function readLocalEntry(
  buffer: Buffer,
  offset: number,
  method: number,
  compressedSize: number,
  uncompressedSize: number
): Buffer {
  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_HEADER) {
    throw new Error("SSA zip local file header is unreadable.");
  }

  const flags = buffer.readUInt16LE(offset + 6);

  if ((flags & 0x1) !== 0) {
    throw new Error("Encrypted SSA zip entries are not supported.");
  }

  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;

  if (uncompressedSize > MAX_ENTRY_BYTES || compressedSize > MAX_ENTRY_BYTES) {
    throw new Error("An SSA zip entry exceeds the 64MB import limit.");
  }

  if (dataEnd > buffer.length) {
    throw new Error("SSA zip entry extends past the end of the file.");
  }

  const compressed = buffer.subarray(dataStart, dataEnd);

  if (method === 0) {
    return Buffer.from(compressed);
  }

  if (method === 8) {
    const inflated = inflateRawSync(compressed);

    if (inflated.length !== uncompressedSize && uncompressedSize !== 0) {
      throw new Error("SSA zip entry decompressed to an unexpected size.");
    }

    return inflated;
  }

  throw new Error(`SSA zip compression method ${method} is not supported.`);
}
