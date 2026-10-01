const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "tojiru.language";

const LANGUAGES = {
  en: { code: "EN", name: "English" },
  "pt-BR": { code: "PT", name: "Português (Brasil)" },
};

const TRANSLATIONS = {
  en: {
    "app.title": "Tojiru 綴じる",
    "hero.description": "Packs a manga folder into a single CBZ file. Each subfolder becomes a chapter: you name each one and Tojiru builds the index in ComicInfo.xml, along with title, author and genres, in the standard read by comic readers.",
    "hero.privacy": "Everything runs in your browser. Your images never leave your computer.",
    "section.folder": "Manga folder",
    "section.details": "Details",
    "section.index": "Index",
    "folder.choose": "Choose folder",
    "folder.hint": "Select the root folder, with one subfolder per chapter.",
    "folder.noImages": "No images found.",
    "field.title": "Title",
    "field.author": "Author",
    "field.artist": "Artist",
    "field.genres": "Genres, comma-separated",
    "field.publisher": "Publisher",
    "field.year": "Year",
    "field.language": "Manga language",
    "field.volume": "Volume",
    "field.reading": "Reading",
    "field.summary": "Summary",
    "reading.rtl": "Manga, right to left",
    "reading.ltr": "Manga, left to right",
    "reading.none": "Not manga",
    "action.newItem": "New item",
    "action.numberChapters": "Number chapters",
    "action.clearNames": "Clear names",
    "action.downloadXml": "Download ComicInfo.xml",
    "action.generate": "Generate CBZ",
    "action.cancel": "Cancel",
    "action.create": "Create",
    "list.empty": "Index items appear here after you choose a folder.",
    "summary.empty": "No folder loaded",
    "picker.title": "New index item",
    "picker.name": "Name",
    "picker.namePlaceholder": "Optional",
    "picker.kind": "Type",
    "kind.chapter.label": "Chapter",
    "kind.chapter.name": "Chapter",
    "kind.cover.label": "Cover",
    "kind.cover.name": "Cover",
    "kind.toc.label": "Index",
    "kind.toc.name": "Index",
    "kind.extra.label": "Extra",
    "kind.extra.name": "Extra",
    "kind.back.label": "Back cover",
    "kind.back.name": "Back cover",
    "count.pages": { one: "{n} page", other: "{n} pages" },
    "count.items": { one: "{n} item", other: "{n} items" },
    "count.chapters": { one: "{n} chapter", other: "{n} chapters" },
    "count.extras": { one: "{n} extra", other: "{n} extras" },
    "count.selectedPages": { one: "{n} page selected", other: "{n} pages selected" },
    "page.start": "p. {n}",
    "item.from": "from {folders}",
    "item.undo": "Undo",
    "item.kind": "Type",
    "item.root": "(root)",
    "status.packing": "Packing...",
    "status.done": "Done: {pages}, {size} MB.",
    "status.error": "Error: {message}",
    "lang.change": "Change language",
  },
  "pt-BR": {
    "app.title": "Tojiru 綴じる",
    "hero.description": "Empacota uma pasta de mangá em um único arquivo CBZ. Cada subpasta vira um capítulo: você dá o nome de cada um e o Tojiru monta o índice no ComicInfo.xml, junto com título, autor e gêneros, no padrão lido por leitores de quadrinhos.",
    "hero.privacy": "Tudo roda no navegador. Suas imagens não saem do computador.",
    "section.folder": "Pasta do mangá",
    "section.details": "Informações",
    "section.index": "Índice",
    "folder.choose": "Escolher pasta",
    "folder.hint": "Selecione a pasta raiz, com uma subpasta por capítulo.",
    "folder.noImages": "Nenhuma imagem achada.",
    "field.title": "Título",
    "field.author": "Autor",
    "field.artist": "Artista",
    "field.genres": "Gêneros, separados por vírgula",
    "field.publisher": "Editora",
    "field.year": "Ano",
    "field.language": "Idioma do mangá",
    "field.volume": "Volume",
    "field.reading": "Leitura",
    "field.summary": "Sinopse",
    "reading.rtl": "Mangá, da direita para a esquerda",
    "reading.ltr": "Mangá, da esquerda para a direita",
    "reading.none": "Não é mangá",
    "action.newItem": "Novo item",
    "action.numberChapters": "Numerar capítulos",
    "action.clearNames": "Limpar nomes",
    "action.downloadXml": "Baixar ComicInfo.xml",
    "action.generate": "Gerar CBZ",
    "action.cancel": "Cancelar",
    "action.create": "Criar",
    "list.empty": "Os itens do índice aparecem aqui depois que você escolher a pasta.",
    "summary.empty": "Nenhuma pasta carregada",
    "picker.title": "Novo item no índice",
    "picker.name": "Nome",
    "picker.namePlaceholder": "Opcional",
    "picker.kind": "Tipo",
    "kind.chapter.label": "Capítulo",
    "kind.chapter.name": "Capítulo",
    "kind.cover.label": "Capa",
    "kind.cover.name": "Capa",
    "kind.toc.label": "Índice",
    "kind.toc.name": "Índice",
    "kind.extra.label": "Extra",
    "kind.extra.name": "Extra",
    "kind.back.label": "Contracapa",
    "kind.back.name": "Contracapa",
    "count.pages": { one: "{n} página", other: "{n} páginas" },
    "count.items": { one: "{n} item", other: "{n} itens" },
    "count.chapters": { one: "{n} capítulo", other: "{n} capítulos" },
    "count.extras": { one: "{n} extra", other: "{n} extras" },
    "count.selectedPages": { one: "{n} página selecionada", other: "{n} páginas selecionadas" },
    "page.start": "p. {n}",
    "item.from": "de {folders}",
    "item.undo": "Desfazer",
    "item.kind": "Tipo",
    "item.root": "(raiz)",
    "status.packing": "Empacotando...",
    "status.done": "Pronto: {pages}, {size} MB.",
    "status.error": "Erro: {message}",
    "lang.change": "Mudar idioma",
  },
};

let currentLanguage = DEFAULT_LANGUAGE;

const supportedLanguages = () => Object.keys(LANGUAGES);
const isSupportedLanguage = (language) => Object.hasOwn(LANGUAGES, language);

function matchSupportedLanguage(tag) {
  const wanted = tag.toLowerCase();
  const exact = supportedLanguages().find((language) => language.toLowerCase() === wanted);
  if (exact) return exact;
  const base = wanted.split("-")[0];
  return supportedLanguages().find((language) => language.toLowerCase().split("-")[0] === base);
}

function readStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    return;
  }
}

function detectLanguage() {
  const stored = readStoredLanguage();
  if (stored && isSupportedLanguage(stored)) return stored;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language || ""];
  for (const tag of preferred) {
    const match = matchSupportedLanguage(tag);
    if (match) return match;
  }
  return DEFAULT_LANGUAGE;
}

function setLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language;
}

function nextLanguage() {
  const all = supportedLanguages();
  return all[(all.indexOf(currentLanguage) + 1) % all.length];
}

function t(key, params = {}) {
  const entry = TRANSLATIONS[currentLanguage][key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;
  const template = typeof entry === "string"
    ? entry
    : entry[new Intl.PluralRules(currentLanguage).select(params.n)] ?? entry.other;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => params[name] ?? placeholder);
}

function applyStaticTranslations() {
  document.title = t("app.title");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    element.title = t(element.dataset.i18nAriaLabel);
  });
}
