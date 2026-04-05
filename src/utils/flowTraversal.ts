// src/utils/flowTraversal.ts

import type { Microflows } from "@mendix/extensions-api";

/**
 * Walks all flow objects including nested LoopedActivity regions so ActionActivity nodes are not missed.
 */
export function forEachMicroflowObject(
    objects: Microflows.MicroflowObject[] | undefined,
    visit: (obj: Microflows.MicroflowObject) => void
): void {
    for (const obj of objects ?? []) {
        visit(obj);
        if (obj.$Type === "Microflows$LoopedActivity") {
            const loop = obj as Microflows.LoopedActivity;
            forEachMicroflowObject(loop.objectCollection?.objects, visit);
        }
    }
}

export function forEachActionActivity(
    objects: Microflows.MicroflowObject[] | undefined,
    visit: (activity: Microflows.ActionActivity) => void
): void {
    forEachMicroflowObject(objects, obj => {
        if (obj.$Type === "Microflows$ActionActivity") {
            visit(obj as Microflows.ActionActivity);
        }
    });
}
