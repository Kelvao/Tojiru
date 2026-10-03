(function (Tojiru) {
  const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
  const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]+/g;
  const DEFAULT_OUTPUT_NAME = "manga";
  const LOOSE_FOLDER = null;

  const Kind = Object.freeze({
    CHAPTER: "chapter",
    COVER: "cover",
    CONTENTS: "toc",
    EXTRA: "extra",
    BACK_COVER: "back",
  });

  const ReadingMode = Object.freeze({
    RIGHT_TO_LEFT: "YesAndRightToLeft",
    LEFT_TO_RIGHT: "Yes",
    NONE: "No",
  });

  const ALL_KINDS = [Kind.CHAPTER, Kind.COVER, Kind.CONTENTS, Kind.EXTRA, Kind.BACK_COVER];
  const MANUAL_KINDS = [Kind.CONTENTS, Kind.COVER, Kind.EXTRA, Kind.BACK_COVER];

  const KIND_RULES = {
    [Kind.CHAPTER]: { sortOrder: 2, namePattern: null },
    [Kind.COVER]: { sortOrder: 0, namePattern: /^(capa|cover|front)/ },
    [Kind.CONTENTS]: { sortOrder: 1, namePattern: /^(indice|index|sumario|toc|contents)/ },
    [Kind.EXTRA]: { sortOrder: 3, namePattern: /^(extra|bonus|omake|especial|special|posfacio|prefacio)/ },
    [Kind.BACK_COVER]: { sortOrder: 4, namePattern: /^(contra ?capa|back|rear)/ },
  };

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  class ImageReadError extends Error {
    constructor(pageName) {
      super(`Could not read image ${pageName}`);
      this.name = "ImageReadError";
      this.pageName = pageName;
    }
  }

  const isImageName = (name) => IMAGE_EXTENSION.test(name);
  const extensionOf = (name) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const isChapter = (item) => item.kind === Kind.CHAPTER;
  const sortOrderOf = (item) => KIND_RULES[item.kind].sortOrder;
  const pagesOf = (items) => items.flatMap((item) => item.pages);
  const countPages = (items) => pagesOf(items).length;
  const sortPagesByName = (pages) => [...pages].sort((a, b) => collator.compare(a.name, b.name));

  function normalizeName(fileName) {
    return fileName
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function detectKind(name) {
    const normalized = normalizeName(name);
    const match = Object.entries(KIND_RULES).find(([, rule]) => rule.namePattern?.test(normalized));
    return match ? match[0] : Kind.CHAPTER;
  }

  function createItem({ folder, kind, pages, title = "", manual = false, origins = null }) {
    return { folder, kind, title, pages, manual, origins };
  }

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
      createItem({ folder: name, kind: detectKind(name), pages: sortPagesByName(group) }),
    );
    const chapterPages = [];
    for (const page of loosePages) {
      const kind = detectKind(page.name);
      if (kind === Kind.CHAPTER) chapterPages.push(page);
      else items.push(createItem({ folder: page.name, kind, pages: [page] }));
    }
    if (chapterPages.length) {
      items.push(createItem({ folder: LOOSE_FOLDER, kind: Kind.CHAPTER, pages: sortPagesByName(chapterPages) }));
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

  const setItemKind = (items, index, kind) => updateItem(items, index, { kind });
  const setItemTitle = (items, index, title) => updateItem(items, index, { title });
  const clearTitles = (items) => items.map((item) => ({ ...item, title: "" }));

  function renameChapters(items, makeTitle) {
    let number = 0;
    return items.map((item) => (isChapter(item) ? { ...item, title: makeTitle(++number) } : item));
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
    const manualItem = createItem({ folder: LOOSE_FOLDER, kind, title, pages: ordered, manual: true, origins });
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
    return updateItem(list, ownerIndex, { pages: sortPagesByName([...list[ownerIndex].pages, page]) });
  }

  function restoreItem(items, index) {
    const target = items[index];
    if (!target?.manual) return items;
    const withoutTarget = items.filter((_, position) => position !== index);
    return [...target.origins].reduce((list, [page, folder]) => returnPage(list, page, folder), withoutTarget);
  }

  function normalizeMetadata(raw) {
    const text = (value) => String(value ?? "").trim();
    const genreList = text(raw.genres).split(",").map((genre) => genre.trim()).filter(Boolean);
    return {
      series: text(raw.series),
      volume: text(raw.volume),
      summary: text(raw.summary),
      year: text(raw.year),
      writer: text(raw.writer),
      penciller: text(raw.penciller),
      publisher: text(raw.publisher),
      genreList,
      genres: genreList.join(", "),
      language: text(raw.language),
      readingMode: raw.readingMode || ReadingMode.RIGHT_TO_LEFT,
    };
  }

  function outputFileName(series, extension) {
    const baseName = (series || DEFAULT_OUTPUT_NAME).replace(FILE_NAME_FORBIDDEN_CHARS, "_");
    return `${baseName}.${extension}`;
  }

  Tojiru.domain = {
    DEFAULT_OUTPUT_NAME,
    LOOSE_FOLDER,
    Kind,
    ReadingMode,
    ALL_KINDS,
    MANUAL_KINDS,
    ImageReadError,
    isImageName,
    extensionOf,
    isChapter,
    pagesOf,
    countPages,
    detectKind,
    createItem,
    buildItems,
    rootFolderName,
    computeStartPages,
    chapterNumber,
    insertByKind,
    moveItem,
    setItemKind,
    setItemTitle,
    clearTitles,
    renameChapters,
    extractPages,
    restoreItem,
    normalizeMetadata,
    outputFileName,
  };
})((window.Tojiru = window.Tojiru || {}));
