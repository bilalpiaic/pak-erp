import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import type { PartyDTO } from "@/lib/parties/types";

type PartiesPrintProps = {
  parties: PartyDTO[];
  filters?: string | null;
};

export function PartiesPrint({ parties, filters }: PartiesPrintProps) {
  return (
    <PrintSheet orientation="landscape">
      <PrintLetterhead
        title="Parties"
        subtitle={filters || `${parties.length} parties`}
        extra={filters ? `${parties.length} parties` : null}
      />
      <table className="print-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>NTN</th>
            <th>Type</th>
            <th>Phone</th>
            <th className="num">Outstanding</th>
            <th className="num">Age</th>
            <th>WHT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {parties.length === 0 ? (
            <tr>
              <td colSpan={8}>No parties found.</td>
            </tr>
          ) : (
            parties.map((party) => (
              <tr key={party.id}>
                <td>{party.name}</td>
                <td>{party.ntn ?? "—"}</td>
                <td>{party.partyType}</td>
                <td>{party.phone ?? "—"}</td>
                <td className="num">
                  <PrintAmount value={party.outstandingAmount} />
                </td>
                <td className="num">
                  {party.outstandingDays != null ? `${party.outstandingDays}d` : "—"}
                </td>
                <td>{party.whtStatus ?? "—"}</td>
                <td>{party.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <PrintSignatures columns={[{ label: "Prepared by" }, { label: "Reviewed by" }]} />
    </PrintSheet>
  );
}
