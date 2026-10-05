(function (Tojiru) {
  const DEFAULT_LANGUAGE = "en";

  const LANGUAGES = {
    en: { code: "EN", name: "English" },
    "pt-BR": { code: "PT", name: "Português (Brasil)" },
  };

  const TRANSLATIONS = {
    en: {
      "app.title": "Tojiru 綴じる",
      "hero.description":
        "Packs a manga folder into a single CBZ or EPUB file. Each subfolder becomes a chapter: you name each one and Tojiru builds the index in ComicInfo.xml, along with title, author and genres, in the standard read by comic readers.",
      "hero.privacy": "Everything runs in your browser. Your images never leave your computer.",
      "section.folder": "Manga folder",
      "section.details": "Details",
      "section.index": "Index",
      "section.autoFill": "Auto-fill",
      "folder.choose": "Choose folder",
      "folder.hint": "Select the root folder, with one subfolder per chapter.",
      "folder.noImages": "No images found.",
      "field.title": "Title",
      "field.author": "Author",
      "field.artist": "Artist",
      "field.genres": "Genres",
      "field.publisher": "Publisher",
      "field.year": "Year",
      "field.language": "Manga language",
      "field.volume": "Volume",
      "field.reading": "Reading",
      "field.summary": "Summary",
      "field.required": "Required",
      "field.optional": "Optional",
      "hint.series": "Becomes the file name and the book title. Filled from the folder name.",
      "hint.writer": "Who writes the story.",
      "hint.penciller": "Who draws it, if different from the author.",
      "hint.genres": "Separate with commas. Each genre becomes a tag.",
      "hint.publisher": "Publisher of this edition.",
      "hint.year": "Publication year, 4 digits.",
      "hint.language": "Language code of the manga's text, such as pt, en or ja.",
      "hint.volume": "Volume number, used to order the series.",
      "hint.readingMode": "Sets the reading direction. Default: right to left.",
      "hint.summary": "Short text about the story.",
      "placeholder.series": "Ex.: One Piece",
      "placeholder.writer": "Ex.: Eiichiro Oda",
      "placeholder.penciller": "Ex.: Eiichiro Oda",
      "placeholder.genres": "Ex.: Action, Adventure",
      "placeholder.publisher": "Ex.: Shueisha",
      "placeholder.year": "Ex.: 1997",
      "placeholder.language": "Ex.: pt",
      "placeholder.volume": "Ex.: 1",
      "placeholder.summary": "Ex.: A young pirate sets out to find a treasure",
      "error.required": "Fill in this field.",
      "status.invalid": "Fill in the required fields.",
      "picker.nameHint": "If left empty, the default name for the type is used.",
      "reading.rtl": "Manga, right to left",
      "reading.ltr": "Manga, left to right",
      "reading.none": "Not manga",
      "action.newItem": "+ New item",
      "action.numberChapters": "Generate numbering",
      "action.clearNames": "Clear names",
      "action.extractFolders": "Extract from folders",
      "action.downloadSidecar": "Download {name}",
      "action.generate": "Generate {format}",
      "action.cancel": "Cancel",
      "action.create": "Create",
      "list.empty": "Index items appear here after you choose a folder.",
      "summary.empty": "No folder loaded",
      "picker.title": "New index item",
      "picker.name": "Name",
      "picker.namePlaceholder": "Ex.: Table of contents",
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
      "status.reading": "Reading images... {current}/{total}",
      "status.imageError": "Could not read image {name}",
      "format.label": "Output format",
      "epub.start": "Start of story",
      "status.done": { one: "Done: {n} page, {size} MB.", other: "Done: {n} pages, {size} MB." },
      "status.error": "Error: {message}",
      "lang.change": "Change language",
      "link.github": "View project on GitHub",
    },
    "pt-BR": {
      "app.title": "Tojiru 綴じる",
      "hero.description":
        "Empacota uma pasta de mangá em um único arquivo CBZ ou EPUB. Cada subpasta vira um capítulo: você dá o nome de cada um e o Tojiru monta o índice no ComicInfo.xml, junto com título, autor e gêneros, no padrão lido por leitores de quadrinhos.",
      "hero.privacy": "Tudo roda no navegador. Suas imagens não saem do computador.",
      "section.folder": "Pasta do mangá",
      "section.details": "Informações",
      "section.index": "Índice",
      "section.autoFill": "Preenchimento automático",
      "folder.choose": "Escolher pasta",
      "folder.hint": "Selecione a pasta raiz, com uma subpasta por capítulo.",
      "folder.noImages": "Nenhuma imagem achada.",
      "field.title": "Título",
      "field.author": "Autor",
      "field.artist": "Artista",
      "field.genres": "Gêneros",
      "field.publisher": "Editora",
      "field.year": "Ano",
      "field.language": "Idioma do mangá",
      "field.volume": "Volume",
      "field.reading": "Leitura",
      "field.summary": "Sinopse",
      "field.required": "Obrigatório",
      "field.optional": "Opcional",
      "hint.series": "Vira o nome do arquivo e o título do livro. Já vem do nome da pasta.",
      "hint.writer": "Quem escreve a história.",
      "hint.penciller": "Quem desenha, se for diferente do autor.",
      "hint.genres": "Separe por vírgula. Cada gênero vira uma etiqueta.",
      "hint.publisher": "Editora desta edição.",
      "hint.year": "Ano de publicação, com 4 dígitos.",
      "hint.language": "Código do idioma do texto do mangá, como pt, en ou ja.",
      "hint.volume": "Número do volume, usado na ordem da série.",
      "hint.readingMode": "Define a direção de leitura. Padrão: da direita para a esquerda.",
      "hint.summary": "Texto curto sobre a história.",
      "placeholder.series": "Ex.: One Piece",
      "placeholder.writer": "Ex.: Eiichiro Oda",
      "placeholder.penciller": "Ex.: Eiichiro Oda",
      "placeholder.genres": "Ex.: Ação, Aventura",
      "placeholder.publisher": "Ex.: Panini",
      "placeholder.year": "Ex.: 1997",
      "placeholder.language": "Ex.: pt",
      "placeholder.volume": "Ex.: 1",
      "placeholder.summary": "Ex.: Um jovem pirata parte em busca de um tesouro",
      "error.required": "Preencha este campo.",
      "status.invalid": "Preencha os campos obrigatórios.",
      "picker.nameHint": "Se ficar vazio, usa o nome padrão do tipo.",
      "reading.rtl": "Mangá, da direita para a esquerda",
      "reading.ltr": "Mangá, da esquerda para a direita",
      "reading.none": "Não é mangá",
      "action.newItem": "+ Novo item",
      "action.numberChapters": "Gerar numeração",
      "action.clearNames": "Limpar nomes",
      "action.extractFolders": "Extrair das pastas",
      "action.downloadSidecar": "Baixar {name}",
      "action.generate": "Gerar {format}",
      "action.cancel": "Cancelar",
      "action.create": "Criar",
      "list.empty": "Os itens do índice aparecem aqui depois que você escolher a pasta.",
      "summary.empty": "Nenhuma pasta carregada",
      "picker.title": "Novo item no índice",
      "picker.name": "Nome",
      "picker.namePlaceholder": "Ex.: Sumário",
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
      "status.reading": "Lendo imagens... {current}/{total}",
      "status.imageError": "Não foi possível ler a imagem {name}",
      "format.label": "Formato de saída",
      "epub.start": "Início da leitura",
      "status.done": { one: "Pronto: {n} página, {size} MB.", other: "Pronto: {n} páginas, {size} MB." },
      "status.error": "Erro: {message}",
      "lang.change": "Mudar idioma",
      "link.github": "Ver projeto no GitHub",
    },
  };

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
        const entry = translations[current]?.[key] ?? translations[fallback][key] ?? key;
        return resolveTemplate(entry, current, params);
      },
    };
  }

  function nextLanguage(current, supported) {
    return supported[(supported.indexOf(current) + 1) % supported.length];
  }

  Tojiru.i18n = {
    DEFAULT_LANGUAGE,
    LANGUAGES,
    TRANSLATIONS,
    detectLanguage,
    createTranslator,
    nextLanguage,
  };
})((window.Tojiru = window.Tojiru || {}));
