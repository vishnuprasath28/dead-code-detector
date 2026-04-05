// src/detector/NanoflowScanner.ts

import type { DeadItem, ModelLike, UnitInfoLike } from "./index.js";
import type { RefCollectionContext } from "../utils/widgetWalker.js";
import { isScannableModule, getModuleName } from "../utils/moduleFilter.js";

export async function scanUnusedNanoflows(
    model: ModelLike,
    ctx: RefCollectionContext,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<DeadItem[]> {
    const unitsInfo = await model.getUnitsInfo().catch(
        () => [] as ReadonlyArray<Readonly<UnitInfoLike>>
    );

    const allNFs = new Map<string, string>();
    for (const info of unitsInfo) {
        if (info.$Type !== "Microflows$Nanoflow") continue;
        if (!isScannableModule(info.moduleName, marketplaceModuleNames)) continue;
        if (await model.isUnitExcluded(info)) continue;
        allNFs.set(info.qualifiedName, info.name);
    }

    if (allNFs.size === 0) return [];

    const deadItems: DeadItem[] = [];
    for (const [qualifiedName, name] of allNFs) {
        const mod = getModuleName(qualifiedName);
        const used =
            ctx.usedNanoflows.has(qualifiedName) ||
            ctx.usedNanoflows.has(name) ||
            ctx.usedNanoflows.has(`${mod}.${name}`);

        if (!used) {
            deadItems.push({
                qualifiedName,
                type: "Nanoflow",
                module: mod,
                name,
            });
        }
    }

    return deadItems;
}
