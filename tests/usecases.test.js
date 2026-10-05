const test = require("node:test");
const assert = require("node:assert");
const { loadScripts } = require("./load");

const { domain: D, usecases: U } = loadScripts(["src/domain/library.js", "src/application/usecases.js"]);

const page = (path) => ({ name: path.split("/").pop(), path, source: path });
const translator = {
  language: "pt-BR",
  t: (key, params) => (params ? `${key}${JSON.stringify(params)}` : key),
};

function setup() {
  const saved = [];
  const written = [];
  const formats = {
    cbz: {
      extension: "cbz",
      sidecar: {
        fileName: "ComicInfo.xml",
        mediaType: "application/xml",
        build: (output) => `xml:${output.entries.length}`,
      },
      write: async (output, onProgress) => {
        written.push(output);
        onProgress({ stage: "packing", percent: 100 });
        return { blob: { size: 42 }, pageCount: output.pages.length };
      },
    },
    epub: { extension: "epub", sidecar: null, write: async () => ({ blob: { size: 1 }, pageCount: 0 }) },
  };
  const saver = {
    save: (blob, fileName) => saved.push({ blob, fileName }),
    saveText: (file) => saved.push(file),
  };
  const store = U.createStore({ items: [], folderLoaded: false, outputFormat: "cbz" });
  const useCases = U.createUseCases({ store, formats, saver, translator });
  return { store, useCases, saved, written };
}

const sampleFolder = [page("M/capa.jpg"), page("M/Cap 1/1.jpg"), page("M/Cap 1/2.jpg"), page("M/Cap 2/1.jpg")];

test("loadFolder builds items and marks the folder as loaded", () => {
  const { store, useCases } = setup();
  useCases.loadFolder(sampleFolder);
  assert.equal(store.get().items.length, 3);
  assert.equal(store.get().folderLoaded, true);
});

test("store notifies subscribers except for quiet updates", () => {
  const { store, useCases } = setup();
  useCases.loadFolder(sampleFolder);
  let notifications = 0;
  store.subscribe(() => notifications++);
  useCases.moveItem(1, 1);
  assert.equal(notifications, 1);
  useCases.renameItem(1, "Novo");
  assert.equal(notifications, 1);
  assert.equal(store.get().items[1].title, "Novo");
});

test("numberChapters uses the translated chapter name and skips extras", () => {
  const { store, useCases } = setup();
  useCases.loadFolder(sampleFolder);
  useCases.numberChapters();
  assert.deepEqual(
    [...store.get().items.map((item) => item.title)],
    ["kind.cover.name", "kind.chapter.name 1", "kind.chapter.name 2"],
  );
});

test("manual items can be created and undone", () => {
  const { store, useCases } = setup();
  useCases.loadFolder(sampleFolder);
  const pages = D.pagesOf(store.get().items);
  useCases.createManualItem({ pages: [pages[1]], kind: D.Kind.CONTENTS, title: "  Sumário " });
  const manual = store.get().items.find((item) => item.manual);
  assert.equal(manual.title, "Sumário");
  useCases.undoManualItem(store.get().items.indexOf(manual));
  assert.equal(
    store.get().items.some((item) => item.manual),
    false,
  );
  assert.equal(D.countPages(store.get().items), 4);
});

test("selectOutputFormat ignores unknown formats", () => {
  const { store, useCases } = setup();
  useCases.selectOutputFormat("epub");
  assert.equal(store.get().outputFormat, "epub");
  useCases.selectOutputFormat("pdf");
  assert.equal(store.get().outputFormat, "epub");
});

test("generate hands a self-contained output document to the selected format and saves the result", async () => {
  const { store, useCases, saved, written } = setup();
  useCases.loadFolder(sampleFolder);
  useCases.renameItem(1, "Início");
  const progress = [];
  const result = await useCases.generate({
    rawMetadata: { series: "Meu: Mangá", genres: "A, B", language: "" },
    onProgress: (event) => progress.push(event),
  });
  const output = written[0];
  assert.deepEqual(
    [...output.entries.map((entry) => entry.title)],
    ["kind.cover.name", "Início", "kind.chapter.name 2"],
  );
  assert.deepEqual([...output.entries.map((entry) => entry.startPage)], [0, 1, 3]);
  assert.equal(output.pages.length, 4);
  assert.equal(output.language, "pt");
  assert.equal(output.labels.contents, "kind.toc.label");
  assert.deepEqual([...output.metadata.genreList], ["A", "B"]);
  assert.equal(result.fileName, "Meu_ Mangá.cbz");
  assert.equal(saved[0].fileName, "Meu_ Mangá.cbz");
  assert.equal(progress.length, 1);
  assert.equal(store.get().items.length, 3);
});

test("exportSidecar saves the format sidecar and does nothing without one", () => {
  const { useCases, saved } = setup();
  useCases.loadFolder(sampleFolder);
  useCases.exportSidecar({ series: "X" });
  assert.deepEqual({ ...saved[0] }, { content: "xml:3", mediaType: "application/xml", fileName: "ComicInfo.xml" });
  useCases.selectOutputFormat("epub");
  useCases.exportSidecar({ series: "X" });
  assert.equal(saved.length, 1);
});

test("titleOf prefers the typed title and falls back to the default name", () => {
  const items = D.buildItems(sampleFolder);
  assert.equal(U.titleOf(items[1], items, translator.t), "kind.chapter.name 1");
  assert.equal(U.titleOf({ ...items[1], title: "  Meu " }, items, translator.t), "Meu");
});

test("generate refuses to run without the required fields and touches neither writer nor saver", async () => {
  const { useCases, saved, written } = setup();
  useCases.loadFolder(sampleFolder);
  await assert.rejects(
    () => useCases.generate({ rawMetadata: { series: "   " }, onProgress: () => {} }),
    (error) => error instanceof D.MetadataError && error.problems[0].field === "series",
  );
  assert.equal(written.length, 0);
  assert.equal(saved.length, 0);
});

test("exportSidecar also requires the title", () => {
  const { useCases, saved } = setup();
  useCases.loadFolder(sampleFolder);
  assert.throws(
    () => useCases.exportSidecar({ series: "" }),
    (error) => error instanceof D.MetadataError,
  );
  assert.equal(saved.length, 0);
});

test("loadFolder fills chapters with the numbered pattern and detected extras with their kind name", () => {
  const { store, useCases } = setup();
  useCases.loadFolder(sampleFolder);
  assert.deepEqual(
    store.get().items.map((item) => item.title),
    ["kind.cover.name", "kind.chapter.name 1", "kind.chapter.name 2"],
  );
});

test("extractFolderNames fills chapters with folder names and numberChapters restores numbering", () => {
  const { store, useCases } = setup();
  useCases.loadFolder(sampleFolder);
  useCases.extractFolderNames();
  assert.deepEqual(
    store.get().items.map((item) => item.title),
    ["kind.cover.name", "Cap 1", "Cap 2"],
  );
  useCases.numberChapters();
  assert.deepEqual(
    store.get().items.map((item) => item.title),
    ["kind.cover.name", "kind.chapter.name 1", "kind.chapter.name 2"],
  );
});

test("root pages have no folder name and stay numbered when extracting", () => {
  const { store, useCases } = setup();
  useCases.loadFolder([page("M/1.jpg"), page("M/Cap 1/1.jpg")]);
  useCases.extractFolderNames();
  assert.deepEqual(
    store.get().items.map((item) => item.title),
    ["kind.chapter.name 1", "Cap 1"],
  );
});

test("detected extras keep their kind name through extracting and numbering", () => {
  const { store, useCases } = setup();
  useCases.loadFolder([page("M/capa.jpg"), page("M/Extra/1.jpg"), page("M/Cap 1/1.jpg"), page("M/Contracapa.jpg")]);
  const titles = () => store.get().items.map((item) => item.title);
  const numbered = ["kind.cover.name", "kind.chapter.name 1", "kind.extra.name", "kind.back.name"];
  assert.deepEqual(titles(), numbered);
  useCases.extractFolderNames();
  assert.deepEqual(titles(), ["kind.cover.name", "Cap 1", "kind.extra.name", "kind.back.name"]);
  useCases.numberChapters();
  assert.deepEqual(titles(), numbered);
});

test("generate uses the filled titles", async () => {
  const { useCases, written } = setup();
  useCases.loadFolder(sampleFolder);
  useCases.extractFolderNames();
  await useCases.generate({ rawMetadata: { series: "M" }, onProgress: () => {} });
  assert.deepEqual(
    written[0].entries.map((entry) => entry.title),
    ["kind.cover.name", "Cap 1", "Cap 2"],
  );
});
