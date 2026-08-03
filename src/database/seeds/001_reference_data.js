"use strict";

const reference = {
  goal_periods: [
    ["daily", "Diário"],
    ["weekly", "Semanal"],
    ["biweekly", "Quinzenal"],
    ["monthly", "Mensal"],
  ],
  services: [
    ["internet", "Internet"],
    ["fixed_phone", "Telefonia fixa"],
    ["mobile_phone", "Telefonia móvel"],
  ],
  operators: [
    ["vivo", "Vivo"],
    ["claro", "Claro"],
    ["tim", "TIM"],
    ["nio", "Nio"],
  ],
  sale_types: [
    ["new", "Novo"],
    ["portability", "Portabilidade"],
  ],
};

exports.seed = async function seed(knex) {
  for (const [table, rows] of Object.entries(reference)) {
    for (const [code, name] of rows) {
      const existing = await knex(table).where({ code }).first();
      if (!existing) await knex(table).insert({ code, name, is_active: true });
    }
  }
};

exports.reference = reference;
