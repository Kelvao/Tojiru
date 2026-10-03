(function (Tojiru) {
  const escapeXml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.xml = { escapeXml };
})((window.Tojiru = window.Tojiru || {}));
