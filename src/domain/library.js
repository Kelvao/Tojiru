(function (Tojiru) {
  const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
  const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]+/g;
  const DEFAULT_OUTPUT_NAME = "manga";
  const UNDETERMINED_LANGUAGE = "und";
  const ISO_639_1_CODES = `
    aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv
    dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie
    ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv
    mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm
    rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts
    tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu
  `
    .trim()
    .split(/\s+/);
  const LOOSE_FOLDER = null;

  const Kind = Object.freeze({
    CHAPTER: "chapter",
    COVER: "cover",
    CONTENTS: "toc",
    EXTRA: "extra",
    BACK_COVER: "back",
  });

  const TitleSource = Object.freeze({ DEFAULT: "default", FOLDER: "folder", USER: "user" });

  const ReadingMode = Object.freeze({
    RIGHT_TO_LEFT: "YesAndRightToLeft",
    LEFT_TO_RIGHT: "Yes",
    NONE: "No",
  });

  const ALL_KINDS = [Kind.CHAPTER, Kind.COVER, Kind.CONTENTS, Kind.EXTRA, Kind.BACK_COVER];
  const MANUAL_KINDS = [Kind.CONTENTS, Kind.COVER, Kind.EXTRA, Kind.BACK_COVER];

  const startsWithWord = (...words) => new RegExp(`^(?:${words.join("|")})(?![a-z])`);

  const KIND_RULES = {
    [Kind.CHAPTER]: { sortOrder: 2, namePattern: null },
    [Kind.COVER]: { sortOrder: 0, namePattern: startsWithWord("capas?", "covers?", "front(?:cover)?") },
    [Kind.CONTENTS]: {
      sortOrder: 1,
      namePattern: startsWithWord("indices?", "index(?:es)?", "sumarios?", "toc", "contents"),
    },
    [Kind.EXTRA]: {
      sortOrder: 3,
      namePattern: startsWithWord(
        "extras?",
        "bonus",
        "omakes?",
        "especiais",
        "especial",
        "specials?",
        "posfacios?",
        "prefacios?",
      ),
    },
    [Kind.BACK_COVER]: {
      sortOrder: 4,
      namePattern: startsWithWord("contra ?capas?", "back(?:cover)?", "rear(?:cover)?"),
    },
  };

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const REQUIRED_FIELDS = Object.freeze(["series"]);

  class MetadataError extends Error {
    constructor(problems) {
      super("Invalid metadata");
      this.name = "MetadataError";
      this.problems = problems;
    }
  }

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

  function createItem({
    folder,
    kind,
    pages,
    title = "",
    titleSource = TitleSource.DEFAULT,
    manual = false,
    origins = null,
  }) {
    return { folder, kind, title, titleSource, pages, manual, origins };
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

  function normalizeMetadata(raw) {
    const text = (value) => String(value ?? "").trim();
    const genreList = text(raw.genres)
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);
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
      language: text(raw.language).toLowerCase(),
      readingMode: raw.readingMode || ReadingMode.RIGHT_TO_LEFT,
    };
  }

  function validateMetadata(metadata) {
    const missing = REQUIRED_FIELDS.filter((field) => !metadata[field]).map((field) => ({ field, rule: "required" }));
    const invalid = metadata.language && !ISO_639_1_CODES.includes(metadata.language);
    return invalid ? [...missing, { field: "language", rule: "invalid" }] : missing;
  }

  function outputFileName(series, extension) {
    const baseName = (series || DEFAULT_OUTPUT_NAME).replace(FILE_NAME_FORBIDDEN_CHARS, "_");
    return `${baseName}.${extension}`;
  }

  Tojiru.domain = {
    DEFAULT_OUTPUT_NAME,
    UNDETERMINED_LANGUAGE,
    ISO_639_1_CODES,
    LOOSE_FOLDER,
    Kind,
    ReadingMode,
    TitleSource,
    ALL_KINDS,
    MANUAL_KINDS,
    REQUIRED_FIELDS,
    MetadataError,
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
    markChapterTitles,
    extractPages,
    restoreItem,
    normalizeMetadata,
    validateMetadata,
    outputFileName,
  };
})((window.Tojiru = window.Tojiru || {}));
