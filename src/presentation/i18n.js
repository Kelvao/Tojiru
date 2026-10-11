(function (Tojiru) {
  const DEFAULT_LANGUAGE = "en";

  const LANGUAGES = {
    en: { code: "EN", name: "English" },
    "pt-BR": { code: "PT", name: "Português (Brasil)" },
  };

  const TRANSLATIONS = Tojiru.i18n?.TRANSLATIONS || {};

  const matchSupportedLanguage = (tag, supported) => {
    const wanted = tag.toLowerCase();
    const exact = supported.find((language) => language.toLowerCase() === wanted);
    if (exact) return exact;
    const base = wanted.split("-")[0];
    return supported.find((language) => language.toLowerCase().split("-")[0] === base);
  };

  function detectLanguage({ stored, preferred, supported, fallback }) {
    if (stored && supported.includes(stored)) return stored;
    for (const tag of preferred) {
      const match = tag ? matchSupportedLanguage(tag, supported) : undefined;
      if (match) return match;
    }
    return fallback;
  }

  function resolveTemplate(entry, language, params) {
    const template =
      typeof entry === "string" ? entry : (entry[new Intl.PluralRules(language).select(params.n)] ?? entry.other);
    return template.replace(/\{(\w+)\}/g, (placeholder, name) => params[name] ?? placeholder);
  }

  function createTranslator({ translations, fallback, language }) {
    let current = language;
    return {
      get language() {
        return current;
      },
      setLanguage(next) {
        current = next;
      },
      t(key, params = {}) {
        const entry = translations[current]?.[key] ?? translations[fallback]?.[key] ?? key;
        return resolveTemplate(entry, current, params);
      },
    };
  }

  function nextLanguage(current, supported) {
    return supported[(supported.indexOf(current) + 1) % supported.length];
  }

  Tojiru.i18n = {
    ...Tojiru.i18n,
    DEFAULT_LANGUAGE,
    LANGUAGES,
    TRANSLATIONS,
    detectLanguage,
    createTranslator,
    nextLanguage,
  };
})((window.Tojiru = window.Tojiru || {}));
