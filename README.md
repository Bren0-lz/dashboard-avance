# Dashboard Avance

Monólito Node.js 24 / Express 5 / EJS para gestão de vendas, metas e indicadores. Páginas SSR, API `/api/v1`, autenticação, mídia, Excel e eventos SSE são servidos pelo mesmo processo e pelo mesmo deploy. O banco é MySQL via uma única instância Knex.

## Arquitetura

- `src/app.js`: Express testável, sem abrir porta.
- `src/server.js`: valida ambiente, testa MySQL, executa migrations opcionais, bootstrap e shutdown.
- `src/database/migrations`: baseline MySQL em cinco migrations ordenadas.
- `src/database/seeds`: somente catálogos/períodos de referência, por upsert aditivo.
- `src/modules`: auth, users, catálogos, mídia, vendas, metas, dashboard, Excel e auditoria.
- `src/views` e `src/public/assets`: layout EJS único e assets locais; nenhuma CDN.
- `scripts/migrate-legacy-sqlite.js`: inspeção, dry-run e migração idempotente do legado.
- `scripts/verify-deploy.js`: valida estrutura, JS/EJS, CSP e artefatos proibidos.
- `tests`: unitários e integração; MySQL real é habilitado por `TEST_MYSQL=1`.

Não existem CORS global, segunda pool Knex, SQLite de runtime, pasta pública de uploads ou exports persistidos. Fotos e ícones enviados ficam em `media_files` (BLOB) e são entregues por endpoint autenticado com ETag.

## Desenvolvimento local

Requisitos: Node.js 24.x e MySQL 8.x.

```bash
cp .env.example .env
npm ci
npm run migrate:deploy
npm run seed:reference
npm run dev
```

Crie antes o banco/usuário indicados no `.env`. Para o primeiro acesso, preencha temporariamente `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e uma senha de pelo menos 12 caracteres. O admin só é criado quando `users` está vazia. Após o primeiro login, remova as três variáveis e reinicie/redeploye.

Comandos úteis:

```bash
npm run build
npm run test:run
npm run migrate:status
npm run migrate:deploy
npm run migrate:rollback       # apenas desenvolvimento; nunca rollback automático em produção
npm run seed:reference         # idempotente, não apaga dados
npm run legacy:inspect -- --source C:\copia\database.sqlite
npm run legacy:migrate -- --source C:\copia\database.sqlite       # dry-run
npm run legacy:migrate -- --source C:\copia\database.sqlite --apply
```

O servidor escuta `0.0.0.0` em `PORT`. `GET /health/live` não depende do banco; `GET /health/ready` testa `SELECT 1` e migrations pendentes sem expor detalhes.

## Variáveis

Use `.env.example` como contrato. Em produção são obrigatórios senha MySQL e `SESSION_SECRET` aleatório com 32+ caracteres. Segredos ficam no hPanel, nunca no Git/log. O pool padrão é 0–5, adequado ao hosting gerenciado. `AUTO_MIGRATE=true` executa `migrate.latest()` antes do `listen`; falha de migration impede a aplicação de aceitar tráfego.

## Decisões de negócio adotadas

Estas são as decisões recomendadas em `RECRIACAO_HOSTINGER.md`:

- timezone comercial `America/Sao_Paulo`; timestamps técnicos em UTC;
- manhã: 08:00–11:59; almoço 12:00–13:29 sem venda nova; tarde 13:30–17:30;
- vendas históricas no almoço são preservadas e reportadas pela migração;
- dinheiro usa `DECIMAL(14,2)` e `decimal.js`; o servidor recalcula `quantity × unit_value`;
- tipo/origem de metas usa `sale_types.code` imutável (`new`/`portability`), nunca o nome;
- `goal_value` é canônico; turnos e quatro categorias são decomposições paralelas e jamais somadas entre si;
- meta individual existente prevalece sobre geral mesmo quando é zero;
- intervalos de metas no mesmo escopo não podem se sobrepor;
- custom soma metas diárias integralmente contidas no intervalo (regra informada na UI);
- filtros de operadora/serviço/tipo/documento/origem alteram o realizado, não a meta; a UI avisa;
- ranking: receita, unidades, primeira venda mais antiga e ID crescente;
- CNPJ inválido nunca é silenciosamente descartado na migração;
- mídia de baixo volume fica em BLOB com interface isolada para futura migração a object storage.

## Autorização e segurança

Todas as rotas de negócio exigem sessão. Exceções: `/login`, `/health/live` e `/health/ready`.

| Papel      | Acesso                                                |
| ---------- | ----------------------------------------------------- |
| `admin`    | usuários, catálogos, metas, vendas, exclusões e Excel |
| `operator` | consultas e criação/edição de vendas                  |
| `viewer`   | dashboard e consultas                                 |

Sessões ficam no MySQL usando a mesma pool Knex. Cookies são `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Mutações exigem token CSRF; login tem rate limit. Helmet/CSP bloqueia fontes externas e inline, erros 500 são genéricos, request IDs acompanham logs/auditoria e senha/hash/cookie/segredo são sanitizados.

Uploads são limitados em memória, validados por magic bytes e aceitam PNG/JPEG/WebP. Excel exige ZIP/XLSX real, limite de bytes/linhas, headers/referências válidos e preview. A confirmação exige digitar `REPLACE` e substitui dados de negócio em transação. Downloads são streaming, `no-store` e nunca escritos em pasta pública.

Exclusão de vendas/metas é lógica e auditada. Catálogo referenciado é inativado. Relação inativa já usada continua selecionável na edição.

## API e eventos

As APIs ficam em `/api/v1/{dashboard,sellers,services,operators,sale-types,sales,goals,users,excel}`. Erros seguem:

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

Listas aceitam `page` e `page_size` (máximo 100). `GET /api/v1/dashboard/events` é SSE autenticado, aceita `Last-Event-ID` e envia `sale_created`, `ranking_overtake` e `daily_goal_reached`. `/poll` é fallback. O navegador grava o último ID por versão/usuário para consumo idempotente.

## Integracao CRM

Administradores criam e revogam chaves em **Integracoes**. A chave completa aparece uma unica vez e deve ficar somente no cofre de segredos do CRM. Ela permite somente consultar referencias e criar vendas. A API exige `Authorization: Bearer <chave>` e aceita ate 120 requisicoes por minuto por chave.

1. Consulte `GET /api/v1/integration/references` para obter os IDs ativos de `sellers`, `services`, `operators` e `sale_types`.
2. Envie `POST /api/v1/integration/sales` com os campos da venda normal e `external_sale_id`, o ID imutavel da venda no CRM.

```powershell
$apiKey = 'dav_live_<prefixo>_<segredo>'
$headers = @{ Authorization = "Bearer $apiKey" }
Invoke-RestMethod -Method Get -Uri 'https://seu-dominio/api/v1/integration/references' -Headers $headers

$body = @{ external_sale_id = 'crm-sale-12345'; seller_id = 1; service_id = 2; operator_id = 3; sale_type_id = 1; sale_date = '2026-07-28'; sale_time = '14:30'; cnpj = '07404596000134'; company_name = 'Empresa Exemplo'; phone = '11999999999'; closed_by_name = 'Nome'; quantity = 1; unit_value = '99.90'; has_doc = $true; is_base_sale = $false; notes = $null } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'https://seu-dominio/api/v1/integration/sales' -Headers $headers -ContentType 'application/json' -Body $body
```

Uma venda nova retorna `201`. Reenviar o mesmo `external_sale_id` com a mesma chave retorna `200` e `idempotent: true`, sem duplicar venda, auditoria ou evento. A importacao Excel limpa o ledger de idempotencia junto das vendas; apos uma restauracao, o CRM deve reenviar somente vendas ainda nao presentes.

## Excel

O export usa o schema 3, com cabeçalhos em português, e contém: Vendedoras, Serviços, Operadoras, Tipos de Venda, Períodos de Meta, Metas, Metas Excluídas, Vendas, Vendas Excluídas e Metadados. Registros ativos e excluídos ficam em abas separadas, inclusive nas exportações por intervalo. A importação restaura esse histórico sem reativá-lo e continua aceitando backups antigos com registros misturados nas abas principais ou cabeçalhos técnicos. Metadados registra schema, versão, UTC e timezone. O round-trip automatizado cobre todas as quatro metas categóricas, origem, total e demais campos atuais.

## Migração SQLite → MySQL

Trabalhe apenas com cópias somente leitura e backups fora do Git.

1. Passe cada candidato com `--source` e execute `legacy:inspect`.
2. Compare schema, migrations, contagens, min/max, receita e unidades. A escolha automática usa evidências; empate bloqueia.
3. Execute `legacy:migrate` sem `--apply`. Revise JSON: mojibake, CNPJ, mídia ausente, almoço, total histórico divergente e períodos legados.
4. Períodos `morning/afternoon` bloqueiam a escrita e exigem revisão manual.
5. Rode baseline/seed no MySQL vazio, faça backup e então repita com `--apply`.
6. A tabela `data_migrations` torna o rerun idempotente pelo SHA-256 da origem.
7. Confira contagens, receita, unidades, metas, órfãos e uma amostra determinística antes do corte.

O total histórico é preservado mesmo se divergir de quantidade × unitário, com ocorrência no relatório. O script não desliga FKs globalmente. Arquivos legados não são adicionados ao repositório.

## Deploy único na Hostinger

1. Use plano Business/Cloud com Node Web App e crie banco/usuário MySQL no hPanel.
2. Conecte este repositório; `package.json` deve permanecer na raiz.
3. Selecione Node 24.x. Build: `npm run build`; start: `npm start`; entry: `src/server.js`.
4. Cadastre as variáveis do `.env.example`; use `APP_URL=https://...`, `TRUST_PROXY=1`, `AUTO_MIGRATE=true`.
5. Faça primeiro deploy com bootstrap admin, entre e troque a senha; remova as variáveis bootstrap e redeploye.
6. Teste live/ready, login, papéis, CRUDs, mídia, dashboard, SSE e Excel.
7. Rode a migração final a partir de uma máquina autorizada. Em Remote MySQL libere somente o IP temporário e remova após o corte.
8. Configure domínio/SSL e confirme cookie `Secure`.

O processo trata SIGTERM/SIGINT: para de aceitar requests, fecha HTTP/Knex e força saída após 10 s.

## Backup, restore e rollback

Antes de cada alteração de schema ou importação, gere dump consistente do MySQL e teste a restauração em outro banco. Armazene dumps criptografados fora do Git com retenção definida. Não use `migrate:rollback` automaticamente em produção.

Rollback de aplicação: redeploy do release anterior. Migrations seguem expand/contract para manter compatibilidade. Rollback de dados: coloque a aplicação em manutenção, restaure o snapshot validado em um banco novo, reconcilie contagens/somas e aponte as variáveis somente depois do aceite.

## Checklist de corte

- [ ] Banco e usuário de produção criados com privilégio mínimo.
- [ ] Backup SQLite/uploads e checksums guardados fora do Git.
- [ ] Dry-run legado sem divergência crítica e exceções aprovadas.
- [x] `npm ci`, `npm run build` e `npm run test:run` verdes localmente (integra��o MySQL preparada no CI).
- [ ] Migrations/seed executados duas vezes sem perda de dados.
- [ ] Bootstrap admin removido após primeiro login.
- [ ] Sistema antigo em somente leitura; snapshot final concluído.
- [ ] Contagens, receita, unidades, metas, mídia e amostra reconciliadas.
- [ ] Smoke: health, login/logout, RBAC/CSRF, CRUD, dashboard, SSE e Excel.
- [ ] Testes manuais em 320, 768 e 1440 px e teclado básico concluídos.
- [ ] HTTPS, cookie Secure, logs sem segredos e alertas operacionais verificados.
- [ ] Restore MySQL e procedimento de rollback ensaiados.
- [ ] Regra temporária de Remote MySQL removida.

## Testes

`npm run test:run` cobre horários, ranges, timezone, CNPJ, dinheiro, metas, ranking, progresso, mídia, Excel, SSE, segurança e inspeção legada. Com `TEST_MYSQL=1`, a suíte também cria migrations do zero, executa seed duas vezes e valida sessão/CSRF/RBAC contra MySQL real. O workflow CI executa tudo em Linux case-sensitive com MySQL 8.4, detectando inclusive diferenças como `navbar.ejs`.

## Decisões de interface

- O dashboard usa tema escuro isolado e largura integral; as telas administrativas usam tema claro e contêiner de até 1200 px.
- Em telas até 900 px, a navegação vira menu recolhível e o dashboard passa a uma coluna. O destaque interno empilha em 700 px.
- O código imutável de serviços, operadoras e tipos de venda é gerado no backend a partir do nome. Ele não aparece no formulário, conforme a composição visual de referência, e não depende de JavaScript.
- Vendas mantêm o tipo de venda no formulário e nas regras, mas a coluna foi omitida da listagem visual conforme o guia. Tabelas largas rolam apenas dentro do próprio contêiner.
- A validação visual cobre 1920×1080, 1440×900, 1024×768, 768×1024 e 390×844, além dos limites 1500, 1200, 1100, 900, 720 e 700 px. Artefatos locais ficam em `tmp/visual-validation/` e não devem ser versionados.
