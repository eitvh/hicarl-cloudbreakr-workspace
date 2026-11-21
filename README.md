
# IG Post Lambda Automation

An Instagram post automation project using AWS Lambda.

## Getting Started

The React frontend lives in `web/` and uses Next.js App Router, TypeScript,
Tailwind CSS v4, and shadcn/ui (Base Nova, neutral theme).

Run these commands in PowerShell:

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. The starter page demonstrates shadcn Button and Card
components. AWS Lambda integration is not configured yet.

## Add UI components

From `web/`:

```powershell
npx.cmd shadcn@latest add input label table
```

Components live in `web/src/components/ui`; import them using
`@/components/ui/<component>`. Configuration is in `web/components.json`, and
theme tokens are in `web/src/app/globals.css`.

Installation guide: https://ui.shadcn.com/docs/installation/next

## Checks

From `web/`:

```powershell
npm.cmd run lint
npm.cmd run build
```

Use `npm` and `npx` instead of their `.cmd` equivalents on macOS/Linux.
