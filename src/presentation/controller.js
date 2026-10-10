(function (Tojiru) {
  const D = Tojiru.domain;
  const BYTES_PER_MB = 1024 * 1024;
  const { LANGUAGES, nextLanguage } = Tojiru.i18n;
  const { describeFailure, describeNotices } = Tojiru.ui.feedback;

  function createController({ store, useCases, formats, view, translator, languageStore, readPages, previews }) {
    const { elements } = view;
    const supportedLanguages = Object.keys(LANGUAGES);
    let statusMessage = null;
    let pickerSelection = new Set();
    let seriesTouched = false;

    function showStatus(key, params = {}, extras = {}) {
      statusMessage = { key, params, ...extras };
      view.renderStatus(statusMessage);
    }

    function handleFailure(error) {
      view.hideProgress();
      const failure = describeFailure(error);
      if (error instanceof D.MetadataError) view.showFieldErrors(error.problems);
      else if (!failure.expected) console.error(failure.cause);
      showStatus(failure.key, failure.params, { severity: "error" });
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
      view.applyStaticTranslations();
      view.renderLanguageCode(LANGUAGES);
      view.fillPickerKinds();
      view.fillMangaLanguageOptions();
      render(store.get());
      view.renderStatus(statusMessage);
    }

    function toggleLanguage() {
      const language = nextLanguage(translator.language, supportedLanguages);
      translator.setLanguage(language);
      languageStore.write(language);
      useCases.refreshTitles();
      refreshLanguage();
    }

    function onFolderSelected(event) {
      const pages = readPages(event.target.files);
      useCases.loadFolder(pages);
      const name = D.rootFolderName(pages);
      if (name && (!seriesTouched || !elements.seriesInput.value)) {
        view.setSeries(name);
        seriesTouched = false;
      }
    }

    function handleProgress({ stage, percent, current, total }) {
      view.showProgress(percent);
      showStatus(stage === "reading" ? "status.reading" : "status.packing", { current, total });
    }

    async function onGenerate() {
      view.clearFieldErrors();
      view.setGenerating(true);
      view.resetProgress();
      let result;
      let failure;
      try {
        result = await useCases.generate({ rawMetadata: view.readMetadataForm(), onProgress: handleProgress });
      } catch (error) {
        failure = error;
      }
      view.setGenerating(false);
      if (failure) handleFailure(failure);
      else {
        const params = { n: result.pageCount, size: (result.size / BYTES_PER_MB).toFixed(1) };
        showStatus("status.done", params, { notes: describeNotices(result.notices) });
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
      elements.seriesInput.addEventListener("input", () => {
        seriesTouched = true;
      });
      elements.extractButton.addEventListener("click", () => useCases.extractFolderNames());
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
