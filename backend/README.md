# Candidate Apps Script security patch

Status: prepared from the AFK editor on 14 October 2026; not installed or deployed.
The frontend's Web App URL matches the active deployment named
"AFK Media Safety - 2 MB Upload Limit", version 19 (21 September 2026).
Two active deployments were listed; only the matching one was inspected.
The Triggers page showed zero triggers for the signed-in account. This does not
prove that another account has no triggers or that backup jobs run elsewhere.
Editor source and deployed version source have not been compared byte-for-byte.

## Changes

- `route_`: disable legacy bootstrap/fetch/sync/syncMutations/uploadTreatmentMedia
  HTTP actions that accept the shared backend token. Secure actions retain session
  authorization; login and all secure actions except secureFetch require POST.
  secureFetch GET remains compatible with the current frontend.
- `afkValidateSession_`: reject invalid expiration timestamps; check the current
  account still exists, is active, matches the session userId and has the same
  known role. Role changes invalidate old sessions rather than upgrading them.
- `afkHandleSecureFetch_`: recursively remove credential fields from returned
  Settings, including legacy account passwords, token, secret and API-key fields.
  The spreadsheet's stored Settings are not modified.

## Apply only in a separate staging project

Export the complete current Apps Script project to a private working directory.
Keep a private backup: Code.gs currently contains a legacy shared token. Do not
commit that original token, script properties, account hashes, or patient data.

From the export directory:

    git apply --check /path/to/apps-script-security.patch
    git apply /path/to/apps-script-security.patch

The patch is based on the editor source, not the older sync module in GitHub.
If it does not apply cleanly, compare the current source instead of forcing it.
`SecurityReplacements.gs` contains the same candidate replacement functions for
review/testing. It is NOT an additive module: do not paste it alongside existing
functions of the same names. Replace route_ in Code.gs, replace the two specified
functions in AuthFoundation.gs, and add the sanitizer once.

Create a separate Apps Script project with a separate spreadsheet containing only
synthetic users and reports. Set its spreadsheet/media properties to staging
resources. Do not copy the production database ID or token. Preserve the backend
modules and manifest needed by the current app. Validate the runtime and deploy
only the staging project first. Confirm the API URL in the staging frontend points
to that staging deployment. Review permissions before granting new access.

Verify real Apps Script login/session behavior, role reads/writes, Owner notes,
account administration, media upload, export, and mutations against synthetic data.
Verify legacy HTTP actions are rejected even when given a valid staging shared
token. Check every other client/integration has migrated away from legacy routes
before applying this patch to production. Another active deployment may continue
to expose old code unless it is reviewed separately.

## Validation performed

    node --test tests/security.test.cjs tests/backend-security.test.cjs

17 tests pass: 9 frontend tests and 8 additional backend tests in mocked Node.js
contexts. The backend tests run the replacement functions with synthetic account,
session and settings data. They do not certify Apps Script service behavior,
production authentication, multi-user performance or deployed-version consistency.

## Remaining findings

- Role grants let operational staff read all six division datasets. The frontend
  uses those datasets for dashboard/reconciliation views. Agree field-level access
  and adjust both frontend and backend before narrowing them.
- The password scheme is custom iterated SHA-256, not a standard adaptive password
  KDF. A compatible migration needs separate design and runtime benchmarks.
- Legacy Settings may retain account passwords; this patch prevents their return
  through secureFetch but does not remove them from storage.
- Mutation deletes are physical; soft delete needs changes across fetch, exports,
  reconciliation, retries and migration, not only the delete handler.
- Session/operation lookups grow with all historical rows; retention/indexing and
  latency need measurement before introducing a cache that could weaken revocation.
- Upload validation allows broad image/video MIME families plus PDF; exact format,
  magic-byte validation and private media access remain to be checked.
- Input formula safety, settings mutations, duplicate IDs, rate-limit races,
  concurrency and audit-write failures remain to be tested.
