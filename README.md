# Gates - Financas

Sistema financeiro pessoal com autenticacao, SQLite local e dados separados por usuario.

## Como rodar

```bash
npm install
npm start
```

Abra `http://127.0.0.1:4173`.

Copie `.env.example` para `.env` e preencha as credenciais iniciais. O `.env` está no `.gitignore` e não deve ser enviado ao Git:

```powershell
Copy-Item .env.example .env
# edite .env com seu e-mail e sua senha
npm start
```

Para acesso pela internet, publique este servidor atras de HTTPS e use `HOST=0.0.0.0`.

Tambem e possivel abrir `index.html` diretamente, mas o servidor local evita problemas com bibliotecas carregadas pelo navegador.

## Persistencia

- O estado completo fica em `data/gates.sqlite`, separado por usuario e dividido em tabelas relacionais.
- A persistencia usa TypeORM com SQLite; entidades, datasource e repositorios ficam em `src/database/`.
- O frontend nao usa `localStorage`; toda leitura e escrita passa pela API autenticada.
- Senhas sao armazenadas apenas como hash bcrypt.
- O arquivo `.env` contém apenas a configuração de inicialização; o `server.js` não contém suas credenciais.
- Sessoes usam cookie `HttpOnly`, `SameSite=Lax`, expiram em 7 dias e podem ser encerradas pelo botao **Sair**.
- Apos 5 tentativas invalidas, o login e bloqueado por 15 minutos por IP e e-mail.
- Backups automaticos do SQLite sao mantidos em `data/backups/` (ate 14 arquivos).
- A recuperacao gera um token de uso unico no log do servidor por 30 minutos. Em producao, conecte esse fluxo a um provedor SMTP para enviar o token por e-mail.
- `data/financeiro.json` e arquivos privados de extratos devem permanecer fora do Git.
- O botao **Exportar** gera um backup JSON com lancamentos, categorias, contas, orcamentos e metas.
- O fluxo **Importar > Backup JSON** restaura esses dados em outro navegador, guia anonima ou dominio.
- PDFs sao processados localmente no navegador; o arquivo nao e enviado para API externa.
- O servidor publica somente `index.html`, `assets/` e `src/`; dados privados e metadados do repositorio nao sao servidos.

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

## PWA

- O app pode ser instalado como PWA em navegadores compatíveis.
- O `service-worker.js` armazena o shell do app e as bibliotecas carregadas por CDN depois do primeiro acesso online.
- Os dados financeiros ficam exclusivamente no SQLite do servidor e exigem conexão com a aplicação.
- Para instalar, abra o app por `localhost` ou HTTPS e use a opção **Instalar aplicativo** do navegador.

## Deploy

O deploy precisa executar Node.js 24 ou superior e manter o diretorio `data/` persistente. Cloudflare Pages estatico nao e suficiente para este backend SQLite.

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
- `src/database/entities.js`: entidades TypeORM das tabelas financeiras.
- `src/database/finance-repository.js`: leitura e persistencia transacional do dominio financeiro.
- `src/database/data-source.js`: configuracao e inicializacao do TypeORM.
- `src/services/auth-service.js`: usuarios, sessoes, hashes e recuperacao de senha.
- `src/server/config.js`: configuracao de ambiente e `.env`.
- `assets/favicon.svg`: icone do app.
- `server.js`: rotas HTTP e servidor de arquivos.
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
