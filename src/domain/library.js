(function (Tojiru) {
  const { Kind, TitleSource, detectKind, createItem, kindOrderOf } = Tojiru.domain;
  const LOOSE_FOLDER = null;

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const isChapter = (item) => item.kind === Kind.CHAPTER;
  const sortOrderOf = (item) => kindOrderOf(item.kind);
  const pagesOf = (items) => items.flatMap((item) => item.pages);
  const countPages = (items) => pagesOf(items).length;
  const totalBytes = (items) => pagesOf(items).reduce((sum, page) => sum + (page.source?.size ?? 0), 0);

  function comparePages(a, b) {
    const first = a.path.split("/");
    const second = b.path.split("/");
    const shared = Math.min(first.length, second.length);
    for (let index = 0; index < shared; index++) {
      const order = collator.compare(first[index], second[index]);
      if (order) return order;
    }
    return first.length - second.length;
  }

  const sortPages = (pages) => [...pages].sort(comparePages);

  function compareItems(a, b) {
    return sortOrderOf(a) - sortOrderOf(b) || collator.compare(a.folder ?? "", b.folder ?? "");
  }

  function rootFolderName(pages) {
    return pages.length ? pages[0].path.split("/")[0] : "";
  }

  function splitByFolder(pages) {
    const folders = new Map();
    const loosePages = [];
    for (const page of pages) {
      const [, name, ...deeperPath] = page.path.split("/");
      if (deeperPath.length === 0) {
        loosePages.push(page);
        continue;
      }
      if (!folders.has(name)) folders.set(name, []);
      folders.get(name).push(page);
    }
    return { folders, loosePages };
  }

  function buildItems(pages) {
    const { folders, loosePages } = splitByFolder(pages);
    const items = [...folders].map(([name, group]) =>
      createItem({ folder: name, kind: detectKind(name), pages: sortPages(group) }),
    );
    const chapterPages = [];
    for (const page of loosePages) {
      const kind = detectKind(page.name);
      if (kind === Kind.CHAPTER) chapterPages.push(page);
      else items.push(createItem({ folder: page.name, kind, pages: [page] }));
    }
    if (chapterPages.length) {
      items.push(createItem({ folder: LOOSE_FOLDER, kind: Kind.CHAPTER, pages: sortPages(chapterPages) }));
    }
    return items.sort(compareItems);
  }

  function computeStartPages(items) {
    let nextPage = 0;
    return items.map((item) => {
      const startPage = nextPage;
      nextPage += item.pages.length;
      return startPage;
    });
  }

  function chapterNumber(items, item) {
    return items.filter(isChapter).indexOf(item) + 1;
  }

  function insertByKind(items, item) {
    const order = sortOrderOf(item);
    const index = items.findIndex((other) => sortOrderOf(other) > order);
    const position = index < 0 ? items.length : index;
    return [...items.slice(0, position), item, ...items.slice(position)];
  }

  function moveItem(items, index, offset) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return items;
    const result = [...items];
    [result[index], result[target]] = [result[target], result[index]];
    return result;
  }

  const updateItem = (items, index, change) =>
    items.map((item, position) => (position === index ? { ...item, ...change } : item));

  const setItemKind = (items, index, kind) =>
    items.map((item, position) => {
      if (position !== index) return item;
      return item.titleSource === TitleSource.USER
        ? { ...item, kind }
        : { ...item, kind, titleSource: TitleSource.DEFAULT };
    });
  const setItemTitle = (items, index, title) => updateItem(items, index, { title, titleSource: TitleSource.USER });
  const clearTitles = (items) => items.map((item) => ({ ...item, title: "", titleSource: TitleSource.USER }));

  function markChapterTitles(items, fromFolders) {
    return items.map((item) => {
      if (!isChapter(item)) return item;
      const fromFolder = fromFolders && !item.manual && item.folder !== LOOSE_FOLDER;
      return { ...item, titleSource: fromFolder ? TitleSource.FOLDER : TitleSource.DEFAULT };
    });
  }

  function originOf(items, page) {
    const owner = items.find((item) => item.pages.includes(page));
    return owner.origins?.get(page) ?? owner.folder;
  }

  function extractPages(items, selectedPages, { kind, title }) {
    const selected = new Set(selectedPages);
    const ordered = pagesOf(items).filter((page) => selected.has(page));
    if (ordered.length === 0) return items;
    const origins = new Map(ordered.map((page) => [page, originOf(items, page)]));
    const remaining = items
      .map((item) => ({ ...item, pages: item.pages.filter((page) => !selected.has(page)) }))
      .filter((item) => item.pages.length > 0);
    const manualItem = createItem({
      folder: LOOSE_FOLDER,
      kind,
      title,
      titleSource: title ? TitleSource.USER : TitleSource.DEFAULT,
      pages: ordered,
      manual: true,
      origins,
    });
    return insertByKind(remaining, manualItem);
  }

  function findOriginOwner(items, folder) {
    return items.findIndex((item) => !item.manual && item.folder === folder);
  }

  function returnPage(items, page, folder) {
    let list = items;
    if (findOriginOwner(list, folder) < 0) {
      const kind = folder === LOOSE_FOLDER ? Kind.CHAPTER : detectKind(folder);
      list = insertByKind(list, createItem({ folder, kind, pages: [] }));
    }
    const ownerIndex = findOriginOwner(list, folder);
    return updateItem(list, ownerIndex, { pages: sortPages([...list[ownerIndex].pages, page]) });
  }

  function restoreItem(items, index) {
    const target = items[index];
    if (!target?.manual) return items;
    const withoutTarget = items.filter((_, position) => position !== index);
    return [...target.origins].reduce((list, [page, folder]) => returnPage(list, page, folder), withoutTarget);
  }

  Tojiru.domain = {
    ...Tojiru.domain,
    LOOSE_FOLDER,
    isChapter,
    pagesOf,
    countPages,
    totalBytes,
    buildItems,
    rootFolderName,
    computeStartPages,
    chapterNumber,
    insertByKind,
    moveItem,
    setItemKind,
    setItemTitle,
    clearTitles,
    markChapterTitles,
    extractPages,
    restoreItem,
  };
})((window.Tojiru = window.Tojiru || {}));
