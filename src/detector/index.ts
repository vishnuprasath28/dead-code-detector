// src/detector/index.ts

import { scanUnusedNanoflows } from "./NanoflowScanner.js";
import {
    buildScannablePagesMap,
    collectPageReferences,
    computeDeadPages,
} from "./PageScanner.js";
import { scanUnusedMicroflows } from "./MicroflowScanner.js";
import { scanUnusedEntities } from "./EntityScanner.js";
import { scanUnusedAttributes } from "./AttributeScanner.js";
import { calculateHealthScore } from "../utils/scoring.js";
import type { DomainModels } from "@mendix/extensions-api";
import { isScannableModule } from "../utils/moduleFilter.js";
import type { RefCollectionContext } from "../utils/widgetWalker.js";

export interface DeadItem {
    qualifiedName: string;
    type: "Page" | "Microflow" | "Nanoflow" | "Entity" | "Attribute";
    module: string;
    name: string;
}

export interface ScanTotals {
    totalPages: number;
    totalMicroflows: number;
    totalNanoflows: number;
    totalEntities: number;
    totalAttributes: number;
}

export interface DeadCodeReport {
    pages: DeadItem[];
    microflows: DeadItem[];
    nanoflows: DeadItem[];
    entities: DeadItem[];
    attributes: DeadItem[];
    healthScore: number;
    totals: ScanTotals;
    scannedAt: Date;
}

export interface UnitInfoLike {
    $ID: string;
    $Type: string;
    qualifiedName: string;
    moduleName: string;
    name: string;
    excluded?: boolean;
}

export interface ModelLike {
    getUnitsInfo(): Promise<ReadonlyArray<Readonly<UnitInfoLike>>>;
    load<T>(type: string, id: string): Promise<T | null>;
    resolve<T>(type: string, qualifiedName: string): Promise<T | null>;
    resetCaches(): void;
    isUnitExcluded(info: Readonly<UnitInfoLike>): Promise<boolean>;
    getDomainModel(moduleName: string): Promise<DomainModels.DomainModel | null>;
    getScannableModuleNames(): Promise<readonly string[]>;
    getGeneratedClientReferences(): Promise<{
        pages: ReadonlySet<string>;
        microflows: ReadonlySet<string>;
        nanoflows: ReadonlySet<string>;
        debug?: {
            generatedRootJsFiles: string[];
            navigationFiles: string[];
            directOperationsJsonReadable: boolean;
            directOperationsJsonLength: number;
            altDeploymentJsonCount: number;
            altMprMxunitCount: number;
        };
    }>;
}

function makeEmptyContext(): RefCollectionContext {
    return {
        usedPages:                        new Set(),
        usedMicroflows:                   new Set(),
        usedNanoflows:                    new Set(),
        usedEntities:                     new Set(),
        usedAttributes:                   new Set(),
        usedSnippets:                     new Set(),
        pendingMenuDocumentQualifiedNames: new Set(),
        pendingSnippetQualifiedNames:      new Set(),
    };
}

async function computeTotals(
    model: ModelLike,
    unitsInfo: ReadonlyArray<Readonly<UnitInfoLike>>,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<ScanTotals> {
    let includedPages = 0;
    for (const u of unitsInfo) {
        if (
            u.$Type === "Pages$Page" &&
            isScannableModule(u.moduleName, marketplaceModuleNames) &&
            !(await model.isUnitExcluded(u))
        ) {
            includedPages++;
        }
    }

    const microflowKeys = new Set<string>();
    for (const u of unitsInfo) {
        if (
            u.$Type === "Microflows$Microflow" &&
            isScannableModule(u.moduleName, marketplaceModuleNames) &&
            !(await model.isUnitExcluded(u))
        ) {
            microflowKeys.add(u.qualifiedName);
        }
    }

    const nanoflowKeys = new Set<string>();
    for (const u of unitsInfo) {
        if (
            u.$Type === "Microflows$Nanoflow" &&
            isScannableModule(u.moduleName, marketplaceModuleNames) &&
            !(await model.isUnitExcluded(u))
        ) {
            nanoflowKeys.add(u.qualifiedName);
        }
    }

    let totalEntities = 0;
    let totalAttributes = 0;
    const moduleNames = await model
        .getScannableModuleNames()
        .catch(() => [] as readonly string[]);

    for (const mod of moduleNames) {
        if (!isScannableModule(mod, marketplaceModuleNames)) continue;
        try {
            const dm = await model.getDomainModel(mod);
            if (!dm) continue;
            totalEntities += dm.entities.length;
            for (const entity of dm.entities) {
                totalAttributes += entity.attributes.length;
            }
        } catch {
        }
    }

    return {
        totalPages: includedPages,
        totalMicroflows: microflowKeys.size,
        totalNanoflows:  nanoflowKeys.size,
        totalEntities,
        totalAttributes,
    };
}

export async function runAllScanners(
    model: ModelLike,
    marketplaceModuleNames: ReadonlySet<string>
): Promise<DeadCodeReport> {
    model.resetCaches();
    const ctx = makeEmptyContext();

    // Seed context with generated client references
    const generatedRefs = await model
        .getGeneratedClientReferences()
        .catch(() => ({
            pages:      new Set<string>(),
            microflows: new Set<string>(),
            nanoflows:  new Set<string>(),
        }));

    for (const p of generatedRefs.pages)      ctx.usedPages.add(p);
    for (const m of generatedRefs.microflows) ctx.usedMicroflows.add(m);
    for (const n of generatedRefs.nanoflows)  ctx.usedNanoflows.add(n);

    const unitsInfo = await model
        .getUnitsInfo()
        .catch(() => [] as ReadonlyArray<Readonly<UnitInfoLike>>);

    const totals = await computeTotals(model, unitsInfo, marketplaceModuleNames);

    const allPagesMap = await buildScannablePagesMap(model, marketplaceModuleNames);
    await collectPageReferences(model, ctx, marketplaceModuleNames);

    const deadMicroflows = await scanUnusedMicroflows(model, ctx, marketplaceModuleNames);
    const deadNanoflows  = await scanUnusedNanoflows(model, ctx, marketplaceModuleNames);
    const deadEntities   = await scanUnusedEntities(model, ctx, marketplaceModuleNames);
    const { items: deadAttributes } = await scanUnusedAttributes(model, ctx, marketplaceModuleNames);
    const deadPages = computeDeadPages(allPagesMap, ctx);

    const report: DeadCodeReport = {
        pages:       deadPages,
        microflows:  deadMicroflows,
        nanoflows:   deadNanoflows,
        entities:    deadEntities,
        attributes:  deadAttributes,
        healthScore: 0,
        totals,
        scannedAt:   new Date(),
    };

    report.healthScore = calculateHealthScore(report, totals);
    return report;
}
