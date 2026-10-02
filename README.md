# Tojiru 綴じる

Aplicativo web que empacota uma pasta de mangá em um único arquivo **CBZ** (com **ComicInfo.xml**) ou **EPUB**, ambos com metadados e um índice navegável por capítulos.

O nome vem do verbo japonês 綴じる (*tojiru*), "encadernar".

Código-fonte: <https://github.com/Kelvao/Tojiru>

Tudo roda no navegador. As imagens são lidas localmente e nunca são enviadas a nenhum servidor.

## Recursos

- Lê uma pasta raiz em que cada subpasta é um capítulo.
- Permite dar nome a cada item do índice e reordenar com ▲▼.
- Reconhece capa, índice, extras e contracapa pelo nome da pasta ou do arquivo.
- Permite criar itens manualmente escolhendo páginas, inclusive as que estão dentro da pasta de um capítulo.
- Gera o `ComicInfo.xml` com título, autor, artista, gêneros, editora, ano, idioma, volume, sinopse, direção de leitura e índice.
- Gera o `.cbz` sem recompressão, ou baixa apenas o `ComicInfo.xml`.
- Gera um `.epub` (EPUB 3, layout fixo) com cada imagem centralizada, sem distorcer nem cortar, e com o mesmo índice, capa e metadados.
- Escolha do formato de saída por um seletor **CBZ | EPUB** na barra de ações.
- Interface escura inspirada no GNOME/libadwaita, responsiva para celular, desktop e monitores ultrawide.
- Disponível em inglês e português (Brasil), com troca automática pelo idioma do navegador e botão para alternar.

## Layout em telas largas

O layout se adapta à largura da janela:

| Largura | Layout |
| --- | --- |
| até 1099 px | Uma coluna, com as seções empilhadas |
| 1100 px ou mais | Painel lateral fixo (pasta e informações) à esquerda e o índice à direita, com a barra de ações embaixo do índice |
| 1700 px ou mais | O painel lateral se divide em duas colunas (pasta e informações), e o índice fica na terceira |

O conteúdo é centralizado e limitado a 2200 px de largura (3200 px a partir de 3000 px), para não ficar esticado de ponta a ponta em monitores ultrawide. O botão de idioma acompanha esse limite.

O painel lateral acompanha a rolagem, então as informações continuam visíveis enquanto você percorre uma lista longa de capítulos. Se o painel for mais alto que a janela, ele rola por conta própria.

A lista do índice usa container queries: conforme a largura disponível, ela se divide em 2 colunas (a partir de 1000 px), 3 colunas (1500 px) e 4 colunas (2000 px). As colunas são preenchidas de cima para baixo, na ordem do índice. O diálogo **Novo item** também cresce e mostra mais miniaturas por linha.

## Como usar

1. Abra `index.html` no navegador.
2. Em **Pasta do mangá**, escolha a pasta raiz.
3. Em **Informações**, preencha título, autor, gêneros e demais campos.
4. Em **Índice**, revise os itens detectados:
   - digite o nome de cada capítulo, ou use **Numerar capítulos**;
   - ajuste o **Tipo** de cada item (Capítulo, Capa, Índice, Extra, Contracapa);
   - reordene com ▲ e ▼.
5. Se a capa ou o índice estiverem dentro da pasta de um capítulo, use **Novo item** (veja abaixo).
6. Na barra inferior, escolha o formato (**CBZ** ou **EPUB**) e clique em **Gerar**. O download começa quando o empacotamento termina. Com EPUB selecionado, o botão do `ComicInfo.xml` é ocultado, já que o EPUB leva seus metadados no próprio arquivo.

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
- Os nomes padrão do índice (`Capa`/`Cover`, `Capítulo N`/`Chapter N` etc.) seguem o idioma da interface no momento em que o arquivo é gerado, tanto no CBZ quanto no EPUB. Nomes digitados por você não são alterados.
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

## Formato do EPUB

O EPUB é gerado a partir da mesma lista do índice, na mesma ordem de páginas do CBZ.

### Imagem centralizada, sem distorcer nem cortar

O arquivo é um EPUB 3 de **layout fixo** (`rendition:layout = pre-paginated`). Cada página é um XHTML com a imagem dentro de um `<svg>`:

```xml
<meta name="viewport" content="width=900, height=1300"/>
<svg width="100%" height="100%" viewBox="0 0 900 1300" preserveAspectRatio="xMidYMid meet">
  <image width="900" height="1300" xlink:href="../images/0002.jpg"/>
</svg>
```

- `viewBox` com as dimensões reais da imagem e `preserveAspectRatio="xMidYMid meet"` fazem o leitor escalar a página inteira para caber na tela, mantendo a proporção e centralizando na horizontal e na vertical. Sobram faixas vazias nos lados ou em cima e embaixo quando a proporção da tela é diferente, e nada é cortado.
- A largura e a altura são lidas de cada imagem ao gerar o arquivo, então páginas de tamanhos diferentes (por exemplo páginas duplas) funcionam no mesmo EPUB.
- Em testes com Chromium, páginas retrato, paisagem e muito altas, em janelas de proporções diferentes, mantiveram a proporção original com folgas iguais nos dois lados.

### Conteúdo do arquivo

```
mimetype                    sem compressão, primeiro item do ZIP
META-INF/container.xml
OEBPS/content.opf           metadados, manifesto e ordem de leitura
OEBPS/nav.xhtml             índice (EPUB 3) e landmarks
OEBPS/toc.ncx               índice (compatibilidade com EPUB 2)
OEBPS/style.css
OEBPS/text/page-0001.xhtml  uma página por imagem
OEBPS/images/0001.jpg
```

### Mapeamento dos campos

| Campo no Tojiru | No EPUB |
| --- | --- |
| Título | `dc:title` e coleção de série (`belongs-to-collection`) |
| Volume | posição na coleção (`group-position`) |
| Autor / Artista | `dc:creator` com papel `aut` / `art` |
| Gêneros | um `dc:subject` por gênero |
| Editora, Ano, Sinopse | `dc:publisher`, `dc:date`, `dc:description` |
| Idioma do mangá | `dc:language` |
| Leitura | `page-progression-direction`: `rtl` para "da direita para a esquerda", `ltr` nos demais |
| Itens do índice | entradas do `nav.xhtml` e do `toc.ncx`, apontando para a primeira página de cada item |
| Capa | a primeira página do item do tipo Capa, ou a primeira página do livro se não houver capa, marcada como `cover-image` |

Os landmarks incluem a capa e o início da leitura (primeiro item do tipo Capítulo). Um identificador `urn:uuid:` novo é gerado a cada arquivo.

### Imagens

JPEG, PNG, GIF e WebP entram sem alteração. BMP e AVIF não são formatos padrão do EPUB e são convertidos para PNG no navegador. Para ler as dimensões, cada imagem é decodificada uma vez, o que torna a geração do EPUB mais lenta que a do CBZ em pastas grandes. A barra de progresso mostra a leitura das imagens e, em seguida, o empacotamento.

### Compatibilidade

A estrutura gerada foi conferida (XML bem formado, manifesto, ordem de leitura e links do índice consistentes, dimensões do `viewBox` iguais às das imagens), mas o arquivo não foi validado com o EPUBCheck. O layout fixo exige leitores com suporte a EPUB 3 de layout fixo. Leitores que tratam todo EPUB como texto reflowable podem ignorar o `viewport` e exibir as páginas de outra forma.

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
├── model.js     Itens do índice, tipos, detecção por nome e utilitários comuns
├── cbz.js       Geração do CBZ e do ComicInfo.xml
├── epub.js      Geração do EPUB
├── app.js       Interface, estado e ações
└── README.md
```

Todos os arquivos ficam na mesma pasta e se referenciam por nome (`href="style.css"`, `src="app.js"`). Basta manter os arquivos juntos, sem subpastas.

Os scripts são arquivos clássicos (sem módulos ES), para funcionar também ao abrir `index.html` direto do disco. Eles compartilham o escopo global e precisam ser carregados nesta ordem: JSZip, `i18n.js`, `model.js`, `cbz.js`, `epub.js` e `app.js`.

### Organização do `i18n.js`

| Bloco | Funções principais |
| --- | --- |
| Dados | `LANGUAGES`, `TRANSLATIONS` |
| Detecção | `detectLanguage`, `matchSupportedLanguage`, `readStoredLanguage`, `storeLanguage` |
| Estado | `setLanguage`, `nextLanguage` |
| Tradução | `t`, `applyStaticTranslations` |

### Organização do `model.js`

Não depende do DOM, exceto por `t()` para nomes de tipos. É usado por `cbz.js`, `epub.js` e `app.js`.

| Bloco | Funções principais |
| --- | --- |
| Tipos | `Kind`, `KIND_DEFINITIONS`, `getDefinition`, `isChapter` |
| Itens | `createItem`, `compareItems`, `buildItems`, `splitByFolder`, `detectKind` |
| Nomes | `defaultName`, `displayName`, `kindLabel`, `outputBaseName` |
| Páginas | `countPages`, `computeStartPages` |
| Utilitários | `escapeXml`, `STORE_ONLY` |

### Organização do `cbz.js`

| Bloco | Funções principais |
| --- | --- |
| ComicInfo | `buildComicInfoXml`, `buildPageEntries`, `buildPageEntry`, `xmlTag` |
| ZIP | `addPagesToZip`, `pageFileName` |
| Saída | `buildCbz` |

### Organização do `epub.js`

| Bloco | Funções principais |
| --- | --- |
| Imagens | `decodeImage`, `prepareImage`, `prepareAllImages`, `toPngBlob` |
| Estrutura | `createPages`, `createEntries`, `createLandmarks`, `findCoverPageIndex` |
| Documentos | `buildPageXhtml`, `buildNavXhtml`, `buildNcx`, `buildPackageOpf` |
| Saída | `buildEpub` |

### Organização do `app.js`

| Bloco | Funções principais |
| --- | --- |
| Estado e DOM | `ui`, `items`, `outputFormat`, `readMetadata` |
| Renderização | `renderItems`, `createItemRow`, `createKindSelect`, `describeSummary` |
| Novo item | `openPicker`, `createManualItem`, `restoreItem`, `insertByKind` |
| Formato e geração | `OUTPUT_FORMATS`, `renderFormat`, `setOutputFormat`, `generateOutput`, `handleProgress` |
| Idioma | `refreshLanguage`, `toggleLanguage`, `folderLabel`, `renderStatus` |
| Ações e eventos | `onFolderSelected`, `numberChapters`, `downloadBlob`, `bindEvents` |

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

### Adicionando um formato de saída

1. Crie um arquivo com uma função `async buildX(list, metadata, onProgress)` que devolva `{ blob, pageCount }`. `list` é a lista de itens, `metadata` vem de `readMetadata()` e `onProgress` recebe `{ stage, percent, current, total }`, com `stage` igual a `"reading"` ou `"packing"`.
2. Carregue o arquivo em `index.html`, antes de `app.js`, e inclua-o na lista de verificação do aviso de carregamento.
3. Registre o formato em `OUTPUT_FORMATS`, em `app.js`, com `extension` e `build`.
4. Inclua um botão com `data-format` no seletor de formato.

### Adicionando um novo tipo de item

1. Inclua o valor em `Kind`.
2. Inclua a definição em `KIND_DEFINITIONS` (`pageType`, `sortOrder`, `namePattern`).
3. Inclua `kind.<valor>.label` e `kind.<valor>.name` em todos os idiomas de `TRANSLATIONS`.
4. Se o tipo puder ser escolhido em **Novo item**, inclua-o em `PICKER_KINDS`.

A lista de opções do seletor, a ordenação, a detecção por nome e o XML passam a usar a nova definição automaticamente.

## Limitações

- O CBZ e o EPUB são montados em memória. Pastas muito grandes (na casa de alguns GB) podem esgotar a memória do navegador.
- O EPUB é de layout fixo, sem texto reflowable, e imagens que o navegador não consegue decodificar interrompem a geração com uma mensagem de erro.
- A marcação de tipos é por item. Não é possível dividir um capítulo em dois itens de capítulo.
- O Tojiru não lê nem edita um `ComicInfo.xml` já existente.

## Privacidade

Os arquivos são processados apenas no navegador. A única requisição externa feita pela página é o carregamento da biblioteca JSZip e da fonte. O idioma escolhido é a única informação guardada no navegador.
