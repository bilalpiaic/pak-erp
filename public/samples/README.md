# Voucher CSV import

One **row per voucher line**. Rows that share the same `voucher_key` become one voucher.

## Files

- `vouchers-import-template.csv` — header row only
- `vouchers-import-sample.csv` — four balanced examples (BRV posted, CRV/BPV/JV drafts)

Import from **Voucher Entry → Import CSV**. You can also download the same files from that dialog.

## Columns

| Column | Required | Notes |
|---|---|---|
| voucher_key | yes | Groups lines into one voucher (any label, unique per voucher in the file) |
| voucher_type | yes (first line of group) | `BPV`, `BRV`, `CPV`, `CRV`, or `JV` |
| voucher_date | yes | `YYYY-MM-DD` or `DD/MM/YYYY` |
| voucher_no | no | Leave blank to auto-allocate (`BRV-001` …) |
| reference_no | no | Invoice / PO / cheque number |
| party_name | no | Matched to Parties master (case-insensitive); otherwise stored as free text |
| party_ntn | no | |
| wht_applicable | no | `yes` / `no` |
| narration | no | Header narration |
| account_code | yes | Must exist on Chart of Accounts (e.g. `1002`, `1010`, `1010-001`) |
| debit | one of debit/credit | Amount; commas allowed (`125,000.00`) |
| credit | one of debit/credit | |
| line_narration | no | |
| status | no | `DRAFT` (default) or `POSTED` (must be balanced) |

Header fields (`type`, `date`, `party`, …) can be filled on the first line of a group; later lines may leave them blank.

Account codes in the sample match the seeded chart: `1001` cash, `1002` HBL, `1010` trade debtors, `2001` creditors, `2002` accrued, `4001` sales, `6001` salaries, `6002` rent.
