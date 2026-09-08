"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  specs,
  createBackupWorkbook,
  createReportWorkbook,
  exportData,
  parseWorkbook,
  createPreview,
  confirmImport,
} = require("../../src/modules/excel/excel.service");
const ExcelJS = require("exceljs");
const knex = require("knex");
const {
  specs: legacySpecs,
} = require("../../src/modules/excel/legacy-workbook");

function backupFixture() {
  return {
    sellers: [{ id: 1, full_name: "Teste", is_active: true }],
    services: [{ id: 1, code: "internet", name: "Internet", is_active: true }],
    operators: [{ id: 1, code: "vivo", name: "Vivo", is_active: true }],
    sale_types: [
      { id: 1, code: "new", name: "Novo", is_active: true },
      { id: 2, code: "portability", name: "Portabilidade", is_active: true },
    ],
    goal_periods: [{ id: 1, code: "daily", name: "Diário", is_active: true }],
    goals: [
      {
        id: 1,
        goal_period_id: 1,
        goal_type: "general",
        goal_value: "100.00",
        portability_base_value: "25.00",
        portability_out_value: "25.00",
        new_base_value: "25.00",
        new_out_value: "25.00",
        start_date: "2026-07-22",
        end_date: "2026-07-22",
      },
    ],
    deleted_goals: [
      {
        id: 2,
        goal_period_id: 1,
        goal_type: "general",
        goal_value: "50.00",
        start_date: "2026-07-22",
        end_date: "2026-07-22",
        deleted_at: "2026-07-23 10:00:00",
      },
    ],
    sales: [
      {
        id: 1,
        seller_id: 1,
        service_id: 1,
        operator_id: 1,
        sale_type_id: 1,
        sale_date: "2026-07-22",
        sale_time: "08:00:00",
        sale_shift: "morning",
        quantity: 1,
        unit_value: "10.00",
        total_value: "10.00",
        has_doc: true,
        is_base_sale: false,
      },
    ],
    deleted_sales: [
      {
        id: 2,
        seller_id: 1,
        service_id: 1,
        operator_id: 1,
        sale_type_id: 1,
        sale_date: "2026-07-22",
        sale_time: "09:00:00",
        sale_shift: "morning",
        quantity: 1,
        unit_value: "20.00",
        total_value: "20.00",
        has_doc: false,
        is_base_sale: true,
        deleted_at: "2026-07-23 10:00:00",
      },
    ],
  };
}

async function createLooseDatabase() {
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  await db.schema.createTable("users", (table) => {
    table.integer("id");
    table.text("name");
  });
  await db.schema.createTable("media_files", (table) => table.integer("id"));
  for (const spec of Object.values(specs))
    await db.schema.createTable(spec.table, (table) => {
      for (const column of spec.columns)
        column === "id"
          ? table.integer(column).primary()
          : table.text(column).nullable();
    });
  return db;
}

test("round-trip Excel preserva quatro metas categóricas e campos de venda", async () => {
  const data = backupFixture();
  const wb = createBackupWorkbook(data);
  assert.equal(wb.getWorksheet("Vendas").rowCount, 2);
  assert.equal(wb.getWorksheet("Vendas Excluídas").rowCount, 2);
  assert.equal(wb.getWorksheet("Metas").rowCount, 2);
  assert.equal(wb.getWorksheet("Metas Excluídas").rowCount, 2);
  assert.deepEqual(
    wb.getWorksheet("Vendas").getRow(1).values.slice(1),
    [
      "Código",
      "Código da Vendedora",
      "Código do Serviço",
      "Código da Operadora",
      "Código do Tipo de Venda",
      "Data da Venda",
      "Hora da Venda",
      "Turno",
      "CNPJ",
      "Razão Social",
      "Telefone de Contato",
      "Nome de Quem Fechou",
      "Quantidade",
      "Valor Unitário",
      "Valor Total",
      "Possui Documento",
      "Venda da Base",
      "Observações",
      "Código de Quem Criou",
      "Código de Quem Atualizou",
      "Código de Quem Excluiu",
      "Criado em",
      "Atualizado em",
      "Excluído em",
    ],
  );
  assert.equal(wb.getWorksheet("Metadados").getCell("B2").value, "3");
  const buffer = await wb.xlsx.writeBuffer();
  const parsed = await parseWorkbook(buffer, 100);
  assert.equal(parsed.report.valid, true, parsed.report.errors.join(";"));
  assert.equal(String(parsed.data.goals[0].new_out_value), "25.00");
  assert.equal(String(parsed.data.sales[0].total_value), "10.00");
  assert.equal(parsed.data.sales[0].is_base_sale, false);
  assert.equal(parsed.data.deleted_sales[0].id, 2);
  assert.ok(parsed.data.deleted_sales[0].deleted_at);
  assert.equal(parsed.data.deleted_goals[0].id, 2);
});

test("relatorio Excel usa nomes, rotulos e formatos brasileiros sem IDs", async () => {
  const data = backupFixture();
  data.users = [{ id: 7, name: "Administradora" }];
  data.sales[0] = {
    ...data.sales[0],
    quantity: 1234,
    unit_value: "1234.56",
    total_value: "1523456.78",
    cnpj_digits: "07404596000134",
    created_by: 7,
    created_at: "2026-07-22 10:11:12",
  };
  data.goals[0] = { ...data.goals[0], created_by: 7 };
  data.deleted_sales[0] = { ...data.deleted_sales[0], deleted_by: 7 };
  data.deleted_goals[0] = { ...data.deleted_goals[0], deleted_by: 7 };

  const original = createReportWorkbook(data, {
    appVersion: "1.2.3",
    timezone: "America/Sao_Paulo",
  });
  const buffer = await original.xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  for (const name of [
    "Vendedoras",
    "Serviços",
    "Operadoras",
    "Tipos de Venda",
    "Períodos de Meta",
    "Metas",
    "Metas Excluídas",
    "Vendas",
    "Vendas Excluídas",
  ]) {
    const headers = wb.getWorksheet(name).getRow(1).values.slice(1).map(String);
    assert.equal(
      headers.some((header) => /\b(id|código)\b|foto|ícone/i.test(header)),
      false,
      `${name}: ${headers.join(", ")}`,
    );
  }

  const sales = wb.getWorksheet("Vendas");
  const saleHeaders = sales.getRow(1).values.slice(1);
  const saleCell = (header) => sales.getRow(2).getCell(saleHeaders.indexOf(header) + 1);
  assert.equal(saleCell("Vendedora").value, "Teste");
  assert.equal(saleCell("Serviço").value, "Internet");
  assert.equal(saleCell("Operadora").value, "Vivo");
  assert.equal(saleCell("Tipo de Venda").value, "Novo");
  assert.equal(saleCell("Turno").value, "Manhã");
  assert.equal(saleCell("Possui Documento").value, "Sim");
  assert.equal(saleCell("Venda da Base").value, "Não");
  assert.equal(saleCell("CNPJ").value, "07.404.596/0001-34");
  assert.equal(saleCell("Criado por").value, "Administradora");
  assert.equal(saleCell("Quantidade").value, 1234);
  assert.equal(saleCell("Quantidade").numFmt, "#.##0");
  assert.equal(saleCell("Valor Unitário").value, 1234.56);
  assert.equal(saleCell("Valor Unitário").numFmt, '"R$" #.##0,00');
  assert.equal(saleCell("Valor Total").value, 1523456.78);
  assert.equal(saleCell("Valor Total").numFmt, '"R$" #.##0,00');
  assert.ok(saleCell("Data da Venda").value instanceof Date);
  assert.equal(saleCell("Data da Venda").numFmt, "dd/mm/yyyy");
  assert.equal(saleCell("Hora da Venda").numFmt, "hh:mm:ss");
  assert.equal(saleCell("Criado em").numFmt, "dd/mm/yyyy hh:mm:ss");

  const goals = wb.getWorksheet("Metas");
  const goalHeaders = goals.getRow(1).values.slice(1);
  const goalCell = (header) => goals.getRow(2).getCell(goalHeaders.indexOf(header) + 1);
  assert.equal(goalCell("Período da Meta").value, "Diário");
  assert.equal(goalCell("Vendedora").value, "Todas as vendedoras");
  assert.equal(goalCell("Tipo da Meta").value, "Geral");
  assert.equal(goalCell("Criado por").value, "Administradora");
  assert.equal(goalCell("Meta Total").numFmt, '"R$" #.##0,00');
  assert.equal(
    wb.getWorksheet("Vendas Excluídas").getRow(2).getCell(20).value,
    "Administradora",
  );
  assert.equal(wb.getWorksheet("Metadados").getCell("B3").value, "Não");
  assert.equal((await parseWorkbook(Buffer.from(buffer), 100)).report.valid, false);
});

test("exportacao sempre cria as abas historicas mesmo quando vazias", () => {
  const data = backupFixture();
  data.deleted_sales = [];
  data.deleted_goals = [];
  for (const wb of [createBackupWorkbook(data), createReportWorkbook(data)]) {
    assert.equal(wb.getWorksheet("Vendas Excluídas").rowCount, 1);
    assert.equal(wb.getWorksheet("Metas Excluídas").rowCount, 1);
  }
});

test("exportacao separa registros ativos e excluidos e filtra ambos por periodo", async () => {
  const db = await createLooseDatabase();
  try {
    await db("sales").insert([
      { id: 1, sale_date: "2026-07-22", deleted_at: null },
      { id: 2, sale_date: "2026-07-22", deleted_at: "2026-07-23 10:00:00" },
      { id: 3, sale_date: "2026-07-20", deleted_at: null },
    ]);
    await db("goals").insert([
      { id: 1, start_date: "2026-07-20", end_date: "2026-07-24", deleted_at: null },
      { id: 2, start_date: "2026-07-22", end_date: "2026-07-22", deleted_at: "2026-07-23 10:00:00" },
      { id: 3, start_date: "2026-07-01", end_date: "2026-07-10", deleted_at: null },
    ]);
    const data = await exportData(db, {
      start_date: "2026-07-22",
      end_date: "2026-07-22",
    });
    assert.deepEqual(data.sales.map((row) => row.id), [1]);
    assert.deepEqual(data.deleted_sales.map((row) => row.id), [2]);
    assert.deepEqual(data.goals.map((row) => row.id), [1]);
    assert.deepEqual(data.deleted_goals.map((row) => row.id), [2]);
  } finally {
    await db.destroy();
  }
});

test("importacao antiga separa deleted_at mesmo sem abas historicas", async () => {
  const wb = createBackupWorkbook(backupFixture());
  for (const [activeName, deletedName] of [
    ["Vendas", "Vendas Excluídas"],
    ["Metas", "Metas Excluídas"],
  ]) {
    const active = wb.getWorksheet(activeName);
    const deleted = wb.getWorksheet(deletedName);
    active.addRow(deleted.getRow(2).values.slice(1));
    wb.removeWorksheet(deleted.id);
  }
  const parsed = await parseWorkbook(await wb.xlsx.writeBuffer(), 100);
  assert.equal(parsed.report.valid, true, parsed.report.errors.join(";"));
  assert.deepEqual(parsed.data.sales.map((row) => row.id), [1]);
  assert.deepEqual(parsed.data.deleted_sales.map((row) => row.id), [2]);
  assert.deepEqual(parsed.data.goals.map((row) => row.id), [1]);
  assert.deepEqual(parsed.data.deleted_goals.map((row) => row.id), [2]);
});

test("importacao aceita os cabecalhos tecnicos dos schemas anteriores", async () => {
  const wb = createBackupWorkbook(backupFixture());
  for (const [name, spec] of Object.entries(specs))
    wb.getWorksheet(name).getRow(1).values = spec.columns;
  const parsed = await parseWorkbook(await wb.xlsx.writeBuffer(), 100);
  assert.equal(parsed.report.valid, true, parsed.report.errors.join(";"));
  assert.equal(parsed.data.sales[0].id, 1);
  assert.equal(parsed.data.deleted_sales[0].id, 2);
});

test("importacao rejeita IDs repetidos entre abas ativas e excluidas", async () => {
  const data = backupFixture();
  data.deleted_sales[0].id = data.sales[0].id;
  data.deleted_goals[0].id = data.goals[0].id;
  const parsed = await parseWorkbook(
    await createBackupWorkbook(data).xlsx.writeBuffer(),
    100,
  );
  assert.equal(parsed.report.valid, false);
  assert.ok(parsed.report.errors.includes("Venda 1: ID duplicado."));
  assert.ok(parsed.report.errors.includes("Meta 1: ID duplicado."));
});

test("round-trip restaura registros historicos sem reativa-los", async () => {
  const buffer = await createBackupWorkbook(backupFixture()).xlsx.writeBuffer();
  const db = await createLooseDatabase();
  try {
    const preview = await createPreview(buffer, { maxRows: 100 });
    assert.equal(preview.valid, true, preview.errors.join(";"));
    assert.equal(preview.counts.sales, 1);
    assert.equal(preview.counts.deleted_sales, 1);
    assert.equal(preview.counts.goals, 1);
    assert.equal(preview.counts.deleted_goals, 1);
    await confirmImport(db, preview.previewId);
    assert.equal(Number((await db("sales").whereNull("deleted_at").count({ count: "id" }).first()).count), 1);
    assert.equal(Number((await db("sales").whereNotNull("deleted_at").count({ count: "id" }).first()).count), 1);
    assert.equal(Number((await db("goals").whereNull("deleted_at").count({ count: "id" }).first()).count), 1);
    assert.equal(Number((await db("goals").whereNotNull("deleted_at").count({ count: "id" }).first()).count), 1);
  } finally {
    await db.destroy();
  }
});

test("importa exportacao do dashboard antigo e grava os dados transformados", async () => {
  const wb = new ExcelJS.Workbook();
  const add = (name, rows) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(legacySpecs[name]);
    rows.forEach((row) => ws.addRow(row));
  };
  add("Vendedoras", [
    [1, "Nayara", "/uploads/nayara.jpg", "Sim", "2026-04-23 16:08:01", null],
  ]);
  add("Servi\u00e7os", [
    [
      1,
      "telefonia m\u00f3vel",
      "/uploads/movel.png",
      "Sim",
      "2026-04-23 16:08:01",
    ],
  ]);
  add("Operadoras", [
    [1, "vivo", "/uploads/vivo.png", "Sim", "2026-04-23 16:08:01"],
  ]);
  add("Tipos de Venda", [
    [
      1,
      "portabilidade",
      "/uploads/portabilidade.png",
      "Sim",
      "2026-04-23 16:08:01",
    ],
  ]);
  add("Per\u00edodos de Meta", [
    [1, "Di\u00e1rio", "2026-04-23 16:08:01"],
    [5, "Manh\u00e3", "2026-04-23 16:08:01"],
  ]);
  add("Metas", [
    [
      1,
      "Manh\u00e3",
      null,
      "Geral",
      null,
      null,
      2800,
      "2026-07-22",
      "2026-07-22",
      "2026-07-22 12:25:16",
      null,
    ],
  ]);
  add("Vendas", [
    [
      6,
      "Nayara",
      "telefonia m\u00f3vel",
      "vivo",
      "portabilidade",
      "2026-04-23",
      "08:54:00",
      "Manh\u00e3",
      "07.404.596/0001-34",
      "Empresa",
      "11999999999",
      "Cliente",
      "Sim",
      "N\u00e3o",
      3,
      69.99,
      209.97,
      null,
      "2026-04-23 16:37:15",
      null,
    ],
  ]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer()),
    parsed = await parseWorkbook(buffer, 100);
  assert.equal(parsed.report.valid, true, parsed.report.errors.join(";"));
  assert.equal(parsed.report.sourceFormat, "legacy-dashboard");
  assert.equal(parsed.data.services[0].code, "mobile_phone");
  assert.equal(parsed.data.sale_types[0].code, "portability");
  assert.equal(parsed.data.sales[0].sale_shift, "morning");
  assert.equal(parsed.data.sales[0].cnpj_digits, "07404596000134");
  assert.equal(parsed.data.goals[0].goal_period_id, 1);
  assert.equal(parsed.data.goals[0].morning_value, "2800.00");
  assert.equal(parsed.data.goals[0].afternoon_value, "0.00");
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  try {
    await db.schema.createTable("users", (table) => table.integer("id"));
    await db.schema.createTable("media_files", (table) => table.integer("id"));
    for (const spec of Object.values(specs))
      await db.schema.createTable(spec.table, (table) => {
        for (const column of spec.columns)
          column === "id"
            ? table.integer(column).primary()
            : table.text(column).nullable();
      });
    const preview = await createPreview(buffer, { maxRows: 100 }),
      result = await confirmImport(db, preview.previewId);
    assert.equal(result.counts.sales, 1);
    const sale = await db("sales").first();
    assert.equal(sale.id, 6);
    assert.equal(sale.total_value, "209.97");
    assert.equal(
      await db("goal_periods").where({ code: "morning" }).first(),
      undefined,
    );
  } finally {
    await db.destroy();
  }
});
test("importacao preserva fotos e icones atuais dos cadastros correspondentes", async () => {
  const data = {
    sellers: [
      { id: 1, full_name: "Nayara", photo_media_id: null, is_active: true },
    ],
    services: [
      {
        id: 1,
        code: "internet",
        name: "Internet",
        icon_media_id: null,
        is_active: true,
      },
    ],
    operators: [
      {
        id: 1,
        code: "vivo",
        name: "Vivo",
        icon_media_id: null,
        is_active: true,
      },
    ],
    sale_types: [
      {
        id: 1,
        code: "new",
        name: "Novo",
        icon_media_id: null,
        is_active: true,
      },
      {
        id: 2,
        code: "portability",
        name: "Portabilidade",
        icon_media_id: null,
        is_active: true,
      },
    ],
    goal_periods: [{ id: 1, code: "daily", name: "Diario", is_active: true }],
    goals: [],
    sales: [],
  };
  const buffer = Buffer.from(
    await createBackupWorkbook(data).xlsx.writeBuffer(),
  );
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  try {
    await db.schema.createTable("users", (table) => table.integer("id"));
    await db.schema.createTable("media_files", (table) => table.integer("id"));
    for (const spec of Object.values(specs))
      await db.schema.createTable(spec.table, (table) => {
        for (const column of spec.columns)
          column === "id"
            ? table.integer(column).primary()
            : table.text(column).nullable();
      });
    await db("media_files").insert([
      { id: 11 },
      { id: 12 },
      { id: 13 },
      { id: 14 },
    ]);
    await db("sellers").insert({
      id: 99,
      full_name: "Nayara",
      photo_media_id: 11,
    });
    await db("services").insert({
      id: 98,
      code: "internet",
      name: "Internet antiga",
      icon_media_id: 12,
    });
    await db("operators").insert({
      id: 97,
      code: "vivo",
      name: "Vivo antiga",
      icon_media_id: 13,
    });
    await db("sale_types").insert({
      id: 96,
      code: "new",
      name: "Novo antigo",
      icon_media_id: 14,
    });
    const preview = await createPreview(buffer, { maxRows: 100 });
    await confirmImport(db, preview.previewId);
    assert.equal(
      Number((await db("sellers").where({ id: 1 }).first()).photo_media_id),
      11,
    );
    assert.equal(
      Number((await db("services").where({ id: 1 }).first()).icon_media_id),
      12,
    );
    assert.equal(
      Number((await db("operators").where({ id: 1 }).first()).icon_media_id),
      13,
    );
    assert.equal(
      Number((await db("sale_types").where({ id: 1 }).first()).icon_media_id),
      14,
    );
  } finally {
    await db.destroy();
  }
});
