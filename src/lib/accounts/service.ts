import type { Account, NormalBalance, Prisma } from "@/generated/prisma/client";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import {
  BS_BY_TYPE,
  CF_BY_TYPE,
  GROUPS_BY_TYPE,
  PL_BY_TYPE,
  defaultsForTypeGroup,
  isBsSection,
  isCfLink,
  isPlSection,
  type BsSection,
  type CfLink,
  type PlSection,
} from "./report-links";
import {
  ACCOUNT_GROUPS,
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  type AccountDTO,
  type AccountGroup,
  type AccountGroupSection,
  type AccountInput,
  type AccountListQuery,
  type AccountType,
} from "./types";

function toAccountDTO(
  account: Account & { _count?: { voucherLines: number } },
): AccountDTO {
  return serialize({
    id: account.id.toString(),
    companyId: account.companyId.toString(),
    code: account.code,
    name: account.name,
    accountType: account.accountType as AccountDTO["accountType"],
    accountGroup: account.accountGroup,
    bsSection: account.bsSection,
    plSection: account.plSection,
    cfLink: account.cfLink,
    normalBalance: account.normalBalance,
    isActive: account.isActive,
    hasTransactions: (account._count?.voucherLines ?? 0) > 0,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  });
}

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) {
    throw new Error("No company found. Create a company in Settings first.");
  }
  return BigInt(company.id);
}

function resolveReportLinks(input: AccountInput): {
  accountGroup: string | null;
  bsSection: BsSection;
  plSection: PlSection;
  cfLink: CfLink;
} {
  const defaults = defaultsForTypeGroup(input.accountType, input.accountGroup);
  const bsSection = isBsSection(input.bsSection) ? input.bsSection : defaults.bsSection;
  const plSection = isPlSection(input.plSection) ? input.plSection : defaults.plSection;
  const cfLink = isCfLink(input.cfLink) ? input.cfLink : defaults.cfLink;
  const accountGroup = input.accountGroup?.trim() || defaults.accountGroup;
  return { accountGroup, bsSection, plSection, cfLink };
}

export function validateAccountInput(
  input: AccountInput,
  options: { requireCode?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const requireCode = options.requireCode ?? true;

  if (requireCode) {
    if (!input.code?.trim()) {
      errors.push("Account code is required.");
    } else if (!/^[A-Za-z0-9.-]{1,30}$/.test(input.code.trim())) {
      errors.push("Account code must be 1–30 letters, numbers, dots, or hyphens.");
    }
  }

  if (!input.name?.trim()) {
    errors.push("Account name is required.");
  } else if (input.name.trim().length > 200) {
    errors.push("Account name must be 200 characters or fewer.");
  }

  if (!ACCOUNT_TYPES.includes(input.accountType)) {
    errors.push("Account type is invalid.");
  }

  if (!NORMAL_BALANCES.includes(input.normalBalance)) {
    errors.push("Normal balance must be Debit or Credit.");
  }

  if (input.accountGroup && input.accountGroup.length > 100) {
    errors.push("Account group must be 100 characters or fewer.");
  }

  if (
    input.accountGroup &&
    ACCOUNT_TYPES.includes(input.accountType) &&
    !(GROUPS_BY_TYPE[input.accountType] as readonly string[]).includes(input.accountGroup) &&
    !(ACCOUNT_GROUPS as readonly string[]).includes(input.accountGroup)
  ) {
    errors.push("Account group is not valid for the selected type.");
  }

  if (
    ACCOUNT_TYPES.includes(input.accountType) &&
    input.accountGroup &&
    (ACCOUNT_GROUPS as readonly string[]).includes(input.accountGroup) &&
    !(GROUPS_BY_TYPE[input.accountType] as readonly string[]).includes(input.accountGroup)
  ) {
    errors.push(
      `Group "${input.accountGroup}" does not belong under ${input.accountType} (BS/P&L hierarchy).`,
    );
  }

  const links = resolveReportLinks(input);
  const type = input.accountType as AccountType;

  if (ACCOUNT_TYPES.includes(type)) {
    if (!(BS_BY_TYPE[type] as readonly string[]).includes(links.bsSection)) {
      errors.push("Balance Sheet head is not valid for this account type.");
    }
    if (!(PL_BY_TYPE[type] as readonly string[]).includes(links.plSection)) {
      errors.push("Profit & Loss head is not valid for this account type.");
    }
    if (!(CF_BY_TYPE[type] as readonly string[]).includes(links.cfLink)) {
      errors.push("Cash Flow link is not valid for this account type.");
    }

    if (type === "Asset" || type === "Liability" || type === "Equity") {
      if (links.bsSection === "None") {
        errors.push("Balance Sheet head is required for Asset / Liability / Equity accounts.");
      }
      if (links.plSection !== "None") {
        errors.push("P&L head must be None for Balance Sheet accounts.");
      }
    }

    if (type === "Revenue" || type === "Expense") {
      if (links.plSection === "None") {
        errors.push("Profit & Loss head is required for Revenue / Expense accounts.");
      }
      if (links.bsSection !== "None") {
        errors.push("Balance Sheet head must be None for P&L accounts.");
      }
    }
  }

  return errors;
}

export async function listAccounts(
  query: AccountListQuery = {},
): Promise<{ accounts: AccountDTO[]; groups: AccountGroupSection[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const where: Prisma.AccountWhereInput = { companyId };

  if (query.accountType && query.accountType !== "All") {
    where.accountType = query.accountType;
  }

  if (query.active === "active") where.isActive = true;
  if (query.active === "inactive") where.isActive = false;

  let searchIds: bigint[] | null = null;
  if (query.search?.trim()) {
    const search = query.search.trim();
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordPattern = `(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`;

    const matched = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM accounts
      WHERE company_id = ${companyId}
        AND (
          code ILIKE ${`%${search}%`}
          OR name ~* ${wordPattern}
          OR account_group ~* ${wordPattern}
          OR bs_section ~* ${wordPattern}
          OR pl_section ~* ${wordPattern}
          OR cf_link ~* ${wordPattern}
        )
    `;
    searchIds = matched.map((row) => row.id);
    where.id = { in: searchIds.length ? searchIds : [BigInt(-1)] };
  }

  const rows = await prisma.account.findMany({
    where,
    include: { _count: { select: { voucherLines: true } } },
    orderBy: { code: "asc" },
  });

  const accounts = rows.map(toAccountDTO);
  const groupMap = new Map<string, AccountDTO[]>();

  for (const account of accounts) {
    const key = account.accountGroup?.trim() || "Ungrouped";
    const list = groupMap.get(key) ?? [];
    list.push(account);
    groupMap.set(key, list);
  }

  const groups = Array.from(groupMap.entries()).map(([group, items]) => ({
    group,
    accounts: items,
  }));

  return { accounts, groups };
}

export async function getAccount(id: string): Promise<AccountDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const account = await prisma.account.findFirst({
    where: { id: BigInt(id), companyId },
    include: { _count: { select: { voucherLines: true } } },
  });
  return account ? toAccountDTO(account) : null;
}

export async function createAccount(input: AccountInput): Promise<AccountDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const code = input.code.trim();
  const links = resolveReportLinks(input);

  const existing = await prisma.account.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (existing) {
    throw new Error(`Account code ${code} already exists.`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        companyId,
        code,
        name: input.name.trim(),
        accountType: input.accountType,
        accountGroup: links.accountGroup,
        bsSection: links.bsSection,
        plSection: links.plSection,
        cfLink: links.cfLink,
        normalBalance: input.normalBalance as NormalBalance,
        isActive: input.isActive ?? true,
      },
      include: { _count: { select: { voucherLines: true } } },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor: "system",
        action: "CREATE",
        entity: "Account",
        recordId: account.id.toString(),
        newValue: {
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          accountGroup: account.accountGroup,
          bsSection: account.bsSection,
          plSection: account.plSection,
          cfLink: account.cfLink,
          isActive: account.isActive,
        },
      },
    });

    return account;
  });

  return toAccountDTO(created);
}

export async function updateAccount(
  id: string,
  input: AccountInput,
): Promise<AccountDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const accountId = BigInt(id);
  const links = resolveReportLinks(input);

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.account.findFirst({
      where: { id: accountId, companyId },
      include: { _count: { select: { voucherLines: true } } },
    });
    if (!before) {
      throw new Error("Account not found.");
    }

    if (input.code.trim() !== before.code) {
      throw new Error("Account code cannot be changed after creation.");
    }

    const account = await tx.account.update({
      where: { id: accountId },
      data: {
        name: input.name.trim(),
        accountType: input.accountType,
        accountGroup: links.accountGroup,
        bsSection: links.bsSection,
        plSection: links.plSection,
        cfLink: links.cfLink,
        normalBalance: input.normalBalance as NormalBalance,
        isActive: input.isActive ?? before.isActive,
      },
      include: { _count: { select: { voucherLines: true } } },
    });

    const action =
      before.isActive !== account.isActive
        ? account.isActive
          ? "ACTIVATE"
          : "DEACTIVATE"
        : "UPDATE";

    await tx.auditLog.create({
      data: {
        companyId,
        actor: "system",
        action,
        entity: "Account",
        recordId: account.id.toString(),
        oldValue: {
          name: before.name,
          accountType: before.accountType,
          accountGroup: before.accountGroup,
          bsSection: before.bsSection,
          plSection: before.plSection,
          cfLink: before.cfLink,
          normalBalance: before.normalBalance,
          isActive: before.isActive,
        },
        newValue: {
          name: account.name,
          accountType: account.accountType,
          accountGroup: account.accountGroup,
          bsSection: account.bsSection,
          plSection: account.plSection,
          cfLink: account.cfLink,
          normalBalance: account.normalBalance,
          isActive: account.isActive,
        },
      },
    });

    return account;
  });

  return toAccountDTO(updated);
}

export async function setAccountActive(
  id: string,
  isActive: boolean,
): Promise<AccountDTO> {
  const existing = await getAccount(id);
  if (!existing) {
    throw new Error("Account not found.");
  }

  return updateAccount(id, {
    code: existing.code,
    name: existing.name,
    accountType: existing.accountType,
    accountGroup: existing.accountGroup as AccountGroup | null,
    bsSection: existing.bsSection,
    plSection: existing.plSection,
    cfLink: existing.cfLink,
    normalBalance: existing.normalBalance,
    isActive,
  });
}
