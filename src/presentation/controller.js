(function (Tojiru) {
  const D = Tojiru.domain;
  const BYTES_PER_MB = 1024 * 1024;
  const { LANGUAGES, DEFAULT_LANGUAGE, nextLanguage } = Tojiru.i18n;

  function createController({ store, useCases, formats, view, translator, languageStore, readPages, previews }) {
    const { elements } = view;
    const supportedLanguages = Object.keys(LANGUAGES);
    let statusMessage = null;
    let pickerSelection = new Set();
    let mangaLanguageTouched = false;

    const mangaLanguageCode = () => translator.language.split("-")[0];

    function showStatus(key, params = {}) {
      statusMessage = { key, params };
      view.renderStatus(statusMessage);
    }

    function describeError(error) {
      if (error instanceof D.ImageReadError) {
        return { key: "status.imageError", params: { name: error.pageName } };
      }
      return { key: "status.error", params: { message: error.message } };
    }

    function handleFailure(error) {
      if (error instanceof D.MetadataError) {
        view.hideProgress();
        view.showFieldErrors(error.problems);
        showStatus("status.invalid");
        return;
      }
      const { key, params } = describeError(error);
      showStatus(key, params);
    }

    function onExportSidecar() {
      view.clearFieldErrors();
      try {
        useCases.exportSidecar(view.readMetadataForm());
      } catch (error) {
        handleFailure(error);
      }
    }

    const intents = {
      onMove: (index, offset) => useCases.moveItem(index, offset),
      onRename: (index, title) => useCases.renameItem(index, title),
      onKindChange: (index, kind) => useCases.changeItemKind(index, kind),
      onUndo: (index) => useCases.undoManualItem(index),
    };

    function render(state) {
      view.renderFormat(formats, state.outputFormat);
      view.renderLibrary(state, intents);
      view.setExportEnabled(state.items.length > 0);
    }

    function refreshLanguage() {
      document.documentElement.lang = translator.language || DEFAULT_LANGUAGE;
      view.applyStaticTranslations();
      view.renderLanguageCode(LANGUAGES);
      if (!mangaLanguageTouched) view.setMangaLanguage(mangaLanguageCode());
      view.fillPickerKinds();
      render(store.get());
      view.renderStatus(statusMessage);
    }

    function toggleLanguage() {
      const language = nextLanguage(translator.language, supportedLanguages);
      translator.setLanguage(language);
      languageStore.write(language);
      refreshLanguage();
    }

    function onFolderSelected(event) {
      const pages = readPages(event.target.files);
      useCases.loadFolder(pages);
      view.fillSeriesIfEmpty(D.rootFolderName(pages));
    }

    function handleProgress({ stage, percent, current, total }) {
      view.showProgress(percent);
      showStatus(stage === "reading" ? "status.reading" : "status.packing", { current, total });
    }

    async function onGenerate() {
      view.clearFieldErrors();
      view.setGenerating(true);
      view.resetProgress();
      try {
        const result = await useCases.generate({ rawMetadata: view.readMetadataForm(), onProgress: handleProgress });
        showStatus("status.done", { n: result.pageCount, size: (result.size / BYTES_PER_MB).toFixed(1) });
      } catch (error) {
        handleFailure(error);
      } finally {
        view.setGenerating(false);
      }
    }

    function onPickerToggle(page, checked) {
      if (checked) pickerSelection.add(page);
      else pickerSelection.delete(page);
      view.updatePickerCount(pickerSelection.size);
    }

    function openPicker() {
      pickerSelection = new Set();
      view.openPicker(store.get().items, onPickerToggle);
      view.updatePickerCount(0);
    }

    function confirmPicker() {
      const { kind, title } = view.readPickerChoice();
      useCases.createManualItem({ pages: [...pickerSelection], kind, title });
      view.closePicker();
    }

    function bindEvents() {
      elements.folderInput.addEventListener("change", onFolderSelected);
      elements.numberButton.addEventListener("click", () => useCases.numberChapters());
      elements.clearButton.addEventListener("click", () => useCases.clearTitles());
      elements.sidecarButton.addEventListener("click", onExportSidecar);
      elements.generateButton.addEventListener("click", onGenerate);
      elements.formatButtons.forEach((button) => {
        button.addEventListener("click", () => useCases.selectOutputFormat(button.dataset.format));
      });
      elements.addButton.addEventListener("click", openPicker);
      elements.pickOk.addEventListener("click", confirmPicker);
      elements.pickCancel.addEventListener("click", () => view.closePicker());
      elements.picker.addEventListener("close", () => previews.releaseAll());
      elements.languageButton.addEventListener("click", toggleLanguage);
      elements.mangaLanguageInput.addEventListener("input", () => {
        mangaLanguageTouched = true;
      });
    }

    function start() {
      bindEvents();
      store.subscribe(render);
      refreshLanguage();
    }

    return { start };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createController = createController;
})((window.Tojiru = window.Tojiru || {}));
