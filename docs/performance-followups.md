# Performance follow-ups

After the FastAPI migration the app felt slow on every navigation/action. A
measurement-driven pass (June 2026) traced and fixed the per-request overhead:

| Fix | PR | Effect (prod) |
| --- | --- | --- |
| Railway moved to EU (co-located with Supabase) | — | halved every API↔DB hop |
| Drop `pool_pre_ping` (+ `pool_recycle=1800`) | #9 | `profiledb` ~142 ms → ~47 ms/request |
| De-dupe `AuthProvider` boot (one profile fetch, no `getUser`) | #10 | cold-load 4→3 calls, per-nav 3→2 |
| Offline JWKS (ES256) token verification | #11 | auth hop ~35 ms → ~0.8 ms/request |

Net: per-request auth+DB overhead **181 ms → 49 ms**; `/api/meetings` **463 → 325 ms**.
See git history (PRs #8–#12) and the diagnosis for details; all timing
scaffolding was removed in #12.

Two **optional** follow-ups remain. Both are independent of auth and were
deliberately left out of the first pass.

---

## 1. `/api/meetings` list query — multiple DB round-trips (~278 ms)

**Evidence.** After the fixes, `/api/meetings` totals ~325 ms in prod, of which
`auth ≈ 1 ms` and the Profile lookup `≈ 47 ms` — the remaining **~278 ms is the
handler**, i.e. the list query itself. Each DB round-trip costs ~24 ms in-region
(Railway EU → Supabase pgbouncer), and the endpoint issues several.

**Where.** `apps/api/app/routers/meetings.py` (`list_meetings`, ~L45-76):
- a `SELECT COUNT(*)` for pagination, then
- a `SELECT Meeting … LIMIT/OFFSET` with `options(*_includes())`, where
  `_includes()` is `selectinload(meeting_type)`, `selectinload(created_by)`,
  `selectinload(attendees).selectinload(MeetingAttendee.profile)`.

`selectinload` issues **one extra query per relationship** (a separate `IN (…)`
round-trip), so a page is roughly COUNT + main + 3 select-in = ~5 sequential
round-trips. With `statement_cache_size=0` (required by the pgbouncer transaction
pooler) none of these use prepared-statement caching.

**Things to investigate / try.**
- Collapse round-trips: use `joinedload` (single JOIN) for the to-one relations
  (`meeting_type`, `created_by`) instead of `selectinload`; keep `selectinload`
  only for the to-many `attendees`/`profile`. Measure — JOINs can transfer more
  rows but save round-trips.
- Drop the separate COUNT: compute total with a window function
  (`func.count().over()`) in the main query, or only when `page == 1`.
- Confirm whether the meetings **list** actually needs `attendees` +
  attendee `profile` eagerly loaded, or whether the list view can omit them and
  load them only on the detail page.
- Check the same pattern in other list endpoints (`ordem_items` also resolves
  refs in `apps/api/app/core/ordem_resolver.py`).

**How to measure.** Re-add a lightweight `Server-Timing`/log around the handler
(the approach used in the diagnosis), or run `EXPLAIN (ANALYZE)` for the query
and count round-trips. Compare before/after on the deployed EU API.

---

## 2. Client page-load wall time (~2 s/page)

**Evidence.** Even after the API got faster, full page loads stayed ~2.0–2.8 s
(measured by navigating real pages). The API calls per navigation are now small
(~2 calls, each fast), so the wall time is dominated by the **client**: JS
download/parse, React hydration, and render — not the network.

**Where to look.**
- The app gates rendering on `useAuth().loading`
  (`apps/web/src/components/providers/auth-provider.tsx`) → first paint waits on
  the initial profile fetch + Supabase `getSession()`. With #10 this is one
  fetch, but render is still gated.
- `apiFetch` calls `supabase.auth.getSession()` on **every** request
  (`apps/web/src/lib/api-client.ts`); each adds a small client-side gap.
- TipTap and other heavy editor deps (already code-split per earlier perf work —
  verify they aren't pulled into the initial route bundles).

**Things to investigate / try.**
- Run the Next.js bundle analyzer + a Lighthouse/Web-Vitals trace on a deployed
  build to see what dominates (JS execution vs network vs hydration).
- Look for client components that could be Server Components, and data that could
  be fetched server-side / streamed rather than client-fetched after hydration.
- Avoid blocking the whole shell on `loading`; render the layout immediately and
  show per-section skeletons.
- Cache the access token in memory instead of calling `getSession()` per request.

**How to measure.** Lighthouse (mobile + desktop), `@next/bundle-analyzer`, and
the browser Performance panel on the deployed Vercel app. Track LCP/TTI before
and after.

---

*Owner: unassigned. These are nice-to-haves, not regressions — pick up if/when
page responsiveness becomes a priority again.*
