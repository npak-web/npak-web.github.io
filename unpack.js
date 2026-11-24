// unpack.js
import { REV_NIBBLE_MAP, codeToChar } from "./npak-codes.js";

const textEncoder = new TextEncoder();
const fallbackDecoder = new TextDecoder("utf-8", { fatal: false });

export async function unpackArchive(archiveBuffer, onProgress) {
  const buf =
    archiveBuffer instanceof Uint8Array
      ? archiveBuffer
      : new Uint8Array(archiveBuffer);

  if (buf.length < 10) {
    throw new Error("Файл архива слишком мал или поврежден.");
  }

  const magic = fallbackDecoder.decode(buf.subarray(0, 4));
  if (magic !== "NPAK") {
    throw new Error("Файл не является архивом формата .npak.");
  }

  const savedChecksum = buf.subarray(4, 8);
  const padding = buf[8];
  const dataBytes = buf.subarray(9);

  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
  const actualChecksum = new Uint8Array(hashBuffer).subarray(0, 4);

  for (let i = 0; i < 4; i++) {
    if (savedChecksum[i] !== actualChecksum[i]) {
      throw new Error(
        "Целостность архива нарушена! Файл изменен или поврежден.",
      );
    }
  }

  const unpackedItems = [];
  let mode = null;
  let currentPath = "";
  let textChunks = [];
  let digitBuffer = "";

  let byteIdx = 0;
  let isLowNibble = false;
  const totalBytes = dataBytes.length;
  const dataView = new DataView(
    dataBytes.buffer,
    dataBytes.byteOffset,
    dataBytes.byteLength,
  );
  let lastPercent = 0;

  while (byteIdx < totalBytes) {
    if (onProgress) {
      const currentPercent = Math.floor((byteIdx / totalBytes) * 100);
      if (currentPercent > lastPercent) {
        lastPercent = currentPercent;
        onProgress(lastPercent);
      }
    }

    if (byteIdx === totalBytes - 1 && isLowNibble && padding === 4) {
      break;
    }

    const currentByte = dataBytes[byteIdx];
    const nibble = isLowNibble ? currentByte & 0x0f : currentByte >> 4;

    if (isLowNibble) {
      byteIdx++;
      isLowNibble = false;
    } else {
      isLowNibble = true;
    }

    const token = REV_NIBBLE_MAP[nibble];

    if (token === "CMD_DIR") {
      mode = "DIR";
      currentPath = "";
    } else if (token === "CMD_FILE") {
      mode = "FILE_PATH";
      currentPath = "";
    } else if (token === "CMD_DATA") {
      mode = "FILE_DATA";
      textChunks = [];
    } else if (token === "CMD_BIN") {
      if (isLowNibble) {
        byteIdx++;
        isLowNibble = false;
      }

      const binSize = dataView.getUint32(byteIdx, false);
      byteIdx += 4;

      const binContent = dataBytes.slice(byteIdx, byteIdx + binSize);
      byteIdx += binSize;

      unpackedItems.push({
        path: currentPath,
        isDir: false,
        data: binContent,
      });
      mode = null;
    } else if (token === "CMD_END") {
      if (mode === "DIR") {
        unpackedItems.push({
          path: currentPath,
          isDir: true,
          data: null,
        });
      } else if (mode === "FILE_DATA") {
        unpackedItems.push({
          path: currentPath,
          isDir: false,
          data: textEncoder.encode(textChunks.join("")),
        });
      }
      mode = null;
    } else if (token === "SEP") {
      const num = Number(digitBuffer);
      const char = codeToChar(num);
      if (mode === "DIR" || mode === "FILE_PATH") {
        currentPath += char;
      } else if (mode === "FILE_DATA") {
        textChunks.push(char);
      }
      digitBuffer = "";
    } else {
      digitBuffer += token;
    }
  }

  if (onProgress) onProgress(100);
  return unpackedItems;
}
