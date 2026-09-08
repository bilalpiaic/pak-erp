import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { QTY_SCALE, amountCentsFromQtyAndRate, toQtyUnits } from "../accounting/quantity";
import { applyIn, applyOut, EMPTY_ON_HAND, wacCents } from "./wac";

describe("quantity units", () => {
  it("parses up to 4 decimal places", () => {
    assert.equal(toQtyUnits("500"), 500 * QTY_SCALE);
    assert.equal(toQtyUnits("1.5"), 15_000);
    assert.equal(toQtyUnits("1.2500"), 12_500);
    assert.equal(toQtyUnits("1.23456"), null);
    assert.equal(toQtyUnits("-1"), null);
  });

  it("computes amount cents from qty × rate without float drift", () => {
    const qty = toQtyUnits("500")!;
    const rate = toQtyUnits("950")!;
    assert.equal(amountCentsFromQtyAndRate(qty, rate), 47_500_000);
  });
});

describe("weighted average cost", () => {
  it("IN 10 @ 100 then IN 10 @ 200 yields WAC 150", () => {
    let onHand = EMPTY_ON_HAND;
    onHand = applyIn(onHand, 10 * QTY_SCALE, 100_000);
    onHand = applyIn(onHand, 10 * QTY_SCALE, 200_000);
    assert.equal(onHand.qtyUnits, 20 * QTY_SCALE);
    assert.equal(onHand.valueCents, 300_000);
    assert.equal(wacCents(onHand), 15_000);
  });

  it("OUT 5 from WAC 150.00 issues 75,000 cents and leaves 15 @ 150.00", () => {
    let onHand = applyIn(EMPTY_ON_HAND, 10 * QTY_SCALE, 100_000);
    onHand = applyIn(onHand, 10 * QTY_SCALE, 200_000);
    const issued = applyOut(onHand, 5 * QTY_SCALE);
    assert.equal(issued.valueCents, 75_000);
    assert.equal(issued.unitCostCents, 15_000);
    assert.equal(issued.onHand.qtyUnits, 15 * QTY_SCALE);
    assert.equal(issued.onHand.valueCents, 225_000);
    assert.equal(wacCents(issued.onHand), 1500);
  });

  it("full issue absorbs remainder cents", () => {
    const onHand = applyIn(EMPTY_ON_HAND, 3 * QTY_SCALE, 100);
    const issued = applyOut(onHand, 3 * QTY_SCALE);
    assert.equal(issued.valueCents, 100);
    assert.equal(issued.onHand.qtyUnits, 0);
    assert.equal(issued.onHand.valueCents, 0);
  });

  it("rejects negative stock", () => {
    const onHand = applyIn(EMPTY_ON_HAND, 1 * QTY_SCALE, 100);
    assert.throws(() => applyOut(onHand, 2 * QTY_SCALE), /Insufficient stock/);
  });
});
