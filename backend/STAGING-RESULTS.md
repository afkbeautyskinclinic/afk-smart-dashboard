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

## Loading optimization candidate — 14 October 2026 follow-up

The Owner screenshot showed successful login followed by loading placeholders.
Code review found three sequential Owner data requests, each repeating session
validation, spreadsheet access and audit operations. The candidate frontend now
loads all 11 Owner datasets in one request. Backend session validation reads existing
auth storage without initializing both auth schemas; the spreadsheet handle is
reused only within one execution, while account/session authorization is still
reread. No shared authentication cache or weaker password hashing was introduced.

Failed data reads are now recorded and represented by "Gagal memuat" on unloaded
Owner KPIs. The read request has a 45-second fetch timeout without an automatic
second attempt, avoiding the previous two 60-second attempts before reporting
failure. Periodic refresh remains available for a later retry.

24 local regression tests pass, including one-tier Owner requests, distinguishable
loading failures and current-account checks despite spreadsheet handle reuse.
The updated backend patch applies to the observed source. These optimizations
are NOT yet deployed to the staging Web App or production, and new browser timing
has not been measured. The existing staging version 3 remains unchanged.

Observed earlier backend login was about 2.3 seconds; that measurement excludes
full frontend rendering/network latency and is not a promise for the new version.
Further profiling must separately measure password verification, session lookup,
dataset reads, HTTP round trips and rendering after the updated staging deploy.

## Owner loading optimization — deployed staging version 4

On 14 October 2026 at approximately 12:52 Asia/Jakarta, the synthetic staging
Web App was updated to version 4 on the existing deployment with unchanged
Anyone access and owner execution. Production Apps Script and main were not
modified. The full staging frontend now contains the single-tier Owner request,
45-second fetch response timeout with no automatic retries, and failed-load labels.
The backend reuses a spreadsheet handle within one execution and validates
current session/account state without auth schema initialization.

The 21-check synthetic backend security suite passed again (12:51:27–12:52:01).
A subsequent three-sample function-level measurement completed at 12:53:45:

| Sample | Login function, including audit | Fetch 11 Owner datasets | Password verification |
| --- | ---: | ---: | ---: |
| 1 | 2331 ms | 2549 ms | 1438 ms |
| 2 | 2829 ms | 2327 ms | 1187 ms |
| 3 | 2375 ms | 2733 ms | 1605 ms |

These measurements use a small synthetic spreadsheet. They exclude HTTP redirects,
network transfer, browser rendering, and real production data volume. They do not
establish end-to-end latency or a before/after improvement ratio. Password hashing
strength was not reduced. All 11 requested datasets were returned in each sample.

Commit 5b4bef192df64b5d173be6e7fb88390fb67a9bdf passed the 24 Node regression
tests locally and both GitHub Actions push/PR runs. The deployed login page loaded
successfully in the browser. Full Owner browser verification remains pending:
two secure browser-auth requests could not target the nested iframe password
field, so manual login handoff is required. Do not treat the frontend loading
issue as resolved until that verification succeeds.
