(function (Tojiru) {
  const ISO_639_1_CODES = `
    aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv
    dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie
    ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv
    mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm
    rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts
    tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu
  `
    .trim()
    .split(/\s+/);
  const UNDETERMINED_LANGUAGE = "und";
  const Kind = Object.freeze({
    CHAPTER: "chapter",
    COVER: "cover",
    BAND: "band",
    FRONT_FLAP: "frontFlap",
    ENDPAPER: "endpaper",
    FLYLEAF: "flyleaf",
    TITLE_PAGE: "titlePage",
    CONTENTS: "toc",
    EXTRA: "extra",
    BACK_FLAP: "backFlap",
    BACK_COVER: "back",
    SPINE: "spine",
  });

  const TitleSource = Object.freeze({ DEFAULT: "default", FOLDER: "folder", USER: "user" });

  const ReadingMode = Object.freeze({
    RIGHT_TO_LEFT: "YesAndRightToLeft",
    LEFT_TO_RIGHT: "Yes",
    NONE: "No",
  });

  const startsWithWord = (...words) => new RegExp(`^(?:${words.join("|")})(?![a-z])`);

  const KIND_DEFINITIONS = Object.freeze([
    { id: Kind.COVER, namePattern: startsWithWord("capas?", "covers?", "front(?:cover)?") },
    { id: Kind.BAND, namePattern: startsWithWord("cintas?", "obi", "belly ?bands?") },
    {
      id: Kind.FRONT_FLAP,
      namePattern: startsWithWord(
        "primeiras? orelhas?",
        "1[\u00aaa\u00b0o]? ?orelhas?",
        "orelha ?1(?!\\d)",
        "orelha ?frontal",
        "front ?flaps?",
      ),
    },
    { id: Kind.ENDPAPER, namePattern: startsWithWord("guardas?", "end ?papers?") },
    { id: Kind.FLYLEAF, namePattern: startsWithWord("folhas? de guardas?", "fly ?leaf", "fly ?leaves") },
    {
      id: Kind.TITLE_PAGE,
      namePattern: startsWithWord("folhas? de rostos?", "paginas? de titulos?", "title ?pages?"),
    },
    {
      id: Kind.CONTENTS,
      namePattern: startsWithWord("indices?", "index(?:es)?", "sumarios?", "toc", "contents"),
    },
    { id: Kind.CHAPTER, namePattern: null },
    {
      id: Kind.EXTRA,
      namePattern: startsWithWord(
        "extras?",
        "bonus",
        "omakes?",
        "especiais",
        "especial",
        "specials?",
        "posfacios?",
        "prefacios?",
      ),
    },
    {
      id: Kind.BACK_FLAP,
      namePattern: startsWithWord(
        "segundas? orelhas?",
        "2[\u00aaa\u00b0o]? ?orelhas?",
        "orelha ?2(?!\\d)",
        "orelha ?traseira",
        "back ?flaps?",
        "rear ?flaps?",
      ),
    },
    { id: Kind.BACK_COVER, namePattern: startsWithWord("contra ?capas?", "back(?:cover)?", "rear(?:cover)?") },
    { id: Kind.SPINE, namePattern: startsWithWord("lombadas?", "spines?") },
  ]);

  const KIND_ORDER = new Map(KIND_DEFINITIONS.map(({ id }, index) => [id, index]));
  const DEFAULT_MANUAL_KIND = Kind.CONTENTS;
  const ALL_KINDS = [Kind.CHAPTER, ...KIND_DEFINITIONS.map(({ id }) => id).filter((id) => id !== Kind.CHAPTER)];
  const MANUAL_KINDS = [
    DEFAULT_MANUAL_KIND,
    ...ALL_KINDS.filter((id) => id !== Kind.CHAPTER && id !== DEFAULT_MANUAL_KIND),
  ];

  const textOf = (value) => String(value ?? "").trim();
  const genreListOf = (value) =>
    textOf(value)
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);

  const METADATA_FIELDS = Object.freeze([
    { key: "series", required: true, normalize: textOf },
    { key: "volume", normalize: textOf },
    { key: "summary", normalize: textOf },
    { key: "year", normalize: textOf },
    { key: "writer", normalize: textOf },
    { key: "penciller", normalize: textOf },
    { key: "publisher", normalize: textOf },
    { key: "genres", normalize: (value) => genreListOf(value).join(", ") },
    {
      key: "language",
      normalize: (value) => textOf(value).toLowerCase(),
      isValid: (value) => !value || ISO_639_1_CODES.includes(value),
    },
    {
      key: "readingMode",
      initial: ReadingMode.RIGHT_TO_LEFT,
      normalize: (value) => value || ReadingMode.RIGHT_TO_LEFT,
    },
  ]);

  const METADATA_KEYS = Object.freeze(METADATA_FIELDS.map(({ key }) => key));
  const REQUIRED_FIELDS = Object.freeze(METADATA_FIELDS.filter(({ required }) => required).map(({ key }) => key));

  const kindOrderOf = (kind) => KIND_ORDER.get(kind);

  function normalizeName(fileName) {
    return fileName
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function detectKind(name) {
    const normalized = normalizeName(name);
    const best = KIND_DEFINITIONS.reduce(
      (current, { id, namePattern }) => {
        const length = namePattern?.exec(normalized)?.[0].length ?? 0;
        return length > current.length ? { id, length } : current;
      },
      { id: Kind.CHAPTER, length: 0 },
    );
    return best.id;
  }

  function createItem({
    folder,
    kind,
    pages,
    title = "",
    titleSource = TitleSource.DEFAULT,
    manual = false,
    origins = null,
  }) {
    return { folder, kind, title, titleSource, pages, manual, origins };
  }

  function createMetadata(raw = {}) {
    return Object.fromEntries(METADATA_FIELDS.map(({ key, initial = "" }) => [key, raw[key] ?? initial]));
  }

  function setMetadataField(metadata, key, value) {
    return METADATA_KEYS.includes(key) ? { ...metadata, [key]: value } : metadata;
  }

  const createManga = ({ metadata = createMetadata(), items = [] } = {}) => ({ metadata, items });

  function normalizeMetadata(raw) {
    const fields = Object.fromEntries(METADATA_FIELDS.map(({ key, normalize }) => [key, normalize(raw[key])]));
    return { ...fields, genreList: genreListOf(raw.genres) };
  }

  function validateMetadata(metadata) {
    return METADATA_FIELDS.flatMap(({ key, required, isValid }) => {
      if (required && !metadata[key]) return [{ field: key, rule: "required" }];
      if (isValid && !isValid(metadata[key])) return [{ field: key, rule: "invalid" }];
      return [];
    });
  }

  Tojiru.domain = {
    ...Tojiru.domain,
    ISO_639_1_CODES,
    UNDETERMINED_LANGUAGE,
    Kind,
    ReadingMode,
    TitleSource,
    ALL_KINDS,
    MANUAL_KINDS,
    METADATA_KEYS,
    REQUIRED_FIELDS,
    kindOrderOf,
    detectKind,
    createItem,
    createMetadata,
    setMetadataField,
    createManga,
    normalizeMetadata,
    validateMetadata,
  };
})((window.Tojiru = window.Tojiru || {}));
