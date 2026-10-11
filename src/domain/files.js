(function (Tojiru) {
  const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
  const FILE_NAME_FORBIDDEN_CHARS = /[\u0000-\u001f\u007f\\/:*?"<>|]+/g;
  const DEFAULT_OUTPUT_NAME = "manga";
  const MAX_FILE_NAME_LENGTH = 180;

  const isImageName = (name) => IMAGE_EXTENSION.test(name);
  const extensionOf = (name) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

  function outputFileName(series, extension) {
    const baseName = (series || DEFAULT_OUTPUT_NAME)
      .replace(FILE_NAME_FORBIDDEN_CHARS, "_")
      .slice(0, MAX_FILE_NAME_LENGTH);
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
