# Manager summaries and monthly revenue target

The Finance form adds `monthlyTarget` immediately after monthly budget and before patient cash receipts. Its month is the report date's month. Owner target never falls back to budget.

Owner headline data comes from the same Finance and Marketing summary functions shown on the manager pages. This is a shared aggregation layer over authorized division records, not a new approval workflow or a reduction in the datasets downloaded by Owner.

- Marketing: Digital Marketing, Creative Performance and CRM feed the manager summary. CRM is the canonical lead/booking/show-up funnel; ad and creative attribution are shown separately, never added as extra patients.
- Finance: Doctor, Medical and Inventory feed operational counts, stock alerts and unresolved issues. The manager supplies verified finance figures.
- Owner: combines these summaries into the existing 14-item Control Tower, ranked open problems and pending Owner escalations. Closed/approved/rejected escalations are excluded. Open historical management issues remain visible until resolved.

## Finance inputs and interpretation

| Field | Meaning |
|---|---|
| monthlyTarget | Monthly revenue target; latest reported value within the report month |
| verifiedRevenue | Complete verified revenue for the report date, excluding cash receipts as an additional revenue source; latest revision per date wins |
| outstandingBalance | Outstanding balance as of the report date; latest value, not a sum |
| monthlyProfitEstimate | Month-to-date profit estimate; latest value, allows losses |
| cashInPatient / cashInOther | Existing cash movement amounts, summed in the current month; amend existing movements instead of re-entering the same amount |

Blank new fields remain unknown, distinct from explicitly entered zero. Finance must verify and enter the new figures; legacy budget, attribution, and cash receipts are not migrated into revenue automatically. Month-to-date revenue totals only reported dates; the UI shows coverage and latest Finance report date. Forecast is a linear projection using elapsed calendar days, not a promise or a statistical model.

Business date uses Asia/Jakarta. Future-dated rows do not contribute. Patient matching uses shared booking IDs, patient IDs or normalized names; incomplete or inconsistent identifiers still require reconciliation. Missing patient reports are shown as not reported.

## Deployment and rollback

Apply `manager-finance-schema.patch` to production Code.gs and deploy before publishing the frontend. This only extends DEFAULT_COLUMNS.manager. Existing mutation validation then permits the four new keys; existing header logic appends missing columns without moving old values. No database rewrite or test transaction is needed in production. Keep backend version 20 and frontend commit c4892eb71b6751686d17ef65dc3dee6afeb8a7e4 for rollback. Preserve new columns and business records during rollback.

Node tests cover date boundaries, target selection, same-day revenue revision, missing vs zero, separate cash/revenue/profit/outstanding, funnel attribution, patient linking and closed-item prioritization, alongside the existing security suite. Local tests do not certify production report contents or real-user form submission.
