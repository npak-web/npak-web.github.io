// pack.js
import { NIBBLE_MAP, charToCode } from "./npak-codes.js";

const textDecoder = new TextDecoder("utf-8", { fatal: true });

class MemoryBitWriter {
  constructor(initialCapacity = 65536) {
    this.buffer = new Uint8Array(initialCapacity);
    this.offset = 0;
    this.highNibble = null;
  }

  ensureCapacity(extraBytes) {
    if (this.offset + extraBytes > this.buffer.length) {
      let newSize = this.buffer.length * 2;
      while (newSize < this.offset + extraBytes) {
        newSize *= 2;
      }
      const nextBuf = new Uint8Array(newSize);
      nextBuf.set(this.buffer.subarray(0, this.offset));
      this.buffer = nextBuf;
    }
  }

  writeNibble(nibble) {
    if (this.highNibble === null) {
      this.highNibble = nibble;
    } else {
      const byte = (this.highNibble << 4) | nibble;
      this.highNibble = null;
      this.ensureCapacity(1);
      this.buffer[this.offset++] = byte;
    }
  }

  alignByte() {
    if (this.highNibble !== null) {
      this.writeNibble(0);
    }
  }

  writeRawBytes(uint8Arr) {
    this.alignByte();
    this.ensureCapacity(uint8Arr.length);
    this.buffer.set(uint8Arr, this.offset);
    this.offset += uint8Arr.length;
  }

  writeString(str) {
    for (const char of str) {
      const numStr = String(charToCode(char));
      for (let i = 0; i < numStr.length; i++) {
        this.writeNibble(NIBBLE_MAP[numStr[i]]);
      }
      this.writeNibble(NIBBLE_MAP["SEP"]);
    }
  }

  writeBinaryFile(fileBytes) {
    this.writeNibble(NIBBLE_MAP["CMD_BIN"]);
    this.alignByte();

    const sizeHeader = new Uint8Array(4);
    new DataView(sizeHeader.buffer).setUint32(0, fileBytes.length, false);
    this.writeRawBytes(sizeHeader);
    this.writeRawBytes(fileBytes);
  }

  async finish() {
    let padding = 0;
    if (this.highNibble !== null) {
      padding = 4;
      this.writeNibble(0);
    }

    const payload = this.buffer.subarray(0, this.offset);
    const hashBuffer = await crypto.subtle.digest("SHA-256", payload);
    const checksum = new Uint8Array(hashBuffer).subarray(0, 4);

    const archive = new Uint8Array(9 + payload.length);
    archive.set([0x4e, 0x50, 0x41, 0x4b], 0); // "NPAK"
    archive.set(checksum, 4);
    archive[8] = padding;
    archive.set(payload, 9);

    return archive;
  }
}

function canCompressAsText(uint8Arr) {
  if (uint8Arr.length === 0) return { isText: true, text: "" };

  const checkLen = Math.min(uint8Arr.length, 4096);
  for (let i = 0; i < checkLen; i++) {
    if (uint8Arr[i] === 0) return { isText: false, text: null };
  }

  try {
    const text = textDecoder.decode(uint8Arr);
    if (text.includes("\uFFFD")) return { isText: false, text: null };
    return { isText: true, text };
  } catch {
    return { isText: false, text: null };
  }
}

export async function packTargets(entries, onProgress) {
  if (!entries || entries.length === 0) {
    throw new Error("Архив пуст — нечего упаковывать.");
  }

  const writer = new MemoryBitWriter();
  const totalSteps = entries.length;

  for (let i = 0; i < totalSteps; i++) {
    const item = entries[i];
    const relPath = item.path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!relPath) continue;

    if (item.isDir) {
      writer.writeNibble(NIBBLE_MAP["CMD_DIR"]);
      writer.writeString(relPath);
      writer.writeNibble(NIBBLE_MAP["CMD_END"]);
    } else {
      writer.writeNibble(NIBBLE_MAP["CMD_FILE"]);
      writer.writeString(relPath);

      const fileBytes =
        item.data instanceof Uint8Array
          ? item.data
          : new Uint8Array(item.data || 0);

      const { isText, text } = canCompressAsText(fileBytes);

      if (isText) {
        writer.writeNibble(NIBBLE_MAP["CMD_DATA"]);
        writer.writeString(text);
        writer.writeNibble(NIBBLE_MAP["CMD_END"]);
      } else {
        writer.writeBinaryFile(fileBytes);
      }
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalSteps) * 100));
    }
  }

  return await writer.finish();
}
