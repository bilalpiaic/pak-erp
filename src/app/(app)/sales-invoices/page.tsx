import { SalesInvoiceEntry } from "@/components/sales-invoices/SalesInvoiceEntry";
import { PageShell } from "@/components/ui/PageShell";
import { getPrimaryCompany } from "@/lib/company/service";
import { listItems } from "@/lib/items/service";
import { listParties } from "@/lib/parties/service";
import { getSalesInvoice, listSalesInvoices } from "@/lib/sales-invoices/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ id?: string }>;

export default async function SalesInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  let invoices: Awaited<ReturnType<typeof listSalesInvoices>>["invoices"] = [];
  let parties: Awaited<ReturnType<typeof listParties>>["parties"] = [];
  let items: Awaited<ReturnType<typeof listItems>>["items"] = [];
  let company: Awaited<ReturnType<typeof getPrimaryCompany>> = null;
  let openInvoice: Awaited<ReturnType<typeof getSalesInvoice>> = null;
  let loadError: string | null = null;

  try {
    const [invoiceData, partyData, itemData, companyData] = await Promise.all([
      listSalesInvoices(),
      listParties({ active: "active" }),
      listItems(),
      getPrimaryCompany(),
    ]);
    invoices = invoiceData.invoices;
    parties = partyData.parties;
    items = itemData.items;
    company = companyData;
    if (params.id?.trim()) {
      openInvoice = await getSalesInvoice(params.id.trim());
    }
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Sales Invoices"
      description="Tax invoice for a customer. Posting writes revenue, GST, and AR. Linking a saleable stock item also posts COGS at weighted average cost. Drafts do not post. Administrators can unpost a posted invoice to edit or delete it."
    >
      <SalesInvoiceEntry
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
