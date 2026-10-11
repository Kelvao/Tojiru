(function (Tojiru) {
  const ErrorCode = Object.freeze({
    INVALID_METADATA: "invalidMetadata",
    IMAGE_READ: "imageRead",
    ZIP_TOO_LARGE: "zipTooLarge",
    ZIP_TOO_MANY_PAGES: "zipTooManyPages",
    STORAGE_FULL: "storageFull",
    OUT_OF_MEMORY: "outOfMemory",
    FILE_UNREADABLE: "fileUnreadable",
    UNEXPECTED: "unexpected",
  });

  const NoticeCode = Object.freeze({ DISK_FALLBACK: "diskFallback" });

  class AppError extends Error {
    constructor(code, params = {}, { cause, message } = {}) {
      super(message ?? code, { cause });
      this.name = "AppError";
      this.code = code;
      this.params = params;
    }
  }

  class MetadataError extends AppError {
    constructor(problems) {
      super(ErrorCode.INVALID_METADATA, {}, { message: "Invalid metadata" });
      this.name = "MetadataError";
      this.problems = problems;
    }
  }

  class ImageReadError extends AppError {
    constructor(pageName, options = {}) {
      super(ErrorCode.IMAGE_READ, { name: pageName }, { ...options, message: `Could not read image ${pageName}` });
      this.name = "ImageReadError";
      this.pageName = pageName;
    }
  }

  Tojiru.domain = {
    ...Tojiru.domain,
    ErrorCode,
    NoticeCode,
    AppError,
    MetadataError,
    ImageReadError,
  };
})((window.Tojiru = window.Tojiru || {}));
