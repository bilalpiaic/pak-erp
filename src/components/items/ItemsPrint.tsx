import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import { ITEM_CATEGORY_LABELS, type ItemDTO } from "@/lib/items/types";

export function ItemsPrint({ items }: { items: ItemDTO[] }) {
  return (
    <PrintSheet orientation="landscape">
      <table className="print-table">
        <PrintThead
          colSpan={7}
          banner={
            <PrintLetterhead title="Items" subtitle={`${items.length} items`} extra="Stock item master" />
          }
        >
          <th>SKU</th>
          <th>Name</th>
          <th>Category</th>
          <th>Unit</th>
          <th>Track stock</th>
          <th className="num">Default rate</th>
          <th>Status</th>
        </PrintThead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7}>No items found.</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.sku}</td>
                <td>{item.name}</td>
                <td>{ITEM_CATEGORY_LABELS[item.category]}</td>
                <td>{item.unit}</td>
                <td>{item.trackStock ? "Yes" : "No"}</td>
                <td className="num">{item.defaultSaleRate ?? "—"}</td>
                <td>{item.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <PrintSignatures columns={[{ label: "Prepared by" }, { label: "Reviewed by" }]} />
    </PrintSheet>
  );
}
