(function (Tojiru) {
  const D = Tojiru.domain;
  const { escapeXml } = Tojiru.infra.xml;
  const COMIC_INFO_FILE = "ComicInfo.xml";
  const MIN_PAGE_NUMBER_WIDTH = 4;
  const FRONT_COVER_TYPE = "FrontCover";
  const STORE_ONLY = { compression: "STORE" };
  const XML_HEADER =
    '<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n';

  const PAGE_TYPES = {
    [D.Kind.COVER]: FRONT_COVER_TYPE,
    [D.Kind.CONTENTS]: "Other",
    [D.Kind.EXTRA]: "Other",
    [D.Kind.BACK_COVER]: "BackCover",
  };

  function xmlTag(name, value) {
    const isEmpty = value === "" || value === null || value === undefined;
    return isEmpty ? "" : `  <${name}>${escapeXml(value)}</${name}>\n`;
  }

  function buildPageEntry(entry) {
    const pageType = PAGE_TYPES[entry.kind] || (entry.startPage === 0 ? FRONT_COVER_TYPE : "");
    const typeAttribute = pageType ? ` Type="${pageType}"` : "";
    return `    <Page Image="${entry.startPage}"${typeAttribute} Bookmark="${escapeXml(entry.title)}" />\n`;
  }

  function buildComicInfoXml(output) {
    const { metadata } = output;
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
      ["PageCount", output.pages.length],
      ["Manga", metadata.readingMode],
    ];
    const body = fields.map(([name, value]) => xmlTag(name, value)).join("");
    const pages = output.entries.map(buildPageEntry).join("");
    return `${XML_HEADER}${body}  <Pages>\n${pages}  </Pages>\n</ComicInfo>\n`;
  }

  function pageFileName(index, width, page) {
    return `${String(index).padStart(width, "0")}.${D.extensionOf(page.name)}`;
  }

  function createCbzFormat({ getJsZip }) {
    async function write(output, onProgress) {
      const zip = new (getJsZip())();
      const width = Math.max(MIN_PAGE_NUMBER_WIDTH, String(output.pages.length).length);
      output.pages.forEach((page, index) => zip.file(pageFileName(index, width, page), page.source, STORE_ONLY));
      zip.file(COMIC_INFO_FILE, buildComicInfoXml(output));
      onProgress({ stage: "packing", percent: 0 });
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (meta) =>
        onProgress({ stage: "packing", percent: meta.percent }),
      );
      return { blob, pageCount: output.pages.length };
    }

    return {
      id: "cbz",
      label: "CBZ",
      extension: "cbz",
      sidecar: { fileName: COMIC_INFO_FILE, mediaType: "application/xml", build: buildComicInfoXml },
      write,
    };
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.cbz = { createCbzFormat, buildComicInfoXml };
})((window.Tojiru = window.Tojiru || {}));
