import type { Prisma } from "@/generated/prisma/client";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";

export async function adjustPartyOutstanding(
  tx: Prisma.TransactionClient,
  args: { partyId: bigint; companyId: bigint; deltaCents: number },
): Promise<void> {
  const party = await tx.party.findFirst({
    where: { id: args.partyId, companyId: args.companyId },
  });
  if (!party) return;
  const current = toCents(party.outstandingAmount?.toString() ?? "0") ?? 0;
  await tx.party.update({
    where: { id: party.id },
    data: {
      outstandingAmount: centsToDecimalString(Math.max(0, current + args.deltaCents)),
    },
  });
}
