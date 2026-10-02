const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]+/g;
const LOOSE_FILES_FOLDER = "(raiz)";
const DEFAULT_ARCHIVE_NAME = "manga";
const FRONT_COVER_TYPE = "FrontCover";
const STORE_ONLY = { compression: "STORE" };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const Kind = Object.freeze({
  CHAPTER: "chapter",
  COVER: "cover",
  CONTENTS: "toc",
  EXTRA: "extra",
  BACK_COVER: "back",
});

const KIND_DEFINITIONS = {
  [Kind.CHAPTER]: { pageType: "", sortOrder: 2, namePattern: null },
  [Kind.COVER]: { pageType: FRONT_COVER_TYPE, sortOrder: 0, namePattern: /^(capa|cover|front)/ },
  [Kind.CONTENTS]: { pageType: "Other", sortOrder: 1, namePattern: /^(indice|index|sumario|toc|contents)/ },
  [Kind.EXTRA]: { pageType: "Other", sortOrder: 3, namePattern: /^(extra|bonus|omake|especial|special|posfacio|prefacio)/ },
  [Kind.BACK_COVER]: { pageType: "BackCover", sortOrder: 4, namePattern: /^(contra ?capa|back|rear)/ },
};

const getDefinition = (item) => KIND_DEFINITIONS[item.kind];

const isChapter = (item) => item.kind === Kind.CHAPTER;

const countPages = (list) => list.reduce((total, item) => total + item.files.length, 0);

const compareByFileName = (a, b) => collator.compare(a.name, b.name);

const sortedByFileName = (files) => [...files].sort(compareByFileName);

function createItem(folder, kind, files) {
  return { folder, kind, title: "", files: sortedByFileName(files) };
}

function compareItems(a, b) {
  const byKind = getDefinition(a).sortOrder - getDefinition(b).sortOrder;
  return byKind || collator.compare(a.folder, b.folder);
}

function normalizeName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectKind(fileName) {
  const normalized = normalizeName(fileName);
  const match = Object.entries(KIND_DEFINITIONS).find(([, definition]) => definition.namePattern?.test(normalized));
  return match ? match[0] : Kind.CHAPTER;
}

function rootFolderName(files) {
  return files.length ? files[0].webkitRelativePath.split("/")[0] : "";
}

function splitByFolder(files) {
  const folders = new Map();
  const looseFiles = [];
  for (const file of files) {
    const [, name, ...deeperPath] = file.webkitRelativePath.split("/");
    if (deeperPath.length === 0) {
      looseFiles.push(file);
      continue;
    }
    if (!folders.has(name)) folders.set(name, []);
    folders.get(name).push(file);
  }
  return { folders, looseFiles };
}

function buildItems(imageFiles) {
  const { folders, looseFiles } = splitByFolder(imageFiles);
  const result = [...folders].map(([name, files]) => createItem(name, detectKind(name), files));
  const chapterPages = [];
  for (const file of looseFiles) {
    const kind = detectKind(file.name);
    if (kind === Kind.CHAPTER) chapterPages.push(file);
    else result.push(createItem(file.name, kind, [file]));
  }
  if (chapterPages.length) result.push(createItem(LOOSE_FILES_FOLDER, Kind.CHAPTER, chapterPages));
  return result.sort(compareItems);
}

const kindLabel = (kind) => t(`kind.${kind}.label`);

function defaultName(item, list) {
  const baseName = t(`kind.${item.kind}.name`);
  if (!isChapter(item)) return baseName;
  const chapterNumber = list.filter(isChapter).indexOf(item) + 1;
  return `${baseName} ${chapterNumber}`;
}

function displayName(item, list) {
  return item.title.trim() || defaultName(item, list);
}

function computeStartPages(list) {
  let nextPage = 0;
  return list.map((item) => {
    const startPage = nextPage;
    nextPage += item.files.length;
    return startPage;
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function outputBaseName(series) {
  return (series || DEFAULT_ARCHIVE_NAME).replace(FILE_NAME_FORBIDDEN_CHARS, "_");
}
