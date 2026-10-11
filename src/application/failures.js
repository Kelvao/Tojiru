(function (Tojiru) {
  const { AppError, ErrorCode } = Tojiru.domain;
  const ALLOCATION_FAILURE = /allocation|array length|string length|out of memory/i;
  const UNREADABLE_FILE_ERRORS = new Set(["NotReadableError", "NotFoundError"]);

  const isStorageFull = (error) => error?.name === "QuotaExceededError";
  const isUnreadableFile = (error) => UNREADABLE_FILE_ERRORS.has(error?.name);
  const isOutOfMemory = (error) => error?.name === "RangeError" && ALLOCATION_FAILURE.test(error.message);

  function toAppError(error) {
    if (error instanceof AppError) return error;
    const options = { cause: error };
    if (isStorageFull(error)) return new AppError(ErrorCode.STORAGE_FULL, {}, options);
    if (isUnreadableFile(error)) return new AppError(ErrorCode.FILE_UNREADABLE, {}, options);
    if (isOutOfMemory(error)) return new AppError(ErrorCode.OUT_OF_MEMORY, {}, options);
    return new AppError(ErrorCode.UNEXPECTED, { detail: String(error?.message ?? error) }, options);
  }

  const isThenable = (value) => typeof value?.then === "function";

  function withAppErrors(action) {
    return (...args) => {
      try {
        const result = action(...args);
        return isThenable(result) ? result.catch((error) => Promise.reject(toAppError(error))) : result;
      } catch (error) {
        throw toAppError(error);
      }
    };
  }

  Tojiru.usecases = { ...Tojiru.usecases, toAppError, withAppErrors };
})((window.Tojiru = window.Tojiru || {}));
