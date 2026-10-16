# Browser outbox and rupiah formatting

Each mutation now has its own localStorage key instead of rewriting one shared array. Two tabs adding different operations cannot overwrite each other's entries. Existing array entries migrate before removal; migration failure preserves the old array. ACK receipts are written before removing a mutation, so delayed messages and legacy queue copies cannot re-enqueue confirmed operations. Receipts are retained; storage is not unlimited and browser data must not be cleared while changes remain pending.

Retry scheduling preserves the original payload and operation ID. Only server ACK or a durable rejected-operation record permits removal. Rejected input remains available in the current account's review panel. Role alone no longer assigns legacy writes to an account. Ambiguous ownership remains stored and is flagged for admin review. No automatic conflict overwrite is introduced.

All division create handlers persist the operation before inserting a visible row. Forms prevent concurrent double submission. Confirmed writes trigger a server refresh, while pending datasets remain protected from stale read responses. Other users still receive periodic updates rather than push streaming. Existing backend locking, stable row IDs, operation IDs and changed-field conflict checks remain in effect; backend version 21 is unchanged by this frontend release.

Currency uses Indonesian full grouping in KPI cards, money fields, tables, charts and exports. Values stay numeric in stored payloads.

Validation covers stale snapshots from two tabs, ACKs arriving while another tab adds input, lost/missing ACK, timeout retries, migration/quota failure, account ownership, and currency output. These controlled tests do not prove every production report is correct, zero latency, unlimited offline durability, or deduplication of separately submitted business events with different IDs. Reload all existing application tabs after deployment so old clients stop rewriting the legacy queue.
