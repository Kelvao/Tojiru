(function (Tojiru) {
  const D = Tojiru.domain;
  const { escapeXml } = Tojiru.infra.xml;
  const EPUB_MEDIA_TYPE = "application/epub+zip";
  const EPUB_CONTENT_DIR = "OEBPS";
  const EPUB_READING_SHARE = 40;
  const EPUB_NUMBER_WIDTH = 4;
  const EPUB_FILE_OPTIONS = { createFolders: false };
  const EPUB_STORED_OPTIONS = { createFolders: false, compression: "STORE" };

  const EPUB_CONTAINER_XML = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${EPUB_CONTENT_DIR}/content.opf" media-type="application/oasis-oebps-package+xml"/>
  </rootfiles>
</container>
`;

  const EPUB_STYLESHEET = `html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

svg {
  display: block;
  width: 100%;
  height: 100%;
}
`;

  const padNumber = (number) => String(number).padStart(EPUB_NUMBER_WIDTH, "0");

  function createPages(output, images) {
    const titles = output.entries.flatMap((entry) => entry.pages.map(() => entry.title));
    return images.map((image, index) => {
      const number = padNumber(index + 1);
      return {
        ...image,
        id: `page-${number}`,
        href: `text/page-${number}.xhtml`,
        imageId: `img-${number}`,
        imagePath: `images/${number}.${image.extension}`,
        title: titles[index],
      };
    });
  }

  function createNavEntries(output, pages) {
    return output.entries.map((entry) => ({ title: entry.title, href: pages[entry.startPage].href }));
  }

  function findCoverPageIndex(output) {
    const cover = output.entries.find((entry) => entry.kind === D.Kind.COVER);
    return cover ? cover.startPage : 0;
  }

  function createLandmarks(output, navEntries, pages, coverIndex) {
    const landmarks = [{ type: "cover", href: pages[coverIndex].href, label: output.labels.cover }];
    const firstChapterIndex = output.entries.findIndex((entry) => entry.kind === D.Kind.CHAPTER);
    if (firstChapterIndex >= 0) {
      landmarks.push({ type: "bodymatter", href: navEntries[firstChapterIndex].href, label: output.labels.startOfStory });
    }
    return landmarks;
  }

  function buildPageXhtml(page, language) {
    const title = escapeXml(page.title);
    const lang = escapeXml(language);
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="viewport" content="width=${page.width}, height=${page.height}"/>
  <link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 ${page.width} ${page.height}" preserveAspectRatio="xMidYMid meet">
    <title>${title}</title>
    <image width="${page.width}" height="${page.height}" xlink:href="../${page.imagePath}"/>
  </svg>
</body>
</html>
`;
  }

  function buildNavXhtml({ entries, landmarks, contentsLabel, language }) {
    const lang = escapeXml(language);
    const tocItems = entries
      .map((entry) => `      <li><a href="${entry.href}">${escapeXml(entry.title)}</a></li>`)
      .join("\n");
    const landmarkItems = landmarks
      .map((mark) => `      <li><a epub:type="${mark.type}" href="${mark.href}">${escapeXml(mark.label)}</a></li>`)
      .join("\n");
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(contentsLabel)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(contentsLabel)}</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
  <nav epub:type="landmarks" id="landmarks" hidden="">
    <ol>
${landmarkItems}
    </ol>
  </nav>
</body>
</html>
`;
  }

  function buildNcx(entries, identifier, title) {
    const navPoints = entries
      .map((entry, index) => `    <navPoint id="nav-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(entry.title)}</text></navLabel>
      <content src="${entry.href}"/>
    </navPoint>`)
      .join("\n");
    return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`;
  }

  function dcTag(name, value) {
    return value ? `    <dc:${name}>${escapeXml(value)}</dc:${name}>\n` : "";
  }

  function buildCreatorTags({ writer, penciller }) {
    const creators = [["writer", writer, "aut"], ["artist", penciller, "art"]].filter(([, name]) => name);
    return creators
      .map(([id, name, role]) => `    <dc:creator id="creator-${id}">${escapeXml(name)}</dc:creator>
    <meta refines="#creator-${id}" property="role" scheme="marc:relators">${role}</meta>
`)
      .join("");
  }

  function buildSeriesTags({ series, volume }) {
    if (!series) return "";
    const position = volume
      ? `    <meta refines="#series-collection" property="group-position">${escapeXml(volume)}</meta>\n`
      : "";
    return `    <meta property="belongs-to-collection" id="series-collection">${escapeXml(series)}</meta>
    <meta refines="#series-collection" property="collection-type">series</meta>
${position}`;
  }

  function buildPackageOpf({ metadata, language, identifier, title, pages, coverIndex }) {
    const direction = metadata.readingMode === D.ReadingMode.RIGHT_TO_LEFT ? "rtl" : "ltr";
    const subjects = metadata.genreList.map((genre) => dcTag("subject", genre)).join("");
    const year = /^\d{4}$/.test(metadata.year) ? metadata.year : "";
    const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const pageItems = pages
      .map((page) => `    <item id="${page.id}" href="${page.href}" media-type="application/xhtml+xml" properties="svg"/>\n`)
      .join("");
    const imageItems = pages
      .map((page, index) => {
        const cover = index === coverIndex ? ' properties="cover-image"' : "";
        return `    <item id="${page.imageId}" href="${page.imagePath}" media-type="${page.mediaType}"${cover}/>\n`;
      })
      .join("");
    const spineItems = pages.map((page) => `    <itemref idref="${page.id}"/>\n`).join("");
    return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
${dcTag("title", title)}${dcTag("language", language)}${buildCreatorTags(metadata)}${dcTag("publisher", metadata.publisher)}${dcTag("date", year)}${subjects}${dcTag("description", metadata.summary)}${buildSeriesTags(metadata)}    <meta property="dcterms:modified">${modified}</meta>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:orientation">auto</meta>
    <meta property="rendition:spread">none</meta>
    <meta name="cover" content="${pages[coverIndex].imageId}"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
${pageItems}${imageItems}  </manifest>
  <spine toc="ncx" page-progression-direction="${direction}">
${spineItems}  </spine>
</package>
`;
  }

  function createEpubFormat({ getJsZip, imageDecoder, generateUuid }) {
    async function prepareAllImages(pages, onProgress) {
      const images = [];
      for (const [index, page] of pages.entries()) {
        images.push(await imageDecoder.prepare(page));
        onProgress({
          stage: "reading",
          percent: ((index + 1) / pages.length) * EPUB_READING_SHARE,
          current: index + 1,
          total: pages.length,
        });
      }
      return images;
    }

    async function write(output, onProgress) {
      const images = await prepareAllImages(output.pages, onProgress);
      const pages = createPages(output, images);
      const navEntries = createNavEntries(output, pages);
      const coverIndex = findCoverPageIndex(output);
      const { metadata, language } = output;
      const title = metadata.series || D.DEFAULT_OUTPUT_NAME;
      const identifier = `urn:uuid:${generateUuid()}`;

      const zip = new (getJsZip())();
      const put = (path, content, options = EPUB_FILE_OPTIONS) => zip.file(`${EPUB_CONTENT_DIR}/${path}`, content, options);
      zip.file("mimetype", EPUB_MEDIA_TYPE, EPUB_STORED_OPTIONS);
      zip.file("META-INF/container.xml", EPUB_CONTAINER_XML, EPUB_FILE_OPTIONS);
      put("content.opf", buildPackageOpf({ metadata, language, identifier, title, pages, coverIndex }));
      put("nav.xhtml", buildNavXhtml({
        entries: navEntries,
        landmarks: createLandmarks(output, navEntries, pages, coverIndex),
        contentsLabel: output.labels.contents,
        language,
      }));
      put("toc.ncx", buildNcx(navEntries, identifier, title));
      put("style.css", EPUB_STYLESHEET);
      pages.forEach((page) => {
        put(page.href, buildPageXhtml(page, language));
        put(page.imagePath, page.data, EPUB_STORED_OPTIONS);
      });

      const blob = await zip.generateAsync(
        { type: "blob", mimeType: EPUB_MEDIA_TYPE, compression: "DEFLATE" },
        (meta) => onProgress({
          stage: "packing",
          percent: EPUB_READING_SHARE + (meta.percent * (100 - EPUB_READING_SHARE)) / 100,
        }),
      );
      return { blob, pageCount: pages.length };
    }

    return { id: "epub", label: "EPUB", extension: "epub", sidecar: null, write };
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.epub = { createEpubFormat };
})((window.Tojiru = window.Tojiru || {}));
