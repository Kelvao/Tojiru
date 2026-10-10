const test = require("node:test");
const assert = require("node:assert");
const JSZip = require("jszip");
const { loadScripts } = require("./load");

const { createZipWriter, ZipLimitError } = loadScripts(["src/domain/library.js", "src/infrastructure/zipstream.js"], {
  TextEncoder,
}).infra.zipstream;

const FIXED_CLOCK = () => new Date(2024, 4, 17, 13, 45, 30);

function memorySink() {
  const chunks = [];
  return {
    chunks,
    write: async (bytes) => {
      chunks.push(Buffer.from(bytes));
    },
    bytes: () => Buffer.concat(chunks),
  };
}

async function pack(entries) {
  const sink = memorySink();
  const writer = createZipWriter({ sink, clock: FIXED_CLOCK });
  for (const [name, source] of entries) await writer.addEntry(name, source);
  const length = await writer.finish();
  return { sink, length, zip: await JSZip.loadAsync(sink.bytes(), { checkCRC32: true }) };
}

test("zip writer produces an archive JSZip reads back with valid CRCs", async () => {
  const { zip, length, sink } = await pack([
    ["0001.jpg", Buffer.from("first page")],
    ["0002.jpg", Buffer.from("second page")],
    ["ComicInfo.xml", "<ComicInfo/>"],
  ]);
  assert.deepEqual(Object.keys(zip.files), ["0001.jpg", "0002.jpg", "ComicInfo.xml"]);
  assert.equal(await zip.file("0001.jpg").async("string"), "first page");
  assert.equal(await zip.file("ComicInfo.xml").async("string"), "<ComicInfo/>");
  assert.equal(length, sink.bytes().length);
});

test("zip writer streams large multi-chunk sources and flushes in batches", async () => {
  const data = Buffer.alloc(5 * 1024 * 1024 + 123);
  for (let index = 0; index < data.length; index++) data[index] = (index * 31 + 7) & 0xff;
  const { zip, sink } = await pack([["big.bin", new Blob([data])]]);
  const restored = await zip.file("big.bin").async("nodebuffer");
  assert.ok(restored.equals(data));
  assert.ok(sink.chunks.length < 20);
});

test("zip writer stores UTF-8 names, empty files and the DOS timestamp", async () => {
  const { zip } = await pack([
    ["capítulo 日本.txt", Buffer.from("x")],
    ["empty.bin", Buffer.alloc(0)],
  ]);
  assert.ok(zip.file("capítulo 日本.txt"));
  assert.equal((await zip.file("empty.bin").async("nodebuffer")).length, 0);
  const date = zip.file("empty.bin").date;
  assert.equal(date.getUTCFullYear(), 2024);
  assert.equal(date.getUTCMonth(), 4);
  assert.equal(date.getUTCDate(), 17);
  assert.equal(date.getUTCHours(), 13);
  assert.equal(date.getUTCMinutes(), 45);
});

test("zip writer rejects more entries than the classic ZIP format allows", async () => {
  const writer = createZipWriter({ sink: memorySink(), clock: FIXED_CLOCK });
  for (let index = 0; index < 0xffff; index++) await writer.addEntry(`${index}`, Buffer.alloc(0));
  await assert.rejects(writer.addEntry("overflow", Buffer.alloc(0)), (error) => error instanceof ZipLimitError);
});

test("writeArchive reports a notice when it falls back to memory", async () => {
  const { writeArchive } = loadScripts(["src/domain/library.js", "src/infrastructure/zipstream.js"], { TextEncoder })
    .infra.zipstream;
  const notices = [];
  const result = await writeArchive({
    entries: [],
    createSink: async () => {
      throw new Error("OPFS unavailable");
    },
    fileName: "a.cbz",
    onProgress: () => {},
    onNotice: (notice) => notices.push(notice.code),
    writeToMemory: async () => "memory",
  });
  assert.equal(result, "memory");
  assert.deepEqual(notices, ["diskFallback"]);
});

test("writeArchive does not hide application errors behind the memory fallback", async () => {
  const lib = loadScripts(["src/domain/library.js", "src/infrastructure/zipstream.js"], { TextEncoder });
  const failure = new lib.domain.ImageReadError("a.png");
  await assert.rejects(
    lib.infra.zipstream.writeArchive({
      entries: [],
      createSink: async () => {
        throw failure;
      },
      fileName: "a.cbz",
      onProgress: () => {},
      onNotice: () => assert.fail("no fallback expected"),
      writeToMemory: async () => assert.fail("no fallback expected"),
    }),
    (error) => error === failure,
  );
});
