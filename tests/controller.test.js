const test = require("node:test");
const assert = require("node:assert");
const { DOMAIN_SCRIPTS, APPLICATION_SCRIPTS, loadScripts } = require("./load");

const {
  domain: D,
  usecases: U,
  i18n,
  ui: { createController },
} = loadScripts([
  ...DOMAIN_SCRIPTS,
  ...APPLICATION_SCRIPTS,
  "src/presentation/i18n.js",
  "src/presentation/feedback.js",
  "src/presentation/controller.js",
]);

function createMockView() {
  const state = {
    boundActions: null,
    renderedStatus: null,
    renderedFormats: null,
    renderedLibraryState: null,
    renderedMetadata: null,
    progress: null,
    generating: false,
    exportEnabled: false,
    fieldErrors: [],
    staticTranslationsApplied: 0,
    languageRendered: null,
    pickerCount: 0,
    pickerOpenedWith: null,
    pickerClosed: false,
  };

  return {
    state,
    bindActions(actions) {
      state.boundActions = actions;
    },
    readMetadataForm() {
      return { series: "Initial Series", volume: "1" };
    },
    renderStatus(msg) {
      state.renderedStatus = msg;
    },
    renderFormat(formats, selected) {
      state.renderedFormats = { formats, selected };
    },
    renderLibrary(storeState, intents) {
      state.renderedLibraryState = storeState;
      state.intents = intents;
    },
    renderMetadata(meta) {
      state.renderedMetadata = meta;
    },
    setExportEnabled(enabled) {
      state.exportEnabled = enabled;
    },
    applyStaticTranslations() {
      state.staticTranslationsApplied++;
    },
    renderLanguage(lang) {
      state.languageRendered = lang;
    },
    fillLanguageOptions(langs) {
      state.languageOptionsFilled = langs;
    },
    fillPickerKinds() {},
    fillMangaLanguageOptions() {},
    showProgress(percent) {
      state.progress = percent;
    },
    hideProgress() {
      state.progress = "hidden";
    },
    resetProgress() {
      state.progress = 0;
    },
    setGenerating(busy) {
      state.generating = busy;
    },
    showFieldErrors(problems) {
      state.fieldErrors = problems;
    },
    clearFieldErrors() {
      state.fieldErrors = [];
    },
    openPicker(items, onToggle) {
      state.pickerOpenedWith = items;
      state.onPickerToggle = onToggle;
    },
    updatePickerCount(count) {
      state.pickerCount = count;
    },
    readPickerChoice() {
      return { kind: D.Kind.COVER, title: "Custom Cover" };
    },
    closePicker() {
      state.pickerClosed = true;
    },
  };
}

function setupController(options = {}) {
  const store = U.createStore({
    manga: D.createManga(),
    folderLoaded: false,
    outputFormat: "cbz",
  });
  const translator = i18n.createTranslator({
    translations: i18n.TRANSLATIONS,
    fallback: "en",
    language: "en",
  });
  let savedLang = "en";
  const languageStore = {
    read: () => savedLang,
    write: (l) => {
      savedLang = l;
    },
  };

  const saver = {
    save: () => {},
    saveText: () => {},
  };

  const formats = {
    cbz: {
      id: "cbz",
      label: "CBZ",
      extension: "cbz",
      sidecar: { fileName: "ComicInfo.xml", mediaType: "application/xml", build: () => "<xml/>" },
      write: options.write || (async () => ({ blob: new Blob(["cbz"]), pageCount: 10 })),
    },
  };

  const useCases = U.createUseCases({ store, formats, saver, translator });
  const view = createMockView();
  const readPages = (files) => files;

  const controller = createController({
    store,
    useCases,
    formats,
    view,
    translator,
    languageStore,
    readPages,
  });

  return { controller, store, useCases, view, translator, languageStore };
}

test("controller.start initializes view, binds actions, and loads form metadata", () => {
  const { controller, store, view } = setupController();
  controller.start();

  assert.ok(view.state.boundActions);
  assert.equal(store.get().manga.metadata.series, "Initial Series");
  assert.equal(view.state.staticTranslationsApplied, 1);
  assert.equal(view.state.exportEnabled, false);
});

test("loadFolder populates manga items and sets export enabled", () => {
  const { controller, store, view } = setupController();
  controller.start();

  const files = [
    { name: "01.jpg", path: "Naruto/Cap 1/01.jpg", source: {} },
    { name: "02.jpg", path: "Naruto/Cap 1/02.jpg", source: {} },
  ];
  view.state.boundActions.onFolderSelected(files);

  assert.equal(store.get().folderLoaded, true);
  assert.equal(store.get().manga.metadata.series, "Naruto");
  assert.equal(store.get().manga.items.length, 1);
  assert.equal(view.state.exportEnabled, true);
});

test("onSeriesTyped prevents overwriting custom series name on subsequent folder load", () => {
  const { controller, store, view } = setupController();
  controller.start();

  view.state.boundActions.onSeriesTyped();
  store.update((s) => ({ manga: { ...s.manga, metadata: { ...s.manga.metadata, series: "Custom Typed Title" } } }));

  view.state.boundActions.onFolderSelected([{ name: "01.jpg", path: "FolderName/01.jpg", source: {} }]);

  assert.equal(store.get().manga.metadata.series, "Custom Typed Title");
});

test("selectLanguage switches language, persists choice, and refreshes titles", () => {
  const { controller, translator, languageStore, view } = setupController();
  controller.start();

  assert.equal(translator.language, "en");
  assert.equal(view.state.languageRendered, "en");
  view.state.boundActions.onSelectLanguage("ja");

  assert.equal(translator.language, "ja");
  assert.equal(languageStore.read(), "ja");
  assert.equal(view.state.languageRendered, "ja");
  assert.equal(view.state.staticTranslationsApplied, 2);
});

test("toggleLanguage cycles languages, persists choice, and refreshes titles", () => {
  const { controller, translator, languageStore, view } = setupController();
  controller.start();

  assert.equal(translator.language, "en");
  view.state.boundActions.onToggleLanguage();

  assert.equal(translator.language, "pt-BR");
  assert.equal(languageStore.read(), "pt-BR");
  assert.equal(view.state.staticTranslationsApplied, 2);
});

test("generate handles successful run, reporting progress and size", async () => {
  const { controller, store, view } = setupController({
    write: async (output, onProgress) => {
      onProgress({ stage: "reading", percent: 50, current: 1, total: 2 });
      onProgress({ stage: "packing", percent: 100, current: 2, total: 2 });
      return { blob: { size: 2 * 1024 * 1024 }, pageCount: 2 };
    },
  });
  controller.start();

  store.update((s) => ({
    manga: {
      metadata: { ...s.manga.metadata, series: "Valid Title" },
      items: [D.createItem({ folder: "Cap 1", kind: D.Kind.CHAPTER, pages: [{ name: "1.jpg" }] })],
    },
  }));

  await view.state.boundActions.onGenerate();

  assert.equal(view.state.generating, false);
  assert.equal(view.state.renderedStatus.key, "status.done");
  assert.equal(view.state.renderedStatus.params.n, 2);
  assert.equal(view.state.renderedStatus.params.size, "2.0");
});

test("generate handles metadata validation errors by highlighting fields", async () => {
  const { controller, store, view } = setupController();
  controller.start();

  store.update((s) => ({
    manga: {
      metadata: { ...s.manga.metadata, series: "" },
      items: [D.createItem({ folder: "Cap 1", kind: D.Kind.CHAPTER, pages: [] })],
    },
  }));

  await view.state.boundActions.onGenerate();

  assert.equal(view.state.generating, false);
  assert.equal(view.state.progress, "hidden");
  assert.equal(view.state.renderedStatus.key, "error.invalidMetadata");
  assert.deepEqual(view.state.fieldErrors, [{ field: "series", rule: "required" }]);
});

test("generate handles unexpected writer failures by reporting error status", async () => {
  const { controller, store, view } = setupController({
    write: async () => {
      throw new Error("Disk write failure");
    },
  });
  controller.start();

  store.update((s) => ({
    manga: {
      metadata: { ...s.manga.metadata, series: "Series" },
      items: [D.createItem({ folder: "Cap 1", kind: D.Kind.CHAPTER, pages: [{ name: "1.jpg" }] })],
    },
  }));

  await view.state.boundActions.onGenerate();

  assert.equal(view.state.generating, false);
  assert.equal(view.state.progress, "hidden");
  assert.equal(view.state.renderedStatus.key, "error.unexpected");
  assert.equal(view.state.renderedStatus.severity, "error");
});

test("picker interactions open dialog, toggle selections, and confirm manual item", () => {
  const { controller, store, view } = setupController();
  controller.start();

  const p1 = { name: "1.jpg" };
  const p2 = { name: "2.jpg" };
  store.update((s) => ({
    manga: {
      ...s.manga,
      items: [D.createItem({ folder: "Cap 1", kind: D.Kind.CHAPTER, pages: [p1, p2] })],
    },
  }));

  view.state.boundActions.onOpenPicker();
  assert.equal(view.state.pickerOpenedWith.length, 1);
  assert.equal(view.state.pickerCount, 0);

  view.state.onPickerToggle(p1, true);
  assert.equal(view.state.pickerCount, 1);
  view.state.onPickerToggle(p2, true);
  assert.equal(view.state.pickerCount, 2);
  view.state.onPickerToggle(p1, false);
  assert.equal(view.state.pickerCount, 1);

  view.state.boundActions.onConfirmPicker();
  assert.equal(view.state.pickerClosed, true);
  assert.equal(store.get().manga.items.length, 2);
  assert.equal(store.get().manga.items[0].kind, D.Kind.COVER);
});
