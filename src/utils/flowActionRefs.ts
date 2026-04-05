// src/utils/flowActionRefs.ts

import type { Microflows } from "@mendix/extensions-api";
import { registerPageRef, type RefCollectionContext } from "./widgetWalker.js";

/**
 * Collects page references from microflow/nanoflow actions (incl. types missing/incomplete in typings).
 */
export function registerPageRefsFromFlowAction(action: Microflows.MicroflowAction, ctx: RefCollectionContext): void {
    if (!action || typeof action !== "object") return;
    const a = action as unknown as Record<string, unknown>;
    if (a.$Type === "Microflows$ShowPageAction") {
        const ps = a.pageSettings as Record<string, unknown> | undefined;
        if (ps && typeof ps.page === "string") {
            registerPageRef(ctx, ps.page);
        }
    }
}
