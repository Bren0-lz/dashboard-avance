"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  integrationSaleSchema,
} = require("../../src/modules/integrations/integration.schema");
const { parse } = require("../../src/shared/validation");
const {
  requireIntegrationApiKey,
} = require("../../src/middlewares/api-key-auth");
const {
  createSale,
  sameSale,
  updateSale,
} = require("../../src/modules/integrations/integration.service");
const salesService = require("../../src/modules/sales/sales.service");

const sale = {
  external_sale_id: "crm-123",
  seller_id: 1,
  service_id: 2,
  operator_id: 3,
  sale_type_id: 1,
  sale_date: "2026-07-28",
  sale_time: "14:30",
  cnpj: "",
  company_name: "",
  phone: "",
  closed_by_name: "",
  quantity: 1,
  unit_value: "99.90",
  has_doc: true,
  is_base_sale: false,
  notes: "",
};

test("venda de integração exige identificador externo", () => {
  assert.throws(
    () => parse(integrationSaleSchema, { ...sale, external_sale_id: " " }),
    (error) =>
      error.code === "VALIDATION_ERROR" &&
      Boolean(error.fieldErrors.external_sale_id),
  );
});

test("venda de integração aceita observação nula", () => {
  assert.equal(
    parse(integrationSaleSchema, { ...sale, notes: null }).notes,
    null,
  );
});

test("integração distingue reenvio idempotente de edição", () => {
  const parsed = parse(integrationSaleSchema, sale);
  const { external_sale_id: _externalSaleId, ...input } = parsed;
  const current = {
    ...input,
    cnpj_digits: input.cnpj,
    sale_time: "14:30:00",
    total_value: "99.90",
  };
  assert.equal(sameSale(current, input), true);
  assert.equal(
    sameSale(current, { ...input, company_name: "Empresa editada" }),
    false,
  );
});

test("PUT cria linha adicionada em edição sem emitir eventos", async () => {
  const originalMutation = salesService.mutateSaleInTransaction;
  let receivedOptions;
  salesService.mutateSaleInTransaction = async (_trx, options) => {
    receivedOptions = options;
    return { id: 77, events: { saleCreated: true } };
  };
  const trx = (table) => {
    if (table !== "external_sale_receipts")
      throw new Error(`Tabela inesperada: ${table}`);
    return {
      where() {
        return this;
      },
      async first() {
        return null;
      },
      async insert() {},
    };
  };
  const db = { transaction: async (callback) => callback(trx) };
  const parsed = parse(integrationSaleSchema, sale);
  const { external_sale_id: externalSaleId, ...input } = parsed;
  try {
    const result = await updateSale(db, {
      apiKeyId: 1,
      externalSaleId,
      input,
    });
    assert.equal(receivedOptions.operation, "create");
    assert.equal(receivedOptions.emitEvents, false);
    assert.equal(result.events, null);
    assert.equal(result.updated, true);
  } finally {
    salesService.mutateSaleInTransaction = originalMutation;
  }
});

test("DELETE seguido de POST restaura a venda sem confete ou eventos", async () => {
  const originalMutation = salesService.mutateSaleInTransaction;
  let receivedOptions;
  salesService.mutateSaleInTransaction = async (_trx, options) => {
    receivedOptions = options;
    return { id: 77, before: { id: 77, deleted_at: new Date() } };
  };
  const trx = (table) => ({
    where() {
      return this;
    },
    async first() {
      return table === "external_sale_receipts"
        ? { sale_id: 77 }
        : { id: 77, deleted_at: new Date() };
    },
  });
  const db = { transaction: async (callback) => callback(trx) };
  const parsed = parse(integrationSaleSchema, sale);
  const { external_sale_id: externalSaleId, ...input } = parsed;
  try {
    const result = await createSale(db, {
      apiKeyId: 1,
      externalSaleId,
      input,
    });
    assert.equal(receivedOptions.operation, "restore");
    assert.equal(receivedOptions.emitEvents, false);
    assert.equal(result.events, null);
    assert.equal(result.updated, true);
  } finally {
    salesService.mutateSaleInTransaction = originalMutation;
  }
});

test("middleware de integração rejeita Bearer ausente antes de acessar banco", async () => {
  let received;
  await requireIntegrationApiKey({})({ get: () => "" }, {}, (error) => {
    received = error;
  });
  assert.equal(received.code, "API_KEY_REQUIRED");
  assert.equal(received.status, 401);
});
