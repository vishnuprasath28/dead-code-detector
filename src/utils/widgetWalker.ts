// src/utils/widgetWalker.ts

export interface RefCollectionContext {
    usedPages: Set<string>;
    usedMicroflows: Set<string>;
    usedNanoflows: Set<string>;
    usedEntities: Set<string>;
    usedAttributes: Set<string>;
    usedSnippets: Set<string>;
    pendingMenuDocumentQualifiedNames?: Set<string>;
    pendingSnippetQualifiedNames?: Set<string>;
}

function addQualifiedNameVariants(target: Set<string>, raw: string): void {
    const trimmed = raw.trim();
    if (!trimmed) return;

    target.add(trimmed);

    const normalized = trimmed.replace(/\//g, ".").replace(/\$/g, ".");
    target.add(normalized);

    const segments = normalized.split(".").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) target.add(last);

    if (segments.length >= 2) {
        const moduleQualifiedName = `${segments[0]}.${last}`;
        const moduleDollarName = `${segments[0]}$${last}`;
        target.add(moduleQualifiedName);
        target.add(moduleDollarName);
    }
}

export function registerPageRef(
    ctx: RefCollectionContext,
    raw: string | null | undefined
): void {
    if (!raw || typeof raw !== "string") return;
    addQualifiedNameVariants(ctx.usedPages, raw);
}

export function registerMicroflowRef(
    ctx: RefCollectionContext,
    raw: string | null | undefined
): void {
    if (!raw || typeof raw !== "string") return;
    addQualifiedNameVariants(ctx.usedMicroflows, raw);
}

export function registerNanoflowRef(
    ctx: RefCollectionContext,
    raw: string | null | undefined
): void {
    if (!raw || typeof raw !== "string") return;
    addQualifiedNameVariants(ctx.usedNanoflows, raw);
}

export function registerEntityRef(
    ctx: RefCollectionContext,
    raw: string | null | undefined
): void {
    if (!raw || typeof raw !== "string") return;
    ctx.usedEntities.add(raw);
}

export function registerAttributeRef(
    ctx: RefCollectionContext,
    raw: string | null | undefined
): void {
    if (!raw || typeof raw !== "string") return;
    ctx.usedAttributes.add(raw);
    const parts = raw.split(".");
    if (parts.length >= 2) ctx.usedAttributes.add(parts.slice(-2).join("."));
    if (parts.length >= 1) ctx.usedAttributes.add(parts[parts.length - 1]!);
}

// ── Structured ref objects ───────────────────────────────────────────────────

function resolveEntityRef(ref: unknown, ctx: RefCollectionContext): void {
    if (!ref || typeof ref !== "object") return;
    const r = ref as Record<string, unknown>;
    if (
        r.$Type === "DomainModels$DirectEntityRef" &&
        typeof r.entity === "string"
    ) {
        registerEntityRef(ctx, r.entity);
        return;
    }
    if (r.$Type === "DomainModels$IndirectEntityRef") {
        const steps = r.steps;
        if (Array.isArray(steps)) {
            for (const step of steps) {
                if (step && typeof step === "object") {
                    const s = step as Record<string, unknown>;
                    if (typeof s.destinationEntity === "string") {
                        registerEntityRef(ctx, s.destinationEntity);
                    }
                }
            }
        }
    }
}

function resolveAttributeRef(ref: unknown, ctx: RefCollectionContext): void {
    if (!ref || typeof ref !== "object") return;
    const r = ref as Record<string, unknown>;
    if (
        r.$Type === "DomainModels$AttributeRef" &&
        typeof r.attribute === "string"
    ) {
        registerAttributeRef(ctx, r.attribute);
    }
}

function resolveStringRef(
    value: unknown,
    ctx: RefCollectionContext,
    type: "microflow" | "nanoflow" | "page" | "entity"
): void {
    const register =
        type === "microflow" ? registerMicroflowRef
        : type === "nanoflow" ? registerNanoflowRef
        : type === "page"     ? registerPageRef
        :                       registerEntityRef;

    if (typeof value === "string" && value.length > 0) {
        register(ctx, value);
        return;
    }
    if (
        value &&
        typeof value === "object" &&
        "qualifiedName" in value &&
        typeof (value as Record<string, unknown>).qualifiedName === "string"
    ) {
        register(ctx, (value as Record<string, unknown>).qualifiedName as string);
    }
}

// ── Client action handler ────────────────────────────────────────────────────

function processClientAction(
    action: Record<string, unknown>,
    ctx: RefCollectionContext
): void {
    switch (action.$Type) {
        case "Pages$CallNanoflowClientAction":
            registerNanoflowRef(ctx, action.nanoflow as string | undefined);
            break;

        case "Pages$MicroflowClientAction":
            resolveStringRef(action.microflow, ctx, "microflow");
            break;

        case "Pages$PageClientAction":
        case "Pages$CreateObjectClientAction": {
            const ps = action.pageSettings;
            if (ps && typeof ps === "object") collectRefs(ps, ctx);
            break;
        }

        case "Pages$OpenWorkflowClientAction":
            if (typeof action.defaultPage === "string") {
                registerPageRef(ctx, action.defaultPage);
            }
            break;

        case "Pages$NoClientAction":
            // no-op — intentionally no action
            break;

        default:
            collectRefs(action, ctx);
            break;
    }
}

// ── Data source handler ──────────────────────────────────────────────────────

function processDataSource(
    ds: Record<string, unknown>,
    ctx: RefCollectionContext
): void {
    switch (ds.$Type) {
        case "Pages$NanoflowSource":
            registerNanoflowRef(ctx, ds.nanoflow as string | undefined);
            break;
        case "Pages$MicroflowSource":
            resolveStringRef(ds.microflow, ctx, "microflow");
            break;
    }
    if (ds.entityRef) resolveEntityRef(ds.entityRef, ctx);
}

// ── Core property scanner ────────────────────────────────────────────────────

function processWidgetProps(
    w: Record<string, unknown>,
    ctx: RefCollectionContext
): void {
    const type = w.$Type as string | undefined;

    // Page reference on PageSettings
    if (type === "Pages$PageSettings" && typeof w.page === "string") {
        registerPageRef(ctx, w.page);
    }

    // TabContainer default page
    if (type === "Pages$TabContainer" && typeof w.defaultPage === "string") {
        registerPageRef(ctx, w.defaultPage);
    }

    // Menu document source
    if (
        type === "Pages$MenuDocumentSource" &&
        typeof w.menu === "string" &&
        w.menu.length > 0
    ) {
        ctx.pendingMenuDocumentQualifiedNames?.add(w.menu);
    }

    // ── Snippet reference ────────────────────────────────────────────────────
    // Pages$SnippetCall.snippet is a qualifiedName string pointing to a snippet
    // The snippet itself contains widgets with microflow/page/entity refs
    // We must queue it for resolution so its widget tree is also walked
    if (type === "Pages$SnippetCall" && typeof w.snippet === "string") {
        const snippetQn = w.snippet;
        if (snippetQn && !ctx.usedSnippets.has(snippetQn)) {
            ctx.usedSnippets.add(snippetQn);
            ctx.pendingSnippetQualifiedNames?.add(snippetQn);
        }
    }

    // Entity path
    if (typeof w.entityPath === "string") {
        const first = w.entityPath.split("/")[0];
        if (first) registerEntityRef(ctx, first);
    }

    // Attribute path
    if (typeof w.attributePath === "string") {
        const ap = w.attributePath;
        registerAttributeRef(ctx, ap);
        const segs = ap.split("/").filter(Boolean);
        if (segs.length >= 1) {
            registerAttributeRef(ctx, segs[segs.length - 1]!);
        }
    }

    // Structured refs
    if (w.entityRef)          resolveEntityRef(w.entityRef, ctx);
    if (w.attributeRef)       resolveAttributeRef(w.attributeRef, ctx);
    if (w.sourceAttributeRef) resolveAttributeRef(w.sourceAttributeRef, ctx);
    if (w.lowerBoundRef)      resolveAttributeRef(w.lowerBoundRef, ctx);
    if (w.upperBoundRef)      resolveAttributeRef(w.upperBoundRef, ctx);

    if (Array.isArray(w.searchRefs)) {
        for (const sr of w.searchRefs) resolveAttributeRef(sr, ctx);
    }

    // Plain string refs
    resolveStringRef(w.microflow, ctx, "microflow");
    resolveStringRef(w.nanoflow,  ctx, "nanoflow");
    resolveStringRef(w.entity,    ctx, "entity");

    // Raw page string (not PageSettings)
    if (typeof w.page === "string" && type !== "Pages$PageSettings") {
        registerPageRef(ctx, w.page);
    }

    // Client actions — all variants
    for (const key of [
        "clientAction",
        "onClickAction",
        "onChangeAction",
        "onEnterAction",
        "onLeaveAction",
        "action",
    ] as const) {
        const a = w[key];
        if (a && typeof a === "object") {
            processClientAction(a as Record<string, unknown>, ctx);
        }
    }

    // Data source
    const dataSource = w.dataSource;
    if (dataSource && typeof dataSource === "object") {
        processDataSource(dataSource as Record<string, unknown>, ctx);
    }

    // Microflow settings
    const mfSettings = w.microflowSettings;
    if (mfSettings && typeof mfSettings === "object") {
        resolveStringRef(
            (mfSettings as Record<string, unknown>).microflow,
            ctx,
            "microflow"
        );
    }
}

// ── Child traversal keys ─────────────────────────────────────────────────────

const ARRAY_CHILD_KEYS = [
    "arguments",         // Pages$LayoutCall.arguments → Pages$LayoutCallArgument[]
    "widgets",           // Pages$LayoutCallArgument.widgets, containers, etc.
    "rows",              // Pages$LayoutGrid.rows
    "columns",           // Pages$LayoutGridRow.columns
    "cells",
    "tabs",
    "tabPages",
    "items",
    "actions",
    "children",
    "parameterMappings",
    "outputMappings",
    "parameters",
    "subItems",
    "pages",
    "content",
    "designProperties",
] as const;

const OBJECT_CHILD_KEYS = [
    "layoutCall",
    "widget",
    "sidebar",
    "header",
    "footer",
    "controlBar",
    "dataView",
    "listView",
    "templateGrid",
    "dataGrid",
    "placeholder",
    "layout",
    "pageSettings",
    "gotoPageSettings",
    "snippetCall",       // Pages$SnippetCallWidget.snippetCall → Pages$SnippetCall
    "conditionalVisibilitySettings",
] as const;

// ── Public entry point ───────────────────────────────────────────────────────

export function collectRefs(widget: unknown, ctx: RefCollectionContext): void {
    if (!widget || typeof widget !== "object") return;
    const w = widget as Record<string, unknown>;

    processWidgetProps(w, ctx);

    for (const key of ARRAY_CHILD_KEYS) {
        const val = w[key];
        if (Array.isArray(val)) {
            for (const item of val) collectRefs(item, ctx);
        }
    }

    for (const key of OBJECT_CHILD_KEYS) {
        const val = w[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
            collectRefs(val, ctx);
        }
    }
}
