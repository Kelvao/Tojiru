# Tojiru 綴じる

[![Official Website](https://img.shields.io/badge/Official_Website-Tojiru%20綴-dc8add)](https://tojiru.pages.dev/)
[![Status](https://img.shields.io/uptimerobot/status/m803438082-8cc629151c0346a7bf46cecb?label=Status)](https://stats.uptimerobot.com/AhVkgcXoGz)
[![Uptime](https://img.shields.io/uptimerobot/ratio/m803438082-8cc629151c0346a7bf46cecb?label=Uptime)](https://stats.uptimerobot.com/AhVkgcXoGz)

🌐 Leia em: [English](README.md) | Português Brasileiro

Organize imagens de mangá e gere um **CBZ** ou **EPUB** com índice e metadados. Tudo é processado no navegador; as imagens não são enviadas a um servidor.

## Recursos

- Lê uma pasta de mangá e transforma cada subpasta em um item do índice (capítulo, capa, extra etc.).
- Gera **CBZ** com `ComicInfo.xml` (índice, autor, gêneros, título) ou **EPUB 3** de layout fixo.
- Grava o arquivo em disco durante a geração, em vez de montá-lo inteiro na memória, quando o navegador permite.
- Não depende de build, CDN ou serviço externo.
- Interface em inglês e português (Brasil).

## Começar

1. Abra `index.html` em um navegador com suporte à seleção de pastas (`webkitdirectory`).
2. Selecione a pasta raiz do mangá.
3. Revise o índice: edite títulos, tipos e ordem (▲▼). Use **+ Novo item** para separar páginas de um capítulo em um item de capa, índice, extra ou contracapa; **Desfazer** devolve as páginas ao item de origem.
4. Preencha o título, escolha **CBZ** ou **EPUB** e clique em **Gerar**.

O título é obrigatório e também define o nome do arquivo. Ao escolher a pasta, ele é preenchido com o nome da pasta raiz se estiver vazio. Os outros metadados são opcionais.

## Como a pasta é organizada

- Cada subpasta direta da raiz vira um item; pastas mais profundas ficam agrupadas nele.
- Imagens soltas na raiz formam o item `(raiz)`, exceto arquivos reconhecidos como capa, índice, extra ou contracapa.
- As páginas são ordenadas pelo caminho em ordem natural (`2.jpg` antes de `10.jpg`), então subpastas dentro de um capítulo ficam agrupadas (`Parte 2` antes de `Parte 10`).
- Os itens já vêm com título preenchido: capítulos no padrão "Capítulo N" e capa, índice, extras e contracapa com o nome do tipo.
- **Extrair das pastas** troca os títulos dos capítulos pelo nome de cada subpasta; páginas soltas na raiz não têm subpasta e continuam numeradas. **Gerar numeração** volta ao padrão "Capítulo N". Os dois sobrescrevem os títulos dos capítulos e não alteram capa, índice, extras, contracapa nem itens criados com **+ Novo item**. **Limpar nomes** esvazia todos os títulos; itens sem título usam o nome do tipo ou "Capítulo N" na geração.
- A detecção reconhece nomes em português e inglês, sem diferenciar maiúsculas ou acentos. O nome precisa começar com a palavra-chave inteira (`Extra 2`, `Capa`), e não dentro de uma palavra maior (`Extraordinary`). Você pode alterar o tipo manualmente.
- Extensões aceitas: `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif` e `bmp`.

## Metadados

| Campo                  | Observação                                       |
| ---------------------- | ------------------------------------------------ |
| Título                 | Obrigatório; também nomeia o arquivo             |
| Autor e artista        | Artista é opcional e pode ser diferente do autor |
| Gêneros                | Separe por vírgulas                              |
| Editora, ano e sinopse | Opcionais; o ano tem 4 dígitos                   |
| Idioma do mangá        | Código como `pt`, `en` ou `ja`                   |
| Volume                 | Número usado para ordenar a série                |
| Direção de leitura     | Padrão: direita para a esquerda                  |

Campos vazios são omitidos dos metadados gerados.

## Formatos

| Formato | Conteúdo                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------- |
| CBZ     | Imagens na ordem do índice e `ComicInfo.xml`; imagens armazenadas sem recompressão             |
| EPUB    | EPUB 3 de layout fixo, com uma página XHTML/SVG por imagem, índice navegável, capa e metadados |

No modo CBZ também é possível baixar apenas o `ComicInfo.xml`. Ele contém uma entrada por item do índice; `Image` aponta para a primeira imagem do item.

No EPUB, o SVG usa escala proporcional (`xMidYMid meet`) para evitar distorção e corte dentro do viewport. O alinhamento e o ajuste final podem variar entre leitores.

## Imagens

| Formato               | Tratamento                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| JPEG, PNG, GIF e WebP | Incluídos sem conversão. No EPUB, largura e altura são lidas do cabeçalho do arquivo, sem decodificar a imagem |
| AVIF e BMP            | Decodificados no navegador e convertidos para PNG no EPUB                                                      |

Detalhes e limites:

- JPEGs com orientação EXIF que troca largura e altura (valores 5 a 8) são decodificados, para que as dimensões coincidam com o que o navegador exibe.
- Como o cabeçalho basta para medir, uma imagem de JPEG, PNG, GIF ou WebP com cabeçalho válido, mas conteúdo corrompido, não gera erro durante a criação do EPUB. Arquivos vazios ou sem cabeçalho reconhecível geram erro com o nome da página.
- A conversão de AVIF e BMP decodifica a imagem inteira e mantém o PNG em memória até o empacotamento. O PNG costuma ser bem maior que o AVIF original.
- No CBZ não há conversão: AVIF e BMP entram como estão, e o leitor precisa saber abri-los.

## Memória e armazenamento temporário

Ao gerar o arquivo, o Tojiru tenta gravá-lo aos poucos no armazenamento privado do navegador (OPFS, pasta `tojiru-tmp`) e só então iniciar o download. Isso evita montar um arquivo grande inteiro na memória.

- Antes de gravar, o app verifica se há cota de armazenamento suficiente.
- Se o OPFS não estiver disponível, a gravação falhar ou a cota for insuficiente, o app volta automaticamente para a montagem em memória com JSZip. Nesse caso, pastas muito grandes podem exceder a memória disponível.
- O arquivo temporário é apagado ao abrir o app e antes de cada nova geração. Ele permanece após o download para que o navegador consiga terminar de lê-lo.
- No caminho em disco, o arquivo gerado tem limite de 4 GiB e 65.535 entradas (formato ZIP clássico, sem ZIP64). Acima disso, a geração falha com erro.
- No caminho em disco, o EPUB armazena também os arquivos XML sem compressão; no caminho em memória eles são comprimidos. O arquivo `mimetype` fica sempre em primeiro lugar e sem compressão, como a especificação exige.
- Duas abas gerando ao mesmo tempo podem apagar os arquivos temporários uma da outra.

A geração de EPUB mede todas as imagens antes de empacotar e pode demorar mais que a de CBZ, principalmente com AVIF e BMP.

O Tojiru não lê nem edita um `ComicInfo.xml` existente.

## Estrutura do projeto

O código é dividido em camadas, e o teste `tests/architecture.test.js` impede dependências na direção errada.

| Camada         | Pasta                | Responsabilidade                                                              |
| -------------- | -------------------- | ----------------------------------------------------------------------------- |
| Domínio        | `src/domain`         | Regras puras: itens, ordenação, detecção de tipos, metadados                  |
| Aplicação      | `src/application`    | Casos de uso (carregar pasta, gerar arquivo) com portas injetadas             |
| Infraestrutura | `src/infrastructure` | Escritores de CBZ e EPUB, ZIP em stream, leitura e conversão de imagens, OPFS |
| Apresentação   | `src/presentation`   | Interface, controlador e traduções                                            |

`src/main.js` é a raiz de composição: liga as camadas e injeta os adaptadores do navegador. Os scripts são carregados na ordem do `index.html`, sem módulos ES, para que o projeto funcione ao abrir o arquivo direto.

## Executar e testar

Não há etapa de build. Abra `index.html` diretamente ou inicie um servidor estático:

```sh
python3 -m http.server 8000
```

Os testes usam `node:test` e JSZip. ESLint e Prettier verificam o código:

```sh
npm install
npm run check
```

Use `npm run format` para formatar os arquivos JavaScript. O workflow do GitHub Actions executa testes, lint e verificação de formatação em cada pull request e em cada push na `main` (Node 20). Para rodar localmente, é necessário Node 18 ou superior.

O JSZip e a fonte Inter estão incluídos no projeto e são carregados localmente, sem dependência de CDN. Caracteres fora da cobertura do Inter, como japonês, usam as fontes disponíveis no sistema.

## Contribuir

Rode `npm run check` antes de abrir um pull request. Este projeto segue o [Código de Conduta](CODE_OF_CONDUCT.md).

## Licença

O código original deste projeto está sob a [PolyForm Noncommercial License 1.0.0](LICENSE). São permitidos uso, alteração e redistribuição para fins não comerciais, desde que os termos da licença e o aviso obrigatório de atribuição sejam mantidos. Componentes de terceiros continuam sujeitos às próprias licenças.

## Privacidade

As imagens são processadas localmente no navegador e nunca saem dele. Durante a geração, o arquivo pode ficar gravado temporariamente no armazenamento privado do navegador (OPFS) e é apagado na próxima geração ou ao abrir o app. O idioma escolhido é salvo no armazenamento local. Nenhuma fonte ou biblioteca é carregada de um serviço externo.
