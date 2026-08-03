"use strict";
function qid(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}
function enrichSalesInspection(
  db,
  report,
  tables,
  columns,
  totalColumn,
  dateColumn,
) {
  const totalExpr = totalColumn === "0" ? "0" : qid(totalColumn),
    unitsExpr = columns.includes("quantity") ? "quantity" : "0";
  report.salesByDate =
    dateColumn !== "NULL"
      ? db
          .prepare(
            `SELECT ${qid(dateColumn)} date,COUNT(*) count,COALESCE(SUM(${totalExpr}),0) revenue FROM sales GROUP BY ${qid(dateColumn)} ORDER BY ${qid(dateColumn)}`,
          )
          .all()
      : [];
  report.salesBySeller = columns.includes("seller_id")
    ? db
        .prepare(
          `SELECT seller_id,COUNT(*) count,COALESCE(SUM(${totalExpr}),0) revenue,COALESCE(SUM(${unitsExpr}),0) units FROM sales GROUP BY seller_id ORDER BY seller_id`,
        )
        .all()
    : [];
  report.orphans = {};
  for (const [column, target] of [
    ["seller_id", "sellers"],
    ["service_id", "services"],
    ["operator_id", "operators"],
    ["sale_type_id", "sale_types"],
  ]) {
    if (columns.includes(column) && tables.includes(target))
      report.orphans[column] = Number(
        db
          .prepare(
            `SELECT COUNT(*) count FROM sales s LEFT JOIN ${qid(target)} t ON t.id=s.${qid(column)} WHERE t.id IS NULL`,
          )
          .get().count,
      );
  }
}
module.exports = { enrichSalesInspection };
