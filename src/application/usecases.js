(function (Tojiru) {
  const {
    MetadataError,
    buildItems,
    rootFolderName,
    createMetadata,
    setMetadataField,
    normalizeMetadata,
    validateMetadata,
    moveItem,
    setItemKind,
    setItemTitle,
    clearTitles,
    markChapterTitles,
    extractPages,
    restoreItem,
    outputFileName,
  } = Tojiru.domain;
  const { retitleItems, buildOutputDocument, withAppErrors } = Tojiru.usecases;

  function seriesAfterLoading(metadata, pages, keepTypedSeries) {
    const folderName = rootFolderName(pages);
    if (!folderName || (keepTypedSeries && metadata.series)) return metadata;
    return setMetadataField(metadata, "series", folderName);
  }

  function createUseCases({ store, formats, saver, translator }) {
    const retitle = (items) => retitleItems(items, translator.t);
    const selectedFormat = () => formats[store.get().outputFormat];

    const changeManga = (change, options) =>
      store.update((state) => ({ manga: { ...state.manga, ...change(state.manga) } }), options);

    const changeItems = (change, options) => changeManga((manga) => ({ items: retitle(change(manga.items)) }), options);

    function buildValidatedOutput() {
      const { metadata: rawMetadata, items } = store.get().manga;
      const metadata = normalizeMetadata(rawMetadata);
      const problems = validateMetadata(metadata);
      if (problems.length) throw new MetadataError(problems);
      return buildOutputDocument({ items, metadata, translator });
    }

    async function generate({ onProgress }) {
      const format = selectedFormat();
      const output = buildValidatedOutput();
      const fileName = outputFileName(output.metadata.series, format.extension);
      const notices = [];
      const onNotice = (notice) => notices.push(notice);
      const { blob, pageCount } = await format.write(output, onProgress, { fileName, onNotice });
      saver.save(blob, fileName);
      return { fileName, pageCount, size: blob.size, notices };
    }

    function exportSidecar() {
      const { sidecar } = selectedFormat();
      if (!sidecar) return;
      saver.saveText({
        content: sidecar.build(buildValidatedOutput()),
        mediaType: sidecar.mediaType,
        fileName: sidecar.fileName,
      });
    }

    return {
      loadFolder(pages, { keepTypedSeries = false } = {}) {
        const { metadata } = store.get().manga;
        const nextMetadata = seriesAfterLoading(metadata, pages, keepTypedSeries);
        store.update((state) => ({
          manga: { ...state.manga, metadata: nextMetadata, items: retitle(buildItems(pages)) },
          folderLoaded: true,
        }));
        return { seriesFilled: nextMetadata !== metadata };
      },
      loadMetadata(rawMetadata) {
        changeManga(() => ({ metadata: createMetadata(rawMetadata) }));
      },
      clearMetadata() {
        changeManga(() => ({ metadata: createMetadata() }));
      },
      changeMetadata(field, value, options) {
        changeManga((manga) => ({ metadata: setMetadataField(manga.metadata, field, value) }), options);
      },
      moveItem(index, offset) {
        changeItems((items) => moveItem(items, index, offset));
      },
      changeItemKind(index, kind) {
        changeItems((items) => setItemKind(items, index, kind));
      },
      renameItem(index, title) {
        changeItems((items) => setItemTitle(items, index, title), { quiet: true });
      },
      extractFolderNames() {
        changeItems((items) => markChapterTitles(items, true));
      },
      numberChapters() {
        changeItems((items) => markChapterTitles(items, false));
      },
      refreshTitles() {
        changeItems((items) => items);
      },
      clearTitles() {
        changeItems(clearTitles);
      },
      createManualItem({ pages, kind, title }) {
        changeItems((items) => extractPages(items, pages, { kind, title: title.trim() }));
      },
      undoManualItem(index) {
        changeItems((items) => restoreItem(items, index));
      },
      selectOutputFormat(formatId) {
        if (formats[formatId]) store.update(() => ({ outputFormat: formatId }));
      },
      generate: withAppErrors(generate),
      exportSidecar: withAppErrors(exportSidecar),
    };
  }

  Tojiru.usecases = { ...Tojiru.usecases, createUseCases };
})((window.Tojiru = window.Tojiru || {}));
