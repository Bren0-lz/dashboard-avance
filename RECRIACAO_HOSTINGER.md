# Especificação completa — recriação do Dashboard Avance na Hostinger

> Handoff pronto para ser entregue a outro modelo no novo repositório.
>
> Elaborado em 22/07/2026 após leitura do frontend, backend, migrations, seeds, banco, uploads e scripts do sistema atual.

## 1. Resultado esperado

Recriar o sistema como **uma única aplicação Node.js**, em **um único repositório e um único projeto/deploy da Hostinger**, com frontend e backend executados pelo mesmo Express.

Decisão recomendada:

- Node.js 24.x;
- Express 5;
- EJS server-side para o frontend;
- JavaScript e CSS modulares;
- MySQL da Hostinger;
- Knex para queries, migrations e seeds;
- autenticação por sessão salva no MySQL;
- uma única aplicação servindo páginas, `/api/v1`, assets, mídia e downloads protegidos.

Não é necessário criar um projeto React separado. O sistema é majoritariamente dashboard, tabelas e formulários; EJS preserva a experiência atual e reduz o risco do deploy. Se no futuro for usado React/Vite, o build deverá continuar sendo servido pelo mesmo Express.

```text
Navegador
  -> HTTPS / proxy Hostinger
    -> Express único
       |- páginas EJS
       |- API /api/v1
       |- autenticação/RBAC/CSRF
       |- regras de dashboard, vendas, metas e Excel
       |- assets estáticos versionados
       `- Knex -> MySQL Hostinger
                   |- negócio
                   |- sessões/auditoria/eventos
                   `- fotos e ícones mutáveis de baixo volume
```

## 2. Resumo do sistema atual

O projeto efetivo está em `dashboard_empresa/`. Hoje ele já é um monólito CommonJS com Express 5, EJS, HTML/CSS/JS puro, Knex, SQLite, Multer e `xlsx`.

O bootstrap `dashboard_empresa/src/server.js`:

- escuta `0.0.0.0:3000` com porta fixa;
- libera CORS para qualquer origem;
- publica toda a pasta `src/public` e `/uploads`;
- monta páginas e APIs;
- roda migrations e, por uma heurística frágil, seeds ao iniciar;
- contém lógica específica para empacotar/abrir um `.exe` no Windows.

No novo repositório não levar lógica de `pkg`, abertura de navegador, diretórios `runtime`, executáveis, `.rar`, bancos SQLite ou exports reais.

### 2.1 Navegação e páginas atuais

| Rota              | Função                                                           |
| ----------------- | ---------------------------------------------------------------- |
| `GET /`           | Dashboard com KPIs, metas, ranking, filtros, timer e celebrações |
| `GET /sellers`    | CRUD de vendedoras e fotos                                       |
| `GET /services`   | CRUD de serviços e ícones                                        |
| `GET /sale-types` | CRUD de tipos de venda e ícones                                  |
| `GET /operators`  | CRUD de operadoras e ícones                                      |
| `GET /sales`      | Lista, filtros, cadastro, edição e exclusão de vendas            |
| `GET /goals`      | Lista, filtros e CRUD de metas                                   |
| `GET /excel`      | Exportação/importação da base em workbook                        |

Todos os CRUDs usam uma página-hub com aba de lista e aba de cadastro/edição, painel recolhível de filtros, tabela, feedback e ações. Não há paginação. `views/layouts/main.ejs` existe, mas não é usado; cada página inclui head/navbar/footer manualmente.

### 2.2 Rotas SSR existentes

Definidas em `dashboard_empresa/src/routes/views.routes.js`:

- Dashboard: `GET /`.
- Vendedoras: `GET /sellers`, `GET /sellers/:id/edit`, `POST /sellers`, `POST /sellers/:id/update`, `POST /sellers/:id/status`, `POST /sellers/:id/delete`.
- Serviços, operadoras e tipos: mesmo padrão, com upload multipart de `icon`.
- Vendas: `GET /sales`, `GET /sales/:id/edit`, `POST /sales`, `POST /sales/:id/update`, `POST /sales/:id/delete`.
- Metas: `GET /goals`, `GET /goals/:id/edit`, `POST /goals`, `POST /goals/:id/update`, `POST /goals/:id/delete`.
- Excel: `GET /excel`, `GET /excel/export`, `POST /excel/import`.

No destino, view controllers e API controllers devem chamar o mesmo service e o mesmo schema de validação. Não duplicar regra como acontece hoje em vendas/metas.

### 2.3 APIs existentes

| Prefixo           | Operações                                             |
| ----------------- | ----------------------------------------------------- |
| `/api/sellers`    | GET lista/id, POST, PUT, PATCH status, DELETE         |
| `/api/services`   | Mesmo, com multipart para ícone                       |
| `/api/operators`  | Mesmo                                                 |
| `/api/sales`      | GET lista/id, POST, PUT, DELETE                       |
| `/api/goals`      | GET lista/id, POST, PUT, DELETE                       |
| `/api/sale-types` | Router existe, mas não é montado e a API não funciona |

O envelope atual usa `{ok,data,message}` e devolve `error.message` interno em falhas. Não há paginação, API de dashboard nem API de períodos.

No novo projeto usar `/api/v1`, montar todos os routers, paginação e erro padronizado:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revise os campos informados.",
    "fieldErrors": { "sale_time": "Horário fora do expediente." }
  }
}
```

## 3. Requisitos funcionais

### 3.1 Login e usuários — novo e obrigatório

O sistema atual não tem usuário, login, sessão ou permissão; qualquer visitante pode excluir tudo e importar um Excel destrutivo. O deploy público deve ter:

- login por e-mail/senha e logout por POST;
- sessão persistida no MySQL;
- cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`;
- troca de senha e bloqueio de usuário inativo;
- todas as páginas/APIs protegidas, exceto login e healthchecks;
- CSRF em mutações;
- administração de usuários pelo admin.

Papéis:

| Papel      | Permissões                                                                         |
| ---------- | ---------------------------------------------------------------------------------- |
| `admin`    | Tudo: usuários, catálogos, metas, vendas, exclusões e Excel                        |
| `operator` | Dashboard/consultas e criar/editar vendas; sem usuários/import/exclusão definitiva |
| `viewer`   | Dashboard e consultas permitidas                                                   |

### 3.2 Vendedoras

Campos: nome completo obrigatório, foto opcional e status. Lista por nome/status, exibindo ID, foto, nome, status, criação e ações.

Regras:

- nome único sem diferenciar maiúsculas/minúsculas;
- registro referenciado deve ser inativado, não apagado;
- relação inativa já ligada a venda/meta deve continuar disponível na edição;
- permitir substituir e remover foto;
- validar arquivo pelo conteúdo real e limpar mídia órfã.

### 3.3 Serviços

Campos: `code` estável, nome, ícone e status. Seeds: internet, telefonia fixa e telefonia móvel. Filtros por nome/status. O código é imutável; o nome pode mudar.

### 3.4 Operadoras

Campos: `code`, nome, ícone e status. Seeds: vivo, claro, tim e nio. A cor do gráfico deve ser derivada de forma determinística do código, inclusive para novas operadoras.

### 3.5 Tipos de venda

Seeds obrigatórios:

- `code=new`, nome “Novo”;
- `code=portability`, nome “Portabilidade”.

O código atual classifica metas comparando literalmente o nome com `novo/new/portabilidade/portability`; renomear o tipo exclui receita silenciosamente. Toda regra nova deve usar o código imutável e tratar o nome só como apresentação.

### 3.6 Vendas

Formulário:

- vendedora, serviço, operadora e tipo;
- data, horário e botão “Agora”;
- CNPJ opcional;
- razão social, telefone e nome de quem fechou opcionais;
- com/sem documento;
- origem: cliente da base ou fora da base;
- quantidade, valor unitário e total calculado;
- observações opcionais — o backend atual possui, mas o campo está comentado na view.

Filtros:

- busca em vendedora, serviço, operadora, tipo, CNPJ, razão, telefone, quem fechou e observação;
- cada catálogo;
- turno, documento, origem e intervalo de datas.

Tabela: vendedora, serviço, operadora, **tipo**, CNPJ, razão, contato, fechou, data, horário, turno, documento, origem, quantidade, unitário, total e ações.

Regras:

- IDs inteiros positivos e FKs existentes;
- referências ativas para novas vendas;
- quantidade inteira > 0;
- dinheiro finito, >= 0 e com duas casas;
- servidor calcula `total = quantity * unit_value` usando aritmética decimal;
- CNPJ salvo com 14 dígitos, validado por DV e formatado só na UI;
- strings com limites explícitos;
- impedir duplo submit;
- criação, snapshot de ranking, cruzamento de meta e eventos na mesma transação;
- exclusão lógica/auditada e ignorada nos agregados.

Resposta de criação sugerida:

```json
{
  "ok": true,
  "data": { "id": 123 },
  "events": {
    "saleCreated": true,
    "rankingOvertake": false,
    "dailyGoalReached": true
  }
}
```

### 3.7 Expediente e turnos

Existe divergência: backend atual inicia a tarde às 12:00; cards, timer e alertas iniciam às 13:30.

Decisão recomendada:

- manhã: `08:00 <= hora < 12:00`;
- almoço: `12:00 <= hora < 13:30`, sem venda comercial;
- tarde: `13:30 <= hora <= 17:30`;
- fora desses períodos: erro 422.

Centralizar em um módulo. Se o negócio confirmar vendas no almoço, alterar uma única configuração e testes. Usar `America/Sao_Paulo` para data/hora comercial e UTC para timestamps técnicos.

### 3.8 Metas

Tipos: geral (seller nulo) e individual (seller obrigatório). Períodos efetivos: diário, semanal, quinzenal e mensal. `morning`/`afternoon` do seed atual são legados; turnos são dimensões da meta diária.

Campos:

- tipo, período, vendedora quando individual e datas inclusivas;
- meta total;
- manhã/tarde apenas em meta diária;
- Portabilidade/Base;
- Portabilidade/Fora da base;
- Novo/Base;
- Novo/Fora da base.

As metas de turno e as categorias são decomposições paralelas da mesma receita. Não somar as duas dimensões.

Regras:

- `goal_value` é o total canônico;
- se os quatro alvos categóricos forem usados, sua soma deve igualar o total;
- em meta diária, se manhã/tarde forem usadas, sua soma deve igualar o mesmo total;
- valores finitos e não negativos;
- início <= fim;
- bloquear intervalos sobrepostos no mesmo escopo `(período,tipo,seller)`;
- individual existente prevalece sobre geral mesmo com total zero;
- tabela mostra o total e permite expandir turnos/categorias.

### 3.9 Dashboard

Filtros globais: período, vendedora, documento, origem, operadora, serviço, tipo e datas personalizadas.

Períodos inclusivos:

- hoje;
- semana segunda-domingo;
- quinzena 1–15 ou 16–último dia;
- mês inteiro;
- personalizado com ambas as datas válidas.

Componentes:

1. Manhã: contagem de vendas com/sem doc, receita por grupo, total e meta.
2. Tarde: mesmos dados.
3. Total do período: com/sem doc, receita e meta apropriada.
4. Quatro metas de receita (tipo × origem).
5. Gráfico de operadoras com unidades e receita.
6. Vídeo/troféu e líder.
7. Ranking com chips de quantidade×valor e ícones de operadora, serviço, tipo, documento, turno e origem.
8. Timer de abertura/manhã/almoço/tarde/encerramento.
9. UGR, receita e ticket médio.
10. Gauges diário/semanal/quinzenal/mensal.

Fórmulas:

- com/sem doc conta registros, não unidades;
- UGR = soma de `quantity`;
- receita = soma de `total_value`;
- ticket por unidade = receita / UGR;
- ranking = receita por seller;
- progresso = realizado/meta×100;
- status: neutro sem meta, perigo <90%, alerta 90–<100%, sucesso >=100%.

Todos os cards devem aplicar os mesmos filtros. Hoje cards de turno descartam operadora/serviço/tipo; corrigir. Textos devem dizer “período selecionado”, não sempre “hoje”.

Meta por seleção:

- hoje/manhã/tarde: diária;
- semana: semanal;
- quinzena: quinzenal;
- mês: mensal;
- personalizado: soma das metas diárias contidas no intervalo, com regra indicada na UI.

Cada gauge usa numerador e meta do mesmo intervalo. Como metas totais não têm dimensões de operadora/serviço/doc, ao aplicar esses filtros a UI deve avisar “realizado filtrado; meta não ajustada a este filtro”.

### 3.10 Ranking, áudio e eventos

Desempate determinístico:

1. maior receita;
2. maior número de unidades;
3. primeira venda mais antiga;
4. seller ID crescente.

Agrupar por ID, não nome. Em update/delete/mudança de data, comparar snapshots reais antes/depois das datas afetadas. O bug atual compara ranking com mapa vazio e gera falsa ultrapassagem.

Preservar:

- som de venda por cerca de 2 s;
- som/flash/confete em ultrapassagem;
- som/confete quando receita cruza a meta diária de baixo para cima;
- alerta em HH:00/HH:30 entre 09:00–11:30 e 13:30–17:00, após gesto do usuário;
- consumo idempotente de cada evento.

O sistema atual usa flags no `localStorage` apenas do navegador que cadastrou. Para TV/outros usuários, usar eventos persistidos + SSE autenticado; polling é fallback.

### 3.11 Excel

Exportação admin-only:

- completa ou por intervalo;
- streaming/download direto, nunca em pasta pública;
- abas Vendedoras, Serviços, Operadoras, Tipos de Venda, Períodos de Meta, Metas, Vendas e Metadados;
- Metadados contém schema version, app version, UTC e timezone;
- incluir todos os campos atuais, especialmente quatro alvos de meta.

Importação:

- `.xlsx`, limite de bytes/linhas e MIME real;
- temporário privado ou memória limitada;
- validação de abas, headers, tipos e referências;
- dry-run com contagens/avisos/erros;
- confirmação explícita antes de substituir;
- transação e ordem pais->filhos;
- relatório e auditoria;
- cleanup em sucesso/falha;
- nenhuma referência a `sqlite_sequence`.

O teste exportar->importar deve preservar 100% dos campos. Hoje esse round-trip perde quatro metas categóricas e `sale_category`.

## 4. Frontend, visual e assets

Preservar a linguagem visual: navbar escura azul/roxo, fundo claro, cards brancos arredondados, badges, botões por intenção, tabelas roláveis e dashboard responsivo.

Requisitos:

- layout EJS único;
- extrair o JS inline gigante do dashboard para `dashboard.js`;
- compartilhar `management-tabs.js` e filtros dos CRUDs;
- `sale-form.js` com máscara, cálculo, disable submit e feedback;
- IDs únicos; hoje filtros/form repetem IDs;
- abas acessíveis com ARIA/teclado;
- datas pt-BR e BRL consistente;
- serialização JSON segura, sem JSON bruto em atributo/script e sem `innerHTML` com dados de banco;
- CSP sem `unsafe-inline` quando possível;
- Chart.js e confetti locais/versionados;
- CSS consolidado/minificado, não 18 `@import`;
- `prefers-reduced-motion` para vídeo/confete;
- testar 320, 768 e 1440 px;
- navbar móvel utilizável, não apenas quebrada em linhas;
- relações inativas atuais visíveis na edição;
- query string explícita tem precedência sobre filtros salvos; storage deve ter versão/usuário.

Assets fixos em `public/assets`: logo, coroa, doc/sem doc, manhã/tarde, ícones canônicos, troféu MP4 e quatro MP3. Otimizar imagens, deduplicar arquivos timestamp, comprimir vídeo/áudio e evitar `preload=auto` de vários megabytes.

Mídia enviada pelo usuário deve ficar fora da release. Para este baixo volume, usar MySQL BLOB em `media_files`; para crescimento futuro, manter uma interface de storage migrável para S3.

Correção Linux obrigatória: o arquivo atual é `partials/navBar.ejs`, mas os includes usam `partials/navbar`. Usar nomes minúsculos idênticos e smoke test em filesystem case-sensitive.

## 5. Banco atual

Esquema lógico SQLite:

- `sellers`: nome, foto, ativo, timestamps;
- `services`, `operators`, `sale_types`: nome unique, ícone, ativo, criação;
- `goal_periods`: nome unique;
- `goals`: período, seller, tipo, manhã/tarde/total, datas, quatro alvos atuais e quatro colunas legadas;
- `sales`: quatro FKs, data/hora/turno, dados de cliente, quantity/unit/total, doc, origem, categoria redundante, notas, timestamps.

Migrations atuais, em ordem:

1. `20260413_001_create_initial_tables.js`;
2. `20260703_001_add_is_base_sale_to_sales.js`;
3. `20260706_001_add_customer_fields_to_sales.js`;
4. `20260713_001_add_sale_categories_and_goal_breakdown.js`;
5. `20260713_002_add_out_of_base_goal_value.js`;
6. `20260714_001_normalize_sale_modalities.js`;
7. `20260720_001_replace_revenue_goal_dimensions.js`.

Não portar literalmente. Elas são SQLite e contêm etapas legadas. Criar baseline MySQL limpa.

Problemas atuais:

- duas instâncias Knex para o mesmo SQLite;
- configuração sempre `development` nos repositórios;
- FKs SQLite não habilitadas;
- seed destrutivo disparado apenas porque `services` está vazia;
- quase nenhum índice;
- deletes geram órfãos/500;
- `banco.txt` é obsoleto;
- bancos, `.xlsx`, uploads reais e `.rar` estão no Git;
- exports públicos anônimos.

Seed novo nunca apaga. Fazer upsert apenas de períodos/catálogos. Vendedoras reais entram por migração/UI; fixtures completas só em teste.

## 6. Modelo MySQL de destino

Usar `utf8mb4`, timestamps UTC, `DATE/TIME` como strings do driver, dinheiro `DECIMAL(14,2)` e pool pequeno único.

### 6.1 Tabelas de plataforma

`users`

- BIGINT PK;
- `name` VARCHAR(120);
- `email` VARCHAR(191) unique case-insensitive;
- `password_hash`;
- `role` admin/operator/viewer;
- `is_active`, `last_login_at`, timestamps.

`sessions`

- `sid` PK, `sess` JSON/TEXT, `expired_at`, índice de expiração.

`media_files`

- ID, kind, original_name, mime_type, byte_size, sha256, LONGBLOB `content`, created_by/at;
- endpoint com ETag, cache, MIME e `nosniff`.

`audit_logs`

- user, action, entity type/id, before/after JSON sanitizado, request ID, IP resumido, data;
- nunca senha/hash/cookie/segredo.

`dashboard_events`

- ID crescente, tipo, payload JSON mínimo, occurred_at, expires_at;
- eventos `sale_created`, `ranking_overtake`, `daily_goal_reached`;
- SSE aceita `Last-Event-ID`.

### 6.2 Catálogos

`sellers`: ID, `full_name` unique, `photo_media_id`, ativo, timestamps.

`services`, `operators`, `sale_types`: ID, `code` unique/imutável, `name` unique, `icon_media_id`, ativo, timestamps.

`goal_periods`: ID, code daily/weekly/biweekly/monthly, nome, ativo, timestamps.

Mídia usa `ON DELETE SET NULL`; relações de negócio usam `RESTRICT`.

### 6.3 `goals`

- IDs/fks de período e seller;
- `goal_type`;
- total, manhã/tarde e quatro categorias em DECIMAL(14,2);
- datas inclusivas;
- created/updated/deleted by/at;
- índice `(goal_period_id,goal_type,seller_id,start_date,end_date,deleted_at)`;
- overlap validado dentro de transação.

### 6.4 `sales`

- FKs seller/service/operator/sale_type;
- DATE/TIME/turno;
- `cnpj_digits` CHAR(14), razão, telefone, fechou;
- quantity INT unsigned;
- unit/total DECIMAL(14,2);
- doc, origem, notas;
- created/updated/deleted by/at.

Índices mínimos:

- `(sale_date,sale_time,id)`;
- `(seller_id,sale_date)`;
- `(operator_id,sale_date)`;
- `(service_id,sale_date)`;
- `(sale_type_id,sale_date)`;
- `(sale_date,sale_shift)`;
- `(sale_date,has_doc)`;
- `(sale_date,is_base_sale)`;
- `cnpj_digits`.

## 7. Organização do novo repositório

```text
/
|- package.json
|- package-lock.json
|- .env.example
|- .gitignore
|- README.md
|- src/
|  |- server.js                 # env, migrations, listen, shutdown
|  |- app.js                    # Express testável sem listen
|  |- config/env.js,database.js
|  |- database/migrations,seeds/
|  |- modules/
|  |  |- auth,users,dashboard/
|  |  |- sellers,services,operators,sale-types/
|  |  |- sales,goals,media,excel,audit/
|  |- middlewares/
|  |- shared/
|  |- views/layouts,partials,pages/
|  `- public/assets/css,js,img,audio,video/
|- scripts/migrate-legacy-sqlite.js
|- scripts/verify-deploy.js
`- tests/unit,integration,e2e,fixtures/
```

Cada módulo tem router view/API, controller fino, service, repository, schema de validação e testes conforme necessário.

## 8. Dependências e scripts

Dependências sugeridas:

- `express`, `ejs`;
- `knex`, `mysql2`;
- `zod` para env/body/query;
- `express-session` + session store Knex/MySQL;
- `bcryptjs` ou `crypto.scrypt`;
- `helmet`, `compression`, rate limiter e CSRF compatível com sessão;
- `multer` apenas onde necessário + biblioteca de detecção de magic bytes/imagem;
- `exceljs` para workbook;
- `decimal.js` para dinheiro;
- biblioteca de timezone, por exemplo Luxon;
- logger estruturado, por exemplo Pino.

Scripts mínimos:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "build": "node scripts/verify-deploy.js",
    "start": "node src/server.js",
    "migrate:deploy": "knex migrate:latest",
    "migrate:status": "knex migrate:list",
    "migrate:rollback": "knex migrate:rollback",
    "seed:reference": "knex seed:run",
    "test": "node --test",
    "test:run": "node --test",
    "legacy:inspect": "node scripts/migrate-legacy-sqlite.js --inspect",
    "legacy:migrate": "node scripts/migrate-legacy-sqlite.js"
  },
  "engines": { "node": "24.x" }
}
```

Adaptar `migrate:status` ao comando efetivamente suportado pelo Knex escolhido.

## 9. Migrations e seeds novos

Criar migrations pequenas e ordenadas, por exemplo:

1. auth/sessions;
2. media e catálogos;
3. períodos/metas;
4. vendas/índices;
5. auditoria/eventos.

Regras operacionais:

- migration nunca depende de seed destrutivo;
- app valida env e conexão antes de ouvir;
- `knex_migrations`/lock serializa execução;
- em Hostinger managed, onde npm por SSH pode não estar disponível, o startup pode executar `migrate.latest()` antes do `listen`, controlado por `AUTO_MIGRATE=true` e com timeout;
- seed de referência é idempotente e separado;
- admin inicial só é criado se `users` estiver vazia e variáveis bootstrap existirem; remover essas variáveis após o primeiro login;
- nunca fazer rollback automático de schema em produção.

Estratégia expand/contract:

1. adicionar tabela/coluna nullable e código compatível;
2. backfill verificável;
3. trocar leitura/escrita;
4. em release posterior remover legado.

Assim o código anterior continua funcionando se for necessário reverter um deploy.

## 10. Migração dos dados SQLite para MySQL

Há pelo menos `dashboard_empresa/src/database/database.sqlite` e um `dashboard.db` antigo na raiz. Não escolher pelo nome: o script deve inspecionar schema, migrations, contagens, intervalo de vendas e soma de receita para identificar a fonte correta.

### 10.1 Pré-corte

1. Copiar os dois bancos em modo somente leitura.
2. Copiar uploads e assets atuais.
3. Gerar checksums e backup fora do Git.
4. Executar `legacy:inspect` e registrar:
   - tabelas/colunas/migrations;
   - contagens;
   - min/max de datas;
   - receita total/por mês/por seller;
   - órfãos e arquivos ausentes.
5. Criar MySQL vazio e rodar baseline.
6. Executar dry-run completo.

### 10.2 Transformações

- preservar IDs quando possível ou manter mapa explícito;
- normalizar UTF-8/mojibake sem alterar silenciosamente conteúdo duvidoso;
- mapear nomes Novo/Portabilidade para codes estáveis;
- descartar `sale_category` redundante;
- manter `is_base_sale` como origem;
- importar os quatro campos de meta atuais e ignorar colunas legadas depois de registrar relatório;
- converter metas period `morning/afternoon` em dimensões de uma daily compatível; se não houver correspondência inequívoca, exigir revisão manual;
- ler paths de foto/ícone, importar bytes em `media_files` e reportar faltantes;
- normalizar CNPJ; dado inválido vira ocorrência de relatório, nunca desaparece silenciosamente;
- preservar `total_value` histórico mesmo se divergir de quantity×unit e reportar divergência; novas vendas seguem cálculo correto;
- preservar vendas 12:00–13:29 como histórico e marcá-las para revisão se a nova regra bloquear almoço;
- converter timestamps para UTC com hipótese registrada.

Ordem: mídia/catálogos/períodos -> sellers -> goals -> sales. Executar transação por lote seguro, idempotência por tabela `data_migrations` e nunca desabilitar FKs globalmente sem necessidade.

### 10.3 Validação

Comparar origem/destino:

- contagem por tabela;
- soma de receita total, por data, mês e seller;
- soma de unidades;
- min/max de datas;
- metas e quatro dimensões;
- zero órfãos;
- arquivos importados/faltantes;
- amostra determinística de registros.

O script termina com relatório JSON e status diferente de zero se houver divergência crítica.

### 10.4 Corte e rollback

1. Colocar sistema antigo em manutenção/somente leitura.
2. Fazer snapshot final e importação final.
3. Validar staging/produção.
4. Liberar domínio.
5. Manter origem e backup imutáveis até aceite.

Rollback de aplicação volta ao commit/deploy anterior. Banco não recebe `down` automático; migrations precisam ser backward-compatible. Antes de migration destrutiva, gerar backup MySQL testado.

Para rodar a migração local contra MySQL Hostinger, liberar temporariamente apenas o IP do operador em Remote MySQL e remover a regra após o corte; nunca marcar “Any Host” permanentemente.

## 11. Variáveis de ambiente

```dotenv
NODE_ENV=production
PORT=3000
APP_URL=https://dashboard.exemplo.com.br
APP_TIMEZONE=America/Sao_Paulo
TRUST_PROXY=1

DB_HOST=localhost
DB_PORT=3306
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
DB_POOL_MIN=0
DB_POOL_MAX=5

SESSION_SECRET=trocar-por-segredo-longo-e-aleatorio
SESSION_COOKIE_NAME=avance_session

AUTO_MIGRATE=true
BOOTSTRAP_ADMIN_NAME=...
BOOTSTRAP_ADMIN_EMAIL=...
BOOTSTRAP_ADMIN_PASSWORD=...

MAX_IMAGE_BYTES=5242880
MAX_EXCEL_BYTES=10485760
LOG_LEVEL=info
```

`.env.example` contém somente placeholders. Segredos reais ficam no hPanel, nunca no Git ou em logs.

## 12. Deploy Hostinger

Informação oficial consultada em 22/07/2026:

- Node.js Web Apps estão disponíveis em Business Web Hosting e planos Cloud; Express é suportado e as versões listadas incluem 18, 20, 22 e 24.
- A integração GitHub faz build/deploy automático; ZIP também é possível.
- No hosting gerenciado, o banco nativo indicado é MySQL.
- Variáveis podem ser cadastradas/importadas no fluxo de deploy.
- O troubleshooting oficial pede `package.json` na raiz e aplicação na porta 3000.

Passo a passo:

1. Confirmar plano Business/Cloud com Node Web App.
2. Criar novo banco/usuário MySQL no hPanel.
3. Garantir `package.json` na raiz do novo repositório, não em subpasta.
4. Não enviar `node_modules`, banco, exports, uploads mutáveis ou `.env`.
5. Adicionar Website -> Deploy Web App -> GitHub.
6. Escolher Express, Node 24.x e branch protegida de produção.
7. Build: `npm run build`; start: `npm start`; entry, se solicitado: `src/server.js`.
8. O servidor usa `Number(process.env.PORT || 3000)` e `0.0.0.0`.
9. Configurar todas as env vars no hPanel.
10. Primeiro deploy cria schema e admin bootstrap.
11. Remover senha bootstrap e redeployar.
12. Rodar migração legada e validações.
13. Testar `/health/live`, `/health/ready`, login, CRUD, mídia, dashboard e Excel.
14. Configurar domínio/SSL.
15. Observar logs, CPU, RAM, I/O e conexões MySQL.

Healthchecks:

- `GET /health/live`: processo ativo, sem detalhes sensíveis;
- `GET /health/ready`: `SELECT 1`, migrations concluídas e dependências essenciais.

Implementar `SIGTERM`/`SIGINT`: parar de aceitar requests, encerrar servidor, fechar Knex e sair com timeout.

Links oficiais:

- [Deploy de Node.js Web App](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Conectar MySQL Hostinger ao Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Variáveis de ambiente](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)
- [Redeploy de aplicação Node](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/)
- [Remote MySQL](https://support.hostinger.com/en/articles/1583546-how-to-set-up-remote-mysql-access-in-hostinger)
- [Falhas de build e porta](https://www.hostinger.com/support/fix-failed-to-build-application-error-hostinger-node-js/)

## 13. Segurança e operação

Obrigatório antes de produção:

- Helmet e CSP; dependências externas locais;
- sem CORS global; mesma origem por padrão;
- CSRF em formulário/API com cookie de sessão;
- rate limit forte em login/import e razoável nas APIs;
- Zod para params/query/body/env;
- limite JSON/urlencoded;
- uploads por magic bytes, dimensões, tamanho e reprocessamento;
- nomes gerados, sem confiar no original;
- mensagens 500 genéricas; detalhes apenas em logs;
- request ID e logs JSON sem PII/segredos;
- prepared queries pelo Knex;
- proteção contra XSS e JSON-in-script;
- cache correto de assets/mídia;
- backup MySQL antes de mudanças e teste periódico de restauração;
- trilha de auditoria;
- dependências atualizadas e lockfile no Git;
- página 404 e error middleware;
- LGPD: mínimo acesso a telefone/nome/CNPJ, retenção e export controlado.

## 14. Bugs que não devem ser recriados

1. `navBar.ejs` versus include `navbar` no Linux.
2. Porta fixa sem env.
3. API de sale types não montada.
4. CORS aberto e ausência de auth/CSRF.
5. Duas conexões Knex/SQLite sem FKs.
6. Seed de startup destrutivo.
7. Excel público, destrutivo, sem preview e perdendo campos.
8. Upload órfão e persistido dentro da release.
9. Cards de turno ignorando filtros.
10. Gauges misturando intervalos diário/mensal.
11. Ranking por nome e empate não determinístico.
12. Falsa ultrapassagem ao mover venda de data.
13. Metas sobrepostas sendo somadas acidentalmente.
14. Meta individual zero caindo para geral.
15. Categoria baseada no nome mutável do tipo.
16. Total de meta somando turnos + categorias em dobro.
17. UTC usado para data padrão de venda e relógios em fusos diferentes.
18. JSON/innerHTML vulnerável a XSS.
19. IDs duplicados, abas sem acessibilidade e relações inativas ausentes na edição.
20. Sem paginação, idempotência, healthcheck, shutdown ou testes.
21. CDN Chart sem versão/guarda interrompendo JS restante.
22. Arquivos reais de banco/export/upload no Git.

## 15. Testes e critérios de aceite

### 15.1 Unitários

- limites 07:59, 08:00, 11:59, 12:00, 13:29, 13:30, 17:30 e 17:31;
- ranges hoje/semana/quinzena/mês/custom em São Paulo;
- virada do dia entre 21h–00h local versus UTC;
- CNPJ válido/inválido;
- dinheiro, total e arredondamento;
- soma/consistência de meta;
- overlap e precedência individual;
- ranking/desempate/ultrapassagem;
- status e percentual da meta.

### 15.2 Integração

- migrations do zero e segunda execução idempotente;
- seed sem apagar dados;
- login, sessão, CSRF e matriz de papéis;
- CRUDs, conflitos 409 e relações inativas;
- criação/edição/exclusão lógica de venda;
- todos os filtros aplicados a todos os agregados;
- Excel round-trip integral;
- upload inválido/limites/cleanup;
- SSE/reconexão/idempotência;
- healthchecks e erro sem vazamento.

### 15.3 E2E/visual

- login -> cadastros -> meta -> venda -> dashboard;
- som/celebração com fallback quando autoplay é bloqueado;
- Excel dry-run/confirm/restore;
- 320/768/1440 px;
- teclado e leitor de tela básico;
- execução em Linux case-sensitive;
- aplicação funcional com CDN indisponível;
- edição com referência inativa;
- query compartilhada não sobrescrita pelo localStorage.

### 15.4 Migração

- fixture representativa de cada migration SQLite;
- dry-run não escreve;
- rerun idempotente;
- contagens/somas/órfãos/mídia conferidos;
- relatório de exceções;
- ensaio de rollback.

Aceite de produção:

- nenhuma rota de negócio anônima;
- nenhuma credencial/dado real no Git;
- `npm ci`, build e testes passam;
- MySQL e migrations saudáveis;
- dados legados reconciliados;
- smoke test de todas as rotas;
- backup e restauração testados;
- logs sem segredos;
- domínio HTTPS e cookies seguros.

## 16. Fases de implementação

1. Scaffold, config/env, Express testável, MySQL, migrations, health e CI.
2. Auth, sessão, papéis, CSRF e auditoria.
3. Catálogos/mídia e seeds idempotentes.
4. Vendas, validações, soft delete e ranking/eventos.
5. Metas corrigidas e prevenção de overlap.
6. Dashboard com métricas/ranges consistentes.
7. Excel seguro com dry-run e round-trip.
8. Script de migração SQLite -> MySQL e reconciliação.
9. Responsividade, acessibilidade, performance e SSE.
10. Staging, ensaio de corte, produção e observabilidade.

Cada fase termina com testes; não deixar auth/segurança apenas para o fim.

## 17. Arquivos do projeto atual que servem de referência

- Bootstrap: `dashboard_empresa/src/server.js`.
- Rotas: `dashboard_empresa/src/routes/`.
- Regras/API: `dashboard_empresa/src/controllers/`, `services/`, `repositories/`, `utils/`.
- Dashboard: `src/services/dashboard.service.js`, `src/repositories/dashboard.repository.js`, `src/views/components/dashboard_overview.ejs`.
- Formulários/filtros: `src/views/components/`.
- Páginas: `src/views/pages/`.
- CSS: `src/public/css/`.
- Banco: `src/database/migrations/`, `seeds/001_initial_data.js`.
- Excel: `src/services/excel.service.js` e controllers/routes correspondentes.
- Upload: `src/middlewares/upload.middleware.js`.

Não usar `banco.txt`, bancos da raiz, `.rar`, exports públicos ou migrations antigas como desenho do novo schema.

## 18. Prompt pronto para o outro modelo

Copie este documento para a raiz do novo repositório e envie:

> Implemente do zero o Dashboard Avance conforme `RECRIACAO_HOSTINGER.md`. Leia o arquivo inteiro antes de alterar código. A aplicação deve ser um único monólito Node.js/Express/EJS, um único deploy Hostinger e MySQL via Knex. Siga as fases na ordem, mantenha um plano atualizado e entregue código funcional, migrations, seeds idempotentes, testes, `.env.example`, README de desenvolvimento/deploy e script de migração legado. Trate a seção “Bugs que não devem ser recriados” como requisitos obrigatórios. Não commite dados, uploads reais, exports, bancos ou segredos. Rode testes/build após cada fase relevante. Quando houver ambiguidade de negócio, use as decisões recomendadas deste documento e registre a escolha no README; só interrompa para perguntar se a decisão alterar dados existentes de forma irreversível.

### Entregáveis finais esperados do outro modelo

- aplicação completa;
- migrations MySQL baseline e subsequentes;
- seeds de referência idempotentes;
- admin bootstrap seguro;
- script de inspeção/migração SQLite;
- testes unitários, integração, E2E crítico e fixture legado;
- `.env.example` e `.gitignore` corretos;
- README local + Hostinger + backup/rollback;
- checklist de corte preenchido;
- relatório de reconciliação dos dados;
- nenhuma pendência crítica de segurança conhecida.
