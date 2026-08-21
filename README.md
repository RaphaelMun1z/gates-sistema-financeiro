# Gates - Financas

Sistema financeiro pessoal estatico, sem login, sem autenticacao e sem backend obrigatorio. O app abre direto no painel e cada navegador mantem os proprios dados.

## Como rodar

```bash
npm install
npm start
```

Abra `http://127.0.0.1:4173`.

Tambem e possivel abrir `index.html` diretamente, mas o servidor local evita problemas com bibliotecas carregadas pelo navegador.

## Persistencia

- O estado completo fica no `localStorage` do navegador.
- Uma instalacao nova comeca vazia.
- Visitantes diferentes nao compartilham dados.
- Nenhum JSON do repositorio e carregado como base inicial.
- `data/financeiro.json` e arquivos privados de extratos devem permanecer fora do Git.
- O botao **Exportar** gera um backup JSON com lancamentos, categorias, contas, orcamentos e metas.
- O fluxo **Importar > Backup JSON** restaura esses dados em outro navegador, guia anonima ou dominio.
- PDFs sao processados localmente no navegador; o arquivo nao e enviado para API externa.
- O servidor local publica somente `index.html`, `assets/` e `src/`; dados privados e metadados do repositorio nao sao servidos.

## Recursos principais

- Visao geral com entradas, saidas, saldo e meta principal.
- Cadastro, edicao e exclusao de lancamentos.
- Filtros globais por periodo, tipo, busca, multiplas categorias e multiplas contas.
- Planejamento mensal com orcamentos por categoria.
- Metas financeiras com progresso e historico de aportes.
- Categorias editaveis com cor e icone.
- Contas criaveis e removiveis.
- Importacao guiada de JSON e extrato/fatura PDF com revisao antes de salvar.
- Exportacao de dados em JSON.
- Tema claro/escuro e layout responsivo.

## Cloudflare Pages

Configure como site estatico:

```text
Framework preset: None
Build command: vazio
Build output directory: .
Root directory: vazio
```

Nao configure KV, D1, variaveis de autenticacao ou Pages Functions para o fluxo atual. A privacidade vem do armazenamento local isolado por navegador e da portabilidade manual pelo JSON.

## Testes

```bash
node --check src/scripts/app.js
node --check src/scripts/account-utils.js
node --check src/scripts/date-utils.js
node --check src/scripts/pdf-parser.js
node --check server.js
npm test
```

## Estrutura

- `index.html`: estrutura da interface.
- `src/styles/styles.css`: identidade visual, responsividade e componentes.
- `src/scripts/app.js`: estado, renderizacao, formularios, filtros e fluxos de importacao.
- `src/scripts/pdf-parser.js`: parser puro de extratos e faturas.
- `src/scripts/account-utils.js`: normalizacao e remocao de contas.
- `src/scripts/date-utils.js`: validacao e intervalos de datas.
- `assets/favicon.svg`: icone do app.
- `server.js`: servidor estatico local.
- `test/`: testes automatizados com `node:test`.

## Diretrizes de UX

- Manter o sistema direto, operacional e sem telas de login.
- Usar verde com moderacao: acao primaria, saldo positivo e progresso.
- Evitar icones decorativos; icones devem apoiar comandos ou categorias.
- Toda importacao precisa ter previa antes de salvar.
- Comandos destrutivos precisam de confirmacao.
- Mobile deve priorizar leitura vertical e evitar depender de tabela larga.
- Controles globais devem afetar o sistema de forma previsivel.

## Proximas melhorias recomendadas

- Previa revisavel para importacao JSON, com opcoes de substituir ou mesclar.
- Desfazer apos exclusao, importacao e edicoes importantes.
- Acoes em lote para lancamentos.
- Recorrencias reais com frequencia, fim e proxima ocorrencia.
- Transferencias entre contas sem impactar receitas/despesas.
- Importacao OFX/CSV com mapeamento de colunas e deduplicacao.
- Regras locais de categorizacao por descricao.
