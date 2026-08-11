import { SalesInvoiceEntry } from "@/components/sales-invoices/SalesInvoiceEntry";
import { PageShell } from "@/components/ui/PageShell";
import { getPrimaryCompany } from "@/lib/company/service";
import { listParties } from "@/lib/parties/service";
import { listSalesInvoices } from "@/lib/sales-invoices/service";

export const dynamic = "force-dynamic";

export default async function SalesInvoicesPage() {
  let invoices: Awaited<ReturnType<typeof listSalesInvoices>>["invoices"] = [];
  let parties: Awaited<ReturnType<typeof listParties>>["parties"] = [];
  let company: Awaited<ReturnType<typeof getPrimaryCompany>> = null;
  let loadError: string | null = null;

  try {
    const [invoiceData, partyData, companyData] = await Promise.all([
      listSalesInvoices(),
      listParties({ active: "active" }),
      getPrimaryCompany(),
    ]);
    invoices = invoiceData.invoices;
    parties = partyData.parties;
    company = companyData;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Sales Invoices"
      description="Create sales invoices with party, PO#, and item lines. Posting writes Dr Trade Debtors / Cr Sales directly to the customer ledger."
    >
      <SalesInvoiceEntry
        initialInvoices={invoices}
        parties={parties}
        company={company}
        loadError={loadError}
      />
    </PageShell>
  );
}
