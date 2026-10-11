(function (Tojiru) {
  const { ErrorCode } = Tojiru.domain;
  const { toAppError } = Tojiru.usecases;

  const knownCodes = new Set(Object.values(ErrorCode));

  function describeFailure(error) {
    const appError = toAppError(error);
    const code = knownCodes.has(appError.code) ? appError.code : ErrorCode.UNEXPECTED;
    return {
      key: `error.${code}`,
      params: appError.params,
      expected: code !== ErrorCode.UNEXPECTED,
      cause: appError.cause ?? appError,
    };
  }

  const describeNotices = (notices) =>
    notices.map((notice) => ({ key: `notice.${notice.code}`, params: notice.params ?? {} }));

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.feedback = { describeFailure, describeNotices };
})((window.Tojiru = window.Tojiru || {}));
