// src/detector/EntityScanner.ts

import type { DomainModels, Microflows, Pages, DataTypes } from "@mendix/extensions-api";
import type { DeadItem, ModelLike, UnitInfoLike } from "./index.js";
import type { RefCollectionContext } from "../utils/widgetWalker.js";
import { collectRefs } from "../utils/widgetWalker.js";
import { forEachActionActivity } from "../utils/flowTraversal.js";
import { registerPageRefsFromFlowAction } from "../utils/flowActionRefs.js";
import { isScannableModule, getModuleName } from "../utils/moduleFilter.js";

export async function scanUnusedEntities(
    model: ModelLike,
    ctx: RefCollectionContext,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<DeadItem[]> {
    const unitsInfo = await model.getUnitsInfo().catch(
        () => [] as ReadonlyArray<Readonly<UnitInfoLike>>
    );
    const moduleNames = await model
        .getScannableModuleNames()
        .catch(() => [] as readonly string[]);

    // Build all entities map from domain models
    const allEntities = new Map<string, string>();
    for (const mod of moduleNames) {
        if (!isScannableModule(mod, marketplaceModuleNames)) continue;
        try {
            const dm = await model.getDomainModel(mod);
            if (!dm) continue;
            for (const entity of dm.entities) {
                allEntities.set(mod + "." + entity.name, entity.name);
            }
        } catch {
        }
    }

    // Collect entity references from all user pages
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

    // Collect entity references from microflows and nanoflows
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

                    if (action.$Type === "Microflows$CreateObjectAction") {
                        const a = action as Microflows.CreateObjectAction;
                        if (a.entity && typeof a.entity === "string") {
                            ctx.usedEntities.add(a.entity);
                        }
                    }

                    if (action.$Type === "Microflows$DeleteAction") {
                        const a = action as Microflows.DeleteAction;
                        if (a.deleteVariableName) {
                            const varObj = findVariableEntity(
                                flow,
                                a.deleteVariableName
                            );
                            if (varObj) ctx.usedEntities.add(varObj);
                        }
                    }

                    if (action.$Type === "Microflows$RetrieveAction") {
                        const a = action as Microflows.RetrieveAction;
                        const source = a.retrieveSource;
                        if (
                            source &&
                            source.$Type === "Microflows$DatabaseRetrieveSource"
                        ) {
                            const db = source as Microflows.DatabaseRetrieveSource;
                            if (db.entity && typeof db.entity === "string") {
                                ctx.usedEntities.add(db.entity);
                            }
                            if (db.xPathConstraint) {
                                extractEntityRefsFromXPath(
                                    db.xPathConstraint,
                                    ctx
                                );
                            }
                        }
                    }

                    if (action.$Type === "Microflows$ChangeObjectAction") {
                        const a = action as Microflows.ChangeObjectAction;
                        if (a.changeVariableName) {
                            const varObj = findVariableEntity(
                                flow,
                                a.changeVariableName
                            );
                            if (varObj) ctx.usedEntities.add(varObj);
                        }
                    }
                }
            );
        } catch {
        }
    }

    // Collect entity references from associations and generalizations
    for (const mod of moduleNames) {
        if (!isScannableModule(mod, marketplaceModuleNames)) continue;
        try {
            const dm = await model.getDomainModel(mod);
            if (!dm) continue;
            for (const assoc of dm.associations ?? []) {
                if (assoc.child && typeof assoc.child === "string") {
                    ctx.usedEntities.add(assoc.child);
                }
                if (assoc.parent && typeof assoc.parent === "string") {
                    ctx.usedEntities.add(assoc.parent);
                }
            }
            for (const entity of dm.entities) {
                const gen = entity.generalization as
                    | DomainModels.Generalization
                    | undefined;
                if (
                    gen &&
                    gen.$Type === "DomainModels$Generalization" &&
                    gen.generalization &&
                    typeof gen.generalization === "string"
                ) {
                    ctx.usedEntities.add(gen.generalization);
                }
            }
        } catch {
        }
    }

    const deadItems: DeadItem[] = [];
    for (const [qualifiedName, name] of allEntities) {
        if (
            !ctx.usedEntities.has(qualifiedName) &&
            !ctx.usedEntities.has(name)
        ) {
            deadItems.push({
                qualifiedName,
                type: "Entity",
                module: getModuleName(qualifiedName),
                name,
            });
        }
    }

    return deadItems;
}

function findVariableEntity(
    mf: Microflows.Microflow | Microflows.Nanoflow,
    variableName: string
): string | null {
    for (const obj of mf.objectCollection?.objects ?? []) {
        if (obj.$Type === "Microflows$MicroflowParameterObject") {
            const param = obj as Microflows.MicroflowParameterObject;
            if (param.name === variableName) {
                const vt = param.variableType as DataTypes.EntityType | undefined;
                if (
                    vt &&
                    typeof vt === "object" &&
                    "entity" in vt &&
                    typeof vt.entity === "string"
                ) {
                    return vt.entity;
                }
            }
        }
    }

    let found: string | null = null;
    forEachActionActivity(mf.objectCollection?.objects, activity => {
        if (found) return;
        const action = activity.action;
        if (!action) return;

        if (action.$Type === "Microflows$CreateObjectAction") {
            const a = action as Microflows.CreateObjectAction;
            if (
                a.outputVariableName === variableName &&
                a.entity &&
                typeof a.entity === "string"
            ) {
                found = a.entity;
            }
        }

        if (action.$Type === "Microflows$RetrieveAction") {
            const a = action as Microflows.RetrieveAction;
            if (a.outputVariableName === variableName) {
                const source = a.retrieveSource;
                if (
                    source &&
                    source.$Type === "Microflows$DatabaseRetrieveSource"
                ) {
                    const db = source as Microflows.DatabaseRetrieveSource;
                    if (db.entity && typeof db.entity === "string") {
                        found = db.entity;
                    }
                }
            }
        }
    });

    return found;
}

function extractEntityRefsFromXPath(
    xpath: string,
    ctx: RefCollectionContext
): void {
    const regex = /\/\/?([\w]+)\//g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xpath)) !== null) {
        if (match[1]) ctx.usedEntities.add(match[1]);
    }
}
