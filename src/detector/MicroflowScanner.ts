// src/detector/MicroflowScanner.ts

import type { Microflows } from "@mendix/extensions-api";
import type { DeadItem, ModelLike, UnitInfoLike } from "./index.js";
import type { RefCollectionContext } from "../utils/widgetWalker.js";
import { forEachActionActivity } from "../utils/flowTraversal.js";
import { registerPageRefsFromFlowAction } from "../utils/flowActionRefs.js";
import { isScannableModule, getModuleName } from "../utils/moduleFilter.js";

export async function scanUnusedMicroflows(
    model: ModelLike,
    ctx: RefCollectionContext,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<DeadItem[]> {
    const unitsInfo = await model.getUnitsInfo().catch(
        () => [] as ReadonlyArray<Readonly<UnitInfoLike>>
    );

    const allMFs = new Map<string, string>();
    for (const info of unitsInfo) {
        if (info.$Type !== "Microflows$Microflow") continue;
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        allMFs.set(info.qualifiedName, info.name);
    }

    // Build deduplicated flow walk list
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

    // Collect microflow + nanoflow call references from all flows
    for (const info of flowsToWalk.values()) {
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        try {
            const flow =
                info.$Type === "Microflows$Microflow"
                    ? await model.resolve<Microflows.Microflow>(
                          "Microflows$Microflow",
                          info.qualifiedName
                      )
                    : await model.resolve<Microflows.Nanoflow>(
                          "Microflows$Nanoflow",
                          info.qualifiedName
                      );
            if (!flow) continue;

            forEachActionActivity(
                flow.objectCollection?.objects,
                activity => {
                    const action = activity.action;
                    if (!action) return;
                    registerPageRefsFromFlowAction(action, ctx);

                    if (action.$Type === "Microflows$MicroflowCallAction") {
                        const a = action as Microflows.MicroflowCallAction;
                        const mf = a.microflowCall?.microflow;
                        if (mf && typeof mf === "string") {
                            ctx.usedMicroflows.add(mf);
                        }
                    }

                    if (action.$Type === "Microflows$NanoflowCallAction") {
                        const a = action as Microflows.NanoflowCallAction;
                        const nf = a.nanoflowCall?.nanoflow;
                        if (nf && typeof nf === "string") {
                            ctx.usedNanoflows.add(nf);
                        }
                    }
                }
            );
        } catch {
        }
    }

    const deadItems: DeadItem[] = [];
    for (const [qualifiedName, name] of allMFs) {
        const mod = getModuleName(qualifiedName);
        const used =
            ctx.usedMicroflows.has(qualifiedName) ||
            ctx.usedMicroflows.has(name) ||
            ctx.usedMicroflows.has(`${mod}.${name}`);

        if (!used) {
            deadItems.push({
                qualifiedName,
                type: "Microflow",
                module: mod,
                name,
            });
        }
    }

    return deadItems;
}
