
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
