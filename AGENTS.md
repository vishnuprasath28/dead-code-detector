# AGENTS.md - DeadCodeDetector

## Project Overview

Mendix Studio Pro extension that detects dead code. Built with TypeScript, React 18, and esbuild. Uses the `@mendix/extensions-api` for Studio Pro integration.

## Build/Lint/Test Commands

```bash
npm run build        # Type-check (tsc --noEmit) + production build (esbuild)
npm run build:dev    # Type-check + watch mode (auto-rebuild on changes)
```

- **No test framework** is configured. Add tests with vitest/jest if needed.
  - To add vitest: `npm i -D vitest @vitest/ui` then `npx vitest` to run, `npx vitest path/to/test.ts` for a single test.
- **No linter** is configured. Add ESLint if needed.
  - To add ESLint: `npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin` then `npx eslint src/`.
- Build outputs to `dist/DeadCodeDetector/` and copies to the local Mendix app directory.
- **Always run `npm run build` before submitting changes** — it will fail on any TypeScript error.

## Code Style & Conventions

### TypeScript
- **Strict mode enabled** (`strict: true` in tsconfig.json)
- Target: ES2023, Module: ESNext, ModuleResolution: Bundler
- JSX: `react` (classic JSX transform)
- No emit from tsc; esbuild handles bundling

### Imports
- Use bare imports for Mendix APIs: `import { IComponent, getStudioProApi } from "@mendix/extensions-api"`
- React imports: `import React, { StrictMode } from "react"`
- Node built-ins use `node:` prefix: `import fs from "node:fs/promises"`
- Relative imports use `.js` extension (esbuild resolves `.ts` → `.js`): `import { foo } from "./bar.js"`
- Import types with `import type` when only used for type annotations

### Formatting
- **Indentation**: 4 spaces for `.ts`/`.tsx`, 2 spaces for `.json`
- **Line endings**: LF
- **Final newline**: required (enforced by .editorconfig)
- No trailing whitespace
- No semicolons unless required for disambiguation

### Naming Conventions
- **Components**: exported as `component` constant implementing `IComponent`
- **Entry points**: `src/main/index.ts` (background), `src/ui/index.tsx` (UI tab)
- **Menu/Tab IDs**: PascalCase with extension prefix, e.g., `DeadCodeDetector.MainMenu`
- **Functions**: camelCase (`scanUnusedMicroflows`, `collectRefs`)
- **Types/Interfaces**: PascalCase (`DeadItem`, `RefCollectionContext`, `ModelLike`)
- **Constants**: camelCase for local, UPPER_SNAKE_CASE for module-level constants
- **Variables**: camelCase, descriptive names

### Error Handling
- Use try/catch for file operations and Mendix API calls
- Catch blocks should be empty or log with `console.error()` — never throw from scanner functions
- Mendix API calls are async; use `await` consistently
- Guard against null/undefined with optional chaining (`?.`) and nullish coalescing (`??`)

### React/JSX Style
- Functional components with `React.FC<PropsType>` pattern
- Inline styles as objects (no CSS files or CSS-in-JS libraries)
- Color values as hex strings: `"#2563eb"`, `"#7c3aed"`
- No external UI libraries — all components are hand-built

### Detector Architecture
- Each scanner follows the pattern: collect all elements → walk sources for references → filter unused
- Shared `RefCollectionContext` accumulates references across all scanners
- Scanner files: `src/detector/PageScanner.ts`, `MicroflowScanner.ts`, `NanoflowScanner.ts`, `EntityScanner.ts`, `AttributeScanner.ts`
- Orchestrator: `src/detector/index.ts` (`runAllScanners`)

### Key Mendix SDK Patterns
- Navigation profiles: `navDoc.desktopProfile`, `phoneProfile`, `tabletProfile`, `webProfile`, `nativeProfile`
- Home page is nested: `profile.homePage.page` (not a direct reference)
- Microflows loaded via `model.resolve<Microflows.Microflow>("Microflows$Microflow", qn)`
- Nanoflows loaded via `model.resolve<Microflows.Nanoflow>("Microflows$Nanoflow", qn)`
- Action activities accessed via `flow.objectCollection.objects`, iterate and check `$Type`

### Build System
- **Bundler**: esbuild with ESM format, tree-shaking, source maps
- **External packages**: `@mendix/component-framework`, `@mendix/model-access-sdk`
- **Asset handling**: images/fonts copied via esbuild file loader
- **Manifest**: `src/manifest.json` copied to output directory

### File Structure
```
src/
  main/index.ts           # Background process entry point
  ui/index.tsx            # UI tab entry point (React)
  ui/DeadCodePanel.tsx    # Main panel component
  ui/TabBar.tsx           # Tab navigation
  ui/ResultList.tsx       # Results list rendering
  ui/ResultRow.tsx        # Individual result row
  ui/HealthScoreCard.tsx  # Health score display
  detector/index.ts       # Scanner orchestrator
  detector/PageScanner.ts
  detector/MicroflowScanner.ts
  detector/NanoflowScanner.ts
  detector/EntityScanner.ts
  detector/AttributeScanner.ts
  utils/widgetWalker.ts   # Widget reference collection
  utils/flowTraversal.ts  # Flow activity iteration
  utils/flowActionRefs.ts # Flow action reference extraction
  utils/moduleFilter.ts   # Module filtering utilities
  utils/scoring.ts        # Health score calculation
  manifest.json           # Extension manifest
build-extension.mjs       # Main esbuild config
build.helpers.mjs         # Shared build utilities
```

### Key Rules
1. Always run `npm run build` before submitting changes
2. Do not commit `dist/` directory
3. Keep `appDir` in build-extension.mjs updated to local Mendix app path
4. Follow .editorconfig settings strictly
5. Use `IComponent` interface for all entry points
6. Make targeted changes only — never rewrite entire files unless necessary
7. Do not modify package.json, tsconfig.json, or build config unless explicitly asked
