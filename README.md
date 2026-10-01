# Tojiru 綴じる

Aplicativo web que empacota uma pasta de mangá em um único arquivo **CBZ** e gera o **ComicInfo.xml** com metadados e um índice navegável por capítulos.

O nome vem do verbo japonês 綴じる (*tojiru*), "encadernar".

Tudo roda no navegador. As imagens são lidas localmente e nunca são enviadas a nenhum servidor.

## Recursos

- Lê uma pasta raiz em que cada subpasta é um capítulo.
- Permite dar nome a cada item do índice e reordenar com ▲▼.
- Reconhece capa, índice, extras e contracapa pelo nome da pasta ou do arquivo.
- Permite criar itens manualmente escolhendo páginas, inclusive as que estão dentro da pasta de um capítulo.
- Gera o `ComicInfo.xml` com título, autor, artista, gêneros, editora, ano, idioma, volume, sinopse, direção de leitura e índice.
- Gera o `.cbz` sem recompressão, ou baixa apenas o `ComicInfo.xml`.
- Interface escura inspirada no GNOME/libadwaita, responsiva para desktop e celular.
- Disponível em inglês e português (Brasil), com troca automática pelo idioma do navegador e botão para alternar.

## Como usar

1. Abra `index.html` no navegador.
2. Em **Pasta do mangá**, escolha a pasta raiz.
3. Em **Informações**, preencha título, autor, gêneros e demais campos.
4. Em **Índice**, revise os itens detectados:
   - digite o nome de cada capítulo, ou use **Numerar capítulos**;
   - ajuste o **Tipo** de cada item (Capítulo, Capa, Índice, Extra, Contracapa);
   - reordene com ▲ e ▼.
5. Se a capa ou o índice estiverem dentro da pasta de um capítulo, use **Novo item** (veja abaixo).
6. Clique em **Gerar CBZ**. O download começa quando o empacotamento termina.

## Estrutura de pastas esperada

```
Meu Mangá/
├── capa.jpg
├── Capítulo 01/
│   ├── 001.jpg
│   ├── 002.jpg
│   └── ...
├── Capítulo 02/
│   └── ...
└── extras/
    └── 001.jpg
```

- Cada subpasta direta da raiz vira um item. Subpastas mais profundas são agrupadas dentro do item da pasta de primeiro nível.
- As imagens são ordenadas por nome em ordem natural (`2.jpg` vem antes de `10.jpg`).
- Imagens soltas na raiz cujo nome indica um tipo especial (por exemplo `capa.jpg`) viram itens próprios. As demais são agrupadas em um único item chamado `(raiz)`.
- Extensões aceitas: `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif`, `bmp`.

## Tipos de item

| Tipo | Detectado quando o nome começa com | `Type` no XML |
| --- | --- | --- |
| Capítulo | qualquer outro nome | nenhum |
| Capa | `capa`, `cover`, `front` | `FrontCover` |
| Índice | `indice`, `index`, `sumario`, `toc`, `contents` | `Other` |
| Extra | `extra`, `bonus`, `omake`, `especial`, `special`, `posfacio`, `prefacio` | `Other` |
| Contracapa | `contracapa`, `contra capa`, `back`, `rear` | `BackCover` |

A comparação ignora maiúsculas, acentos e a extensão do arquivo.

A ordem inicial é: Capa, Índice, Capítulos, Extras, Contracapa. Dentro de cada grupo, a ordem é pelo nome. O tipo detectado pode ser trocado manualmente em cada linha.

## Criando itens manualmente

É comum o índice ou a capa virem dentro da pasta do capítulo 1. Para separá-los:

1. Clique em **Novo item**.
2. Escolha o **Tipo** (Índice, Capa, Extra ou Contracapa) e, se quiser, um **Nome**.
3. Marque as páginas que fazem parte do item. As miniaturas são agrupadas pela pasta de origem.
4. Clique em **Criar**.

As páginas marcadas saem do item de origem e passam a formar o novo item, que é inserido de acordo com o tipo. Itens criados dessa forma mostram a origem (por exemplo "de Capítulo 01") e o botão **Desfazer**, que devolve as páginas à pasta original. Um item que fica sem páginas é removido.

Se você marcar uma página do meio de um capítulo, ela sai do capítulo e o restante continua como um único item. O capítulo não é dividido em dois.

## Idiomas

A interface está disponível em **English** e **Português (Brasil)**.

- Na primeira visita, o idioma é escolhido pela lista de idiomas do navegador (`navigator.languages`). Qualquer variante de português (`pt-PT`, por exemplo) usa Português (Brasil). Idiomas não suportados usam inglês.
- O botão com globo no canto direito da barra superior alterna entre os idiomas. A escolha é guardada no `localStorage` do navegador e passa a ter prioridade sobre a detecção automática.
- O campo **Idioma do mangá** (`LanguageISO`) começa com o código do idioma da interface (`pt` ou `en`) e deixa de acompanhar a troca assim que você edita o campo.
- Os nomes padrão do índice (`Capa`/`Cover`, `Capítulo N`/`Chapter N` etc.) seguem o idioma da interface no momento em que o arquivo é gerado. Nomes digitados por você não são alterados.
- A detecção de capa, índice, extras e contracapa pelo nome de pastas e arquivos reconhece termos em português e inglês, independentemente do idioma da interface.

### Adicionando um idioma

1. Em `i18n.js`, inclua o idioma em `LANGUAGES` (`code` curto para o botão e `name`).
2. Copie o bloco `en` dentro de `TRANSLATIONS` para a nova chave e traduza os valores. As chaves não mudam.
3. Entradas com forma plural usam as categorias de `Intl.PluralRules` do idioma (`one`, `other` e, quando existir, `few`, `many`...). A categoria `other` é obrigatória.

Chaves ausentes em um idioma caem para o inglês. Textos estáticos do HTML usam `data-i18n` (texto), `data-i18n-placeholder` e `data-i18n-aria-label`. Textos montados em JavaScript usam `t(chave, parâmetros)`, com marcadores `{nome}`.

## Formato do ComicInfo.xml

O índice usa uma entrada `<Page>` por item, e não por imagem. `Image` é a posição da primeira página do item no CBZ, começando em 0. O valor do item seguinte é o valor do anterior somado à quantidade de páginas do anterior.

Exemplo com capa (1 página), índice (2), dois capítulos (20 e 15 páginas) e contracapa (1):

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>Meu Mangá</Title>
  <Series>Meu Mangá</Series>
  <Year>2020</Year>
  <Writer>Autor</Writer>
  <Genre>Ação, Aventura</Genre>
  <LanguageISO>pt</LanguageISO>
  <PageCount>39</PageCount>
  <Manga>YesAndRightToLeft</Manga>
  <Pages>
    <Page Image="0" Type="FrontCover" Bookmark="Capa" />
    <Page Image="1" Type="Other" Bookmark="Índice" />
    <Page Image="3" Bookmark="Capítulo 1" />
    <Page Image="23" Bookmark="Capítulo 2" />
    <Page Image="38" Type="BackCover" Bookmark="Contracapa" />
  </Pages>
</ComicInfo>
```

Regras:

- `Bookmark` é o nome digitado. Se estiver vazio, usa o nome padrão: "Capa", "Índice", "Extra", "Contracapa" ou "Capítulo N". `N` conta apenas os itens do tipo Capítulo.
- Se a primeira página do arquivo não tiver tipo definido, ela recebe `Type="FrontCover"`.
- Campos vazios são omitidos. `Title` e `Series` recebem o mesmo valor do campo **Título**.
- `Manga` aceita `YesAndRightToLeft`, `Yes` e `No`.
- Valores são escapados (`&`, `<`, `>`, `"`).

O formato segue o esquema ComicInfo (Anansi Project). O suporte a `Pages` e `Bookmark` varia entre leitores e gerenciadores de biblioteca.

## Formato do CBZ

- O `.cbz` é um ZIP com as páginas e o `ComicInfo.xml` na raiz.
- As páginas são renomeadas em sequência (`0000.jpg`, `0001.png`, ...), com largura mínima de 4 dígitos, para que a ordem não dependa dos nomes originais.
- Os arquivos são armazenados sem compressão (`STORE`), já que as imagens costumam estar comprimidas.
- O nome do arquivo vem do campo **Título**, com caracteres inválidos trocados por `_`. Sem título, usa `manga.cbz`.

## Executando

Não há build nem dependências para instalar. Abra `index.html` diretamente ou sirva a pasta com qualquer servidor estático:

```
python3 -m http.server 8000
```

### Requisitos

- Navegador moderno com suporte a seleção de pastas (`webkitdirectory`): Chrome, Edge, Firefox e Safari recentes.
- Acesso à internet para carregar a biblioteca [JSZip](https://stuk.github.io/jszip/) (CDN cdnjs) e a fonte Inter (Google Fonts). Sem a fonte, a interface usa a fonte do sistema.

Para usar offline, baixe o `jszip.min.js` para `vendor/` e troque o `src` da tag `<script>` correspondente em `index.html`.

## Estrutura do projeto

```
tojiru/
├── index.html   Estrutura da página e do diálogo "Novo item"
├── style.css    Tema escuro estilo libadwaita, componentes e responsividade
├── i18n.js      Traduções, detecção de idioma e função t()
├── app.js       Lógica da aplicação
└── README.md
```

Todos os arquivos ficam na mesma pasta e se referenciam por nome (`href="style.css"`, `src="app.js"`). Basta manter os quatro arquivos juntos, sem subpastas.

### Organização do `i18n.js`

| Bloco | Funções principais |
| --- | --- |
| Dados | `LANGUAGES`, `TRANSLATIONS` |
| Detecção | `detectLanguage`, `matchSupportedLanguage`, `readStoredLanguage`, `storeLanguage` |
| Estado | `setLanguage`, `nextLanguage` |
| Tradução | `t`, `applyStaticTranslations` |

### Organização do `app.js`

Os scripts são arquivos clássicos (sem módulos ES), para funcionar também ao abrir `index.html` direto do disco. `i18n.js` precisa ser carregado antes de `app.js`.

| Bloco | Funções principais |
| --- | --- |
| Constantes e tipos | `Kind`, `KIND_DEFINITIONS`, mensagens e padrões |
| Modelo | `createItem`, `compareItems`, `buildItems`, `detectKind`, `defaultName`, `displayName` |
| ComicInfo | `readMetadata`, `buildComicInfoXml`, `buildPageEntries`, `escapeXml` |
| CBZ | `addPagesToZip`, `pageFileName`, `archiveBaseName`, `downloadBlob` |
| Renderização | `renderItems`, `createItemRow`, `createKindSelect`, `describeSummary` |
| Novo item | `openPicker`, `createManualItem`, `restoreItem`, `insertByKind` |
| Idioma | `refreshLanguage`, `toggleLanguage`, `folderLabel`, `renderStatus` |
| Ações e eventos | `onFolderSelected`, `generateCbz`, `numberChapters`, `bindEvents` |

Um item da lista é um objeto com esta forma:

```js
{
  folder: "Capítulo 01",
  kind: "chapter",
  title: "",
  files: [File, File],
  manual: true,
  sources: Map
}
```

`manual` e `sources` existem apenas em itens criados por **Novo item**. `sources` guarda a pasta de origem de cada arquivo, usada por **Desfazer**.

### Convenções

- Funções pequenas com uma única responsabilidade. Lógica pura (modelo, XML) separada de DOM e de ações.
- Constantes nomeadas no lugar de valores literais.
- Referências ao DOM concentradas no objeto `ui`.
- Sem comentários no código; os nomes devem explicar a intenção.

### Adicionando um novo tipo de item

1. Inclua o valor em `Kind`.
2. Inclua a definição em `KIND_DEFINITIONS` (`pageType`, `sortOrder`, `namePattern`).
3. Inclua `kind.<valor>.label` e `kind.<valor>.name` em todos os idiomas de `TRANSLATIONS`.
4. Se o tipo puder ser escolhido em **Novo item**, inclua-o em `PICKER_KINDS`.

A lista de opções do seletor, a ordenação, a detecção por nome e o XML passam a usar a nova definição automaticamente.

## Limitações

- O CBZ é montado em memória. Pastas muito grandes (na casa de alguns GB) podem esgotar a memória do navegador.
- A marcação de tipos é por item. Não é possível dividir um capítulo em dois itens de capítulo.
- O Tojiru não lê nem edita um `ComicInfo.xml` já existente.

## Privacidade

Os arquivos são processados apenas no navegador. A única requisição externa feita pela página é o carregamento da biblioteca JSZip e da fonte. O idioma escolhido é a única informação guardada no navegador.
