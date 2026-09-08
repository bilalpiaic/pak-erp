import { QTY_SCALE, unitCostCentsFromValue } from "@/lib/accounting/quantity";

export type OnHand = {
  qtyUnits: number;
  valueCents: number;
};

export const EMPTY_ON_HAND: OnHand = { qtyUnits: 0, valueCents: 0 };

export function wacCents(onHand: OnHand): number {
  if (onHand.qtyUnits <= 0) return 0;
  return Math.round((onHand.valueCents * QTY_SCALE) / onHand.qtyUnits);
}

export function applyIn(onHand: OnHand, qtyUnits: number, valueCents: number): OnHand {
  if (qtyUnits <= 0) {
    throw new Error("Inbound quantity must be positive.");
  }
  if (valueCents < 0) {
    throw new Error("Inbound value cannot be negative.");
  }
  return {
    qtyUnits: onHand.qtyUnits + qtyUnits,
    valueCents: onHand.valueCents + valueCents,
  };
}

export type IssueResult = {
  onHand: OnHand;
  valueCents: number;
  unitCostCents: number;
};

/**
 * Issue qty at current WAC. Issuing the entire remainder absorbs leftover cents
 * so on-hand value never drifts from 1020.
 */
export function applyOut(onHand: OnHand, qtyUnits: number): IssueResult {
  if (qtyUnits <= 0) {
    throw new Error("Outbound quantity must be positive.");
  }
  if (qtyUnits > onHand.qtyUnits) {
    throw new Error("Insufficient stock: quantity would go negative.");
  }
  if (qtyUnits === onHand.qtyUnits) {
    return {
      onHand: { qtyUnits: 0, valueCents: 0 },
      valueCents: onHand.valueCents,
      unitCostCents: onHand.qtyUnits > 0 ? wacCents(onHand) : 0,
    };
  }
  const valueCents = Math.round((qtyUnits * onHand.valueCents) / onHand.qtyUnits);
  return {
    onHand: {
      qtyUnits: onHand.qtyUnits - qtyUnits,
      valueCents: onHand.valueCents - valueCents,
    },
    valueCents,
    unitCostCents: wacCents(onHand),
  };
}

export function inboundUnitCost(valueCents: number, qtyUnits: number): number {
  return unitCostCentsFromValue(valueCents, qtyUnits);
}
