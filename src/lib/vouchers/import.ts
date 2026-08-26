import { getPrimaryCompany } from "@/lib/company/service";
import { csvRowsToRecords, parseCsv } from "@/lib/csv/parse";
import { getPrisma } from "@/lib/db/prisma";
import { VOUCHER_TYPES, type VoucherTypeValue } from "@/lib/vouchers/types";
import { parseVoucherDate, validateVoucherInput } from "@/lib/vouchers/validation";

import { VOUCHER_IMPORT_HEADERS } from "./import-sample";
import type { VoucherImportItemResult, VoucherImportResult } from "./import-types";
import { createAndPostVoucher, createDraftVoucher } from "./service";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_DATA_ROWS = 2000;
const MAX_VOUCHERS = 200;

const HEADER_ALIASES: Record<string, (typeof VOUCHER_IMPORT_HEADERS)[number]> = {
  voucher_key: "voucher_key",
  group: "voucher_key",
  import_id: "voucher_key",
  key: "voucher_key",
  voucher_type: "voucher_type",
  type: "voucher_type",
  voucher_date: "voucher_date",
  date: "voucher_date",
  voucher_no: "voucher_no",
  voucher_number: "voucher_no",
  number: "voucher_no",
  reference_no: "reference_no",
  reference: "reference_no",
  ref: "reference_no",
  party_name: "party_name",
  party: "party_name",
  party_ntn: "party_ntn",
  ntn: "party_ntn",
  cnic: "party_ntn",
  wht_applicable: "wht_applicable",
  wht: "wht_applicable",
  narration: "narration",
  account_code: "account_code",
  account: "account_code",
  code: "account_code",
  debit: "debit",
  dr: "debit",
  credit: "credit",
  cr: "credit",
  line_narration: "line_narration",
  line_detail: "line_narration",
  line_narration_detail: "line_narration",
  status: "status",
  post: "status",
};

export type { VoucherImportItemResult, VoucherImportResult } from "./import-types";

export type VoucherImportOptions = {
  dryRun?: boolean;
  /** When true, post every balanced voucher unless a row sets status=DRAFT. */
  postBalanced?: boolean;
};

type NormalizedRow = {
  sourceRow: number;
  voucherKey: string;
  voucherType: string;
  voucherDate: string;
  voucherNo: string;
  referenceNo: string;
  partyName: string;
  partyNtn: string;
  whtApplicable: string;
  narration: string;
  accountCode: string;
  debit: string;
  credit: string;
  lineNarration: string;
  status: string;
};

function mapRecord(record: Record<string, string>, sourceRow: number): NormalizedRow {
  const mapped: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(record)) {
    const canonical = HEADER_ALIASES[rawKey];
    if (canonical && mapped[canonical] == null) mapped[canonical] = value;
  }
  return {
    sourceRow,
    voucherKey: mapped.voucher_key ?? "",
    voucherType: mapped.voucher_type ?? "",
    voucherDate: mapped.voucher_date ?? "",
    voucherNo: mapped.voucher_no ?? "",
    referenceNo: mapped.reference_no ?? "",
    partyName: mapped.party_name ?? "",
    partyNtn: mapped.party_ntn ?? "",
    whtApplicable: mapped.wht_applicable ?? "",
    narration: mapped.narration ?? "",
    accountCode: mapped.account_code ?? "",
    debit: mapped.debit ?? "",
    credit: mapped.credit ?? "",
    lineNarration: mapped.line_narration ?? "",
    status: mapped.status ?? "",
  };
}

function parseImportDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (parseVoucherDate(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  return parseVoucherDate(iso) ? iso : null;
}

function parseBool(value: string): boolean {
  return /^(1|y|yes|true|t)$/i.test(value.trim());
}

function parseStatus(value: string): "DRAFT" | "POSTED" | null {
  const v = value.trim().toUpperCase();
  if (!v) return null;
  if (v === "POSTED" || v === "POST" || v === "YES" || v === "TRUE" || v === "1") return "POSTED";
  if (v === "DRAFT" || v === "NO" || v === "FALSE" || v === "0") return "DRAFT";
  return null;
}

function fillForward(rows: NormalizedRow[]): NormalizedRow[] {
  const lastByKey = new Map<string, NormalizedRow>();
  return rows.map((row) => {
    const prev = lastByKey.get(row.voucherKey);
    const next: NormalizedRow = {
      ...row,
      voucherType: row.voucherType || prev?.voucherType || "",
      voucherDate: row.voucherDate || prev?.voucherDate || "",
      voucherNo: row.voucherNo || prev?.voucherNo || "",
      referenceNo: row.referenceNo || prev?.referenceNo || "",
      partyName: row.partyName || prev?.partyName || "",
      partyNtn: row.partyNtn || prev?.partyNtn || "",
      whtApplicable: row.whtApplicable || prev?.whtApplicable || "",
      narration: row.narration || prev?.narration || "",
      status: row.status || prev?.status || "",
    };
    lastByKey.set(row.voucherKey, next);
    return next;
  });
}

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

export function previewVoucherCsv(csvText: string): {
  rows: NormalizedRow[];
  errors: string[];
} {
  const errors: string[] = [];
  if (!csvText.trim()) {
    return { rows: [], errors: ["CSV file is empty."] };
  }
  const table = parseCsv(csvText);
  if (table.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least one data row."] };
  }
  const records = csvRowsToRecords(table);
  if (records.length > MAX_DATA_ROWS) {
    errors.push(`CSV has ${records.length} data rows; maximum is ${MAX_DATA_ROWS}.`);
  }
  const rows = records.slice(0, MAX_DATA_ROWS).map((record, index) => mapRecord(record, index + 2));
  const missingKey = rows.filter((row) => !row.voucherKey);
  if (missingKey.length) {
    errors.push(
      `voucher_key is required on every row (empty on row ${missingKey
        .slice(0, 5)
        .map((r) => r.sourceRow)
        .join(", ")}).`,
    );
  }
  return { rows: fillForward(rows.filter((row) => row.voucherKey)), errors };
}

export async function importVouchersFromCsv(
  csvText: string,
  options: VoucherImportOptions = {},
  actor = "system",
): Promise<VoucherImportResult> {
  const dryRun = Boolean(options.dryRun);
  const { rows, errors: fileErrors } = previewVoucherCsv(csvText);
  const groups = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    const list = groups.get(row.voucherKey) ?? [];
    list.push(row);
    groups.set(row.voucherKey, list);
  }

  if (groups.size > MAX_VOUCHERS) {
    fileErrors.push(`CSV has ${groups.size} vouchers; maximum is ${MAX_VOUCHERS} per file.`);
  }

  const items: VoucherImportItemResult[] = [];
  if (fileErrors.length) {
    items.push({
      voucherKey: "(file)",
      rowStart: 1,
      rowEnd: 1,
      voucherType: null,
      voucherNo: null,
      status: null,
      ok: false,
      errors: fileErrors,
    });
    return {
      dryRun,
      totalRows: rows.length,
      voucherCount: groups.size,
      created: 0,
      posted: 0,
      failed: 1,
      items,
    };
  }

  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const [accounts, parties] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      select: { id: true, code: true, isActive: true },
    }),
    prisma.party.findMany({
      where: { companyId },
      select: { id: true, name: true, ntn: true, isActive: true },
    }),
  ]);
  const accountByCode = new Map(accounts.map((a) => [a.code.trim().toLowerCase(), a]));
  const partyByName = new Map(
    parties.map((p) => [p.name.trim().toLowerCase(), p]),
  );

  const usedNumbers = new Set<string>();
  let created = 0;
  let posted = 0;
  let failed = 0;

  for (const [voucherKey, group] of groups) {
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const item: VoucherImportItemResult = {
      voucherKey,
      rowStart: first.sourceRow,
      rowEnd: last.sourceRow,
      voucherType: first.voucherType || null,
      voucherNo: first.voucherNo || null,
      status: null,
      ok: false,
      errors: [],
    };

    const type = first.voucherType.trim().toUpperCase() as VoucherTypeValue;
    if (!(VOUCHER_TYPES as readonly string[]).includes(type)) {
      item.errors.push(
        `Invalid voucher_type "${first.voucherType || "(blank)"}". Use BPV, BRV, CPV, CRV, or JV.`,
      );
    }
    if (type === "SI") {
      item.errors.push("Sales invoices cannot be imported here — use Sales Invoices.");
    }

    const voucherDate = parseImportDate(first.voucherDate);
    if (!voucherDate) {
      item.errors.push("voucher_date must be YYYY-MM-DD (or DD/MM/YYYY).");
    }

    const requestedNo = first.voucherNo.trim();
    if (requestedNo) {
      if (usedNumbers.has(requestedNo.toLowerCase())) {
        item.errors.push(`Voucher number ${requestedNo} is used twice in this file.`);
      }
      usedNumbers.add(requestedNo.toLowerCase());
    }

    const statusFromCsv = parseStatus(first.status);
    const wantPost =
      statusFromCsv === "POSTED" ||
      (Boolean(options.postBalanced) && statusFromCsv !== "DRAFT");

    const lines = [];
    for (const row of group) {
      if (!row.accountCode) {
        item.errors.push(`Row ${row.sourceRow}: account_code is required.`);
        continue;
      }
      const account = accountByCode.get(row.accountCode.toLowerCase());
      if (!account) {
        item.errors.push(`Row ${row.sourceRow}: account ${row.accountCode} was not found.`);
        continue;
      }
      if (wantPost && !account.isActive) {
        item.errors.push(`Row ${row.sourceRow}: account ${row.accountCode} is inactive.`);
      }
      lines.push({
        accountId: account.id.toString(),
        debit: row.debit || "0",
        credit: row.credit || "0",
        lineNarration: row.lineNarration,
      });
    }

    const partyName = first.partyName.trim();
    const party = partyName ? partyByName.get(partyName.toLowerCase()) : null;

    const input = {
      voucherType: type,
      voucherDate: voucherDate ?? first.voucherDate,
      voucherNo: requestedNo || null,
      referenceNo: first.referenceNo || null,
      partyId: party?.id.toString() ?? null,
      partyName: party?.name ?? partyName ?? null,
      partyNtn: first.partyNtn || party?.ntn || null,
      whtApplicable: parseBool(first.whtApplicable),
      narration: first.narration || null,
      lines,
    };

    const validation = validateVoucherInput(input, {
      requireBalanced: wantPost,
      requireLines: true,
    });
    item.errors.push(...validation.errors);
    item.status = wantPost ? "POSTED" : "DRAFT";

    if (item.errors.length) {
      failed += 1;
      items.push(item);
      continue;
    }

    if (dryRun) {
      item.ok = true;
      item.voucherNo = requestedNo || `(auto ${type}-…)`;
      created += 1;
      if (wantPost) posted += 1;
      items.push(item);
      continue;
    }

    try {
      const voucher = wantPost
        ? await createAndPostVoucher(input, actor)
        : await createDraftVoucher(input, actor);
      item.ok = true;
      item.voucher = voucher;
      item.voucherNo = voucher.voucherNo;
      item.status = voucher.status === "POSTED" ? "POSTED" : "DRAFT";
      item.voucherType = voucher.voucherType;
      created += 1;
      if (voucher.status === "POSTED") posted += 1;
    } catch (error) {
      failed += 1;
      item.errors.push(error instanceof Error ? error.message : "Failed to save voucher.");
    }
    items.push(item);
  }

  return {
    dryRun,
    totalRows: rows.length,
    voucherCount: groups.size,
    created,
    posted,
    failed,
    items,
  };
}

export { MAX_CSV_BYTES };
