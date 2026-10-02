const BYTES_PER_MB = 1024 * 1024;
const HIDDEN_CLASS = "hide";

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
  formatButtons: document.querySelectorAll("[data-format]"),
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
const DEFAULT_OUTPUT_FORMAT = "cbz";
const OUTPUT_FORMATS = {
  cbz: { extension: "cbz", build: buildCbz },
  epub: { extension: "epub", build: buildEpub },
};

let items = [];
let outputFormat = DEFAULT_OUTPUT_FORMAT;

let folderLoaded = false;

let statusMessage = null;

let languageFieldTouched = false;

let pickerSelection = new Set();

let previewUrls = [];

const readText = (id) => byId(id).value.trim();

function displayFolder(name) {
  return name === LOOSE_FILES_FOLDER ? t("item.root") : name;
}

function folderLabel(item) {
  if (!item.manual) return displayFolder(item.folder);
  const folders = [...new Set(item.sources.values())].map(displayFolder).join(", ");
  return t("item.from", { folders });
}

function readMetadata() {
  const genreList = readText("genre").split(",").map((genre) => genre.trim()).filter(Boolean);
  return {
    series: readText("series"),
    volume: readText("volume"),
    summary: readText("summary"),
    year: readText("year"),
    writer: readText("writer"),
    penciller: readText("penciller"),
    publisher: readText("publisher"),
    genreList,
    genres: genreList.join(", "),
    language: readText("lang"),
    readingMode: byId("manga").value,
  };
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

function renderFormat() {
  ui.formatButtons.forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.format === outputFormat));
  });
  ui.xmlButton.hidden = outputFormat !== "cbz";
  ui.generateButton.textContent = t("action.generate", { format: outputFormat.toUpperCase() });
}

function setOutputFormat(format) {
  outputFormat = format;
  renderFormat();
}

function handleProgress({ stage, percent, current, total }) {
  ui.progress.value = percent;
  showStatus(stage === "reading" ? "status.reading" : "status.packing", { current, total });
}

async function generateOutput() {
  const { extension, build } = OUTPUT_FORMATS[outputFormat];
  const metadata = readMetadata();
  ui.generateButton.disabled = true;
  startProgress();
  try {
    const { blob, pageCount } = await build(items, metadata, handleProgress);
    downloadBlob(blob, `${outputBaseName(metadata.series)}.${extension}`);
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

function downloadComicInfo() {
  const xml = buildComicInfoXml(readMetadata(), items);
  downloadBlob(new Blob([xml], { type: "application/xml" }), COMIC_INFO_FILE);
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
  renderFormat();
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
  ui.generateButton.addEventListener("click", generateOutput);
  ui.formatButtons.forEach((button) => {
    button.addEventListener("click", () => setOutputFormat(button.dataset.format));
  });
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
