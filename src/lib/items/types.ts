export const ITEM_CATEGORIES = ["Fabric", "Trim", "FinishedGoods", "Other"] as const;
export type ItemCategoryValue = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategoryValue, string> = {
  Fabric: "Fabric",
  Trim: "Trim",
  FinishedGoods: "Finished goods",
  Other: "Other",
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
