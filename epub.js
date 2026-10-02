const EPUB_MEDIA_TYPE = "application/epub+zip";
const EPUB_CONTENT_DIR = "OEBPS";
const EPUB_READING_SHARE = 40;
const EPUB_NUMBER_WIDTH = 4;
const EPUB_RTL_READING_MODE = "YesAndRightToLeft";
const EPUB_FILE_OPTIONS = { createFolders: false };
const EPUB_STORED_OPTIONS = { createFolders: false, compression: "STORE" };
const CONVERTED_IMAGE = { extension: "png", mediaType: "image/png" };
const NATIVE_IMAGE_MEDIA_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

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

const fileExtension = (file) => file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
const padNumber = (number) => String(number).padStart(EPUB_NUMBER_WIDTH, "0");

async function createBitmapOrNull(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

async function decodeWithImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeImage(file) {
  const bitmap = typeof createImageBitmap === "function" ? await createBitmapOrNull(file) : null;
  return bitmap ?? decodeWithImageElement(file);
}

const sizeOf = (decoded) => ({
  width: decoded.naturalWidth ?? decoded.width,
  height: decoded.naturalHeight ?? decoded.height,
});

async function toPngBlob(decoded, { width, height }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(decoded, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, CONVERTED_IMAGE.mediaType));
}

async function prepareImage(file) {
  const decoded = await decodeImage(file);
  const size = sizeOf(decoded);
  const extension = fileExtension(file);
  const isNative = Object.hasOwn(NATIVE_IMAGE_MEDIA_TYPES, extension);
  const data = isNative ? file : await toPngBlob(decoded, size);
  decoded.close?.();
  return {
    data,
    extension: isNative ? extension : CONVERTED_IMAGE.extension,
    mediaType: isNative ? NATIVE_IMAGE_MEDIA_TYPES[extension] : CONVERTED_IMAGE.mediaType,
    ...size,
  };
}

async function prepareAllImages(files, onProgress) {
  const images = [];
  for (const [index, file] of files.entries()) {
    try {
      images.push(await prepareImage(file));
    } catch {
      throw new Error(t("status.imageError", { name: file.name }));
    }
    onProgress({
      stage: "reading",
      percent: ((index + 1) / files.length) * EPUB_READING_SHARE,
      current: index + 1,
      total: files.length,
    });
  }
  return images;
}

function generateUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createPages(list, images) {
  const owners = list.flatMap((item) => item.files.map(() => item));
  return images.map((image, index) => {
    const number = padNumber(index + 1);
    return {
      ...image,
      id: `page-${number}`,
      href: `text/page-${number}.xhtml`,
      imageId: `img-${number}`,
      imagePath: `images/${number}.${image.extension}`,
      title: displayName(owners[index], list),
    };
  });
}

function createEntries(list, pages) {
  const startPages = computeStartPages(list);
  return list.map((item, index) => ({
    title: displayName(item, list),
    href: pages[startPages[index]].href,
  }));
}

function findCoverPageIndex(list) {
  const coverItemIndex = list.findIndex((item) => item.kind === Kind.COVER);
  return coverItemIndex < 0 ? 0 : computeStartPages(list)[coverItemIndex];
}

function createLandmarks(list, entries, pages, coverIndex) {
  const landmarks = [{ type: "cover", href: pages[coverIndex].href, label: t("kind.cover.label") }];
  const firstChapterIndex = list.findIndex(isChapter);
  if (firstChapterIndex >= 0) {
    landmarks.push({ type: "bodymatter", href: entries[firstChapterIndex].href, label: t("epub.start") });
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

function buildNavXhtml(entries, landmarks, language) {
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
  <title>${escapeXml(t("kind.toc.label"))}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(t("kind.toc.label"))}</h1>
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
  const direction = metadata.readingMode === EPUB_RTL_READING_MODE ? "rtl" : "ltr";
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

async function buildEpub(list, metadata, onProgress) {
  const images = await prepareAllImages(list.flatMap((item) => item.files), onProgress);
  const pages = createPages(list, images);
  const entries = createEntries(list, pages);
  const coverIndex = findCoverPageIndex(list);
  const language = metadata.language || currentLanguage.split("-")[0];
  const title = metadata.series || DEFAULT_ARCHIVE_NAME;
  const identifier = `urn:uuid:${generateUuid()}`;

  const zip = new JSZip();
  const put = (path, content, options = EPUB_FILE_OPTIONS) => zip.file(`${EPUB_CONTENT_DIR}/${path}`, content, options);
  zip.file("mimetype", EPUB_MEDIA_TYPE, EPUB_STORED_OPTIONS);
  zip.file("META-INF/container.xml", EPUB_CONTAINER_XML, EPUB_FILE_OPTIONS);
  put("content.opf", buildPackageOpf({ metadata, language, identifier, title, pages, coverIndex }));
  put("nav.xhtml", buildNavXhtml(entries, createLandmarks(list, entries, pages, coverIndex), language));
  put("toc.ncx", buildNcx(entries, identifier, title));
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
