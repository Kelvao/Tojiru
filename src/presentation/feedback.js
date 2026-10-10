(function (Tojiru) {
  const D = Tojiru.domain;

  const knownCodes = new Set(Object.values(D.ErrorCode));

  function describeFailure(error) {
    const appError = D.toAppError(error);
    const code = knownCodes.has(appError.code) ? appError.code : D.ErrorCode.UNEXPECTED;
    return {
      key: `error.${code}`,
      params: appError.params,
      expected: code !== D.ErrorCode.UNEXPECTED,
      cause: appError.cause ?? appError,
    };
  }

  const describeNotices = (notices) =>
    notices.map((notice) => ({ key: `notice.${notice.code}`, params: notice.params ?? {} }));

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.feedback = { describeFailure, describeNotices };
})((window.Tojiru = window.Tojiru || {}));
