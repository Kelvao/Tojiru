const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

(function (Tojiru) {
  const escapeXml = (value) =>
    String(value)
      .replace(INVALID_XML_CHARS, '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.xml = { escapeXml };
})((window.Tojiru = window.Tojiru || {}));
