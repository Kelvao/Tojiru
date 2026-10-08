const test = require("node:test");
const assert = require("node:assert");
const { loadScripts } = require("./load");

const { domain: D } = loadScripts(["src/domain/library.js"]);

const page = (path) => ({ name: path.split("/").pop(), path, source: path });
const folders = (items) => [...items.map((item) => item.folder)];
const names = (item) => [...item.pages.map((p) => p.name)];

test("domain loads with no browser globals available", () => {
  assert.ok(D.buildItems);
});

test("detectKind recognises names in Portuguese and English, ignoring accents and extension", () => {
  assert.equal(D.detectKind("Capa.jpg"), D.Kind.COVER);
  assert.equal(D.detectKind("cover"), D.Kind.COVER);
  assert.equal(D.detectKind("Índice.png"), D.Kind.CONTENTS);
  assert.equal(D.detectKind("sumário"), D.Kind.CONTENTS);
  assert.equal(D.detectKind("Extras"), D.Kind.EXTRA);
  assert.equal(D.detectKind("contra capa"), D.Kind.BACK_COVER);
  assert.equal(D.detectKind("Capítulo 01"), D.Kind.CHAPTER);
  assert.equal(D.detectKind("cap 1"), D.Kind.CHAPTER);
});

test("detectKind matches keywords as whole words, not inside longer words", () => {
  const chapters = [
    "Extraordinary Tales",
    "Background",
    "Frontier",
    "Coverage",
    "Capacidade",
    "Especialista",
    "Rearguard",
    "Tocando o Terror",
    "Indexação",
  ];
  chapters.forEach((name) => assert.equal(D.detectKind(name), D.Kind.CHAPTER, name));
  const expected = {
    [D.Kind.COVER]: ["capa2", "Capas", "Covers", "Front Cover", "frontcover", "cover_01"],
    [D.Kind.CONTENTS]: ["Índices", "indices", "Indexes", "toc", "Contents"],
    [D.Kind.EXTRA]: ["extra 01", "Omake_2", "Omakes", "Bonus", "Especiais", "Specials", "Posfácio", "Prefácio"],
    [D.Kind.BACK_COVER]: ["Back Cover", "backcover", "Contracapa", "contra capa 2", "rear"],
  };
  Object.entries(expected).forEach(([kind, names]) => {
    names.forEach((name) => assert.equal(D.detectKind(name), kind, name));
  });
});

test("buildItems groups by folder and orders cover, contents, chapters, extras, back cover", () => {
  const items = D.buildItems([
    page("M/contracapa.jpg"),
    page("M/Cap 10/1.jpg"),
    page("M/Cap 2/1.jpg"),
    page("M/extras/1.jpg"),
    page("M/indice.jpg"),
    page("M/capa.jpg"),
  ]);
  assert.deepEqual(folders(items), ["capa.jpg", "indice.jpg", "Cap 2", "Cap 10", "extras", "contracapa.jpg"]);
  assert.deepEqual(
    items.map((item) => item.kind),
    ["cover", "toc", "chapter", "chapter", "extra", "back"],
  );
});

test("buildItems sorts pages naturally inside a folder", () => {
  const [item] = D.buildItems([page("M/Cap 1/10.jpg"), page("M/Cap 1/2.jpg"), page("M/Cap 1/1.jpg")]);
  assert.deepEqual(names(item), ["1.jpg", "2.jpg", "10.jpg"]);
});

test("loose chapter images are grouped in one item without a folder name", () => {
  const items = D.buildItems([page("M/2.jpg"), page("M/1.jpg"), page("M/capa.jpg")]);
  assert.equal(items.length, 2);
  assert.equal(items[1].folder, D.LOOSE_FOLDER);
  assert.deepEqual(names(items[1]), ["1.jpg", "2.jpg"]);
});

test("nested subfolders belong to their first-level folder", () => {
  const items = D.buildItems([page("M/Cap 1/a/1.jpg"), page("M/Cap 1/b/2.jpg")]);
  assert.equal(items.length, 1);
  assert.equal(items[0].pages.length, 2);
});

test("pages inside nested subfolders keep each subfolder together, in natural order", () => {
  const items = D.buildItems([
    page("M/Cap 1/Parte 10/1.jpg"),
    page("M/Cap 1/Parte 2/2.jpg"),
    page("M/Cap 1/Parte 2/1.jpg"),
    page("M/Cap 1/Parte 10/2.jpg"),
  ]);
  assert.deepEqual(
    items[0].pages.map((p) => p.path),
    ["M/Cap 1/Parte 2/1.jpg", "M/Cap 1/Parte 2/2.jpg", "M/Cap 1/Parte 10/1.jpg", "M/Cap 1/Parte 10/2.jpg"],
  );
});

test("restoreItem puts returned pages back in path order inside nested subfolders", () => {
  const items = D.buildItems([page("M/Cap 1/A/1.jpg"), page("M/Cap 1/A/2.jpg"), page("M/Cap 1/B/1.jpg")]);
  const picked = D.extractPages(items, [items[0].pages[1]], { kind: D.Kind.EXTRA, title: "" });
  const restored = D.restoreItem(
    picked,
    picked.findIndex((item) => item.manual),
  );
  assert.deepEqual(
    restored[0].pages.map((p) => p.path),
    ["M/Cap 1/A/1.jpg", "M/Cap 1/A/2.jpg", "M/Cap 1/B/1.jpg"],
  );
});

test("computeStartPages accumulates page counts from zero", () => {
  const items = D.buildItems([page("M/capa.jpg"), page("M/Cap 1/1.jpg"), page("M/Cap 1/2.jpg"), page("M/Cap 2/1.jpg")]);
  assert.deepEqual([...D.computeStartPages(items)], [0, 1, 3]);
  assert.equal(D.countPages(items), 4);
});

test("extractPages moves selected pages into a manual item placed by kind", () => {
  const items = D.buildItems([page("M/capa.jpg"), page("M/Cap 1/1.jpg"), page("M/Cap 1/2.jpg"), page("M/Cap 1/3.jpg")]);
  const pages = D.pagesOf(items);
  const result = D.extractPages(items, [pages[2], pages[1]], { kind: D.Kind.CONTENTS, title: "Sumário" });
  assert.deepEqual(
    result.map((item) => item.kind),
    ["cover", "toc", "chapter"],
  );
  assert.equal(result[1].manual, true);
  assert.equal(result[1].title, "Sumário");
  assert.deepEqual(names(result[1]), ["1.jpg", "2.jpg"]);
  assert.deepEqual(names(result[2]), ["3.jpg"]);
  assert.equal(result[1].origins.get(pages[1]), "Cap 1");
  assert.equal(items[1].pages.length, 3);
});

test("extractPages drops items left without pages and ignores empty selections", () => {
  const items = D.buildItems([page("M/Cap 1/1.jpg"), page("M/Cap 2/1.jpg")]);
  const emptied = D.extractPages(items, items[0].pages, { kind: D.Kind.EXTRA, title: "" });
  assert.deepEqual(
    emptied.map((item) => item.kind),
    ["chapter", "extra"],
  );
  assert.equal(D.extractPages(items, [], { kind: D.Kind.EXTRA, title: "" }), items);
});

test("restoreItem returns pages to their folders in order, recreating removed folders", () => {
  const items = D.buildItems([page("M/Cap 1/1.jpg"), page("M/Cap 1/2.jpg"), page("M/Cap 1/3.jpg")]);
  const extracted = D.extractPages(items, [items[0].pages[0], items[0].pages[2]], { kind: D.Kind.EXTRA, title: "" });
  const restored = D.restoreItem(
    extracted,
    extracted.findIndex((item) => item.manual),
  );
  assert.equal(restored.length, 1);
  assert.deepEqual(names(restored[0]), ["1.jpg", "2.jpg", "3.jpg"]);

  const single = D.buildItems([page("M/Cap 1/1.jpg")]);
  const emptied = D.extractPages(single, single[0].pages, { kind: D.Kind.EXTRA, title: "" });
  const back = D.restoreItem(emptied, 0);
  assert.deepEqual(folders(back), ["Cap 1"]);
  assert.equal(back[0].kind, D.Kind.CHAPTER);
});

test("restoreItem leaves non-manual items alone", () => {
  const items = D.buildItems([page("M/Cap 1/1.jpg")]);
  assert.equal(D.restoreItem(items, 0), items);
});

test("renameChapters numbers only chapters and clearTitles empties every title", () => {
  const items = D.buildItems([page("M/capa.jpg"), page("M/Cap 1/1.jpg"), page("M/Cap 2/1.jpg")]);
  const numbered = D.renameChapters(items, (n) => `C${n}`);
  assert.deepEqual(
    numbered.map((item) => item.title),
    ["", "C1", "C2"],
  );
  assert.deepEqual(
    D.clearTitles(numbered).map((item) => item.title),
    ["", "", ""],
  );
});

test("moveItem swaps neighbours, never mutates and ignores out-of-range moves", () => {
  const items = D.buildItems([page("M/Cap 1/1.jpg"), page("M/Cap 2/1.jpg")]);
  const moved = D.moveItem(items, 0, 1);
  assert.deepEqual(folders(moved), ["Cap 2", "Cap 1"]);
  assert.deepEqual(folders(items), ["Cap 1", "Cap 2"]);
  assert.equal(D.moveItem(items, 0, -1), items);
  assert.equal(D.moveItem(items, 1, 1), items);
});

test("setItemKind and setItemTitle return new lists", () => {
  const items = D.buildItems([page("M/Cap 1/1.jpg")]);
  assert.equal(D.setItemKind(items, 0, D.Kind.EXTRA)[0].kind, "extra");
  assert.equal(D.setItemTitle(items, 0, "Início")[0].title, "Início");
  assert.equal(items[0].kind, "chapter");
  assert.equal(items[0].title, "");
});

test("normalizeMetadata trims fields and splits genres", () => {
  const metadata = D.normalizeMetadata({ series: "  X ", genres: " Ação, ,Aventura ", year: " 2020", readingMode: "" });
  assert.equal(metadata.series, "X");
  assert.deepEqual([...metadata.genreList], ["Ação", "Aventura"]);
  assert.equal(metadata.genres, "Ação, Aventura");
  assert.equal(metadata.year, "2020");
  assert.equal(metadata.readingMode, D.ReadingMode.RIGHT_TO_LEFT);
});

test("outputFileName sanitises forbidden characters and falls back to a default", () => {
  assert.equal(D.outputFileName("A/B:C?", "cbz"), "A_B_C_.cbz");
  assert.equal(D.outputFileName("", "epub"), "manga.epub");
});

test("isImageName and extensionOf", () => {
  assert.ok(D.isImageName("a.JPG"));
  assert.ok(!D.isImageName("a.txt"));
  assert.equal(D.extensionOf("A.WebP"), "webp");
});

test("validateMetadata reports missing required fields only", () => {
  assert.deepEqual([...D.REQUIRED_FIELDS], ["series"]);
  assert.deepEqual(
    D.validateMetadata(D.normalizeMetadata({ series: "  " })).map((p) => ({ ...p })),
    [{ field: "series", rule: "required" }],
  );
  assert.deepEqual([...D.validateMetadata(D.normalizeMetadata({ series: "X" }))], []);
  assert.deepEqual([...D.validateMetadata(D.normalizeMetadata({ series: "X", writer: "", year: "" }))], []);
});

test("ISO 639-1 codes are unique, lowercase two-letter codes with a name in every UI language", () => {
  const codes = D.ISO_639_1_CODES;
  assert.equal(new Set(codes).size, codes.length);
  codes.forEach((code) => assert.match(code, /^[a-z]{2}$/, code));
  ["en", "pt"].forEach((locale) => {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    codes.forEach((code) => assert.notEqual(names.of(code).toLowerCase(), code, `${locale}:${code}`));
  });
});

test("normalizeMetadata lowercases the language code", () => {
  assert.equal(D.normalizeMetadata({ series: "X", language: " JA " }).language, "ja");
});

test("validateMetadata only accepts ISO 639-1 language codes", () => {
  const problems = (language) =>
    D.validateMetadata(D.normalizeMetadata({ series: "X", language })).map((p) => ({ ...p }));
  ["", "pt", "ja", "JA", "zh"].forEach((language) => assert.deepEqual(problems(language), [], language));
  ["português", "pt-BR", "pt_BR", "jpn", "xx", "p", "1234"].forEach((language) =>
    assert.deepEqual(problems(language), [{ field: "language", rule: "invalid" }], language),
  );
  assert.deepEqual(
    D.validateMetadata(D.normalizeMetadata({ series: "", language: "português" })).map((p) => ({ ...p })),
    [
      { field: "series", rule: "required" },
      { field: "language", rule: "invalid" },
    ],
  );
});

test("MetadataError carries the list of problems", () => {
  const error = new D.MetadataError([{ field: "series", rule: "required" }]);
  assert.equal(error.message, "Invalid metadata");
  assert.equal(error.name, "MetadataError");
  assert.equal(error.problems[0].field, "series");
});
