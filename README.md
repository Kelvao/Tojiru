# Tojiru 綴じる

Organize imagens de mangá e gere um **CBZ** ou **EPUB** com índice e metadados. Tudo é processado no navegador; as imagens não são enviadas a um servidor.

## Começar

1. Abra `index.html` em um navegador com suporte à seleção de pastas (`webkitdirectory`).
2. Selecione a pasta raiz do mangá.
3. Revise o índice: edite nomes, tipos e ordem. Use **Novo item** para separar páginas que estejam dentro de um capítulo.
4. Preencha o título, escolha **CBZ** ou **EPUB** e clique em **Gerar**.

O título é obrigatório e também define o nome do arquivo. Os outros metadados são opcionais.

## Como a pasta é organizada

- Cada subpasta direta da raiz vira um item; pastas mais profundas ficam agrupadas nele.
- Imagens soltas na raiz formam o item `(raiz)`, exceto arquivos reconhecidos como capa, índice, extra ou contracapa.
- As páginas são ordenadas por nome em ordem natural (`2.jpg` antes de `10.jpg`).
- A detecção reconhece nomes em português e inglês, sem diferenciar maiúsculas ou acentos. Você pode alterar o tipo manualmente.
- Extensões aceitas: `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif` e `bmp`.

## Metadados

| Campo | Observação |
| --- | --- |
| Título | Obrigatório; também nomeia o arquivo |
| Autor e artista | Artista é opcional e pode ser diferente do autor |
| Gêneros | Separe por vírgulas |
| Editora, ano e sinopse | Opcionais |
| Idioma | Código como `pt`, `en` ou `ja` |
| Volume | Número usado para ordenar a série |
| Direção de leitura | Padrão: direita para a esquerda |

Campos vazios são omitidos dos metadados gerados.

## Formatos

| Formato | Conteúdo |
| --- | --- |
| CBZ | Imagens na ordem do índice e `ComicInfo.xml`; imagens armazenadas sem recompressão |
| EPUB | EPUB 3 de layout fixo, com uma página XHTML/SVG por imagem, índice navegável, capa e metadados |

No modo CBZ também é possível baixar apenas o `ComicInfo.xml`. Ele contém uma entrada por item do índice; `Image` aponta para a primeira imagem do item.

No EPUB, o SVG usa escala proporcional (`xMidYMid meet`) para evitar distorção e corte dentro do viewport. O alinhamento e o ajuste final podem variar entre leitores. JPEG, PNG, GIF e WebP são incluídos sem conversão; BMP e AVIF são convertidos para PNG no navegador.

Os arquivos são montados em memória; pastas muito grandes podem exceder a memória disponível. A geração de EPUB decodifica as imagens e pode demorar mais que a de CBZ. O Tojiru não lê nem edita um `ComicInfo.xml` existente.

## Executar e testar

Não há etapa de build. Abra `index.html` diretamente ou inicie um servidor estático:

```sh
python3 -m http.server 8000
```

Os testes usam `node:test` e JSZip:

```sh
npm install
npm test
```

É necessária conexão à internet para carregar o JSZip. A fonte externa é opcional e tem fallback para a fonte do sistema.

## Licença

O código original deste projeto está sob a [PolyForm Noncommercial License 1.0.0](LICENSE). São permitidos uso, alteração e redistribuição para fins não comerciais, desde que os termos da licença e o aviso obrigatório de atribuição sejam mantidos. Componentes de terceiros continuam sujeitos às próprias licenças.

## Privacidade

As imagens são processadas localmente no navegador. O idioma escolhido é salvo no armazenamento local; a página carrega JSZip e, opcionalmente, a fonte a partir de serviços externos.
