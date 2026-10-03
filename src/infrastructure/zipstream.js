(function (Tojiru) {
  const LOCAL_SIGNATURE = 0x04034b50;
  const DESCRIPTOR_SIGNATURE = 0x08074b50;
  const CENTRAL_SIGNATURE = 0x02014b50;
  const END_SIGNATURE = 0x06054b50;
  const ZIP_VERSION = 20;
  const FLAG_UTF8 = 0x0800;
  const FLAG_DESCRIPTOR = 0x0008;
  const METHOD_STORE = 0;
  const LOCAL_HEADER_SIZE = 30;
  const DESCRIPTOR_SIZE = 16;
  const CENTRAL_HEADER_SIZE = 46;
  const END_RECORD_SIZE = 22;
  const MAX_UINT32 = 0xffffffff;
  const MAX_ENTRIES = 0xffff;
  const FLUSH_THRESHOLD = 1024 * 1024;
  const DOS_EPOCH_YEAR = 1980;

  class ZipLimitError extends Error {
    constructor(reason) {
      super(`ZIP limit exceeded: ${reason}`);
      this.name = "ZipLimitError";
      this.reason = reason;
    }
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[index] = value >>> 0;
    }
    return table;
  })();

  function updateCrc(crc, chunk) {
    let value = crc;
    for (let index = 0; index < chunk.length; index++) value = CRC_TABLE[(value ^ chunk[index]) & 0xff] ^ (value >>> 8);
    return value;
  }

  function dosDateTime(date) {
    const year = Math.max(date.getFullYear(), DOS_EPOCH_YEAR) - DOS_EPOCH_YEAR;
    return {
      date: (year << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    };
  }

  function buildLocalHeader(nameBytes, { date, time }, { flags, crc = 0, size = 0 }) {
    const bytes = new Uint8Array(LOCAL_HEADER_SIZE + nameBytes.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, LOCAL_SIGNATURE, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, flags, true);
    view.setUint16(8, METHOD_STORE, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    bytes.set(nameBytes, LOCAL_HEADER_SIZE);
    return bytes;
  }

  function buildDescriptor(crc, size) {
    const bytes = new Uint8Array(DESCRIPTOR_SIZE);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, DESCRIPTOR_SIGNATURE, true);
    view.setUint32(4, crc, true);
    view.setUint32(8, size, true);
    view.setUint32(12, size, true);
    return bytes;
  }

  function buildCentralHeader(entry) {
    const bytes = new Uint8Array(CENTRAL_HEADER_SIZE + entry.nameBytes.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, CENTRAL_SIGNATURE, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, ZIP_VERSION, true);
    view.setUint16(8, entry.flags, true);
    view.setUint16(10, METHOD_STORE, true);
    view.setUint16(12, entry.time, true);
    view.setUint16(14, entry.date, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint32(42, entry.offset, true);
    bytes.set(entry.nameBytes, CENTRAL_HEADER_SIZE);
    return bytes;
  }

  function buildEndRecord(entryCount, centralSize, centralOffset) {
    const bytes = new Uint8Array(END_RECORD_SIZE);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, END_SIGNATURE, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    return bytes;
  }

  function concatenate(chunks, totalLength) {
    if (chunks.length === 1) return chunks[0];
    const joined = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
      joined.set(chunk, position);
      position += chunk.length;
    }
    return joined;
  }

  async function readChunks(source, onChunk) {
    const reader = source.stream().getReader();
    for (let result = await reader.read(); !result.done; result = await reader.read()) await onChunk(result.value);
  }

  const isStreamable = (source) => typeof source.stream === "function";
  const toBytes = (source) => (typeof source === "string" ? new TextEncoder().encode(source) : source);
  const finalizeCrc = (crc) => (crc ^ 0xffffffff) >>> 0;
  const sizeOfSource = (source) => source.size ?? source.length ?? 0;
  const totalSize = (entries) => entries.reduce((sum, entry) => sum + sizeOfSource(entry.source), 0);

  function createZipWriter({ sink, clock = () => new Date() }) {
    const encoder = new TextEncoder();
    const entries = [];
    let position = 0;
    let pending = [];
    let pendingLength = 0;

    async function flush() {
      if (pendingLength === 0) return;
      const joined = concatenate(pending, pendingLength);
      pending = [];
      pendingLength = 0;
      await sink.write(joined);
    }

    async function emit(bytes) {
      position += bytes.length;
      if (position > MAX_UINT32) throw new ZipLimitError("archive larger than 4 GiB");
      pending.push(bytes);
      pendingLength += bytes.length;
      if (pendingLength >= FLUSH_THRESHOLD) await flush();
    }

    async function addBuffered(nameBytes, stamp, bytes) {
      const crc = finalizeCrc(updateCrc(0xffffffff, bytes));
      const offset = position;
      await emit(buildLocalHeader(nameBytes, stamp, { flags: FLAG_UTF8, crc, size: bytes.length }));
      await emit(bytes);
      return { crc, size: bytes.length, offset, flags: FLAG_UTF8 };
    }

    async function addStreamed(nameBytes, stamp, source) {
      const flags = FLAG_UTF8 | FLAG_DESCRIPTOR;
      const offset = position;
      await emit(buildLocalHeader(nameBytes, stamp, { flags }));
      let crc = 0xffffffff;
      let size = 0;
      await readChunks(source, async (chunk) => {
        crc = updateCrc(crc, chunk);
        size += chunk.length;
        await emit(chunk);
      });
      const finalCrc = finalizeCrc(crc);
      await emit(buildDescriptor(finalCrc, size));
      return { crc: finalCrc, size, offset, flags };
    }

    async function addEntry(name, source) {
      if (entries.length >= MAX_ENTRIES) throw new ZipLimitError("more than 65535 entries");
      const nameBytes = encoder.encode(name);
      const stamp = dosDateTime(clock());
      const written = isStreamable(source)
        ? await addStreamed(nameBytes, stamp, source)
        : await addBuffered(nameBytes, stamp, toBytes(source));
      entries.push({ nameBytes, ...written, ...stamp });
    }

    async function finish() {
      const centralOffset = position;
      for (const entry of entries) await emit(buildCentralHeader(entry));
      const centralSize = position - centralOffset;
      await emit(buildEndRecord(entries.length, centralSize, centralOffset));
      await flush();
      return position;
    }

    return { addEntry, finish };
  }

  async function writeEntriesToSink({ sink, entries, onProgress }) {
    const writer = createZipWriter({ sink });
    const total = totalSize(entries);
    let done = 0;
    onProgress(0);
    for (const [index, entry] of entries.entries()) {
      await writer.addEntry(entry.path, entry.source);
      done += sizeOfSource(entry.source);
      onProgress(total ? (done / total) * 100 : ((index + 1) / entries.length) * 100);
    }
    await writer.finish();
    onProgress(100);
  }

  async function writeArchive({ entries, createSink, fileName, onProgress, writeToMemory }) {
    if (!createSink) return writeToMemory();
    let sink = null;
    try {
      sink = await createSink({ fileName, requiredBytes: totalSize(entries) });
      await writeEntriesToSink({ sink, entries, onProgress });
      return await sink.close();
    } catch (error) {
      await sink?.abort();
      if (error instanceof ZipLimitError) throw error;
      return writeToMemory();
    }
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.zipstream = { createZipWriter, writeArchive, ZipLimitError };
})((window.Tojiru = window.Tojiru || {}));
