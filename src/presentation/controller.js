(function (Tojiru) {
  const { MetadataError } = Tojiru.domain;
  const { LANGUAGES, nextLanguage } = Tojiru.i18n;
  const { describeFailure, describeNotices } = Tojiru.ui.feedback;
  const BYTES_PER_MB = 1024 * 1024;

  const megabytes = (bytes) => (bytes / BYTES_PER_MB).toFixed(1);

  function createController({ store, useCases, formats, view, translator, languageStore, readPages }) {
    const supportedLanguages = Object.keys(LANGUAGES);
    let statusMessage = null;
    let pickerSelection = new Set();
    let seriesTypedByUser = false;

    function showStatus(key, params = {}, extras = {}) {
      statusMessage = { key, params, ...extras };
      view.renderStatus(statusMessage);
    }

    function showFailure(error) {
      view.hideProgress();
      const failure = describeFailure(error);
      if (error instanceof MetadataError) view.showFieldErrors(error.problems);
      else if (!failure.expected) console.error(failure.cause);
      showStatus(failure.key, failure.params, { severity: "error" });
    }

    function showSuccess({ pageCount, size, notices }) {
      showStatus("status.done", { n: pageCount, size: megabytes(size) }, { notes: describeNotices(notices) });
    }

    function showProgress({ stage, percent, current, total }) {
      view.showProgress(percent);
      showStatus(stage === "reading" ? "status.reading" : "status.packing", { current, total });
    }

    const itemIntents = {
      onMove: (index, offset) => useCases.moveItem(index, offset),
      onRename: (index, title) => useCases.renameItem(index, title),
      onKindChange: (index, kind) => useCases.changeItemKind(index, kind),
      onUndo: (index) => useCases.undoManualItem(index),
    };

    function render(state) {
      view.renderFormat(formats, state.outputFormat);
      view.renderLibrary(state, itemIntents);
      view.setExportEnabled(state.manga.items.length > 0);
      view.renderMetadata(state.manga.metadata);
    }

    function refreshLanguage() {
      view.applyStaticTranslations();
      view.renderLanguage(translator.language);
      view.fillPickerKinds();
      view.fillMangaLanguageOptions();
      render(store.get());
      view.renderStatus(statusMessage);
    }

    function selectLanguage(language) {
      if (!supportedLanguages.includes(language)) return;
      translator.setLanguage(language);
      languageStore.write(language);
      useCases.refreshTitles();
      refreshLanguage();
    }

    function toggleLanguage() {
      selectLanguage(nextLanguage(translator.language, supportedLanguages));
    }

    function loadFolder(files) {
      const { seriesFilled } = useCases.loadFolder(readPages(files), { keepTypedSeries: seriesTypedByUser });
      if (seriesFilled) seriesTypedByUser = false;
    }

    function exportSidecar() {
      view.clearFieldErrors();
      try {
        useCases.exportSidecar();
      } catch (error) {
        showFailure(error);
      }
    }

    async function generate() {
      view.clearFieldErrors();
      view.setGenerating(true);
      view.resetProgress();
      try {
        const result = await useCases.generate({ onProgress: showProgress });
        view.setGenerating(false);
        showSuccess(result);
      } catch (error) {
        view.setGenerating(false);
        showFailure(error);
      }
    }

    function togglePickerPage(page, checked) {
      if (checked) pickerSelection.add(page);
      else pickerSelection.delete(page);
      view.updatePickerCount(pickerSelection.size);
    }

    function openPicker() {
      pickerSelection = new Set();
      view.openPicker(store.get().manga.items, togglePickerPage);
      view.updatePickerCount(0);
    }

    function confirmPicker() {
      const { kind, title } = view.readPickerChoice();
      useCases.createManualItem({ pages: [...pickerSelection], kind, title });
      view.closePicker();
    }

    function start() {
      useCases.loadMetadata(view.readMetadataForm());
      view.fillLanguageOptions?.(LANGUAGES);
      view.bindActions({
        onFolderSelected: loadFolder,
        onSeriesTyped: () => {
          seriesTypedByUser = true;
        },
        onExtractFolderNames: () => useCases.extractFolderNames(),
        onNumberChapters: () => useCases.numberChapters(),
        onClearTitles: () => useCases.clearTitles(),
        onClearMetadata: () => {
          seriesTypedByUser = false;
          view.clearFieldErrors();
          useCases.clearMetadata();
        },
        onExportSidecar: exportSidecar,
        onGenerate: generate,
        onSelectFormat: (formatId) => useCases.selectOutputFormat(formatId),
        onOpenPicker: openPicker,
        onConfirmPicker: confirmPicker,
        onSelectLanguage: selectLanguage,
        onToggleLanguage: toggleLanguage,
        onMetadataChange: (field, value) => useCases.changeMetadata(field, value, { quiet: true }),
      });
      store.subscribe(render);
      refreshLanguage();
    }

    return { start };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createController = createController;
})((window.Tojiru = window.Tojiru || {}));
