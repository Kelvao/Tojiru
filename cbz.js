const COMIC_INFO_FILE = "ComicInfo.xml";
const MIN_PAGE_NUMBER_WIDTH = 4;
const XML_HEADER = '<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n';

function xmlTag(name, value) {
  const isEmpty = value === "" || value === null || value === undefined;
  return isEmpty ? "" : `  <${name}>${escapeXml(value)}</${name}>\n`;
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

async function buildCbz(list, metadata, onProgress) {
  const zip = new JSZip();
  const pageCount = addPagesToZip(zip, list);
  zip.file(COMIC_INFO_FILE, buildComicInfoXml(metadata, list));
  onProgress({ stage: "packing", percent: 0 });
  const blob = await zip.generateAsync(
    { type: "blob", compression: "STORE", streamFiles: true },
    (meta) => onProgress({ stage: "packing", percent: meta.percent }),
  );
  return { blob, pageCount };
}
