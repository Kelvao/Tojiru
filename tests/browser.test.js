const test = require("node:test");
const assert = require("node:assert");
const { DOMAIN_SCRIPTS, loadScripts } = require("./load");

const {
  infra: { browser },
} = loadScripts([...DOMAIN_SCRIPTS, "src/infrastructure/browser.js"]);

test("pagesFromFileList filters non-images and extracts relative paths", () => {
  const files = [
    { name: "01.jpg", webkitRelativePath: "Manga/01.jpg" },
    { name: "thumbs.db", webkitRelativePath: "Manga/thumbs.db" },
    { name: "02.png", webkitRelativePath: "Manga/02.png" },
    { name: "notes.txt", webkitRelativePath: "Manga/notes.txt" },
  ];
  const pages = browser.pagesFromFileList(files);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].name, "01.jpg");
  assert.equal(pages[0].path, "Manga/01.jpg");
  assert.equal(pages[0].source, files[0]);
  assert.equal(pages[1].name, "02.png");
});

test("createLanguageStore reads, writes and handles storage failures", () => {
  const memory = new Map();
  const windowRef = {
    localStorage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, val) => memory.set(key, val),
    },
    navigator: { languages: ["pt-BR", "en"], language: "pt-BR" },
  };
  const store = browser.createLanguageStore({ storageKey: "test.lang", windowRef });
  assert.equal(store.read(), null);
  store.write("pt-BR");
  assert.equal(store.read(), "pt-BR");
  assert.deepEqual(store.preferred(), ["pt-BR", "en"]);

  const throwingWindow = {
    localStorage: {
      getItem: () => {
        throw new Error("Disabled");
      },
      setItem: () => {
        throw new Error("Disabled");
      },
    },
    navigator: { language: "en" },
  };
  const failingStore = browser.createLanguageStore({ storageKey: "test.lang", windowRef: throwingWindow });
  assert.equal(failingStore.read(), null);
  assert.doesNotThrow(() => failingStore.write("en"));
  assert.deepEqual(failingStore.preferred(), ["en"]);
});

test("createPreviewUrls tracks and releases object URLs", () => {
  const created = [];
  const revoked = [];
  globalThis.URL.createObjectURL = (source) => {
    const url = `blob://fake/${source.name}`;
    created.push(url);
    return url;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };

  const previews = browser.createPreviewUrls();
  const source1 = { name: "1.jpg" };
  const u1 = previews.urlFor({ source: source1 });
  const u2 = previews.urlFor({ source: { name: "2.jpg" } });
  const u1Again = previews.urlFor({ source: source1 });
  assert.equal(u1Again, u1);
  assert.equal(created.length, 2);
  assert.equal(u1, "blob://fake/1.jpg");
  assert.equal(u2, "blob://fake/2.jpg");

  previews.releaseAll();
  assert.deepEqual(revoked, [u1, u2]);
});

test("generateUuid returns valid UUID format", () => {
  const uuid = browser.generateUuid();
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("createBlobSaver triggers download click on anchor", () => {
  const appended = [];
  const clicked = [];
  const removed = [];
  let linkElement = null;

  const documentRef = {
    createElement: (tag) => {
      assert.equal(tag, "a");
      linkElement = {
        href: "",
        download: "",
        click: () => clicked.push(linkElement),
        remove: () => removed.push(linkElement),
      };
      return linkElement;
    },
    body: {
      append: (el) => appended.push(el),
    },
  };

  const saver = browser.createBlobSaver(documentRef);
  const blob = new Blob(["test"]);
  saver.save(blob, "output.cbz");

  assert.equal(appended.length, 1);
  assert.equal(clicked.length, 1);
  assert.equal(removed.length, 1);
  assert.equal(linkElement.download, "output.cbz");
});

test("loadTranslations fetches each language json", async () => {
  const customFetch = async (url) => {
    if (url.includes("en.json")) return { ok: true, json: async () => ({ title: "Hello" }) };
    if (url.includes("pt-BR.json")) return { ok: true, json: async () => ({ title: "Olá" }) };
    return { ok: false, status: 404 };
  };

  const {
    infra: { browser: b },
  } = loadScripts([...DOMAIN_SCRIPTS, "src/infrastructure/browser.js"], { fetch: customFetch });

  const translations = await b.loadTranslations(["en", "pt-BR"], "fake-locales");
  assert.deepEqual(translations, {
    en: { title: "Hello" },
    "pt-BR": { title: "Olá" },
  });
});
