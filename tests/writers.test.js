const test = require("node:test");
const assert = require("node:assert");
const JSZip = require("jszip");
const { loadScripts } = require("./load");

const Tojiru = loadScripts(["src/domain/library.js", "src/application/usecases.js", "src/infrastructure/xml.js", "src/infrastructure/cbz.js", "src/infrastructure/epub.js"]);
const D = Tojiru.domain;
const getJsZip = () => JSZip;

const page = (path) => ({ name: path.split("/").pop(), path, source: Buffer.from(path) });
const translator = { language: "pt-BR", t: (key, params) => ({ "kind.cover.name": "Capa", "kind.toc.name": "Índice", "kind.chapter.name": "Capítulo", "kind.extra.name": "Extra", "kind.back.name": "Contracapa", "kind.toc.label": "Índice", "kind.cover.label": "Capa", "epub.start": "Início da leitura" }[key] ?? key) };

function buildOutput(items, rawMetadata = {}) {
  const metadata = D.normalizeMetadata({ series: "Meu Mangá & Cia", writer: "Autor", genres: "Ação, Aventura", year: "2020", volume: "3", language: "pt", ...rawMetadata });
  return Tojiru.usecases.buildOutputDocument({ items, metadata, translator });
}

const sampleItems = () =>
  D.buildItems([page("M/capa.jpg"), page("M/indice.jpg"), page("M/Cap 1/1.jpg"), page("M/Cap 1/2.jpg"), page("M/Cap 2/1.jpg"), page("M/extra.jpg")]);

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
  assert.deepEqual(Object.keys(zip.files), ["0000.jpg", "0001.jpg", "0002.jpg", "0003.jpg", "0004.jpg", "0005.jpg", "ComicInfo.xml"]);
  assert.equal(await zip.file("0002.jpg").async("string"), "M/Cap 1/1.jpg");
  assert.ok(events.every((event) => event.stage === "packing"));
  assert.equal(format.sidecar.fileName, "ComicInfo.xml");
});

function fakeDecoder(sizes = {}) {
  return {
    prepare: async (pageToRead) => {
      const [width, height] = sizes[pageToRead.name] ?? [900, 1300];
      return { data: pageToRead.source, extension: D.extensionOf(pageToRead.name), mediaType: "image/jpeg", width, height };
    },
  };
}

test("EPUB writer builds fixed-layout XHTML pages with proportionally scaled SVG images", async () => {
  const format = Tojiru.infra.epub.createEpubFormat({ getJsZip, imageDecoder: fakeDecoder({ "2.jpg": [1800, 1200] }), generateUuid: () => "fixed-uuid" });
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
  assert.deepEqual([...nav.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a>/g)].map((match) => match[2]), ["Capa", "Índice", "Capítulo 1", "Capítulo 2", "Extra"]);
  assert.match(nav, /href="text\/page-0003\.xhtml">Capítulo 1/);
  assert.match(nav, /epub:type="bodymatter" href="text\/page-0003\.xhtml">Início da leitura/);

  const widePage = await zip.file("OEBPS/text/page-0004.xhtml").async("string");
  assert.match(widePage, /name="viewport" content="width=1800, height=1200"/);
  assert.match(widePage, /<svg[^>]*width="100%" height="100%" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid meet">/);
  assert.match(widePage, /<image width="1800" height="1200" xlink:href="\.\.\/images\/0004\.jpg"\/>/);

  const stylesheet = await zip.file("OEBPS/style.css").async("string");
  assert.match(stylesheet, /svg\s*\{\s*display:\s*block;\s*width:\s*100%;\s*height:\s*100%;\s*\}/);

  const stages = events.map((event) => event.stage);
  assert.equal(stages[0], "reading");
  assert.equal(stages.at(-1), "packing");
  assert.equal(events.at(-1).percent, 100);
  const percents = events.map((event) => event.percent);
  assert.deepEqual(percents, [...percents].sort((a, b) => a - b));
});

test("EPUB writer uses left-to-right direction when the manga is not right to left", async () => {
  const format = Tojiru.infra.epub.createEpubFormat({ getJsZip, imageDecoder: fakeDecoder(), generateUuid: () => "u" });
  const output = buildOutput(sampleItems(), { readingMode: D.ReadingMode.LEFT_TO_RIGHT });
  const zip = await open((await format.write(output, () => {})).blob);
  assert.match(await zip.file("OEBPS/content.opf").async("string"), /page-progression-direction="ltr"/);
});

test("EPUB writer propagates image read errors from the decoder", async () => {
  const decoder = { prepare: async (pageToRead) => { throw new D.ImageReadError(pageToRead.name); } };
  const format = Tojiru.infra.epub.createEpubFormat({ getJsZip, imageDecoder: decoder, generateUuid: () => "u" });
  await assert.rejects(() => format.write(buildOutput(sampleItems()), () => {}), (error) => error.name === "ImageReadError" && error.pageName === "capa.jpg");
});
