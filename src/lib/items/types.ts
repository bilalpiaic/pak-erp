export const ITEM_CATEGORIES = ["Saleable", "Consumable"] as const;
export type ItemCategoryValue = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategoryValue, string> = {
  Saleable: "Saleable",
  Consumable: "Consumable",
};

export const ITEM_CATEGORY_HINTS: Record<ItemCategoryValue, string> = {
  Saleable: "From production (BOMs) — sold on sales invoices",
  Consumable: "Purchased and used in production",
};

export const ITEM_UNITS = ["Pcs", "Mtr", "Yds", "Kg", "Lot"] as const;
export type ItemUnitValue = (typeof ITEM_UNITS)[number];

export type ItemDTO = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: ItemCategoryValue;
  unit: string;
  trackStock: boolean;
  isActive: boolean;
  defaultSaleRate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemInput = {
  sku: string;
  name: string;
  category: ItemCategoryValue;
  unit?: string | null;
  trackStock?: boolean;
  isActive?: boolean;
  defaultSaleRate?: string | number | null;
};

export type ItemListQuery = {
  search?: string;
  category?: string;
  active?: "all" | "active" | "inactive";
};
