const test = require("node:test");
const assert = require("node:assert");
const { DOMAIN_SCRIPTS, APPLICATION_SCRIPTS, loadScripts } = require("./load");

const {
  i18n,
  ui: { createView },
} = loadScripts([
  ...DOMAIN_SCRIPTS,
  ...APPLICATION_SCRIPTS,
  "src/presentation/i18n.js",
  "src/presentation/feedback.js",
  "src/presentation/dom.js",
  "src/presentation/labels.js",
  "src/presentation/libraryView.js",
  "src/presentation/metadataFormView.js",
  "src/presentation/pickerView.js",
  "src/presentation/view.js",
]);

function createMockElement(tag = "div") {
  const children = [];
  const listeners = {};
  const attributes = {};
  return {
    tagName: tag.toUpperCase(),
    value: "",
    textContent: "",
    placeholder: "",
    disabled: false,
    hidden: false,
    inert: false,
    children,
    dataset: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
    },
    getAttribute: (attr) => attributes[attr] ?? null,
    setAttribute: (attr, val) => {
      attributes[attr] = val;
    },
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    dispatchEvent(event) {
      const evt = { target: this, ...event };
      (listeners[event.type] || []).forEach((h) => h(evt));
    },
    append: (...items) => children.push(...items),
    replaceChildren: (...items) => {
      children.length = 0;
      children.push(...items);
    },
  };
}

function createMockDocument() {
  const elementsById = new Map();
  const getOrCreate = (id) => {
    if (!elementsById.has(id)) elementsById.set(id, createMockElement("div"));
    return elementsById.get(id);
  };

  const requiredIds = [
    "dir",
    "lang",
    "st",
    "list",
    "sum",
    "pr",
    "st2",
    "series",
    "extract",
    "auto",
    "clear",
    "xml",
    "go",
    "add",
    "langSelect",
    "picker",
    "pickName",
    "pickKind",
    "pickPages",
    "pickCount",
    "pickOk",
    "pickCancel",
  ];

  requiredIds.forEach(getOrCreate);

  return {
    documentElement: { lang: "" },
    title: "",
    getElementById: (id) => getOrCreate(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement(tag),
  };
}

test("view creates without error and fillLanguageOptions populates languageSelect", () => {
  const documentRef = createMockDocument();
  const translator = i18n.createTranslator({
    translations: i18n.TRANSLATIONS,
    fallback: "en",
    language: "en",
  });
  const previews = { urlFor: () => "", releaseAll: () => {} };

  const view = createView({ documentRef, translator, previews });
  assert.ok(view);

  const langSelect = documentRef.getElementById("langSelect");
  view.fillLanguageOptions(i18n.LANGUAGES);

  assert.equal(langSelect.children.length, Object.keys(i18n.LANGUAGES).length);
  assert.equal(langSelect.children[0].value, "en");
  assert.equal(langSelect.children[0].textContent, "English");
});

test("view binds language selection change event to action", () => {
  const documentRef = createMockDocument();
  const translator = i18n.createTranslator({
    translations: i18n.TRANSLATIONS,
    fallback: "en",
    language: "en",
  });
  const previews = { urlFor: () => "", releaseAll: () => {} };
  const view = createView({ documentRef, translator, previews });

  let selected = null;
  view.bindActions({
    onFolderSelected: () => {},
    onSeriesTyped: () => {},
    onExtractFolderNames: () => {},
    onNumberChapters: () => {},
    onClearTitles: () => {},
    onExportSidecar: () => {},
    onGenerate: () => {},
    onSelectFormat: () => {},
    onOpenPicker: () => {},
    onConfirmPicker: () => {},
    onSelectLanguage: (lang) => {
      selected = lang;
    },
    onMetadataChange: () => {},
  });

  const langSelect = documentRef.getElementById("langSelect");
  langSelect.value = "ja";
  langSelect.dispatchEvent({ type: "change" });

  assert.equal(selected, "ja");
});

test("view renders current language and updates control disabled states", () => {
  const documentRef = createMockDocument();
  const translator = i18n.createTranslator({
    translations: i18n.TRANSLATIONS,
    fallback: "en",
    language: "en",
  });
  const previews = { urlFor: () => "", releaseAll: () => {} };
  const view = createView({ documentRef, translator, previews });

  const langSelect = documentRef.getElementById("langSelect");
  view.renderLanguage("de");
  assert.equal(langSelect.value, "de");

  view.setGenerating(true);
  assert.equal(langSelect.disabled, true);

  view.setGenerating(false);
  assert.equal(langSelect.disabled, false);
});

test("fillMangaLanguageOptions populates manga language options including empty option", () => {
  const documentRef = createMockDocument();
  const translator = i18n.createTranslator({
    translations: i18n.TRANSLATIONS,
    fallback: "en",
    language: "en",
  });
  const previews = { urlFor: () => "", releaseAll: () => {} };
  const view = createView({ documentRef, translator, previews });

  const mangaLang = documentRef.getElementById("lang");
  view.fillMangaLanguageOptions();

  assert.ok(mangaLang.children.length > 100);
  assert.equal(mangaLang.children[0].value, "");
  assert.equal(mangaLang.children[0].textContent, "—");
});
