// src/detector/PageScanner.ts

import type { Pages } from "@mendix/extensions-api";
import type { DeadItem, ModelLike, UnitInfoLike } from "./index.js";
import type { RefCollectionContext } from "../utils/widgetWalker.js";
import { collectRefs } from "../utils/widgetWalker.js";
import { isScannableModule, getModuleName } from "../utils/moduleFilter.js";

// Pages matching these patterns are navigation entry points.
// The Mendix navigation document is not accessible via the Extensions API.
const HOME_PAGE_PATTERNS = [
    /^Home_/i,
    /^Home$/i,
    /^Homepage/i,
    /^Landing/i,
    /^Login/i,
    /^Index$/i,
    /^Default$/i,
    /^Main$/i,
    /^Start$/i,
    /^Welcome$/i,
];

function isNavigationEntryPoint(name: string): boolean {
    return HOME_PAGE_PATTERNS.some(p => p.test(name));
}

export async function buildScannablePagesMap(
    model: ModelLike,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<Map<string, string>> {
    const unitsInfo = await model
        .getUnitsInfo()
        .catch(() => [] as ReadonlyArray<Readonly<UnitInfoLike>>);

    const allPages = new Map<string, string>();
    for (const info of unitsInfo) {
        if (info.$Type !== "Pages$Page") continue;
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        allPages.set(info.qualifiedName, info.name);
    }
    return allPages;
}

export async function collectPageReferences(
    model: ModelLike,
    ctx: RefCollectionContext,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<void> {
    const unitsInfo = await model
        .getUnitsInfo()
        .catch(() => [] as ReadonlyArray<Readonly<UnitInfoLike>>);

    // ── 1. Walk all user pages ───────────────────────────────────────────────
    const pageInfos = unitsInfo.filter(u => u.$Type === "Pages$Page");
    for (const info of pageInfos) {
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        try {
            const page = await model.resolve<Pages.Page>(
                "Pages$Page",
                info.qualifiedName
            );
            if (page) collectRefs(page, ctx);
        } catch {
        }
    }

    // ── 2. Walk layouts ──────────────────────────────────────────────────────
    const layoutInfos = unitsInfo.filter(u => u.$Type === "Pages$Layout");
    for (const info of layoutInfos) {
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        try {
            const layout = await model.resolve("Pages$Layout", info.qualifiedName);
            if (layout) collectRefs(layout, ctx);
        } catch {
        }
    }

    // ── 3. Walk snippets ─────────────────────────────────────────────────────
    const snippetInfos = unitsInfo.filter(u => u.$Type === "Pages$Snippet");
    const resolvedSnippets = new Set<string>();

    for (const info of snippetInfos) {
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        if (resolvedSnippets.has(info.qualifiedName)) continue;
        resolvedSnippets.add(info.qualifiedName);
        try {
            const snippet = await model.resolve("Pages$Snippet", info.qualifiedName);
            if (snippet) collectRefs(snippet, ctx);
        } catch {
        }
    }

    // Second pass — snippets queued during page/layout walk
    const pendingSnippets = ctx.pendingSnippetQualifiedNames;
    if (pendingSnippets) {
        for (const qn of pendingSnippets) {
            if (resolvedSnippets.has(qn)) continue;
            resolvedSnippets.add(qn);
            try {
                const snippet = await model.resolve("Pages$Snippet", qn);
                if (snippet) collectRefs(snippet, ctx);
            } catch {
            }
        }
    }
}

export function computeDeadPages(
    allPages: Map<string, string>,
    ctx: RefCollectionContext
): DeadItem[] {
    const deadItems: DeadItem[] = [];
    for (const [qualifiedName, name] of allPages) {
        const mod = getModuleName(qualifiedName);

        // Skip known navigation entry point patterns
        if (isNavigationEntryPoint(name)) continue;

        const used =
            ctx.usedPages.has(qualifiedName) ||
            ctx.usedPages.has(name) ||
            ctx.usedPages.has(`${mod}.${name}`);

        if (!used) {
            deadItems.push({
                qualifiedName,
                type: "Page",
                module: mod,
                name,
            });
        }
    }
    return deadItems;
}
