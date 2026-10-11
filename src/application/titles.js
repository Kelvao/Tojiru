(function (Tojiru) {
  const { TitleSource, isChapter, chapterNumber } = Tojiru.domain;

  function defaultTitleOf(item, items, translate) {
    const baseName = translate(`kind.${item.kind}.name`);
    return isChapter(item) ? `${baseName} ${chapterNumber(items, item)}` : baseName;
  }

  const titleOf = (item, items, translate) => item.title.trim() || defaultTitleOf(item, items, translate);

  function automaticTitleOf(item, items, translate) {
    return item.titleSource === TitleSource.FOLDER ? item.folder : defaultTitleOf(item, items, translate);
  }

  function retitleItems(items, translate) {
    return items.map((item) => {
      if (item.titleSource === TitleSource.USER) return item;
      const title = automaticTitleOf(item, items, translate);
      return title === item.title ? item : { ...item, title };
    });
  }

  Tojiru.usecases = { ...Tojiru.usecases, defaultTitleOf, titleOf, retitleItems };
})((window.Tojiru = window.Tojiru || {}));
