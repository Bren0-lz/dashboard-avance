"use strict";

function compareRanking(a, b) {
  const revenue = Number(b.revenue) - Number(a.revenue);
  if (revenue) return revenue;
  const units = Number(b.units) - Number(a.units);
  if (units) return units;
  const firstSale = String(a.first_sale).localeCompare(String(b.first_sale));
  return firstSale || Number(a.seller_id) - Number(b.seller_id);
}
function sortRanking(rows) {
  return [...rows].sort(compareRanking);
}
function didOvertake(before, after, sellerId) {
  const oldIndex = before.findIndex(
    (row) => Number(row.seller_id) === Number(sellerId),
  );
  const newIndex = after.findIndex(
    (row) => Number(row.seller_id) === Number(sellerId),
  );
  const previousIndex = oldIndex >= 0 ? oldIndex : before.length;
  return newIndex >= 0 && newIndex < previousIndex;
}

function didTakeLead(before, after, sellerId) {
  const previousLeader = before[0];
  const currentLeader = after[0];
  return (
    Boolean(previousLeader && currentLeader) &&
    Number(previousLeader.seller_id) !== Number(sellerId) &&
    Number(currentLeader.seller_id) === Number(sellerId)
  );
}

module.exports = { compareRanking, sortRanking, didOvertake, didTakeLead };
