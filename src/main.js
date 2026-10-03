(function (Tojiru) {
  const { createStore, createUseCases } = Tojiru.usecases;
  const { DEFAULT_LANGUAGE, LANGUAGES, TRANSLATIONS, detectLanguage, createTranslator } = Tojiru.i18n;
  const {
    pagesFromFileList,
    createBlobSaver,
    createOpfsStorage,
    createLanguageStore,
    createPreviewUrls,
    generateUuid,
  } = Tojiru.infra.browser;
  const { createImageDecoder } = Tojiru.infra.images;
  const { createCbzFormat } = Tojiru.infra.cbz;
  const { createEpubFormat } = Tojiru.infra.epub;
  const { createView, createController } = Tojiru.ui;

  const LANGUAGE_STORAGE_KEY = "tojiru.language";
  const DEFAULT_OUTPUT_FORMAT = "cbz";

  function requireJsZip() {
    if (!window.JSZip) throw new Error("JSZip is not loaded");
    return window.JSZip;
  }

  const languageStore = createLanguageStore({ storageKey: LANGUAGE_STORAGE_KEY, windowRef: window });
  const translator = createTranslator({
    translations: TRANSLATIONS,
    fallback: DEFAULT_LANGUAGE,
    language: detectLanguage({
      stored: languageStore.read(),
      preferred: languageStore.preferred(),
      supported: Object.keys(LANGUAGES),
      fallback: DEFAULT_LANGUAGE,
    }),
  });

  const imageDecoder = createImageDecoder({ documentRef: document });
  const opfs = createOpfsStorage({ navigatorRef: navigator });
  opfs.purge();
  const formats = {
    cbz: createCbzFormat({ getJsZip: requireJsZip, createSink: opfs.createSink }),
    epub: createEpubFormat({ getJsZip: requireJsZip, imageDecoder, generateUuid, createSink: opfs.createSink }),
  };

  const store = createStore({ items: [], folderLoaded: false, outputFormat: DEFAULT_OUTPUT_FORMAT });
  const useCases = createUseCases({ store, formats, saver: createBlobSaver(document), translator });
  const previews = createPreviewUrls();
  const view = createView({ documentRef: document, translator, previews });

  createController({
    store,
    useCases,
    formats,
    view,
    translator,
    languageStore,
    readPages: pagesFromFileList,
    previews,
  }).start();

  Tojiru.started = true;
})((window.Tojiru = window.Tojiru || {}));
