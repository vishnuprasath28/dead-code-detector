# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build        # Type-check + production build to dist/DeadCodeDetector/
npm run build:dev    # Type-check + watch mode with auto-rebuild
```

Build output is copied to the local Mendix app directory configured in `build-extension.mjs` (default: `C:\Users\VishnuPrasathTA.AzureAD\Mendix\App-main`).

## Architecture Overview

This is a Mendix Studio Pro extension that detects dead code (unused pages, microflows, nanoflows, entities, and attributes) in Mendix projects.

### Entry Points

- **Background process**: `src/main/index.ts` - Registers the extensions menu and tab opener
- **UI tab**: `src/ui/index.tsx` - Renders the React-based dead code detector panel

### Core Modules

```
src/
├── main/
│   └── index.ts              # Background: registers ExtensionsMenu item
├── ui/
│   ├── index.tsx             # UI entry point
│   ├── DeadCodePanel.tsx     # Main React component with scan logic
│   ├── HealthScoreCard.tsx   # Displays health score (0-100)
│   ├── TabBar.tsx            # Tab navigation for 5 categories
│   ├── ResultList.tsx        # Renders filtered results by tab
│   └── ResultRow.tsx         # Individual item row with copy button
├── detector/
│   ├── index.ts              # runAllScanners() orchestrates all scans
│   ├── PageScanner.ts        # Finds unused pages via layoutCall refs
│   ├── MicroflowScanner.ts   # Finds unused microflows via call actions
│   ├── NanoflowScanner.ts    # Finds unused nanoflows
│   ├── EntityScanner.ts      # Finds unused entities
│   └── AttributeScanner.ts   # Finds unused attributes
└── utils/
    ├── widgetWalker.ts       # collectRefs() traverses widget trees
    ├── moduleFilter.ts       # isUserModule() filters system modules
    └── scoring.ts            # calculateHealthScore()
```

### Detection Algorithm

1. **Reference Collection**: `widgetWalker.ts` traverses all widgets recursively, collecting references to pages, microflows, nanoflows, entities, and attributes from props like `microflow`, `nanoflow`, `page`, `entityPath`, `attributePath`, `dataSource`, and `clientAction`.

2. **Unused Detection**: Each scanner compares the set of all user-module items against the collected references. Items not referenced are marked as dead.

3. **Module Filtering**: `isUserModule()` excludes system modules (System, App, Mx*, Atlas_*, *Commons, *_Core).

### Key Interfaces

- `IComponent` from `@mendix/extensions-api` - All entry points export `component: IComponent` with `async loaded(componentContext)`
- `ModelLike` - Abstraction over Mendix model API for `getUnitsInfo()` and `resolve()`
- `RefCollectionContext` - Holds Sets of used items for reference tracking

### Build System

- **Bundler**: esbuild (ESM format, tree-shaking, source maps)
- **TypeScript**: Strict mode, ES2023 target, no emit (esbuild handles output)
- **Externals**: `@mendix/component-framework`, `@mendix/model-access-sdk`
- **Plugins**: `copyManifestPlugin` copies `src/manifest.json`, `copyToAppPlugin` syncs to Mendix app directory

### Mendix API Usage

```ts
import { getStudioProApi } from "@mendix/extensions-api";

const studioPro = getStudioProApi(componentContext);
studioPro.ui.extensionsMenu.add({...});
studioPro.ui.tabs.open({...});
studioPro.app.model.pages.getUnitsInfo();
studioPro.app.model.microflows.resolve(...);
```
