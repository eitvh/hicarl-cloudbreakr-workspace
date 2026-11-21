
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

Set DASHBOARD_PASSWORD in Vercel server environment settings before deployment.
Production requests are blocked until configured; HTTP Basic authentication
accepts any username and that password. Use HTTPS. Local development is unlocked
unless a password is set. Prefer a MongoDB user restricted to read access.
Never prefix MongoDB credentials with NEXT_PUBLIC_.

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

The separate Live demo screen uses 21/11/2026 (Dummy), local sample counters, and animated charts. Queue and Scheduler signals are examples, not AWS measurements. It performs no polling. Motion respects prefers-reduced-motion.

AWS file selection immediately replaces the local snapshot; leaving the AWS tab or refreshing clears it. Select all relevant CloudWatch streams in the job time window: execution environments have separate streams, and last-event time is not start time. Automatic AWS retrieval is not enabled.


## In-place latest-job activity and staging filters

The header status opens latest-job activity inside the existing dashboard content area. It always uses the latest job snapshot, independently of an older selected report job. Activity remains inferred at manual refresh, not a worker heartbeat. The Dummy selector inside that panel previews states for 21/11/2026; it does not affect real report cards or invoke AWS. The former standalone Live demo navigation has been removed. Job AI estimates join usage events to the latest job through run IDs.

Staging supports exact string post/user IDs, embedding status, and publication status, with five posts per page. Rows open a bounded Details/Full caption dialog. Full captions paginate in Unicode code points, 450 per page. No embedding vectors or sensitive worker tokens are exposed.

The header uses the standalone transparent Cloudbreakr symbol from https://corporate.cloudbreakr.com/wp-content/uploads/2024/05/cropped-logo-Cloudbreark-small-192x192.png alongside the Cloudbreakr title. The Instagram pipeline mark is a custom outline SVG with no background.

AWS monitoring includes a How to download logs guide for Search all log streams and Actions > Download Search Results. Imports remain local and ephemeral.
## Live/report separation and bundled CloudWatch snapshot

The default job is now the newest source job that has source_done=true, retained staging posts, and zero unresolved retained posts. Jobs without retained evidence are not assumed complete. The header live indicator is shown only for recent unfinished activity (fetching, embedding, or attention) and is hidden for completed, stale, idle, or unavailable snapshots. It is inferred on refresh, not a worker heartbeat. Clicking it replaces the content area with live-only details and hides completed-report cards and filters. The separate Live preview (Dummy) navigation uses simulated values dated 21/11/2026 and never impersonates real activity.

The four supplied CloudWatch exports are bundled in data/cloudwatch/full-20261119-v1.json, preserving their original CSV contents. The authenticated /api/aws-snapshot route returns deduplicated REPORT records or downloads an original CSV by allowlisted file index. No raw logs are placed in public/. Each original download was verified byte-for-byte against the supplied file.

Coverage: 800 exported events, 136 unique REPORT requests, no duplicate REPORT request IDs, 106.144 billed seconds, 106.144 GB-seconds, peak used memory 194 MB. These are partial exports, not full-job coverage. No AWS dollar bill is inferred. The UI provides Usage summary, Files & downloads, and Invocation records tabs; custom imports remain ephemeral browser data.

IDs and events have explicit labels. Linked posts support paginated full-caption viewing and copying the complete caption. The country selector uses a local Hong Kong SVG flag (https://flagcdn.com/hk.svg), and headings use Manrope. Browser checks covered live/completed separation with an isolated response fixture, absence of a live indicator for the actual completed job, full-caption clipboard contents, original file downloads, and mobile panel fit. No database writes were performed.
