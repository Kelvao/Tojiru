# Tojiru 綴じる

[![Official Website](https://img.shields.io/badge/Official_Website-Tojiru%20綴-dc8add)](https://tojiru.pages.dev/)
[![Status](https://img.shields.io/uptimerobot/status/m803438082-8cc629151c0346a7bf46cecb?label=Status)](https://stats.uptimerobot.com/AhVkgcXoGz)
[![Uptime](https://img.shields.io/uptimerobot/ratio/m803438082-8cc629151c0346a7bf46cecb?label=Uptime)](https://stats.uptimerobot.com/AhVkgcXoGz)

🌐 Read in: English | [Português Brasileiro](README.pt-BR.md)

Organize manga images and generate a **CBZ** or **EPUB** with an index and metadata. Everything is processed in the browser; images are never uploaded to a server.

## Features

- Reads a manga folder and turns each subfolder into an index item (chapter, cover, extra, etc.).
- Generates a **CBZ** with `ComicInfo.xml` (index, author, genres, title) or a fixed-layout **EPUB 3**.
- Writes the file to disk while generating, instead of building it entirely in memory, when the browser allows it.
- Needs no build step, CDN or external service.
- Interface in English and Portuguese (Brazil).

## Getting started

1. Open `index.html` in a browser that supports folder selection (`webkitdirectory`).
2. Select the manga's root folder.
3. Review the index: edit titles, types and order (▲▼). Use **+ New item** to split pages off a chapter into a cover, index, extra or back cover item; **Undo** returns the pages to the original item.
4. Fill in the title, choose **CBZ** or **EPUB** and click **Generate**.

The title is required and also sets the file name. When you choose the folder, it is filled in with the root folder's name if empty. The other metadata fields are optional.

## How the folder is organized

- Each direct subfolder of the root becomes an item; deeper folders are grouped into it.
- Loose images in the root form the `(root)` item, except files recognized as a cover, index, extra or back cover.
- Pages are sorted by path in natural order (`2.jpg` before `10.jpg`), so subfolders inside a chapter stay together (`Part 2` before `Part 10`).
- Items come with their titles already filled in: chapters follow the "Chapter N" pattern, and the cover, index, extras and back cover get the name of their type.
- **Extract from folders** replaces chapter titles with the name of each subfolder; loose pages in the root have no subfolder and stay numbered. **Generate numbering** goes back to the "Chapter N" pattern. Both overwrite chapter titles and leave the cover, index, extras, back cover and items created with **+ New item** untouched. **Clear names** empties all titles; items without a title use their type name or "Chapter N" when generating.
- Detection recognizes Portuguese and English names, ignoring case and accents. You can change the type manually.
- Accepted extensions: `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif` and `bmp`.

## Metadata

| Field                    | Notes                                         |
| ------------------------ | --------------------------------------------- |
| Title                    | Required; also names the file                 |
| Author and artist        | Artist is optional and may differ from author |
| Genres                   | Separate with commas                          |
| Publisher, year, summary | Optional; the year has 4 digits               |
| Manga language           | A code such as `pt`, `en` or `ja`             |
| Volume                   | Number used to order the series               |
| Reading direction        | Default: right to left                        |

Empty fields are omitted from the generated metadata.

## Formats

| Format | Contents                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------- |
| CBZ    | Images in index order and `ComicInfo.xml`; images are stored without recompression              |
| EPUB   | Fixed-layout EPUB 3, with one XHTML/SVG page per image, a navigable index, a cover and metadata |

In CBZ mode you can also download only the `ComicInfo.xml`. It has one entry per index item; `Image` points to the item's first image.

In the EPUB, the SVG uses proportional scaling (`xMidYMid meet`) to avoid distortion and cropping inside the viewport. Alignment and final fit may vary between readers.

## Images

| Format               | Handling                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| JPEG, PNG, GIF, WebP | Included without conversion. In the EPUB, width and height are read from the file header, without decoding the image |
| AVIF and BMP         | Decoded in the browser and converted to PNG in the EPUB                                                              |

Details and limits:

- JPEGs with an EXIF orientation that swaps width and height (values 5 to 8) are decoded, so the dimensions match what the browser displays.
- Since the header is enough to measure an image, a JPEG, PNG, GIF or WebP with a valid header but corrupted content does not cause an error while building the EPUB. Empty files or files without a recognizable header fail with an error naming the page.
- Converting AVIF and BMP decodes the whole image and keeps the PNG in memory until packaging. The PNG is usually much larger than the original AVIF.
- In the CBZ there is no conversion: AVIF and BMP are included as they are, and the reader must know how to open them.

## Memory and temporary storage

When generating the file, Tojiru tries to write it piece by piece to the browser's private storage (OPFS, `tojiru-tmp` folder) and only then starts the download. This avoids building a large file entirely in memory.

- Before writing, the app checks that there is enough storage quota.
- If OPFS is unavailable, writing fails or the quota is insufficient, the app automatically falls back to assembling the file in memory with JSZip. In that case, very large folders may exceed the available memory.
- The temporary file is deleted when the app opens and before each new generation. It stays after the download so the browser can finish reading it.
- On the disk path, the generated file is limited to 4 GiB and 65,535 entries (classic ZIP format, no ZIP64). Above that, generation fails with an error.
- On the disk path, the EPUB also stores its XML files uncompressed; on the in-memory path they are compressed. The `mimetype` file is always first and uncompressed, as the specification requires.
- Two tabs generating at the same time may delete each other's temporary files.

EPUB generation measures all images before packaging and may take longer than CBZ, especially with AVIF and BMP.

Tojiru does not read or edit an existing `ComicInfo.xml`.

## Project structure

The code is split into layers, and the `tests/architecture.test.js` test prevents dependencies from pointing the wrong way.

| Layer          | Folder               | Responsibility                                                          |
| -------------- | -------------------- | ----------------------------------------------------------------------- |
| Domain         | `src/domain`         | Pure rules: items, sorting, type detection, metadata                    |
| Application    | `src/application`    | Use cases (load folder, generate file) with injected ports              |
| Infrastructure | `src/infrastructure` | CBZ and EPUB writers, streaming ZIP, image reading and conversion, OPFS |
| Presentation   | `src/presentation`   | Interface, controller and translations                                  |

`src/main.js` is the composition root: it wires the layers together and injects the browser adapters. Scripts are loaded in the order of `index.html`, without ES modules, so the project works when the file is opened directly.

## Running and testing

There is no build step. Open `index.html` directly or start a static server:

```sh
python3 -m http.server 8000
```

The tests use `node:test` and JSZip. ESLint and Prettier check the code:

```sh
npm install
npm run check
```

Use `npm run format` to format the JavaScript files. The GitHub Actions workflow runs tests, lint and the formatting check on every pull request and every push to `main` (Node 20). To run locally, Node 18 or newer is required.

JSZip and the Inter font are included in the project and loaded locally, with no CDN dependency. Characters outside Inter's coverage, such as Japanese, use the fonts available on the system.

## Contributing

Run `npm run check` before opening a pull request. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

The original code of this project is under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, modification and redistribution are allowed, as long as the license terms and the required attribution notice are kept. Third-party components remain subject to their own licenses.

## Privacy

Images are processed locally in the browser and never leave it. During generation, the file may be stored temporarily in the browser's private storage (OPFS) and is deleted on the next generation or when the app opens. The chosen language is saved in local storage. No font or library is loaded from an external service.
