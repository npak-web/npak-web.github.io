# NPAK

**A fast JavaScript archiver for the `.npak` format**, running seamlessly in both Node.js and the browser with zero server uploads.

[English](README.en.md) | [Русский](README.md)

**Live Demo:** [Try NPAK Online Converter (.zip ↔ .npak)](https://github.io)

---

## Key Features

- **Hybrid Compression Engine:** Automatically detects incompressible files (media, pre-compressed binaries) and stores them directly with zero speed loss.
- **Optimized for Text & Code:** Uses static frequency dictionaries and 4-bit codes for rapid compression of source code and plain text.
- **Strong Integrity Verification:** Uses cryptographic **SHA-256** hashing instead of legacy CRC-32.
- **100% Client-Side Privacy:** The web converter (`npak-web`) processes everything locally in the user's browser — no files are ever sent over the network.
- **Bidirectional Conversion:** Supports seamless two-way conversion between `.zip` and `.npak`.

---

## Comparison: ZIP vs NPAK

| Feature                     | ZIP                                                             | NPAK                                                                                    |
| :-------------------------- | :-------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **Core Technology**         | C / C++                                                         | JavaScript                                                                              |
| **Availability**            | Built into most operating systems                               | In the browser (`npak-web`) or via npm (`npak-archiver`)                                |
| **Text & Code Compression** | Adaptive Deflate algorithm                                      | Static frequency dictionaries and 4-bit codes                                           |
| **Media & Binary Files**    | Wastes CPU cycles trying to re-compress already compressed data | Hybrid engine detects incompressible files and packs them directly without speed loss   |
| **Integrity Check**         | Legacy CRC-32                                                   | Cryptographic SHA-256 hash                                                              |
| **Web Privacy**             | Depends on the third-party online service                       | Complete privacy: all operations run locally in the browser with zero network transfers |

---

## Installation

To use NPAK in Node.js projects or modern bundlers (Vite, Webpack), install the npm package:

```bash
npm install npak-archiver
```

---

## Usage

### In Code (ES Modules)

```javascript
import { packTargets } from "./pack.js";
import { unpackArchive } from "./unpack.js";

// 1. Pack files into .npak format
const entries = [
  { path: "docs/", isDir: true, data: null },
  {
    path: "docs/hello.txt",
    isDir: false,
    data: new TextEncoder().encode("Hello, NPAK!"),
  },
];

const npakBytes = await packTargets(entries, (progress) => {
  console.log(`Packing progress: ${progress}%`);
});

// 2. Unpack a .npak archive
const extractedItems = await unpackArchive(npakBytes.buffer, (progress) => {
  console.log(`Unpacking progress: ${progress}%`);
});

console.log(extractedItems);
```

### Online Converter (`npak-web`)

You can run the web interface locally by serving the project directory over HTTP (e.g., via `npx serve` or VS Code Live Server):

```bash
npx serve .
```

> **Note:** Because the browser converter uses native ES modules (`pack.js` and `unpack.js`), it must be served via `http://` or `https://` rather than opened directly via `file://`.

---

## Project Structure

```text
├── index.html          # Landing page with feature overview and format comparison
├── converter.html      # Browser-based converter (.zip ↔ .npak) with Drag-and-Drop
├── pack.js             # Core module for packing data into .npak
├── unpack.js           # Core module for unpacking and SHA-256 verification
├── README.md           # English documentation
└── README.ru.md        # Russian documentation
```

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.
