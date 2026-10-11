(function (Tojiru) {
  const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
  const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]+/g;
  const DEFAULT_OUTPUT_NAME = "manga";

  const isImageName = (name) => IMAGE_EXTENSION.test(name);
  const extensionOf = (name) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

  function outputFileName(series, extension) {
    const baseName = (series || DEFAULT_OUTPUT_NAME).replace(FILE_NAME_FORBIDDEN_CHARS, "_");
    return `${baseName}.${extension}`;
  }

  Tojiru.domain = {
    ...Tojiru.domain,
    DEFAULT_OUTPUT_NAME,
    isImageName,
    extensionOf,
    outputFileName,
  };
})((window.Tojiru = window.Tojiru || {}));
