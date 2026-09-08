import { PurchaseInvoiceEntry } from "@/components/purchase-invoices/PurchaseInvoiceEntry";
import { PageShell } from "@/components/ui/PageShell";
import { getPrimaryCompany } from "@/lib/company/service";
import { listItems } from "@/lib/items/service";
import { listParties } from "@/lib/parties/service";
import { getPurchaseInvoice, listPurchaseInvoices } from "@/lib/purchase-invoices/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ id?: string }>;

export default async function PurchaseInvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let invoices: Awaited<ReturnType<typeof listPurchaseInvoices>>["invoices"] = [];
  let parties: Awaited<ReturnType<typeof listParties>>["parties"] = [];
  let items: Awaited<ReturnType<typeof listItems>>["items"] = [];
  let company: Awaited<ReturnType<typeof getPrimaryCompany>> = null;
  let openInvoice: Awaited<ReturnType<typeof getPurchaseInvoice>> = null;
  let loadError: string | null = null;

  try {
    const [invoiceData, partyData, itemData, companyData] = await Promise.all([
      listPurchaseInvoices(),
      listParties({ active: "active" }),
      listItems({ active: "active" }),
      getPrimaryCompany(),
    ]);
    invoices = invoiceData.invoices;
    parties = partyData.parties;
    items = itemData.items;
    company = companyData;
    if (params.id?.trim()) openInvoice = await getPurchaseInvoice(params.id.trim());
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Purchase Invoices"
      description="Goods inward of consumable items. Posting writes Dr Stock in Trade / Cr Trade Creditors and quantity IN at line cost. Drafts do not move stock."
    >
      <PurchaseInvoiceEntry
        initialInvoices={invoices}
        parties={parties}
        items={items}
        company={company}
        openInvoice={openInvoice}
        loadError={loadError}
      />
    </PageShell>
  );
}
