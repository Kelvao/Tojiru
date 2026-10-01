const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]+/g;
const COMIC_INFO_FILE = "ComicInfo.xml";
const LOOSE_FILES_FOLDER = "(raiz)";
const DEFAULT_ARCHIVE_NAME = "manga";
const FRONT_COVER_TYPE = "FrontCover";
const MIN_PAGE_NUMBER_WIDTH = 4;
const BYTES_PER_MB = 1024 * 1024;
const HIDDEN_CLASS = "hide";
const XML_HEADER = '<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n';
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

const byId = (id) => document.getElementById(id);

const ui = {
  folderInput: byId("dir"),
  folderStatus: byId("st"),
  list: byId("list"),
  summary: byId("sum"),
  progress: byId("pr"),
  status: byId("st2"),
  seriesInput: byId("series"),
  numberButton: byId("auto"),
  clearButton: byId("clear"),
  xmlButton: byId("xml"),
  generateButton: byId("go"),
  addButton: byId("add"),
  languageButton: byId("langToggle"),
  languageCode: byId("langCode"),
  languageField: byId("lang"),
  picker: byId("picker"),
  pickName: byId("pickName"),
  pickKind: byId("pickKind"),
  pickPages: byId("pickPages"),
  pickCount: byId("pickCount"),
  pickOk: byId("pickOk"),
  pickCancel: byId("pickCancel"),
};

const PICKER_KINDS = [Kind.CONTENTS, Kind.COVER, Kind.EXTRA, Kind.BACK_COVER];

let items = [];
let folderLoaded = false;
let statusMessage = null;
let languageFieldTouched = false;
let pickerSelection = new Set();
let previewUrls = [];

const getDefinition = (item) => KIND_DEFINITIONS[item.kind];
const isChapter = (item) => item.kind === Kind.CHAPTER;
const countPages = (list) => list.reduce((total, item) => total + item.files.length, 0);
const compareByFileName = (a, b) => collator.compare(a.name, b.name);
const sortedByFileName = (files) => [...files].sort(compareByFileName);
const readText = (id) => byId(id).value.trim();

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

function displayFolder(name) {
  return name === LOOSE_FILES_FOLDER ? t("item.root") : name;
}

function folderLabel(item) {
  if (!item.manual) return displayFolder(item.folder);
  const folders = [...new Set(item.sources.values())].map(displayFolder).join(", ");
  return t("item.from", { folders });
}

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

function xmlTag(name, value) {
  const isEmpty = value === "" || value === null || value === undefined;
  return isEmpty ? "" : `  <${name}>${escapeXml(value)}</${name}>\n`;
}

function readMetadata() {
  return {
    series: readText("series"),
    volume: readText("volume"),
    summary: readText("summary"),
    year: readText("year"),
    writer: readText("writer"),
    penciller: readText("penciller"),
    publisher: readText("publisher"),
    genres: readText("genre").split(",").map((genre) => genre.trim()).filter(Boolean).join(", "),
    language: readText("lang"),
    readingMode: byId("manga").value,
  };
}

function buildPageEntry(item, list, pageIndex) {
  const pageType = getDefinition(item).pageType || (pageIndex === 0 ? FRONT_COVER_TYPE : "");
  const typeAttribute = pageType ? ` Type="${pageType}"` : "";
  const bookmark = escapeXml(displayName(item, list));
  return `    <Page Image="${pageIndex}"${typeAttribute} Bookmark="${bookmark}" />\n`;
}

function buildPageEntries(list) {
  const startPages = computeStartPages(list);
  return list.map((item, index) => buildPageEntry(item, list, startPages[index])).join("");
}

function buildComicInfoXml(metadata, list) {
  const fields = [
    ["Title", metadata.series],
    ["Series", metadata.series],
    ["Volume", metadata.volume],
    ["Summary", metadata.summary],
    ["Year", metadata.year],
    ["Writer", metadata.writer],
    ["Penciller", metadata.penciller],
    ["Publisher", metadata.publisher],
    ["Genre", metadata.genres],
    ["LanguageISO", metadata.language],
    ["PageCount", countPages(list)],
    ["Manga", metadata.readingMode],
  ];
  const body = fields.map(([name, value]) => xmlTag(name, value)).join("");
  return `${XML_HEADER}${body}  <Pages>\n${buildPageEntries(list)}  </Pages>\n</ComicInfo>\n`;
}

function pageFileName(pageNumber, width, file) {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return String(pageNumber).padStart(width, "0") + extension;
}

function addPagesToZip(zip, list) {
  const width = Math.max(MIN_PAGE_NUMBER_WIDTH, String(countPages(list)).length);
  const files = list.flatMap((item) => item.files);
  files.forEach((file, pageNumber) => zip.file(pageFileName(pageNumber, width, file), file, STORE_ONLY));
  return files.length;
}

function archiveBaseName() {
  const name = readText("series") || DEFAULT_ARCHIVE_NAME;
  return name.replace(FILE_NAME_FORBIDDEN_CHARS, "_");
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function createMoveButton(symbol, onClick) {
  const button = createElement("button", "", symbol);
  button.tabIndex = -1;
  button.addEventListener("click", onClick);
  return button;
}

function createReorderControls(index) {
  const controls = createElement("div", "ord");
  controls.append(
    createMoveButton("▲", () => moveItem(index, -1)),
    createMoveButton("▼", () => moveItem(index, 1)),
  );
  return controls;
}

function createUndoButton(item) {
  const button = createElement("button", "lnk", t("item.undo"));
  button.tabIndex = -1;
  button.addEventListener("click", () => restoreItem(item));
  return button;
}

function createFolderLabel(item) {
  const label = createElement("div", item.manual ? "fn man" : "fn");
  label.title = folderLabel(item);
  label.append(createElement("span", "", folderLabel(item)));
  if (item.manual) label.append(createUndoButton(item));
  return label;
}

function createTitleInput(item) {
  const input = createElement("input");
  input.placeholder = defaultName(item, items);
  input.value = item.title;
  input.addEventListener("input", () => { item.title = input.value; });
  return input;
}

function createKindSelect(item) {
  const select = createElement("select", "kd");
  select.setAttribute("aria-label", t("item.kind"));
  for (const kind of Object.keys(KIND_DEFINITIONS)) {
    const option = createElement("option", "", kindLabel(kind));
    option.value = kind;
    select.append(option);
  }
  select.value = item.kind;
  select.addEventListener("change", () => {
    item.kind = select.value;
    renderItems();
  });
  return select;
}

function createStartPageLabel(item, startPage) {
  const label = createElement("div", "pg", t("page.start", { n: startPage + 1 }));
  label.title = t("count.pages", { n: item.files.length });
  return label;
}

function createItemRow(item, index, startPage) {
  const row = createElement("div", "ch");
  row.append(
    createReorderControls(index),
    createFolderLabel(item),
    createTitleInput(item),
    createKindSelect(item),
    createStartPageLabel(item, startPage),
  );
  return row;
}

function describeSummary(list) {
  if (!list.length) return t("summary.empty");
  const chapters = list.filter(isChapter).length;
  const extras = list.length - chapters;
  const parts = [t("count.chapters", { n: chapters })];
  if (extras) parts.push(t("count.extras", { n: extras }));
  parts.push(t("count.pages", { n: countPages(list) }));
  return parts.join(" · ");
}

function renderItems() {
  const startPages = computeStartPages(items);
  const rows = items.map((item, index) => createItemRow(item, index, startPages[index]));
  if (rows.length) ui.list.replaceChildren(...rows);
  else ui.list.textContent = t("list.empty");
  ui.summary.textContent = describeSummary(items);
  renderFolderStatus();
}

function setExportEnabled(enabled) {
  ui.generateButton.disabled = !enabled;
  ui.xmlButton.disabled = !enabled;
  ui.addButton.disabled = !enabled;
}

function renderStatus() {
  ui.status.textContent = statusMessage ? t(statusMessage.key, statusMessage.params) : "";
}

function showStatus(key, params = {}) {
  statusMessage = { key, params };
  renderStatus();
}

function startProgress() {
  ui.progress.value = 0;
  ui.progress.classList.remove(HIDDEN_CLASS);
}

function moveItem(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  renderItems();
}

function numberChapters() {
  items.filter(isChapter).forEach((item) => { item.title = defaultName(item, items); });
  renderItems();
}

function clearTitles() {
  items.forEach((item) => { item.title = ""; });
  renderItems();
}

function fillSeriesFromFolder(imageFiles) {
  const folderName = rootFolderName(imageFiles);
  if (folderName && !ui.seriesInput.value) ui.seriesInput.value = folderName;
}

function describeSelection(list) {
  return `${t("count.items", { n: list.length })}, ${t("count.pages", { n: countPages(list) })}.`;
}

function renderFolderStatus() {
  if (items.length) ui.folderStatus.textContent = describeSelection(items);
  else ui.folderStatus.textContent = t(folderLoaded ? "folder.noImages" : "folder.hint");
}

function onFolderSelected(event) {
  const imageFiles = [...event.target.files].filter((file) => IMAGE_EXTENSION.test(file.name));
  folderLoaded = true;
  items = buildItems(imageFiles);
  fillSeriesFromFolder(imageFiles);
  renderItems();
  setExportEnabled(items.length > 0);
}

function downloadComicInfo() {
  const xml = buildComicInfoXml(readMetadata(), items);
  downloadBlob(new Blob([xml], { type: "application/xml" }), COMIC_INFO_FILE);
}

async function generateCbz() {
  ui.generateButton.disabled = true;
  startProgress();
  try {
    const zip = new JSZip();
    const pageCount = addPagesToZip(zip, items);
    zip.file(COMIC_INFO_FILE, buildComicInfoXml(readMetadata(), items));
    showStatus("status.packing");
    const blob = await zip.generateAsync(
      { type: "blob", compression: "STORE", streamFiles: true },
      (meta) => { ui.progress.value = meta.percent; },
    );
    downloadBlob(blob, `${archiveBaseName()}.cbz`);
    showStatus("status.done", {
      pages: t("count.pages", { n: pageCount }),
      size: (blob.size / BYTES_PER_MB).toFixed(1),
    });
  } catch (error) {
    showStatus("status.error", { message: error.message });
  } finally {
    ui.generateButton.disabled = false;
  }
}

function insertByKind(list, item) {
  const order = getDefinition(item).sortOrder;
  const index = list.findIndex((other) => getDefinition(other).sortOrder > order);
  list.splice(index < 0 ? list.length : index, 0, item);
}

function originOf(file) {
  const owner = items.find((item) => item.files.includes(file));
  return owner.sources?.get(file) ?? owner.folder;
}

function createManualItem() {
  const files = items.flatMap((item) => item.files).filter((file) => pickerSelection.has(file));
  const sources = new Map(files.map((file) => [file, originOf(file)]));
  items.forEach((item) => { item.files = item.files.filter((file) => !pickerSelection.has(file)); });
  items = items.filter((item) => item.files.length > 0);
  insertByKind(items, { folder: "", kind: ui.pickKind.value, title: ui.pickName.value.trim(), files, manual: true, sources });
}

function restoreItem(item) {
  items = items.filter((other) => other !== item);
  for (const [file, folder] of item.sources) {
    let owner = items.find((other) => !other.manual && other.folder === folder);
    if (!owner) {
      owner = createItem(folder, detectKind(folder), []);
      insertByKind(items, owner);
    }
    owner.files = sortedByFileName([...owner.files, file]);
  }
  renderItems();
}

function previewUrl(file) {
  const url = URL.createObjectURL(file);
  previewUrls.push(url);
  return url;
}

function releasePreviews() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function updatePickerState() {
  ui.pickOk.disabled = pickerSelection.size === 0;
  ui.pickCount.textContent = t("count.selectedPages", { n: pickerSelection.size });
}

function createPickerThumb(file) {
  const label = createElement("label", "pk-thumb");
  const checkbox = createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) pickerSelection.add(file);
    else pickerSelection.delete(file);
    updatePickerState();
  });
  const image = createElement("img");
  image.loading = "lazy";
  image.decoding = "async";
  image.alt = file.name;
  image.src = previewUrl(file);
  label.append(checkbox, image, createElement("span", "", file.name));
  return label;
}

function createPickerGroup(item) {
  const group = createElement("div", "pk-group");
  const grid = createElement("div", "pk-grid");
  grid.append(...item.files.map(createPickerThumb));
  group.append(createElement("div", "pk-title", `${folderLabel(item)} · ${t("count.pages", { n: item.files.length })}`), grid);
  return group;
}

function openPicker() {
  pickerSelection = new Set();
  ui.pickName.value = "";
  ui.pickPages.replaceChildren(...items.map(createPickerGroup));
  updatePickerState();
  ui.picker.showModal();
}

function confirmPicker() {
  createManualItem();
  ui.picker.close();
  renderItems();
}

function fillPickerKinds() {
  const selected = ui.pickKind.value;
  const options = PICKER_KINDS.map((kind) => {
    const option = createElement("option", "", kindLabel(kind));
    option.value = kind;
    return option;
  });
  ui.pickKind.replaceChildren(...options);
  if (selected) ui.pickKind.value = selected;
}

function syncLanguageField() {
  if (!languageFieldTouched) ui.languageField.value = currentLanguage.split("-")[0];
}

function refreshLanguage() {
  applyStaticTranslations();
  ui.languageCode.textContent = LANGUAGES[currentLanguage].code;
  syncLanguageField();
  fillPickerKinds();
  renderItems();
  renderStatus();
}

function toggleLanguage() {
  const language = nextLanguage();
  setLanguage(language);
  storeLanguage(language);
  refreshLanguage();
}

function bindEvents() {
  ui.folderInput.addEventListener("change", onFolderSelected);
  ui.numberButton.addEventListener("click", numberChapters);
  ui.clearButton.addEventListener("click", clearTitles);
  ui.xmlButton.addEventListener("click", downloadComicInfo);
  ui.generateButton.addEventListener("click", generateCbz);
  ui.addButton.addEventListener("click", openPicker);
  ui.pickOk.addEventListener("click", confirmPicker);
  ui.pickCancel.addEventListener("click", () => ui.picker.close());
  ui.picker.addEventListener("close", releasePreviews);
  ui.languageButton.addEventListener("click", toggleLanguage);
  ui.languageField.addEventListener("input", () => { languageFieldTouched = true; });
}

bindEvents();
setLanguage(detectLanguage());
refreshLanguage();
