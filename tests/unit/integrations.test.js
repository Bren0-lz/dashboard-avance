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

test("middleware de integração rejeita Bearer ausente antes de acessar banco", async () => {
  let received;
  await requireIntegrationApiKey({})({ get: () => "" }, {}, (error) => {
    received = error;
  });
  assert.equal(received.code, "API_KEY_REQUIRED");
  assert.equal(received.status, 401);
});
