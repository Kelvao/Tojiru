(function (Tojiru) {
  const WINDOW_BYTES = 64 * 1024;
  const HEAD_BYTES = 32;
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const EXIF_ORIENTATION_TAG = 0x0112;
  const FIRST_TRANSPOSING_ORIENTATION = 5;
  const NON_FRAME_MARKERS = new Set([0xc4, 0xc8, 0xcc]);

  const ascii = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const viewOf = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const sized = (width, height) => (width > 0 && height > 0 ? { width, height } : null);

  function createReader(readBytes) {
    let start = 0;
    let bytes = new Uint8Array(0);
    return {
      async read(offset, length) {
        if (offset < start || offset + length > start + bytes.length) {
          start = offset;
          bytes = await readBytes(offset, Math.max(length, WINDOW_BYTES));
        }
        return bytes.subarray(offset - start, offset - start + length);
      },
    };
  }

  function pngSize(head) {
    const isPng = head.length >= 24 && PNG_SIGNATURE.every((value, index) => head[index] === value);
    if (!isPng || ascii(head, 12, 4) !== "IHDR") return null;
    const view = viewOf(head);
    return sized(view.getUint32(16), view.getUint32(20));
  }

  function gifSize(head) {
    if (head.length < 10 || !/^GIF8[79]a$/.test(ascii(head, 0, 6))) return null;
    const view = viewOf(head);
    return sized(view.getUint16(6, true), view.getUint16(8, true));
  }

  function webpSize(head) {
    if (head.length < 30 || ascii(head, 0, 4) !== "RIFF" || ascii(head, 8, 4) !== "WEBP") return null;
    const view = viewOf(head);
    const chunk = ascii(head, 12, 4);
    if (chunk === "VP8 ") {
      const hasStartCode = head[23] === 0x9d && head[24] === 0x01 && head[25] === 0x2a;
      return hasStartCode ? sized(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff) : null;
    }
    if (chunk === "VP8L") {
      if (head[20] !== 0x2f) return null;
      const bits = view.getUint32(21, true);
      return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8X") {
      const width = 1 + (head[24] | (head[25] << 8) | (head[26] << 16));
      const height = 1 + (head[27] | (head[28] << 8) | (head[29] << 16));
      return sized(width, height);
    }
    return null;
  }

  async function exifOrientation(reader, dataOffset, dataLength) {
    const data = await reader.read(dataOffset, Math.min(dataLength, WINDOW_BYTES));
    if (data.length < 14 || ascii(data, 0, 6) !== "Exif\u0000\u0000") return null;
    const byteOrder = ascii(data, 6, 2);
    if (byteOrder !== "II" && byteOrder !== "MM") return null;
    const littleEndian = byteOrder === "II";
    const view = viewOf(data);
    const directory = 6 + view.getUint32(10, littleEndian);
    if (directory + 2 > data.length) return null;
    const entryCount = view.getUint16(directory, littleEndian);
    for (let index = 0; index < entryCount; index++) {
      const entry = directory + 2 + index * 12;
      if (entry + 12 > data.length) return null;
      if (view.getUint16(entry, littleEndian) === EXIF_ORIENTATION_TAG) return view.getUint16(entry + 8, littleEndian);
    }
    return null;
  }

  const isFrameMarker = (marker) => marker >= 0xc0 && marker <= 0xcf && !NON_FRAME_MARKERS.has(marker);
  const isStandaloneMarker = (marker) => marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7);

  async function jpegSize(reader) {
    let offset = 2;
    let orientation = 1;
    for (;;) {
      const header = await reader.read(offset, 4);
      if (header.length < 2 || header[0] !== 0xff) return null;
      const marker = header[1];
      if (marker === 0xff) {
        offset += 1;
      } else if (isStandaloneMarker(marker)) {
        offset += 2;
      } else if (marker === 0xd9 || marker === 0xda || header.length < 4) {
        return null;
      } else {
        const length = (header[2] << 8) | header[3];
        if (length < 2) return null;
        if (isFrameMarker(marker)) {
          const frame = await reader.read(offset + 5, 4);
          if (frame.length < 4) return null;
          const view = viewOf(frame);
          const size = sized(view.getUint16(2), view.getUint16(0));
          return orientation >= FIRST_TRANSPOSING_ORIENTATION ? null : size;
        }
        if (marker === 0xe1) orientation = (await exifOrientation(reader, offset + 4, length - 2)) ?? orientation;
        offset += 2 + length;
      }
    }
  }

  async function readImageSize(readBytes) {
    const reader = createReader(readBytes);
    const head = await reader.read(0, HEAD_BYTES);
    if (head[0] === 0xff && head[1] === 0xd8) return jpegSize(reader);
    return pngSize(head) ?? gifSize(head) ?? webpSize(head);
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.imagesize = { readImageSize };
})((window.Tojiru = window.Tojiru || {}));
