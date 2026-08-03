"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  specs,
  createWorkbook,
  parseWorkbook,
  createPreview,
  confirmImport,
} = require("../../src/modules/excel/excel.service");
const ExcelJS = require("exceljs");
const knex = require("knex");
const {
  specs: legacySpecs,
} = require("../../src/modules/excel/legacy-workbook");
test("round-trip Excel preserva quatro metas categóricas e campos de venda", async () => {
  const data = {
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
  };
  const wb = createWorkbook(data);
  const buffer = await wb.xlsx.writeBuffer();
  const parsed = await parseWorkbook(buffer, 100);
  assert.equal(parsed.report.valid, true, parsed.report.errors.join(";"));
  assert.equal(String(parsed.data.goals[0].new_out_value), "25.00");
  assert.equal(String(parsed.data.sales[0].total_value), "10.00");
  assert.equal(parsed.data.sales[0].is_base_sale, false);
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
  const buffer = Buffer.from(await createWorkbook(data).xlsx.writeBuffer());
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
