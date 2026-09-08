import type { Item, Prisma } from "@/generated/prisma/client";
import { qtyUnitsToDecimalString, toQtyUnits } from "@/lib/accounting/quantity";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_UNITS,
  type ItemCategoryValue,
  type ItemDTO,
  type ItemInput,
  type ItemListQuery,
} from "./types";

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

function toItemDTO(item: Item): ItemDTO {
  return serialize({
    id: item.id.toString(),
    companyId: item.companyId.toString(),
    sku: item.sku,
    name: item.name,
    category: item.category as ItemCategoryValue,
    unit: item.unit,
    trackStock: item.trackStock,
    isActive: item.isActive,
    defaultSaleRate:
      item.defaultSaleRate != null ? qtyUnitsToDecimalString(toQtyUnits(item.defaultSaleRate.toString()) ?? 0) : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  });
}

export function validateItemInput(input: ItemInput): string[] {
  const errors: string[] = [];
  if (!input.sku?.trim()) errors.push("SKU is required.");
  else if (input.sku.trim().length > 40) errors.push("SKU must be 40 characters or fewer.");
  if (!input.name?.trim()) errors.push("Item name is required.");
  else if (input.name.trim().length > 200) errors.push("Item name must be 200 characters or fewer.");
  if (!ITEM_CATEGORIES.includes(input.category)) errors.push("Invalid item category.");
  const unit = input.unit?.trim() || "Pcs";
  if (unit.length > 20) errors.push("Unit must be 20 characters or fewer.");
  if (input.defaultSaleRate != null && input.defaultSaleRate !== "") {
    const units = toQtyUnits(input.defaultSaleRate);
    if (units === null) errors.push("Default sale rate must be a non-negative number with up to 4 decimals.");
  }
  return errors;
}

export async function listItems(query: ItemListQuery = {}): Promise<{ items: ItemDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const search = query.search?.trim();
  const category =
    query.category && (ITEM_CATEGORIES as readonly string[]).includes(query.category)
      ? (query.category as ItemCategoryValue)
      : undefined;

  const items = await prisma.item.findMany({
    where: {
      companyId,
      ...(query.active === "active" ? { isActive: true } : {}),
      ...(query.active === "inactive" ? { isActive: false } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sku: "asc" }],
  });

  return { items: items.map(toItemDTO) };
}

export async function getItem(id: string): Promise<ItemDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const item = await prisma.item.findFirst({
    where: { id: BigInt(id), companyId },
  });
  return item ? toItemDTO(item) : null;
}

export async function createItem(input: ItemInput, actor = "system"): Promise<ItemDTO> {
  const errors = validateItemInput(input);
  if (errors.length) throw new Error(errors.join(" "));

  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const rateUnits = toQtyUnits(input.defaultSaleRate ?? "");
  const unit = input.unit?.trim() || "Pcs";

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          companyId,
          sku: input.sku.trim().toUpperCase(),
          name: input.name.trim(),
          category: input.category,
          unit,
          trackStock: input.trackStock ?? true,
          isActive: input.isActive ?? true,
          defaultSaleRate: rateUnits != null && rateUnits > 0 ? qtyUnitsToDecimalString(rateUnits) : null,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actor,
          action: "CREATE",
          entity: "Item",
          recordId: created.id.toString(),
          newValue: { sku: created.sku, name: created.name },
        },
      });
      return created;
    });
    return toItemDTO(item);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("An item with this SKU or name already exists.");
    }
    throw error;
  }
}

export async function updateItem(id: string, input: ItemInput, actor = "system"): Promise<ItemDTO> {
  const errors = validateItemInput(input);
  if (errors.length) throw new Error(errors.join(" "));

  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const itemId = BigInt(id);
  const rateUnits = toQtyUnits(input.defaultSaleRate ?? "");
  const unit = input.unit?.trim() || "Pcs";

  try {
    const item = await prisma.$transaction(async (tx) => {
      const before = await tx.item.findFirst({ where: { id: itemId, companyId } });
      if (!before) throw new Error("Item not found.");

      const updated = await tx.item.update({
        where: { id: itemId },
        data: {
          sku: input.sku.trim().toUpperCase(),
          name: input.name.trim(),
          category: input.category,
          unit,
          trackStock: input.trackStock ?? before.trackStock,
          isActive: input.isActive ?? before.isActive,
          defaultSaleRate: rateUnits != null && rateUnits > 0 ? qtyUnitsToDecimalString(rateUnits) : null,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actor,
          action: "UPDATE",
          entity: "Item",
          recordId: updated.id.toString(),
          oldValue: { sku: before.sku, name: before.name },
          newValue: { sku: updated.sku, name: updated.name },
        },
      });
      return updated;
    });
    return toItemDTO(item);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("An item with this SKU or name already exists.");
    }
    throw error;
  }
}

export async function setItemActive(id: string, isActive: boolean, actor = "system"): Promise<ItemDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const existing = await prisma.item.findFirst({ where: { id: BigInt(id), companyId } });
  if (!existing) throw new Error("Item not found.");

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.item.update({
      where: { id: existing.id },
      data: { isActive },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
        entity: "Item",
        recordId: updated.id.toString(),
        oldValue: { isActive: existing.isActive },
        newValue: { isActive },
      },
    });
    return updated;
  });
  return toItemDTO(item);
}

export async function deleteUnusedItem(id: string, actor = "system"): Promise<void> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const itemId = BigInt(id);

  await prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id: itemId, companyId },
      include: {
        _count: {
          select: {
            stockMovements: true,
            salesInvoiceLines: true,
            purchaseInvoiceLines: true,
            adjustmentLines: true,
          },
        },
      },
    });
    if (!item) throw new Error("Item not found.");
    const used =
      item._count.stockMovements +
      item._count.salesInvoiceLines +
      item._count.purchaseInvoiceLines +
      item._count.adjustmentLines;
    if (used > 0) {
      throw new Error("Item is used on documents or stock movements and cannot be deleted. Deactivate it instead.");
    }
    await tx.item.delete({ where: { id: itemId } });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "DELETE",
        entity: "Item",
        recordId: itemId.toString(),
        oldValue: { sku: item.sku, name: item.name },
      },
    });
  });
}

export async function requireItem(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  itemId: bigint,
  options: {
    requireActive?: boolean;
    requireTrackStock?: boolean;
    requireCategory?: ItemCategoryValue;
  } = {},
): Promise<Item> {
  const item = await tx.item.findFirst({ where: { id: itemId, companyId } });
  if (!item) throw new Error("Item not found.");
  if (options.requireActive && !item.isActive) {
    throw new Error(`Item ${item.sku} is inactive.`);
  }
  if (options.requireTrackStock && !item.trackStock) {
    throw new Error(`Item ${item.sku} is not stock-tracked.`);
  }
  if (options.requireCategory && item.category !== options.requireCategory) {
    if (options.requireCategory === "Saleable") {
      throw new Error(
        `Item ${item.sku} is ${ITEM_CATEGORY_LABELS[item.category as ItemCategoryValue]}. Sales invoices use saleable items (from production / BOMs).`,
      );
    }
    throw new Error(
      `Item ${item.sku} is ${ITEM_CATEGORY_LABELS[item.category as ItemCategoryValue]}. Purchase invoices use consumable items.`,
    );
  }
  return item;
}

export { ITEM_UNITS };
