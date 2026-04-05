// src/detector/AttributeScanner.ts

import type { Microflows, Pages } from "@mendix/extensions-api";
import type { DeadItem, ModelLike, UnitInfoLike } from "./index.js";
import type { RefCollectionContext } from "../utils/widgetWalker.js";
import { collectRefs } from "../utils/widgetWalker.js";
import { forEachActionActivity } from "../utils/flowTraversal.js";
import { registerPageRefsFromFlowAction } from "../utils/flowActionRefs.js";
import { isScannableModule, getModuleName } from "../utils/moduleFilter.js";

export async function scanUnusedAttributes(
    model: ModelLike,
    ctx: RefCollectionContext,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<{ items: DeadItem[]; totalCount: number }> {
    const unitsInfo = await model.getUnitsInfo().catch(
        () => [] as ReadonlyArray<Readonly<UnitInfoLike>>
    );
    const moduleNames = await model
        .getScannableModuleNames()
        .catch(() => [] as readonly string[]);

    // Build all attributes map from domain models
    const allAttrs = new Map<string, string>();
    for (const mod of moduleNames) {
        if (!isScannableModule(mod, marketplaceModuleNames)) continue;
        try {
            const dm = await model.getDomainModel(mod);
            if (!dm) continue;
            for (const entity of dm.entities) {
                const entityQn = mod + "." + entity.name;
                for (const attr of entity.attributes) {
                    allAttrs.set(entityQn + "." + attr.name, attr.name);
                }
            }
        } catch {
        }
    }

    // Collect attribute references from all user pages
    const pagesInfo = unitsInfo.filter(u => u.$Type === "Pages$Page");
    for (const info of pagesInfo) {
        if (await model.isUnitExcluded(info)) continue;
        try {
            const page = await model.load<Pages.Page>("Pages$Page", info.$ID);
            if (page) collectRefs(page, ctx);
        } catch {
        }
    }

    // Build deduplicated flow walk list from unitsInfo only
    const flowsToWalk = new Map<string, Readonly<UnitInfoLike>>();
    for (const u of unitsInfo) {
        if (
            u.$Type !== "Microflows$Microflow" &&
            u.$Type !== "Microflows$Nanoflow"
        ) continue;
        if (!flowsToWalk.has(u.qualifiedName)) {
            flowsToWalk.set(u.qualifiedName, u);
        }
    }

    // Collect attribute references from microflows and nanoflows
    for (const info of flowsToWalk.values()) {
        if (await model.isUnitExcluded(info)) continue;
        try {
            const flow =
                info.$Type === "Microflows$Microflow"
                    ? await model.load<Microflows.Microflow>(
                          "Microflows$Microflow",
                          info.$ID
                      )
                    : await model.load<Microflows.Nanoflow>(
                          "Microflows$Nanoflow",
                          info.$ID
                      );
            if (!flow) continue;

            forEachActionActivity(
                flow.objectCollection?.objects,
                activity => {
                    const action = activity.action;
                    if (!action) return;
                    registerPageRefsFromFlowAction(action, ctx);

                    if (
                        action.$Type === "Microflows$ChangeObjectAction" ||
                        action.$Type === "Microflows$CreateObjectAction"
                    ) {
                        const a = action as Microflows.ChangeObjectAction;
                        for (const item of a.items ?? []) {
                            if (
                                item.attribute &&
                                typeof item.attribute === "string"
                            ) {
                                ctx.usedAttributes.add(item.attribute);
                            }
                        }
                    }

                    if (action.$Type === "Microflows$RetrieveAction") {
                        const a = action as Microflows.RetrieveAction;
                        const source = a.retrieveSource;
                        if (
                            source &&
                            source.$Type === "Microflows$DatabaseRetrieveSource"
                        ) {
                            const db =
                                source as Microflows.DatabaseRetrieveSource;
                            if (db.xPathConstraint) {
                                extractAttributeRefsFromXPath(
                                    db.xPathConstraint,
                                    ctx
                                );
                            }
                        }
                    }
                }
            );
        } catch {
        }
    }

    const deadItems: DeadItem[] = [];
    for (const [key, name] of allAttrs) {
        if (
            !ctx.usedAttributes.has(key) &&
            !ctx.usedAttributes.has(name)
        ) {
            const parts = key.split(".");
            deadItems.push({
                qualifiedName: key,
                type: "Attribute",
                module: getModuleName(key),
                name: parts.slice(1).join("."),
            });
        }
    }

    return { items: deadItems, totalCount: allAttrs.size };
}

function extractAttributeRefsFromXPath(
    xpath: string,
    ctx: RefCollectionContext
): void {
    const regex = /([\w]+)\.([\w]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xpath)) !== null) {
        if (match[1] && match[2]) {
            ctx.usedAttributes.add(match[1] + "." + match[2]);
            ctx.usedAttributes.add(match[2]);
        }
    }
}
