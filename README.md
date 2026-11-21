
# IG Post Lambda Automation

An Instagram post automation project using AWS Lambda.

## Getting Started

The React frontend lives at the repository root and uses Next.js App Router, TypeScript,
Tailwind CSS v4, and shadcn/ui (Base Nova, neutral theme).

Run these commands in PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. The starter page demonstrates shadcn Button and Card
components. AWS Lambda integration is not configured yet.

## Add UI components

From the repository root:

```powershell
npx.cmd shadcn@latest add input label table
```

Components live in `src/components/ui`; import them using
`@/components/ui/<component>`. Configuration is in `components.json`, and
theme tokens are in `src/app/globals.css`.

Installation guide: https://ui.shadcn.com/docs/installation/next

## Checks

From the repository root:

```powershell
npm.cmd run lint
npm.cmd run build
```

Use `npm` and `npx` instead of their `.cmd` equivalents on macOS/Linux.

## Deploy to Vercel

Use the repository root as the Vercel Root Directory (leave it blank, rather than
`web`). Select the Next.js framework preset and keep the default install, build,
and output settings. If the project previously used `web`, clear that Root
Directory setting before deploying this layout.

## Read-only monitoring dashboard

The dashboard reads the existing AUTOMATION_IG_MONGO_* and
AUTOMATION_IG_STAGING_DATABASE / COLLECTION, STATE_COLLECTION, USAGE_COLLECTION
variables from server environment configuration. No database writes, index
creation, Lambda invocation, or AI calls are implemented.

Run npm.cmd run dev locally. Select the source job and the Malaysia usage event
date (for the documented benchmark, posts are dated November 19 while usage
was recorded November 20). Staging lists omit vectors and paginate 5 posts.

The /login page defaults to username admin (overridable with server-only DASHBOARD_USERNAME). The password must be supplied through server-only DASHBOARD_PASSWORD; there is no fallback password. Missing or empty DASHBOARD_PASSWORD disables sign-in and invalidates sessions. Configure it in local .env and Vercel Production environment variables; redeploy after changing Vercel variables. The form replaces browser Basic authentication and applies locally and in production. Dashboard APIs and original-log downloads require a signed, HttpOnly, SameSite=Lax session cookie (Secure over HTTPS), expiring after eight hours. Logout is at the bottom of the navigation panel and clears the cookie.

DASHBOARD_SESSION_SECRET can supply a stable random session-signing secret. When absent, the configured server-only MongoDB URI provides the secret material; production without either fails closed at sign-in. Credentials are included in key derivation, so changing credentials invalidates existing sessions. Session data contains only expiry and a random nonce, never the password or URI. MongoDB is not used to store sessions. Never prefix credentials or session secrets with NEXT_PUBLIC_.

Usage estimates use stored event pricing, not current environment rates.
AWS infrastructure billing is not included. Report run counts match the Python report: runs started on the selected Malaysia event date plus earlier runs with events on that date. Includes per-run counts and API outcomes, totals, and a JSON export. Selectable dates come from stored report records; the latest available date is the default.

Embedding cost uses only usage collection api_usage records with operation=embedding. The separate finished-date filter uses Malaysia midnight boundaries on finished_at. All-record mode includes unfinished API calls; missing cost stays unknown. Cost and daily report filters are independent of the selected source job. No AWS billing is included.

The last automation time is the latest source_job.created_at. Job summaries reflect retained, mutable staging records. The UI defaults to dark mode, remembers theme preference, and refreshes through a private no-store API without page navigation. Detail panels scroll within a viewport-height shell on small screens. Refresh manually to fetch current data.

### Job timing, API details, and AWS scenarios

Overview shows source-fetch duration and the observed span from source-job
creation to the latest linked invocation finish. The observed span is not an
authoritative completion timestamp. Missing invocation finish times are counted.

Embedding outcome badges open the latest 25 records for that outcome in the
applied finished-date window, across pricing groups. The read-only projection
includes model, post/run IDs, timestamps, tokens, usage source, estimate, and
sanitized error type. API success is separate from successful publication.

Extraction is enabled only when API records link through invocation run IDs to
the selected source job. It is independent of daily and embedding-date filters.
No extraction records means the tab stays locked.

AWS monitoring currently explains the proposed read-only CloudWatch integration. It does not connect to AWS or show a bill. Metrics/logs, configuration access, regional pricing and cost coverage must be established before implementation. No AWS credentials, service calls, or infrastructure changes were added.

Dropdowns use shadcn Select with themed popups. Run investigation separates Summary, Linked posts, and API results into bounded tabs. Posts and API groups paginate three per page; the backdrop and Escape dismiss the dialog.


The dashboard uses fixed side navigation, identical metric cards across sections, a post-outcome donut, and report event bars. Staging is paginated five posts at a time; run details are paginated six at a time and open in a dialog. Metric definitions and cost scope are available through keyboard-accessible info tooltips. The overview was checked in headless Edge at desktop, laptop and phone viewport sizes.


## HK monitoring and investigations

HK is the configured active pipeline; MY and SG selectors are disabled placeholders. Region selection does not switch databases yet. The overall AI estimate sums all recorded embedding and extraction costs across dates, with unknown calls preserved; it excludes AWS. Embedding filters affect only the detailed embedding view.

Run investigation accepts a run UUID across all dates and displays projected run metadata, API outcomes, recorded events, and paginated linked posts. Current staging content is separate from historical events. All queries remain read-only.

Activity is inferred on manual refresh, not a heartbeat: recent means within five minutes. The preview selector changes only the explicitly labeled demo dialog, never real statistics. No automatic polling or AWS calls are enabled.

AWS log import processes an existing text, CSV, or CloudWatch events JSON file up to 5 MB in browser memory. Standard text Lambda REPORT messages are supported. It does not upload or persist the file, call AWS, deduplicate rows, or infer dollar rates. Partial files do not represent full-job totals. Fetching new AWS data is a separate action and is not guaranteed free.

Parser tests: node --experimental-strip-types --test --test-isolation=none tests/log-report.test.mts (Node 24). Browser checks covered five-post/six-run pagination, run UUID search, activity previews, no-network log imports, and mobile/desktop overview fit.


## November 22 interface update

Official logo assets are stored locally in public/brand: Cloudbreakr from https://corporate.cloudbreakr.com/wp-content/uploads/2024/05/CB_logo-e1716525290534.png and Instagram from https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg.

Investigation supports exact run UUID, post ID, or user ID. User lookup covers retained staging records only and is bounded to 100 posts; matching runs are bounded to 100, with an explicit limitation message. It creates no indexes and makes no writes. IDs remain strings.

The red Live (Dummy) header control opens a simulated popup dated 21/11/2026. It performs no polling.

AWS file selection immediately replaces the local snapshot; leaving the AWS tab or refreshing clears it. Select all relevant CloudWatch streams in the job time window: execution environments have separate streams, and last-event time is not start time. Automatic AWS retrieval is not enabled.


## Current monitoring behavior (22 Nov 2026)

AWS **Job cost estimate** automatically uses recorded job runtimes and worker counts; no calculator inputs are required. It shows an ARM–x86 range using Singapore tier-1 rates, with formula tooltips and a separate observed-log subtotal. The full-job model assumes the 1024 MB configuration seen in the partial logs applies to all workers. Application start/finish times are a runtime proxy, not Lambda billed duration. SQS assumes three small-message actions per recorded worker (send, receive, delete), with fetch on FIFO and embedding on standard queues. Scheduler assumes one kickoff. Free allowances, CloudWatch, networking, KMS, missing invocations, polling, batching, and discounts are excluded. This is an estimate, not an AWS bill. The supplied job currently gives approximately $0.076905–$0.093490 before allowances.

Invocation request IDs open observed duration, billed compute, memory, formula-derived cost and available log events. Application events are linked only within an unambiguous START/END window in the same export. An available application run ID opens the run/post investigator. REPORT alone does not prove success. Custom imports expose REPORT metrics; additional event detail is available for the bundled snapshot.

Live opens in a popup. The red **Live (Dummy)** header button always identifies simulated data. Real live status remains hidden without recent unfinished activity. Fetch, embedding and extraction appear concurrently; missing real progress denominators are marked unavailable. Dummy refresh changes local sample counters only. Captions now use a continuous, bounded scroll area and copy the entire caption, without splitting it into pages. Popups have entry transitions, tab skeletons and reduced-motion support.

### Vercel `/api/dashboard` 503

The supplied production request ran for 8.05 seconds, consistent with the configured 8-second MongoDB server-selection timeout; this is evidence, not a confirmed diagnosis. Middleware succeeded. Vercel's HTTP external-request summary does not establish whether a MongoDB protocol connection was attempted.

1. Confirm server-only `AUTOMATION_IG_MONGO_URI`, `AUTOMATION_IG_MONGO_DATABASE`, and the configured staging/state/usage collection variables exist in **Vercel Production**, then redeploy. Local `.env` does not configure the deployed project. Keep `DASHBOARD_PASSWORD` server-only too.
2. Verify Atlas cluster availability, database-user credentials/read permissions, and Network Access for the deployment's outbound addresses. A developer laptop allowlist entry does not cover Vercel. The browser's remote Vercel IP is not the function's outbound IP. Do not disable TLS or dashboard authentication.
3. The updated API returns a sanitized diagnostic code and reference: `MONGO_CONFIG`, `MONGO_AUTH`, `MONGO_PERMISSION`, `MONGO_NETWORK`, `MONGO_CONNECTION_TIMEOUT`, or `MONGO_QUERY_TIMEOUT`. Match the reference in Vercel runtime logs. Raw credentials, URI and database messages are never returned or logged.

Report queries now obtain matching run IDs from the day's aggregated events instead of performing a correlated lookup for every run. No database indexes or data are modified. Production connectivity must still be verified after deployment; local success does not prove Vercel access.
