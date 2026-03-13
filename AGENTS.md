# AGENTS.md

## Purpose

- Define repository-specific instructions for coding agents.
- Keep guidance concrete: exact commands, paths, and constraints.
- Keep this file current when commands or conventions change.

## Repository Snapshot

- Project: `LevisPotholeSignal`
- Primary stack: `React 19 + Vite 6` (JavaScript, ESM)
- App goal: capture pothole GPS points and submit reports to ArcGIS (`src/App.jsx`)
- Main code location: `src/` with shared UI flow in `src/App.jsx` and feature UI in `src/components/`

## Commands

- Install dependencies: `npm install`
- Start development environment: `npm run dev`
- Build production artifacts: `npm run build`
- Preview production build: `npm run preview`
- Run lint checks: `npm run lint`
- Run tests: `npm test`
- Run formatters/autofix: `npm run lint -- --fix`
- Required pre-merge verification: `npm test && npm run lint && npm run build`

## Workflow Rules

- Read this file before making edits.
- Match existing project conventions and file structure.
- Keep changes scoped to the user request.
- Preserve French user-facing copy unless the user asks for language/content changes.
- Prefer local edits in `src/components/` for isolated UI behavior; keep cross-feature state flow in `src/App.jsx`.
- For changes to geolocation capture or ArcGIS submission logic, validate the flow in dev mode and avoid unnecessary external submissions (use app debug mode when possible).
- Ask before destructive actions (mass deletes, history rewrites, resets).
- Run relevant verification commands before finalizing changes.

## Pull Request Expectations

- Summarize behavior changes and impacted files.
- Include verification commands run and key outcomes (`npm run lint`, `npm run build`, and manual browser checks when UI behavior changes).
- Call out known risks, assumptions, or follow-up work.

## Monorepo Notes

- Add nested `AGENTS.md` files in subdirectories when local rules differ.
- The nearest `AGENTS.md` to a file should define local instructions.

## Detection Notes

- Detected Node.js from package.json (package manager: npm).
- ESLint is configured in `eslint.config.js`; no standalone test framework is configured in `package.json`.
