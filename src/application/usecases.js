(function (Tojiru) {
  const D = Tojiru.domain;

  function createStore(initialState) {
    let state = initialState;
    const listeners = new Set();
    return {
      get: () => state,
      update(change, { quiet = false } = {}) {
        state = { ...state, ...change(state) };
        if (!quiet) listeners.forEach((listener) => listener(state));
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  function defaultTitleOf(item, items, translate) {
    const baseName = translate(`kind.${item.kind}.name`);
    return D.isChapter(item) ? `${baseName} ${D.chapterNumber(items, item)}` : baseName;
  }

  const titleOf = (item, items, translate) => item.title.trim() || defaultTitleOf(item, items, translate);

  function buildOutputDocument({ items, metadata, translator }) {
    const translate = translator.t;
    const startPages = D.computeStartPages(items);
    return {
      metadata,
      language: metadata.language || D.UNDETERMINED_LANGUAGE,
      pages: D.pagesOf(items),
      entries: items.map((item, index) => ({
        title: titleOf(item, items, translate),
        kind: item.kind,
        startPage: startPages[index],
        pages: item.pages,
      })),
      labels: {
        contents: translate("kind.toc.label"),
        cover: translate("kind.cover.label"),
        startOfStory: translate("epub.start"),
      },
    };
  }

  function createUseCases({ store, formats, saver, translator }) {
    function retitle(items) {
      return items.map((item) => {
        if (item.titleSource === D.TitleSource.USER) return item;
        const title =
          item.titleSource === D.TitleSource.FOLDER ? item.folder : defaultTitleOf(item, items, translator.t);
        return title === item.title ? item : { ...item, title };
      });
    }

    const changeItems = (change, options) =>
      store.update((state) => ({ items: retitle(change(state.items)) }), options);

    function outputFor(rawMetadata) {
      const metadata = D.normalizeMetadata(rawMetadata);
      const problems = D.validateMetadata(metadata);
      if (problems.length) throw new D.MetadataError(problems);
      return buildOutputDocument({ items: store.get().items, metadata, translator });
    }

    return {
      loadFolder(pages) {
        store.update(() => ({ items: retitle(D.buildItems(pages)), folderLoaded: true }));
      },
      moveItem(index, offset) {
        changeItems((items) => D.moveItem(items, index, offset));
      },
      changeItemKind(index, kind) {
        changeItems((items) => D.setItemKind(items, index, kind));
      },
      renameItem(index, title) {
        changeItems((items) => D.setItemTitle(items, index, title), { quiet: true });
      },
      extractFolderNames() {
        changeItems((items) => D.markChapterTitles(items, true));
      },
      numberChapters() {
        changeItems((items) => D.markChapterTitles(items, false));
      },
      refreshTitles() {
        changeItems((items) => items);
      },
      clearTitles() {
        changeItems(D.clearTitles);
      },
      createManualItem({ pages, kind, title }) {
        changeItems((items) => D.extractPages(items, pages, { kind, title: title.trim() }));
      },
      undoManualItem(index) {
        changeItems((items) => D.restoreItem(items, index));
      },
      selectOutputFormat(formatId) {
        if (formats[formatId]) store.update(() => ({ outputFormat: formatId }));
      },
      async generate({ rawMetadata, onProgress }) {
        const format = formats[store.get().outputFormat];
        const output = outputFor(rawMetadata);
        const fileName = D.outputFileName(output.metadata.series, format.extension);
        const { blob, pageCount } = await format.write(output, onProgress, { fileName });
        saver.save(blob, fileName);
        return { fileName, pageCount, size: blob.size };
      },
      exportSidecar(rawMetadata) {
        const { sidecar } = formats[store.get().outputFormat];
        if (!sidecar) return;
        saver.saveText({
          content: sidecar.build(outputFor(rawMetadata)),
          mediaType: sidecar.mediaType,
          fileName: sidecar.fileName,
        });
      },
    };
  }

  Tojiru.usecases = {
    createStore,
    createUseCases,
    buildOutputDocument,
    defaultTitleOf,
    titleOf,
  };
})((window.Tojiru = window.Tojiru || {}));
