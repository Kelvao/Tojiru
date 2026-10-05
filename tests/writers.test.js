const test = require("node:test");
const assert = require("node:assert");
const JSZip = require("jszip");
const { loadScripts } = require("./load");

const Tojiru = loadScripts(
  [
    "src/domain/library.js",
    "src/application/usecases.js",
    "src/infrastructure/xml.js",
    "src/infrastructure/zipstream.js",
    "src/infrastructure/cbz.js",
    "src/infrastructure/epub.js",
  ],
  { TextEncoder },
);
const D = Tojiru.domain;
const getJsZip = () => JSZip;

const page = (path) => ({ name: path.split("/").pop(), path, source: Buffer.from(path) });
const translator = {
  language: "pt-BR",
  t: (key) =>
    ({
      "kind.cover.name": "Capa",
      "kind.toc.name": "Índice",
      "kind.chapter.name": "Capítulo",
      "kind.extra.name": "Extra",
      "kind.back.name": "Contracapa",
      "kind.toc.label": "Índice",
      "kind.cover.label": "Capa",
      "epub.start": "Início da leitura",
    })[key] ?? key,
};

function buildOutput(items, rawMetadata = {}) {
  const metadata = D.normalizeMetadata({
    series: "Meu Mangá & Cia",
    writer: "Autor",
    genres: "Ação, Aventura",
    year: "2020",
    volume: "3",
    language: "pt",
    ...rawMetadata,
  });
  return Tojiru.usecases.buildOutputDocument({ items, metadata, translator });
}

const sampleItems = () =>
  D.buildItems([
    page("M/capa.jpg"),
    page("M/indice.jpg"),
    page("M/Cap 1/1.jpg"),
    page("M/Cap 1/2.jpg"),
    page("M/Cap 2/1.jpg"),
    page("M/extra.jpg"),
  ]);

async function open(blob) {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

test("ComicInfo lists one Page per index item with the right offsets and types", () => {
  const { buildComicInfoXml } = Tojiru.infra.cbz;
  const xml = buildComicInfoXml(buildOutput(sampleItems()));
  const pages = xml.split("<Pages>")[1];
  assert.match(pages, /Image="0" Type="FrontCover" Bookmark="Capa"/);
  assert.match(pages, /Image="1" Type="Other" Bookmark="Índice"/);
  assert.match(pages, /Image="2" Bookmark="Capítulo 1"/);
  assert.match(pages, /Image="4" Bookmark="Capítulo 2"/);
  assert.match(pages, /Image="5" Type="Other" Bookmark="Extra"/);
  assert.equal((pages.match(/<Page /g) || []).length, 5);
  assert.match(xml, /<PageCount>6<\/PageCount>/);
  assert.match(xml, /<Title>Meu Mangá &amp; Cia<\/Title>/);
});

test("ComicInfo marks the first page as cover when no cover item exists and omits empty fields", () => {
  const { buildComicInfoXml } = Tojiru.infra.cbz;
  const items = D.buildItems([page("M/Cap 1/1.jpg")]);
  const xml = buildComicInfoXml(buildOutput(items, { writer: "", year: "" }));
  assert.match(xml, /Image="0" Type="FrontCover" Bookmark="Capítulo 1"/);
  assert.doesNotMatch(xml, /<Writer>|<Year>/);
});

test("CBZ writer stores renamed pages in order and adds ComicInfo.xml", async () => {
  const format = Tojiru.infra.cbz.createCbzFormat({ getJsZip });
  const events = [];
  const { blob, pageCount } = await format.write(buildOutput(sampleItems()), (event) => events.push(event));
  const zip = await open(blob);
  assert.equal(pageCount, 6);
  assert.deepEqual(Object.keys(zip.files), [
    "0000.jpg",
    "0001.jpg",
    "0002.jpg",
    "0003.jpg",
    "0004.jpg",
    "0005.jpg",
    "ComicInfo.xml",
  ]);
  assert.equal(await zip.file("0002.jpg").async("string"), "M/Cap 1/1.jpg");
  assert.ok(events.every((event) => event.stage === "packing"));
  assert.equal(format.sidecar.fileName, "ComicInfo.xml");
});

function fakeDecoder(sizes = {}) {
  return {
    prepare: async (pageToRead) => {
      const [width, height] = sizes[pageToRead.name] ?? [900, 1300];
      return {
        data: pageToRead.source,
        extension: D.extensionOf(pageToRead.name),
        mediaType: "image/jpeg",
        width,
        height,
      };
    },
  };
}

test("EPUB writer builds fixed-layout XHTML pages with proportionally scaled SVG images", async () => {
  const format = Tojiru.infra.epub.createEpubFormat({
    getJsZip,
    imageDecoder: fakeDecoder({ "2.jpg": [1800, 1200] }),
    generateUuid: () => "fixed-uuid",
  });
  const events = [];
  const { blob, pageCount } = await format.write(buildOutput(sampleItems()), (event) => events.push(event));
  const zip = await open(blob);
  const names = Object.keys(zip.files);
  assert.equal(names[0], "mimetype");
  assert.equal(await zip.file("mimetype").async("string"), "application/epub+zip");
  assert.equal(names.filter((name) => name.endsWith("/")).length, 0);
  assert.equal(pageCount, 6);

  const container = await zip.file("META-INF/container.xml").async("string");
  assert.match(container, /media-type="application\/oebps-package\+xml"/);

  const opf = await zip.file("OEBPS/content.opf").async("string");
  assert.match(opf, /<dc:identifier id="book-id">urn:uuid:fixed-uuid<\/dc:identifier>/);
  assert.match(opf, /<dc:title>Meu Mangá &amp; Cia<\/dc:title>/);
  assert.match(opf, /page-progression-direction="rtl"/);
  assert.match(opf, /rendition:layout">pre-paginated/);
  assert.match(opf, /<meta name="zero-gutter" content="true"\/>/);
  assert.match(opf, /<meta name="zero-margin" content="true"\/>/);
  assert.match(opf, /<meta name="original-resolution" content="900x1300"\/>/);
  assert.match(opf, /id="img-0001"[^>]*properties="cover-image"/);
  assert.match(opf, /group-position">3</);
  assert.equal((opf.match(/<itemref /g) || []).length, 6);

  const nav = await zip.file("OEBPS/nav.xhtml").async("string");
  assert.deepEqual(
    [...nav.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a>/g)].map((match) => match[2]),
    ["Capa", "Índice", "Capítulo 1", "Capítulo 2", "Extra"],
  );
  assert.match(nav, /href="text\/page-0003\.xhtml">Capítulo 1/);
  assert.match(nav, /epub:type="bodymatter" href="text\/page-0003\.xhtml">Início da leitura/);

  const widePage = await zip.file("OEBPS/text/page-0004.xhtml").async("string");
  assert.match(widePage, /name="viewport" content="width=1800, height=1200"/);
  assert.match(
    widePage,
    /<svg[^>]*width="100wh" height="100vh" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid meet">/,
  );
  assert.match(widePage, /<image width="1800" height="1200" xlink:href="\.\.\/images\/0004\.jpg"\/>/);

  const stylesheet = await zip.file("OEBPS/style.css").async("string");
  assert.match(stylesheet, /svg\s*\{\s*display:\s*block;\s*width:\s*100%;\s*height:\s*100%;\s*\}/);

  const stages = events.map((event) => event.stage);
  assert.equal(stages[0], "reading");
  assert.equal(stages.at(-1), "packing");
  assert.equal(events.at(-1).percent, 100);
  const percents = events.map((event) => event.percent);
  assert.deepEqual(
    percents,
    [...percents].sort((a, b) => a - b),
  );
});

test("EPUB writer uses left-to-right direction when the manga is not right to left", async () => {
  const format = Tojiru.infra.epub.createEpubFormat({ getJsZip, imageDecoder: fakeDecoder(), generateUuid: () => "u" });
  const output = buildOutput(sampleItems(), { readingMode: D.ReadingMode.LEFT_TO_RIGHT });
  const zip = await open((await format.write(output, () => {})).blob);
  assert.match(await zip.file("OEBPS/content.opf").async("string"), /page-progression-direction="ltr"/);
});

test("EPUB writer propagates image read errors from the decoder", async () => {
  const decoder = {
    prepare: async (pageToRead) => {
      throw new D.ImageReadError(pageToRead.name);
    },
  };
  const format = Tojiru.infra.epub.createEpubFormat({ getJsZip, imageDecoder: decoder, generateUuid: () => "u" });
  await assert.rejects(
    () => format.write(buildOutput(sampleItems()), () => {}),
    (error) => error.name === "ImageReadError" && error.pageName === "capa.jpg",
  );
});

function memorySink() {
  const chunks = [];
  return {
    chunks,
    aborted: false,
    write: async (bytes) => {
      chunks.push(Buffer.from(bytes));
    },
    close: async () => new Blob(chunks),
    abort: async function () {
      this.aborted = true;
    },
  };
}

test("CBZ writer streams to a disk sink and produces the same archive layout", async () => {
  const sink = memorySink();
  const requests = [];
  const createSink = async (request) => {
    requests.push(request);
    return sink;
  };
  const format = Tojiru.infra.cbz.createCbzFormat({ getJsZip, createSink });
  const events = [];
  const { blob, pageCount } = await format.write(buildOutput(sampleItems()), (event) => events.push(event), {
    fileName: "Meu Manga.cbz",
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
  assert.equal(pageCount, 6);
  assert.deepEqual(Object.keys(zip.files), [
    "0000.jpg",
    "0001.jpg",
    "0002.jpg",
    "0003.jpg",
    "0004.jpg",
    "0005.jpg",
    "ComicInfo.xml",
  ]);
  assert.equal(await zip.file("0002.jpg").async("string"), "M/Cap 1/1.jpg");
  assert.match(await zip.file("ComicInfo.xml").async("string"), /<PageCount>6<\/PageCount>/);
  assert.equal(requests[0].fileName, "Meu Manga.cbz");
  const output = buildOutput(sampleItems());
  const pagesBytes = output.pages.reduce((sum, item) => sum + item.source.length, 0);
  assert.equal(requests[0].requiredBytes, pagesBytes + Tojiru.infra.cbz.buildComicInfoXml(output).length);
  assert.equal(events.at(-1).percent, 100);
  assert.ok(events.every((event) => event.stage === "packing"));
  assert.equal(sink.aborted, false);
});

test("CBZ writer falls back to memory when the disk sink cannot be created", async () => {
  const createSink = async () => {
    throw new Error("OPFS unavailable");
  };
  const format = Tojiru.infra.cbz.createCbzFormat({ getJsZip, createSink });
  const { blob, pageCount } = await format.write(buildOutput(sampleItems()), () => {});
  const zip = await open(blob);
  assert.equal(pageCount, 6);
  assert.equal(await zip.file("0002.jpg").async("string"), "M/Cap 1/1.jpg");
});

test("CBZ writer aborts the sink and falls back to memory when a disk write fails", async () => {
  const sink = memorySink();
  sink.write = async () => {
    throw new Error("QuotaExceededError");
  };
  const format = Tojiru.infra.cbz.createCbzFormat({ getJsZip, createSink: async () => sink });
  const { blob } = await format.write(buildOutput(sampleItems()), () => {});
  const zip = await open(blob);
  assert.equal(sink.aborted, true);
  assert.equal(await zip.file("0000.jpg").async("string"), "M/capa.jpg");
});

const withoutTimestamp = (bytes) =>
  Buffer.from(bytes.toString("latin1").replace(/(dcterms:modified">)[^<]+/, "$1"), "latin1");

async function epubAsMemoryAndDisk(sinkOverride) {
  const sink = sinkOverride ?? memorySink();
  const options = { getJsZip, imageDecoder: fakeDecoder({ "2.jpg": [1800, 1200] }), generateUuid: () => "fixed-uuid" };
  const output = buildOutput(sampleItems());
  const memory = await Tojiru.infra.epub.createEpubFormat(options).write(output, () => {});
  const events = [];
  const requests = [];
  const createSink = async (request) => {
    requests.push(request);
    return sink;
  };
  const disk = await Tojiru.infra.epub
    .createEpubFormat({ ...options, createSink })
    .write(output, (event) => events.push(event), { fileName: "Meu Manga.epub" });
  return { memory, disk, sink, events, requests };
}

test("EPUB writer streams to a disk sink with the same entries and contents as the memory path", async () => {
  const { memory, disk, events, requests } = await epubAsMemoryAndDisk();
  const memoryZip = await open(memory.blob);
  const diskZip = await JSZip.loadAsync(await disk.blob.arrayBuffer(), { checkCRC32: true });
  assert.equal(disk.pageCount, 6);
  assert.deepEqual(Object.keys(diskZip.files), Object.keys(memoryZip.files));
  for (const name of Object.keys(memoryZip.files)) {
    const expected = withoutTimestamp(await memoryZip.file(name).async("nodebuffer"));
    const actual = withoutTimestamp(await diskZip.file(name).async("nodebuffer"));
    assert.ok(actual.equals(expected), `${name} differs`);
  }
  assert.equal(requests[0].fileName, "Meu Manga.epub");
  assert.ok(requests[0].requiredBytes > 0);
  const stages = events.map((event) => event.stage);
  assert.equal(stages[0], "reading");
  assert.equal(stages.at(-1), "packing");
  assert.equal(events.at(-1).percent, 100);
  const percents = events.map((event) => event.percent);
  assert.deepEqual(
    percents,
    [...percents].sort((a, b) => a - b),
  );
});

test("EPUB disk archive keeps the OCF signature: mimetype first, stored, no extra field, no data descriptor", async () => {
  const { disk } = await epubAsMemoryAndDisk();
  const bytes = Buffer.from(await disk.blob.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.equal(bytes.readUInt16LE(6) & 0x0008, 0);
  assert.equal(bytes.readUInt16LE(8), 0);
  assert.equal(bytes.readUInt16LE(28), 0);
  assert.equal(bytes.toString("latin1", 30, 38), "mimetype");
  assert.equal(bytes.toString("latin1", 38, 58), "application/epub+zip");
});

test("EPUB writer falls back to memory when a disk write fails", async () => {
  const sink = memorySink();
  sink.write = async () => {
    throw new Error("QuotaExceededError");
  };
  const { disk } = await epubAsMemoryAndDisk(sink);
  const zip = await open(disk.blob);
  assert.equal(sink.aborted, true);
  assert.equal(Object.keys(zip.files)[0], "mimetype");
  assert.equal(await zip.file("OEBPS/images/0001.jpg").async("string"), "M/capa.jpg");
});
