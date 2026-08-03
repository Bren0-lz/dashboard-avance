# Contrato visual e guia de CSS — Dashboard Avance Vip

> Handoff visual para acompanhar o arquivo **RECRIACAO_HOSTINGER.md**.
>
> Este documento traduz os prints e o CSS do sistema original em regras implementáveis no novo repositório. Ele descreve composição, dimensões, cards, cores, tipografia, estados, responsividade e critérios de aceite.

## 1. Como usar este documento

O outro modelo deve tratar este arquivo como um **contrato visual**, e não como uma sugestão genérica de design.

Ordem de precedência:

1. os prints fornecidos definem composição, hierarquia e aparência;
2. este documento define os valores e comportamentos que não ficam evidentes apenas pelos prints;
3. **RECRIACAO_HOSTINGER.md** define regras funcionais, dados, rotas, banco e deploy;
4. o código antigo pode ser consultado para casos de borda, mas seus defeitos listados aqui não devem ser copiados.

Termos normativos:

- **DEVE**: requisito de aceite;
- **NÃO DEVE**: comportamento proibido;
- **PODE**: liberdade de implementação que não altera a aparência;
- “desktop canônico”: viewport igual ou superior a 1.501 px, tendo 1.920 px como principal referência;
- “administrativo”: Vendedoras, Serviços, Tipos de Venda, Operadoras, Vendas, Metas e Banco;
- “dashboard”: somente a página Início.

Os prints de Lista de Vendas e do formulário de Metas parecem ter sido capturados com o zoom do navegador abaixo de 100%. Isso **não** autoriza diminuir a fonte raiz, aplicar zoom CSS, transform: scale ou reduzir o container global. A referência continua sendo fonte de 16 px, barra de aproximadamente 73 px e container administrativo de 1.200 px.

## 2. Resultado visual esperado

O sistema possui duas linguagens visuais deliberadamente diferentes:

| Contexto         | Aparência                                      |               Largura | Densidade            |
| ---------------- | ---------------------------------------------- | --------------------: | -------------------- |
| Início/dashboard | navy escuro, glass, bordas e faixas neon       | quase toda a viewport | alta                 |
| CRUDs e Metas    | claro, branco, cinza-azulado, sombra discreta  | container de 1.200 px | média                |
| Vendas           | tema administrativo claro                      | quase toda a viewport | muito alta na tabela |
| Banco/Excel      | tema administrativo claro, cards independentes | container de 1.200 px | média                |
| Navbar e rodapé  | navy escuro compartilhado                      |      viewport inteira | baixa                |

Regra central: **não uniformizar os dois temas**. Os cards neon pertencem apenas ao dashboard; os cards brancos pertencem ao administrativo.

### 2.1 Mapa das telas

| Rota/tela      | Composição principal                                                 |
| -------------- | -------------------------------------------------------------------- |
| Início         | grade superior de KPIs, resultado de vendas, períodos e velocímetros |
| Vendedoras     | título + hub branco com abas Lista/Cadastrar                         |
| Serviços       | título + hub branco com abas Lista/Cadastrar                         |
| Tipos de Venda | título + hub branco com abas Lista/Cadastrar                         |
| Operadoras     | título + hub branco com abas Lista/Cadastrar                         |
| Vendas         | título + hub branco largo com Lista/Cadastrar                        |
| Metas          | título + hub branco com Lista/Cadastrar                              |
| Banco          | título + dois cards lado a lado e card de orientações abaixo         |

## 3. Arquitetura de CSS recomendada

Não carregar o CSS de 48 KB do dashboard em todas as páginas. O novo projeto deve separar pelo menos:

    styles/
      tokens.css
      reset.css
      core.css
      shell.css
      components/
        buttons.css
        badges.css
        forms.css
        tables.css
        tabs.css
        feedback.css
        media.css
      pages/
        admin.css
        sales.css
        excel.css
        dashboard.css

Entradas recomendadas:

- **core.css**: reset, tokens, body, navbar, rodapé e componentes compartilhados;
- **admin.css**: cabeçalho de página, hub, listas, formulários e filtros;
- **sales.css**: exceções de largura e tabela de Vendas;
- **excel.css**: composição do Banco;
- **dashboard.css**: carregado somente na rota inicial ou completamente escopado em **.theme-dashboard**.

Pode-se usar CSS Modules, styled components ou outro mecanismo, desde que o resultado calculado seja o mesmo. Se usar CSS global, escopar todas as regras escuras sob **.dashboard-page** ou **.theme-dashboard**.

É recomendável declarar camadas:

    @layer reset, tokens, base, layout, components, pages, utilities;

Isso evita a quantidade de !important existente na tabela antiga.

O antigo prefixo **sales-hub-** é usado por todos os CRUDs. No novo projeto, o nome semântico recomendado é **management-hub-**. O nome interno pode mudar; a geometria não.

## 4. Fundação global

### 4.1 Reset

Aplicar:

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html {
      font-size: 16px;
    }

    body,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p,
    ul,
    ol,
    figure {
      margin: 0;
      padding: 0;
    }

    ul,
    ol {
      list-style: none;
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

Imagens devem ser block e ter max-width: 100%. O body não pode produzir rolagem horizontal global.

### 4.2 Tipografia

A fonte original e mais fiel aos prints é:

    Arial, Helvetica, sans-serif

Não trocar por Inter, Roboto ou uma fonte arredondada durante a recriação visual.

Escala administrativa:

| Elemento            |                  Tamanho |    Peso | Cor                    |
| ------------------- | -----------------------: | ------: | ---------------------- |
| H1 da página        |                    32 px |     700 | #1e293b                |
| H2 de seção/card    |                    24 px |     700 | #1e293b                |
| Subtítulo da página |                    16 px |     400 | #64748b                |
| Texto comum         |                    16 px |     400 | #1f2937                |
| Label               |                    16 px |     600 | #64748b dentro de card |
| Tab                 |                 14,72 px |     800 | variável               |
| Cabeçalho de tabela |                 13,12 px |     800 | #0f172a                |
| Célula de tabela    |                  15,2 px |     400 | #0f172a                |
| Botão pequeno       |                    14 px | 400–600 | branco                 |
| Helper              | aproximadamente 13–14 px |     400 | #64748b                |

Escala do dashboard:

- títulos dos KPIs: 1,02 rem, peso 700–800;
- labels internos: 0,74–0,78 rem;
- números dos KPIs: 1,05–1,1 rem, peso 800–900;
- texto de tabela: 1 rem;
- nome da líder: 1,6 rem, peso 900;
- valores devem usar font-variant-numeric: tabular-nums sempre que possível.

Em mobile, textos auxiliares não devem ficar abaixo de 12 px; para elementos interativos, preferir 14 px ou mais.

### 4.3 Tokens de espaço, raio e sombra

    :root {
      --space-1: 4px;
      --space-2: 8px;
      --space-2-5: 10px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;

      --radius-sm: 8px;
      --radius-control: 10px;
      --radius-tab-link: 12px;
      --radius-card: 14px;
      --radius-media: 16px;
      --radius-dashboard: 18px;
      --radius-timer: 20px;
      --radius-pill: 999px;

      --shadow-card: 0 6px 20px rgba(0, 0, 0, 0.08);
      --container-admin: 1200px;
    }

### 4.4 Paleta administrativa

    :root {
      --admin-bg: #f4f6f8;
      --surface: #ffffff;
      --surface-alt: #f8fafc;
      --text: #1f2937;
      --heading: #1e293b;
      --table-text: #0f172a;
      --muted: #64748b;
      --border: #cbd5e1;
      --border-soft: #e5e7eb;

      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary: #475569;
      --secondary-hover: #334155;
      --success: #15803d;
      --success-hover: #166534;
      --warning: #d97706;
      --warning-hover: #b45309;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
    }

### 4.5 Paleta do dashboard

    :root {
      --dash-bg-top: #07101f;
      --dash-bg-middle: #0a1330;
      --dash-bg-bottom: #080f24;
      --dash-card-top: rgba(16, 24, 48, 0.88);
      --dash-card-bottom: rgba(8, 15, 32, 0.94);
      --dash-border: rgba(255, 255, 255, 0.10);
      --dash-text: #f8fbff;
      --dash-text-strong: #ffffff;
      --dash-text-muted: rgba(220, 230, 247, 0.72);

      --accent-morning-a: #67e8f9;
      --accent-morning-b: #2563eb;
      --accent-afternoon-a: #f472b6;
      --accent-afternoon-b: #a855f7;
      --accent-day-a: #2dd4bf;
      --accent-day-b: #22c55e;
      --accent-revenue-a: #60a5fa;
      --accent-revenue-b: #6366f1;
      --accent-operator-a: #8b5cf6;
      --accent-operator-b: #ec4899;
      --accent-goal: #facc15;
      --accent-winner: #ffe58a;
    }

## 5. Casca compartilhada

### 5.1 Body e fluxo da página

O body deve ter:

- min-height: 100vh;
- display: flex;
- flex-direction: column;
- fundo administrativo #f4f6f8;
- cor #1f2937;
- overflow-x: hidden.

O main deve ter flex: 1 para empurrar o rodapé ao fim da viewport em páginas curtas. O rodapé não é fixed e nunca pode encobrir conteúdo.

### 5.2 Navbar

A barra superior ocupa toda a largura e é estática, não sticky, nos prints.

Geometria desktop:

- display flex;
- justify-content: space-between;
- align-items: center;
- gap: 16 px;
- padding: 16 px 24 px;
- altura resultante: aproximadamente 72–76 px;
- logo à esquerda com 40 px de altura e aproximadamente 154 px de largura;
- menu à direita, flex, gap 16 px, com wrap permitido.

Fundo:

    radial-gradient(circle at left center,
      rgba(59, 130, 246, 0.18), transparent 24%),
    radial-gradient(circle at center top,
      rgba(168, 85, 247, 0.18), transparent 28%),
    linear-gradient(180deg,
      rgba(10, 17, 39, 0.96) 0%,
      rgba(7, 12, 29, 0.98) 100%)

Complementos:

- border-bottom: 1 px solid rgba(255,255,255,.10);
- shadow principal: 0 10px 24px rgba(0,0,0,.28);
- glow azul muito discreto;
- backdrop-filter: blur(12px), com fallback de fundo opaco.

Links:

- padding 8 px 12 px;
- raio 12 px;
- texto rgba(240,247,255,.88);
- borda transparente;
- transição de 200 ms;
- no hover, sobe 1 px;
- no ativo e hover, recebe gradiente azul/roxo translúcido, borda branca 10%, texto branco e glow discreto.

Somente o item correspondente à rota atual recebe o estado ativo.

Em telas de até 900 px, o comportamento mínimo fiel é navbar em coluna, alinhada à esquerda, e menu com wrap. Uma melhoria aceita é um menu recolhível acessível, desde que a aparência desktop permaneça idêntica e o botão tenha aria-expanded.

### 5.3 Fundo administrativo

O fundo é quase branco, com halos muito leves, fixos atrás do conteúdo:

    radial-gradient(circle at top left,
      rgba(59, 130, 246, 0.10), transparent 24%),
    radial-gradient(circle at top right,
      rgba(168, 85, 247, 0.10), transparent 26%),
    radial-gradient(circle at bottom center,
      rgba(45, 212, 191, 0.06), transparent 24%)

Não usar manchas saturadas, textura, ruído ou degradê cinza forte.

### 5.4 Rodapé

Geometria:

- largura total;
- padding 20 px 24 px;
- altura visual aproximada de 58–61 px;
- texto centralizado em rgba(220,230,247,.72).

Fundo:

    linear-gradient(
      180deg,
      rgba(8, 14, 30, 0.82) 0%,
      rgba(6, 10, 24, 0.94) 100%
    )

Usar borda superior branca 8%, sombra suave para cima e blur com fallback. Em páginas curtas, o rodapé encosta no fundo da viewport; em páginas longas, aparece após o conteúdo.

## 6. Layout administrativo padrão

### 6.1 Container e cabeçalho

    .page-content {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      flex: 1;
    }

Em viewport de 1.920 px:

- o container começa em x = 360 px;
- o conteúdo útil começa em x = 384 px;
- o card mede 1.152 px;
- o conteúdo útil termina em x = 1.536 px.

O cabeçalho da página:

- padding vertical de 2 px;
- margin-bottom de 24 px;
- H1 com margin-bottom de 8 px;
- subtítulo #64748b.

### 6.2 Card base claro

    .admin-card {
      background: #fff;
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, .08);
      color: #1f2937;
    }

Não adicionar borda escura ou sombra pesada. A superfície parece elevada, mas leve.

### 6.3 Hub com abas

O hub é um card externo branco:

- width: 100%;
- display: grid;
- gap: 20 px;
- padding: 20 px;
- raio 14 px;
- sombra leve.

Wireframe:

    ┌────────────────────────────────────────────────────────────┐
    │ [Lista de ...] [Cadastrar ...]                             │
    │ ────────────────────────────────────────────────────────── │
    │                                                            │
    │  conteúdo da aba ativa                                     │
    │                                                            │
    └────────────────────────────────────────────────────────────┘

A linha de tabs:

- display flex;
- gap 10 px;
- wrap;
- padding-bottom 6 px;
- border-bottom 1 px rgba(148,163,184,.18).

Tab inativa:

- padding 10 px 16 px;
- formato pill;
- fonte 0,92 rem / 800;
- fundo rgba(148,163,184,.08);
- borda rgba(148,163,184,.24);
- texto #475569.

Tab ativa:

- gradiente vertical rgba(59,130,246,.18) para rgba(37,99,235,.16);
- borda rgba(59,130,246,.34);
- texto #1d4ed8;
- aro interno azul 8%.

A tab de lista abre por padrão. Em edição, a segunda abre e seu texto muda para “Editar ...”. Painéis inativos ficam hidden/display none.

Os controles devem usar semântica real de tabs: role tablist/tab/tabpanel, aria-selected, aria-controls, teclado Left/Right/Home/End e foco visível.

### 6.4 Cabeçalho da lista

Logo abaixo das tabs:

- título e descrição à esquerda;
- botão “Mostrar filtros” à direita;
- display flex, justify-content space-between, align-items center;
- gap 16 px;
- margin-bottom 16 px.

O botão é secundário pequeno. Ao abrir, muda para “Ocultar filtros” e atualiza aria-expanded.

### 6.5 Painel de filtros

Começa fechado. Quando aberto:

- margin-bottom 18 px;
- padding 18 px;
- raio 16 px;
- fundo #f8fafc;
- borda 1 px rgba(148,163,184,.14).

O formulário usa gap 18 px. A grade desktop possui duas colunas iguais, gap vertical 16 px e horizontal 18 px. Limpar fica à esquerda e Filtrar à direita.

Em até 720 px, a grade vira uma coluna e as ações ocupam a largura disponível.

## 7. Componentes administrativos

### 7.1 Tabela padrão

O wrapper deve ter width: 100% e overflow-x: auto.

A tabela:

- width: 100%;
- fundo branco;
- sem zebra;
- sem borda externa pesada;
- sem células em formato de card;
- separadores horizontais suaves.

Cabeçalho:

- fundo #f8fafc;
- texto #0f172a;
- fonte 0,82 rem / 800;
- padding 12 px;
- alinhamento à esquerda.

Células:

- texto #0f172a;
- fonte 0,95 rem;
- padding 12 px;
- vertical-align middle;
- border-bottom 1 px #e5e7eb.

Primeira coluna genérica: 90 px. Coluna de ações genérica: 280 px. As ações usam flex, gap 8 px e wrap.

Não adicionar hover ou zebra no administrativo, pois não aparecem nos prints. Um hover quase imperceptível é aceitável apenas se não mudar a captura em repouso.

### 7.2 Fotos e ícones nas tabelas

Invólucro:

- 46 x 46 px;
- padding 6 px;
- raio 14 px;
- gradiente branco para #f8fafc;
- borda rgba(148,163,184,.22);
- aro interno branco discreto.

Imagem:

- 30 x 30 px;
- logos e ícones: object-fit contain;
- foto de vendedora: object-fit cover, recorte central;
- adicionar width e height no HTML para evitar layout shift.

No preview de edição:

- foto: 120 x 120 px, raio 16, cover;
- ícone: caixa 58 x 58, padding 8, imagem 40 x 40 contain.

### 7.3 Badges

Badge base:

- inline-flex centralizado;
- padding 4 px 10 px;
- raio pill;
- 0,85 rem / 600;
- line-height 1,2;
- white-space nowrap.

| Uso                                  | Fundo                 | Texto   |
| ------------------------------------ | --------------------- | ------- |
| Ativo, Ativa, Com documento          | rgba(34,197,94,.14)   | #15803d |
| Inativo, Sem documento, Fora da base | rgba(100,116,139,.14) | #475569 |
| Manhã, Da base                       | rgba(59,130,246,.14)  | #1d4ed8 |
| Tarde                                | rgba(245,158,11,.16)  | #b45309 |

Tipos de Venda usam o badge de status maior:

- min-width 78 px;
- padding 6 px 12 px;
- 0,78 rem / 800;
- borda verde ou vermelha translúcida.

O texto deve sempre acompanhar a cor; não transmitir estado apenas por cor.

### 7.4 Botões

Base:

- inline-flex;
- centralizado nos dois eixos;
- padding 10 px 16 px;
- raio 10 px;
- sem borda visível;
- cursor pointer;
- transição 200 ms;
- texto branco.

Variantes:

| Ação                                      | Cor normal | Hover   |
| ----------------------------------------- | ---------- | ------- |
| Salvar, Atualizar, Filtrar, Aplicar       | #2563eb    | #1d4ed8 |
| Editar, Limpar, Cancelar, Mostrar filtros | #475569    | #334155 |
| Ativar                                    | #15803d    | #166534 |
| Inativar                                  | #d97706    | #b45309 |
| Excluir                                   | #dc2626    | #b91c1c |

Botão pequeno:

- padding 8 px 12 px;
- fonte 0,875 rem.

Tipos de Venda podem usar min-height 36 px, padding 8 px 14 px e raio 12 px, como no print.

Na lista de Tipos de Venda, “Inativar” aparece cinza; conservar essa variante específica.

Todos os botões precisam de:

- hover;
- active;
- focus-visible;
- disabled com opacity aproximada de 0,55 e cursor not-allowed;
- loading com aria-busy sem mudar bruscamente a largura;
- alvo de toque de pelo menos 44 x 44 px em telas pequenas.

### 7.5 Formulários

Todos os formulários dos prints são **uma coluna, inclusive no desktop**.

Estrutura:

- form display grid;
- grid-template-columns: 1fr;
- gap 16 px;
- grupo display grid;
- gap entre label e controle: 8 px.

Controles:

- width 100%;
- min-width 0;
- padding 10 px 12 px;
- borda 1 px #cbd5e1;
- raio 10 px;
- fundo branco;
- altura visual aproximada 40–42 px;
- texto escuro.

O input file usa padding 8 px 10 px. O controle nativo varia por navegador. Se comparação pixel a pixel multi-browser for obrigatória, criar um file picker customizado acessível que mantenha “Escolher arquivo” e o nome do arquivo. Caso contrário, Chrome/Edge é a baseline visual.

Grupo de horário:

    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;

O botão “Agora” fica à direita do input.

Ações:

- display flex;
- gap 12 px;
- wrap;
- justify-content flex-end;
- no create, “Salvar” fica à direita;
- no edit, “Cancelar” à esquerda e “Atualizar” à direita.

A aba de formulário contém um **segundo card branco interno**, com os mesmos 20 px de padding, raio 14 e sombra suave. O duplo nível visual dos prints é intencional.

### 7.6 Feedback, vazio e loading

Sucesso:

- fundo #dcfce7;
- texto #166534;
- padding 12 px;
- raio 10 px.

Erro:

- fundo #fee2e2;
- texto #991b1b;
- padding 12 px;
- raio 10 px.

Usar role status/aria-live polite para sucesso e role alert para erro. Erros de campo usam aria-invalid e aria-describedby.

Estado vazio administrativo:

- fundo #f8fafc;
- borda tracejada #cbd5e1;
- texto #64748b;
- padding 28 px 16 px;
- raio 10–14 px;
- centralizado.

Estado vazio do dashboard deve ser outra variante, com superfície navy e texto claro. Não reutilizar a variante clara sobre fundo escuro.

Loading deve reservar a altura final. Skeletons, se usados, são discretos e ficam estáticos com prefers-reduced-motion.

## 8. Descrição tela por tela — administrativo

### 8.1 Vendedoras — lista

Composição:

1. H1 “Vendedoras”;
2. subtítulo;
3. hub branco;
4. tabs “Lista de Vendedoras” e “Cadastrar Vendedora”;
5. cabeçalho “Lista de Vendedoras”, descrição e botão de filtros;
6. tabela.

Colunas, nesta ordem:

| Coluna            | Exibição                         |
| ----------------- | -------------------------------- |
| ID                | número                           |
| Foto              | thumbnail 46 x 46                |
| Nome da Vendedora | texto                            |
| Status            | badge Ativa/Inativa              |
| Data de Criação   | data e hora                      |
| Ações             | Editar, Inativar/Ativar, Excluir |

### 8.2 Vendedoras — formulário

Card interno com:

1. título “Cadastrar Vendedora” ou “Editar Vendedora”;
2. descrição;
3. Nome da Vendedora;
4. Foto da Vendedora;
5. preview da foto atual apenas na edição;
6. Status;
7. Cancelar na edição e Salvar/Atualizar à direita.

### 8.3 Serviços — lista

Colunas:

| Coluna          | Exibição                         |
| --------------- | -------------------------------- |
| ID              | número                           |
| Ícone           | thumbnail com contain            |
| Nome do Serviço | texto                            |
| Status          | Ativo/Inativo                    |
| Data de Criação | data e hora                      |
| Ações           | Editar, Inativar/Ativar, Excluir |

### 8.4 Serviços — formulário

Campos empilhados:

1. Nome do Serviço;
2. Status;
3. Ícone do Serviço;
4. helper “Formatos aceitos: JPG, PNG ou WEBP.”;
5. preview do ícone atual na edição;
6. ações.

### 8.5 Operadoras

A geometria é igual à de Serviços.

Lista:

- ID;
- Ícone;
- Nome da Operadora;
- Status;
- Data de Criação;
- Ações.

Formulário:

- Nome;
- Status;
- Ícone;
- helper;
- preview na edição;
- ações.

### 8.6 Tipos de Venda

Lista:

| Coluna | Observação                      |
| ------ | ------------------------------- |
| Ícone  | caixa 46 x 46                   |
| Tipo   | nome em minúsculo conforme dado |
| Status | badge maior com borda           |
| Ações  | Editar, Inativar, Excluir       |

Não inserir visualmente ID nem Data de Criação nessa tabela.

Formulário:

- Nome do Tipo de Venda;
- Status;
- Ícone;
- helper;
- preview na edição;
- ações.

### 8.7 Metas — lista

Colunas:

1. ID;
2. Tipo;
3. Período;
4. Vendedora;
5. Valor;
6. Início;
7. Fim;
8. Ações.

Ações: somente Editar e Excluir.

Valores monetários não quebram linha. Vendedora ausente aparece como hífen.

### 8.8 Metas — formulário

Todos os campos são empilhados:

1. Tipo da Meta;
2. Período;
3. Vendedora, exibida apenas para meta individual;
4. Meta da Manhã, quando aplicável;
5. Meta da Tarde, quando aplicável;
6. Meta de Receita — Portabilidade / Base;
7. Meta de Receita — Portabilidade / Fora da Base;
8. Meta de Receita — Novo / Base;
9. Meta de Receita — Novo / Fora da Base;
10. helper de que os valores são faturamento em reais;
11. Meta Total;
12. Data Inicial;
13. Data Final;
14. ações.

Campos condicionais devem sumir sem deixar buraco no grid. O formulário não deve ser reduzido a aproximadamente 865 px por causa do zoom observado em um print; segue o container canônico.

### 8.9 Vendas — lista

Esta é a principal exceção de largura.

O main:

- ocupa a largura da viewport;
- mantém padding de 24 px;
- não usa max-width 1.200 px;
- não usa width: fit-content no body;
- não faz navbar e rodapé crescerem horizontalmente.

O card branco ocupa a largura útil. O wrapper da tabela é o único elemento com overflow-x: auto.

As 16 colunas são:

1. Vendedora;
2. Serviço;
3. Operadora;
4. CNPJ;
5. Razão Social;
6. Contato;
7. Fechou;
8. Data;
9. Horário;
10. Turno;
11. Doc;
12. Origem;
13. Qtd.;
14. Unitário;
15. Total;
16. Ações.

Larguras mínimas práticas:

| Coluna/grupo | Mínimo |
| ------------ | -----: |
| Vendedora    | 100 px |
| Serviço      | 100 px |
| Operadora    | 100 px |
| CNPJ         | 150 px |
| Razão Social | 150 px |
| Contato      | 120 px |
| Fechou       | 110 px |
| Data         |  94 px |
| Horário      |  94 px |
| Turno        |  86 px |
| Documento    | 136 px |
| Origem       | 136 px |
| Quantidade   |  58 px |
| Unitário     |  86 px |
| Total        |  86 px |
| Ações        | 146 px |

A tabela possui min-width aproximada de 1.750 px e white-space nowrap. Ações Editar/Excluir ficam lado a lado. Em viewport menor, a tabela rola dentro do card; html/body, navbar e footer não rolam lateralmente.

Os badges seguem:

- Manhã azul;
- Tarde laranja;
- Com documento verde;
- Sem documento cinza;
- Da base azul;
- Fora da base cinza.

### 8.10 Vendas — formulário

Também usa o main largo e card com 100% da largura útil, mas os campos continuam em uma única coluna:

1. Vendedora;
2. Serviço;
3. Operadora;
4. Tipo da Venda;
5. Data da Venda;
6. Horário da Venda + botão Agora;
7. CNPJ;
8. Razão Social;
9. Telefone de Contato;
10. Nome de Quem Fechou;
11. Possui Documento?;
12. Origem do Cliente;
13. Quantidade;
14. Valor Unitário;
15. Valor Total;
16. Salvar no extremo direito.

Não transformar esse formulário em duas ou três colunas.

### 8.11 Banco — Importar e Exportar Excel

Não usa hub nem tabs.

Wireframe desktop:

    ┌──────────────────── Exportar ────────────────────┐
    │ texto, datas, helper, botão                      │
    └──────────────────────────────────────────────────┘
    ┌──────────────────── Importar ────────────────────┐
    │ texto, arquivo, botão                            │
    └──────────────────────────────────────────────────┘

Na tela larga, os dois cards acima ficam lado a lado em duas colunas iguais:

    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;

Cada card:

- padding 20 px;
- raio 18 px;
- mesma altura por stretch;
- título com margin-bottom 12 px;
- parágrafo line-height 1,5.

Exportar:

- texto explicativo;
- Data inicial;
- Data final;
- helper;
- botão “Baixar arquivo Excel”, visualmente à esquerda abaixo do helper.

Importar:

- texto explicativo;
- file picker;
- botão “Importar arquivo” à direita.

Abaixo, “Orientações” ocupa toda a largura em um terceiro card. A lista tem recuo de 20 px, sem marcadores visíveis no print e gap vertical de 8 px entre itens.

Quando não couberem duas colunas, o grid auto-fit empilha os cards.

## 9. Dashboard escuro — composição completa

### 9.1 Canvas

O main do dashboard:

- width e max-width de 100%;
- padding horizontal herdado de 24 px;
- padding vertical de 16 px;
- não deve ter max-height: 100%.

Fundo:

    radial-gradient(circle at top left,
      rgba(59, 130, 246, 0.14), transparent 26%),
    radial-gradient(circle at top right,
      rgba(168, 85, 247, 0.14), transparent 28%),
    radial-gradient(circle at bottom center,
      rgba(45, 212, 191, 0.08), transparent 28%),
    linear-gradient(
      180deg,
      #07101f 0%,
      #0a1330 38%,
      #080f24 100%
    )

As seções têm 10 px de separação vertical.

### 9.2 Grade superior canônica

Em viewport acima de 1.500 px:

    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: 10px;

Mapa:

    | Manhã 2 | Tarde 2 | Total 2 | Receita 3 | Operadoras 3 | Showcase 4 |

Em 1.920 px, após os 24 px laterais:

- cada card span 2 mede aproximadamente 223–225 px;
- cada card span 3 mede aproximadamente 340–343 px;
- o showcase span 4 mede aproximadamente 458–460 px;
- todos ficam em uma única faixa;
- a altura visual da faixa é aproximadamente 295 px;
- o maior item define a altura e os demais esticam.

### 9.3 Base dos cards do dashboard

    .dashboard-card {
      position: relative;
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, .10);
      background: linear-gradient(
        180deg,
        rgba(16, 24, 48, .88),
        rgba(8, 15, 32, .94)
      );
      box-shadow:
        0 10px 26px rgba(0, 0, 0, .32),
        inset 0 0 0 1px rgba(255, 255, 255, .03),
        0 0 20px rgba(59, 130, 246, .05);
    }

KPIs superiores usam padding 12 px. Uma faixa de 4 px ocupa o topo por pseudo-elemento. O conteúdo fica acima dos gradientes usando stacking context local.

Não reaproveitar o card branco administrativo e depois tentar sobrescrevê-lo; criar um componente escuro próprio.

### 9.4 Manhã, Tarde e Total do dia

Os três possuem a mesma anatomia:

    ┌──────────────── título ───────────── pill ───────┐
    │ ┌──── Com doc ────┐ ┌──── Sem doc ────────────┐ │
    │ │ qtd. / valor     │ │ qtd. / valor             │ │
    │ └──────────────────┘ └──────────────────────────┘ │
    │ ┌──────────── total do período ─────────────────┐ │
    │ └───────────────────────────────────────────────┘ │
    │ ┌ - - - - - meta / estado - - - - - - - - - ┐ │
    │ └───────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────┘

Header:

- flex, space-between, center;
- gap 8 px;
- margin-bottom 10 px;
- título branco;
- pill com padding 5 px 10 px, fonte 0,76 rem / 700.

Mini-cards:

- grid 1fr 1fr;
- gap 8 px;
- margin-bottom 10 px;
- cada célula com padding 8 px, raio 14 px, fundo branco 6%, borda branca 10%.

Bloco total:

- padding 8 px 10 px;
- raio 14 px;
- mesma superfície translúcida.

Bloco da meta:

- margin-top 10 px;
- padding 8 px 10 px;
- raio 14 px;
- borda tracejada;
- o valor fica amarelo #facc15 com glow.

Estados da meta:

| Estado  | Regra funcional           | Fundo     | Borda                |
| ------- | ------------------------- | --------- | -------------------- |
| neutral | meta ausente ou zero      | gray 10%  | gray 30%, tracejada  |
| danger  | progresso abaixo de 90%   | red 14%   | red 40%, tracejada   |
| warning | de 90% até abaixo de 100% | amber 16% | amber 42%, tracejada |
| success | 100% ou mais              | green 14% | green 34%, tracejada |

Variantes:

- Manhã: faixa #67e8f9 para #2563eb, fundo azul profundo, borda cyan 30%;
- Tarde: faixa #f472b6 para #a855f7, fundo roxo profundo, borda rosa 30%;
- Total: faixa #2dd4bf para #22c55e, fundo teal profundo, borda teal 30%.

### 9.5 Metas de receita

Card span 3 com faixa #60a5fa para #6366f1.

Possui título e quatro linhas:

1. Portabilidade / Base;
2. Portabilidade / Fora da base;
3. Novo / Base;
4. Novo / Fora da base.

Cada linha:

- grid label + valor;
- min-height 49 px;
- gap 12 px;
- padding 8 px 10 px;
- raio 12 px;
- fundo branco 5,5%;
- borda branca 9%.

Label:

- 0,76 rem;
- uma linha;
- overflow hidden;
- ellipsis.

Valor:

- 0,92 rem;
- tabular nums;
- nowrap;
- formato “R$ atual / R$ meta”;
- parcela da meta em amarelo.

### 9.6 Operadoras

Card span 3, faixa #8b5cf6 para #ec4899 e halo roxo.

Header:

- título “Operadoras”;
- pill “Participação no dia”.

Legenda:

- grid auto-fit com mínimo 92 px;
- gap 6 px;
- item com padding 5 px 7 px;
- raio 10 px;
- fundo branco 4–7%;
- nome, quantidade e valor;
- textos longos usam ellipsis.

Pizza:

- contêiner com 155 px de altura;
- responsiva, sem preservar aspect ratio;
- padding interno 8 px;
- fatia com borda branca de 2 px;
- hoverOffset 8 px;
- porcentagem branca, 12 px / 800;
- legenda nativa do Chart.js desativada.

Cores:

| Operadora    | Cor     |
| ------------ | ------- |
| TIM          | #2563eb |
| Claro        | #dc2626 |
| Nio          | #22c55e |
| Vivo         | #7c3aed |
| Oi           | #16a34a |
| desconhecida | #475569 |

Sem vendas, mostrar estado vazio escuro centralizado, e não uma pizza vazia.

### 9.7 Showcase: troféu e melhor vendedora

O showcase ocupa span 4 e internamente:

    grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr);
    gap: 10px;

Os dois itens:

- min-height 185 px, mas esticam à altura da linha;
- raio 18 px;
- overflow hidden.

Troféu:

- vídeo local;
- width e height 100%;
- object-fit cover;
- object-position center;
- scale 1.24 intencional para o recorte do print;
- autoplay muted loop playsinline;
- poster obrigatório;
- preload metadata ou none.

Vendedora:

- foto preenche toda a área;
- object-fit cover;
- object-position center top;
- conteúdo absoluto no rodapé;
- gradiente de transparente para navy 96%;
- padding 16 px 12 px 12 px;
- nome 1,08 rem / 900 branco;
- chamada 0,68 rem / 800, uppercase, branca 84%.

Sem foto, usar placeholder dourado com inicial. Sem líder, usar o estado vazio escuro.

### 9.8 Resultado de vendas

O card ocupa a largura inteira:

- padding 16 px;
- raio 18 px;
- radial roxo no topo direito sobre navy;
- borda roxa 18%;
- shadow e halo discretos.

#### Header e filtros

No desktop:

- título à esquerda;
- filtros e meta à direita;
- tudo na mesma faixa;
- gap 16 px.

O form de filtros usa flex, wrap, gap 10 px e align-items end.

Filtros:

1. Período;
2. Vendedora;
3. Documento;
4. Base;
5. Operadora;
6. Serviço;
7. Tipo da venda;
8. Data inicial, apenas no período personalizado;
9. Data final, apenas no período personalizado.

Cada grupo:

- mínimo 140 px;
- flex-basis 140 px;
- label 0,76 rem / 700;
- controle com 38 px de altura;
- padding 8 px 10 px;
- raio 12 px;
- fundo branco 4–7%;
- borda branca 10%;
- texto #f8fbff.

Focus:

- sem outline padrão removido sem reposição;
- borda azul 55%;
- ring de 3 px rgba(96,165,250,.12);
- glow leve.

Botões:

- 38 px de altura;
- Limpar cinza;
- Aplicar em gradiente azul;
- raio 12 px.

À direita, “Meta do mês: ...” usa label claro 0,95 rem / 700 e valor branco 1 rem / 800. Ao filtrar uma vendedora, podem aparecer meta, vendido e falta para bater na mesma área, com wrap.

#### Tabela de ranking

Três colunas:

- Vendedora: 190 px;
- Vendas: flexível;
- Total: 180 px.

Tabela:

- width 100%;
- table-layout fixed;
- border-collapse separate;
- raio 18 px;
- fundo transparente.

Cabeçalho:

- gradiente branco 14% para 8%;
- padding 14 px 18 px;
- 0,96 rem / 800;
- texto #f8fbff.

Linhas comuns:

- gradiente navy;
- células padding 12 px 18 px;
- texto 1 rem;
- separador branco 8%;
- hover clareia discretamente.

Nome:

- rank badge de 32 px para segundo lugar em diante;
- fundo indigo/azul translúcido;
- gap 12 px entre badge e nome.

Vendas:

- faixa horizontal rolável;
- chips sem quebra;
- gap 8 px;
- scrollbar fina e visível;
- não forçar a rolagem para o fim sem indicação.

Chip:

- inline-flex;
- gap 7 px;
- padding 5 px 9 px;
- formato pill;
- superfície branca 5–10%;
- borda branca 10%.

Ícones no chip:

- 28 x 28 px;
- object-fit contain;
- fundo branco;
- raio 4 px;
- sombra pequena.

Origem:

- pill interno com min-height 24 px;
- base em verde;
- fora da base em slate.

Líder:

- linha com gradiente dourado à esquerda que desaparece em navy à direita;
- aro interno dourado;
- glow amarelo;
- nome 1,6 rem / 900 em #fdff8a;
- total em amarelo;
- círculo da coroa 38 x 38 px.

O ícone dentro da coroa deve medir aproximadamente 24–28 px, nunca 400 px.

### 9.9 Faixa inferior

Desktop acima de 1.500 px:

    grid-template-columns: 390px minmax(0, 1fr);
    grid-template-areas: "periods performance";
    gap: 12px;

Os dois cards devem parecer da mesma altura.

#### Períodos

Card esquerdo:

- faixa #7c3aed para #ec4899;
- radial roxo;
- fundo #091024 para #100b29;
- borda e halo roxos;
- padding 10 px.

Caixa interna:

- min-height 200 px;
- padding 16 px 14 px;
- raio 20 px;
- borda branca suave;
- conteúdo centralizado;
- título 0,98 rem / 800;
- dica 0,72 rem;
- timer 2,2 rem / 900.

Estados:

| Período           | Cor          |
| ----------------- | ------------ |
| Neutro/carregando | azul         |
| Manhã             | amarelo      |
| Almoço            | verde        |
| Tarde             | rosa/magenta |
| Encerrado         | cinza        |

Definir fallback para a variável de cor do timer; não deixar custom property inexistente.

#### Ticket médio, UGRs e Velocímetro

Card direito:

- faixa #16a34a para #38bdf8 e #2563eb;
- padding 10 px 12 px;
- fundo navy com radial cyan.

Primeira linha:

- três métricas iguais;
- gap 8 px;
- cada tile min-height 74 px;
- label e valor empilhados.

Métricas:

1. UGR total;
2. Receita;
3. Ticket médio por unidade vendida.

Segunda linha:

- quatro gauges iguais;
- gap 12 px;
- margin-top 10 px.

Tiles:

- padding 10 px;
- raio 18 px;
- fundo #111827 para #0b1220;
- borda branca 8%;
- faixa superior de 3 px.

Ordem e cores:

1. Diária: cyan/azul;
2. Semanal: roxo;
3. Quinzenal: laranja;
4. Mensal: verde/teal.

Gauge:

- 112 x 52 px;
- arco semicircular;
- escala em marcas;
- agulha;
- centro circular;
- percentual 0,76 rem / 900;
- título 0,96 rem / 900;
- meta 0,74 rem.

Fornecer fallbacks antes de color-mix, conic-gradient e mask para navegadores antigos.

## 10. Responsividade

### 10.1 Matriz de breakpoints

| Faixa     | Administrativo                      | Dashboard                                                    |
| --------- | ----------------------------------- | ------------------------------------------------------------ |
| >1500     | container 1200; Vendas largo        | topo 16 colunas; inferior 390 + restante                     |
| 1201–1500 | igual                               | topo 3 colunas; showcase refluído; inferior 2 colunas iguais |
| 1101–1200 | igual                               | métricas de performance 2 colunas; gauges 2                  |
| 901–1100  | igual                               | legenda de operadoras 2 colunas                              |
| 721–900   | navbar refluída; tabelas com scroll | topo e inferior em 1 coluna; KPIs internos 1 coluna          |
| <=720     | tabs, filtros e ações empilhados    | mantém regras de 900 e controles largos                      |
| <=700     | padding pode cair para 16           | showcase, filtros e legenda em 1 coluna                      |

### 10.2 Correção do encaixe intermediário

O CSS antigo, entre 901 e 1.500 px, deixa células vazias porque o showcase ocupa duas colunas após itens unitários. Não reproduzir a lacuna.

Alvo recomendado para a grade de três colunas:

- linha 1: Manhã, Tarde, Total;
- linha 2: Receita ocupando duas colunas e Operadoras uma;
- linha 3: Showcase ocupando as três colunas;
- nenhuma célula vazia.

Uma composição equivalente sem buracos também é aceita.

Em até 900 px:

- todos os cards ficam em uma coluna;
- header dos KPIs vira coluna;
- mini-stats viram uma coluna;
- timer cai para 2 rem;
- métricas e gauges viram uma coluna.

Em até 700 px:

- troféu e foto são empilhados;
- cada mídia tem min-height aproximada de 230 px;
- header do resultado, filtros, ações e legenda são empilhados;
- botões e grupos ocupam 100%.

### 10.3 Regras globais para telas estreitas

- html/body nunca têm rolagem horizontal;
- tabelas e faixas de chips podem rolar em contêiner próprio;
- cards têm min-width: 0;
- nenhum label se sobrepõe a valor;
- imagens não deformam;
- texto monetário não quebra em duas linhas;
- strings longas truncadas oferecem title, tooltip ou acesso ao valor completo;
- em 390 px, padding horizontal de 16 px é recomendado;
- time input mantém input + botão enquanto couber; abaixo disso pode empilhar.

## 11. Interações, acessibilidade e movimento

### 11.1 Focus

Todo link, tab, botão e controle precisa de focus-visible. Referência:

    :focus-visible {
      outline: 3px solid rgba(96, 165, 250, .45);
      outline-offset: 2px;
    }

Em superfícies claras, o ring pode usar #2563eb. Não remover o outline sem substituição.

### 11.2 Semântica

- tabs com roles e teclado;
- botão de filtros com aria-expanded e aria-controls;
- canvas de operadoras com role img, descrição e alternativa textual;
- gauges com aria-label contendo percentual e meta;
- imagens decorativas com alt vazio;
- fotos e logos com alt útil;
- feedback com live region;
- ações destrutivas com confirmação explícita;
- status nunca apenas por cor.

### 11.3 Movimento e áudio

O dashboard tem vídeo, hover, agulhas, flash, confete e áudio. Implementar:

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
      }
    }

Além disso:

- não disparar confete/flash para quem prefere movimento reduzido;
- pausar ou substituir o vídeo decorativo por poster;
- não iniciar áudio sem gesto ou consentimento;
- oferecer mute persistente;
- hover com translateY deve ser desativado nesse modo.

### 11.4 Z-index

Escala recomendada:

| Camada                                        | Z-index |
| --------------------------------------------- | ------: |
| conteúdo normal                               |       0 |
| pseudo-elementos internos                     |     1–4 |
| header de tabela sticky, se usado             |      20 |
| navbar sticky, somente se futuramente exigida |     100 |
| dropdown                                      |     200 |
| overlay                                       |     900 |
| modal                                         |    1000 |
| toast                                         |    1100 |
| celebração                                    |    1200 |

Usar isolation: isolate nos cards com pseudo-elementos. Evitar background fixo com z-index negativo atravessando stacking contexts.

## 12. Assets e fidelidade

Reutilizar ou migrar:

- logo Avance Vip em PNG transparente;
- fotos verticais de vendedoras;
- ícones de operadoras;
- ícones de serviços;
- ícones de tipos de venda;
- ícones de documento e turno;
- coroa;
- vídeo do troféu;
- áudios dos eventos.

Regras:

- logo renderizado a 40 px de altura;
- foto de vendedora: cover, center top no destaque;
- ícones: contain;
- vídeo: cover com recorte validado;
- imagens abaixo da dobra: loading lazy e decoding async;
- topo crítico: não lazy;
- declarar dimensões para impedir CLS;
- gerar thumbnails 64/128 px para ícones enormes;
- comprimir e deduplicar arquivos;
- manter uploads persistentes conforme o guia de Hostinger.

Não depender de fonte externa para atingir o visual. Chart.js e canvas-confetti devem ser dependências locais e versionadas, não CDNs soltos. Fixar configuração, cores e devicePixelRatio do gráfico para regressão visual consistente.

## 13. Defeitos do sistema antigo que não devem ser copiados

1. O dashboard redefine **.u-text-muted** globalmente com cor clara e pode contaminar páginas administrativas. Escopar ao tema escuro.
2. **.empty-state** possui definições conflitantes. Criar variantes light e dark.
3. Regras de tabela estão duplicadas entre arquivos de forms e tables. Deixar uma fonte de verdade.
4. Existem dois tamanhos de botão, **sm** e **small**, sem taxonomia. Unificar internamente.
5. Existem badge e status-badge duplicados. Unificar, preservando as duas dimensões visuais.
6. A página de Vendas usa fit-content e overflow visible no body/main. Isso expande o documento inteiro. O scroll deve pertencer ao wrapper.
7. O ícone da coroa usa width 400 px e height 40x inválido. Corrigir para 24–28 px.
8. A faixa de chips é levada automaticamente ao fim pelo JavaScript, escondendo vendas iniciais. Não fazer autoscroll sem affordance.
9. O wrapper da tabela de ranking usa overflow hidden e pode cortar conteúdo mobile. Usar overflow-x auto ou versão em cards.
10. O breakpoint de 1.500 px gera um terço vazio. Usar áreas explícitas.
11. A cor do timer usa variável sem fallback e recebe uma redefinição magenta solta. Cor deve vir apenas do modificador de estado.
12. max-height: 100% no main do dashboard é inútil e pode causar restrição futura.
13. Regras antigas de cards de troféu/top seller fora do showcase e stat-card não aparecem no markup atual. Não portar CSS morto.
14. Não há estados focus-visible, disabled, loading ou invalid completos. Implementá-los.
15. Não há prefers-reduced-motion. Implementá-lo.
16. color-mix, masks, backdrop-filter e conic-gradient precisam de fallback.
17. O texto de fallback do vídeo contém mojibake. Todo o projeto novo deve ser UTF-8.
18. O arquivo antigo da navbar tem diferença de caixa no nome em alguns includes. Em Linux/Hostinger, nomes e imports devem coincidir exatamente.

## 14. Ordem sugerida de implementação

1. criar reset e tokens;
2. implementar body, container, fundo, navbar e rodapé;
3. criar cards, botões, badges, forms, tabs e feedback;
4. implementar um hub administrativo reutilizável;
5. fechar Vendedoras como tela-padrão;
6. replicar Serviços, Operadoras e Tipos de Venda;
7. implementar Metas;
8. implementar Vendas com largura especial e scroll local;
9. implementar Banco/Excel;
10. criar tema e componentes exclusivos do dashboard;
11. montar grade superior;
12. montar ranking e filtros;
13. montar período, métricas, pizza e gauges;
14. adicionar estados e acessibilidade;
15. validar todos os breakpoints;
16. executar regressão visual.

## 15. Critérios de aceite visual

### 15.1 Viewports obrigatórias

Capturar e comparar:

- 1920 x 1080;
- 1440 x 900;
- 1024 x 768;
- 768 x 1024;
- 390 x 844.

Testar imediatamente antes e depois dos breakpoints de 1.500, 1.200, 1.100, 900, 720 e 700 px.

Tolerância sugerida:

- geometria: 2–4 px;
- tipografia: mesma família, peso e escala;
- cores e gradientes: visualmente equivalentes;
- dados dinâmicos podem ser mascarados no diff;
- não mascarar cards, espaçamento, labels, imagens ou estados.

### 15.2 Checklist compartilhado

- [ ] navbar idêntica em todas as páginas;
- [ ] item atual marcado por pill azul-roxa;
- [ ] logo com 40 px de altura e sem deformação;
- [ ] rodapé no fim, nunca sobreposto;
- [ ] nenhum scroll horizontal em html/body;
- [ ] foco visível em todos os controles;
- [ ] zoom de 200% utilizável;
- [ ] contraste WCAG AA;
- [ ] zero layout shift perceptível;
- [ ] UTF-8 sem caracteres corrompidos;
- [ ] estados vazio, loading, sucesso, erro e disabled coerentes.

### 15.3 Checklist administrativo

- [ ] em 1.920 px, card padrão mede 1.152 px e começa em x aproximado 384;
- [ ] fundo quase branco com halos discretos;
- [ ] outer card e inner form card visíveis;
- [ ] tabs em pill e divisória inferior;
- [ ] formulários permanecem em uma coluna;
- [ ] inputs têm aproximadamente 41 px;
- [ ] Salvar fica à direita;
- [ ] listas não têm zebra;
- [ ] header de tabela é cinza muito claro;
- [ ] ícones de 30 px ficam em caixa de 46 px;
- [ ] filtros começam fechados;
- [ ] Vendas ocupa quase a viewport toda;
- [ ] tabela de Vendas não quebra badges nem valores;
- [ ] o scroll de Vendas fica dentro do card;
- [ ] Excel mostra dois cards em desktop e um em mobile.

### 15.4 Checklist do dashboard

- [ ] em 1.920 px, o topo inteiro fica em uma única linha 2/2/2/3/3/4;
- [ ] gaps superiores são de 10 px;
- [ ] cards da faixa têm a mesma altura, aproximadamente 295 px no cenário do print;
- [ ] todos usam raio 18 px e faixa neon de 4 px;
- [ ] receita possui quatro linhas;
- [ ] operadoras mostra legenda e pizza;
- [ ] vídeo e foto preenchem sem deformar;
- [ ] resultado fica 10 px abaixo e ocupa toda a largura;
- [ ] título, filtros e meta dividem a mesma faixa no desktop;
- [ ] líder possui gradiente e glow dourados;
- [ ] chips não quebram;
- [ ] total fica alinhado à direita;
- [ ] faixa inferior usa 390 px + restante;
- [ ] performance mostra três métricas e quatro gauges em desktop;
- [ ] nenhum card é cortado nos breakpoints.

### 15.5 Cenários de dados obrigatórios

Validar o dashboard com:

- meta não definida;
- progresso abaixo de 90%;
- progresso entre 90% e 99,99%;
- meta batida;
- sem vendas;
- sem operadora;
- sem campeã;
- uma e múltiplas operadoras;
- primeiro, segundo e terceiro lugares;
- muitos chips por vendedora;
- período personalizado com datas;
- timers manhã, almoço, tarde e encerrado;
- gauges em 0%, 50% e 100%.

## 16. Prompt pronto para o outro modelo

Copie a instrução abaixo junto com este arquivo e **RECRIACAO_HOSTINGER.md**:

> Implemente o frontend seguindo integralmente GUIA_VISUAL_CSS.md e use RECRIACAO_HOSTINGER.md para as regras funcionais. Os prints são a fonte de verdade para composição e hierarquia, mas capturas feitas com zoom reduzido não alteram os tokens globais. Preserve dois temas: dashboard escuro e administrativo claro. Reutilize componentes sem uniformizar as aparências. Não copie os defeitos listados no guia. Antes de concluir, gere screenshots nas cinco viewports obrigatórias, compare a geometria e informe qualquer divergência residual.

## 17. Definição de pronto

A recriação visual só está pronta quando:

1. todas as telas listadas existem nos dois estados de aba;
2. cards, tabelas e formulários seguem a geometria descrita;
3. o dashboard reproduz a composição 16-colunas no desktop canônico;
4. Vendas é larga sem expandir o body;
5. temas claro e escuro não vazam entre si;
6. responsividade não cria lacunas, cortes ou sobreposição;
7. acessibilidade e reduced motion estão implementados;
8. os testes visuais das cinco viewports foram executados;
9. os assets são locais, otimizados e compatíveis com o deploy da Hostinger;
10. nenhuma correção visual quebra as regras funcionais do documento principal.
