# Apps Script staging runtime results

14 October 2026, Asia/Jakarta. The candidate patch was executed in a separate
Apps Script project named AFK Security Staging - Synthetic Tests - 2026-10-14.
No production spreadsheet ID or production shared token was copied into it.
The manifest requests Google Sheets scope only; Drive and external requests
are omitted for this runtime suite. Google account authorization was completed
by the account owner.

Observed execution: started 08:41:42, result logged 08:42:39, completed 08:42:40.
Result: `ok: true`, 21 checks passed. Approximate total suite duration: 58 seconds;
this includes setup, account hashing, sheet I/O and multiple logins, and is not
an individual-request latency measurement or a multi-user performance benchmark.

Verified directly in Apps Script with a new synthetic spreadsheet:

1. Login creates a session.
2. Valid session returns expected identity.
3. Authorized CRM dataset read succeeds.
4. Forbidden manager dataset read is rejected.
5. Authorized CRM report mutation succeeds.
6. Repeated mutation is recognized as already applied.
7. Retry leaves exactly one report.
8. Staff cannot set Owner note.
9. Forbidden write is rejected despite client role tampering.
10–14. Legacy bootstrap, fetch, sync, syncMutations and media actions are rejected.
15. Settings response strips legacy account password and backend token.
16. Disabling an account rejects its existing session.
17. Changing an account role rejects its previous session.
18. Invalid expiry timestamp is rejected.
19. Logout revokes the session.
20. Media exceeding 2 MB is rejected before upload.
21. HTML MIME upload is rejected.

17 Node regression tests and GitHub Actions had also passed for the candidate.
These counts describe different suites; they are not 38 independent feature
certifications.

## Scope limits and next gates

This run calls backend functions through the Apps Script editor. It does not
validate the deployed HTTP endpoint, CORS/redirect handling, real browser sessions,
frontend report exports, real file contents, private Drive media access, backups,
restore, polling freshness or simultaneous multi-user writes. No Web App staging
endpoint has been deployed. No production Apps Script deployment has changed.

Next: deploy a separately authorized staging Web App, point a staging frontend at
it, and validate HTTP role enforcement, Owner/Manager flows, network-failure retries,
conflicting edits, reports/exports and realistic concurrent input with synthetic
records before reviewing production rollout. Keep the production cutover separate
from merging the repository: GitHub Pages deploys frontend on pushes to main,
whereas Apps Script needs its own deployment version update.

`StagingRuntime.gs` is the reproducible runtime suite. Use it only in a separate
project with the full candidate backend modules and a blank property store.
It refuses an existing database ID on first setup and verifies the staging ID/name
on subsequent runs. It creates synthetic accounts, reports, sessions and audit
records. Do not install it in production.

## Restricted Web App and browser RPC tests — follow-up

A separate staging Web App version 1 was deployed on 14 October 2026 with
access **Only myself**, executing as the account owner. A browser successfully
loaded its synthetic test page and completed 12 RPC mutation calls (6 distinct
operation/row IDs submitted twice). All replies were APPLIED or ALREADY_APPLIED,
and the final read contained exactly 6 distinct rows. Seven conflict checks passed:
baseline creation, first edit, stale same-field rejection, winning value preserved,
stale different-field merge, both fields retained, and missing update rejected.
Observed synthetic backend login: 2318 ms (lookup 393 ms, password verification
714 ms, session creation 804 ms). Total browser suite: 80389 ms, including login,
mutation requests, verification reads and the sequential conflict suite. This is
not a per-request or large-load benchmark; it does not certify hundreds of users.

The test page uses google.script.run RPC inside Google’s authenticated Web App.
It verifies real concurrent execution/locking and backend outcomes, but not the
cross-origin fetch transport from GitHub Pages. The staging endpoint remains
restricted to the owner. The production endpoint and production data are unchanged.

The frontend candidate now also:
- polls while visible, authenticated and online at a per-tab interval of 30–45 s;
  pauses while writes are pending or fetch/sync is busy;
- refreshes all Owner source datasets and only the active page datasets for staff;
- sends secureFetch credentials in the POST body, not URL query parameters;
- returns a revoked/expired current session to login;
- neutralizes CSV formula text and limits Owner exports to the Owner role.

21 local regression tests pass for the expanded frontend/backend candidate.
The actual GitHub Pages-to-staging endpoint transport, every division’s form,
CSV/PDF downloads, realistic multi-user load and media storage remain pending.
