(function (Tojiru) {
  const { UNDETERMINED_LANGUAGE, computeStartPages, pagesOf } = Tojiru.domain;
  const { titleOf } = Tojiru.usecases;

  function buildEntries(items, translate) {
    const startPages = computeStartPages(items);
    return items.map((item, index) => ({
      title: titleOf(item, items, translate),
      kind: item.kind,
      startPage: startPages[index],
      pages: item.pages,
    }));
  }

  function buildLabels(translate) {
    return {
      contents: translate("kind.toc.label"),
      cover: translate("kind.cover.label"),
      startOfStory: translate("epub.start"),
    };
  }

  function buildOutputDocument({ items, metadata, translator }) {
    return {
      metadata,
      language: metadata.language || UNDETERMINED_LANGUAGE,
      pages: pagesOf(items),
      entries: buildEntries(items, translator.t),
      labels: buildLabels(translator.t),
    };
  }

  Tojiru.usecases = { ...Tojiru.usecases, buildOutputDocument };
})((window.Tojiru = window.Tojiru || {}));
