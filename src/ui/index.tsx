// src/ui/index.tsx

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IComponent, getStudioProApi } from "@mendix/extensions-api";
import { DeadCodePanel } from "./DeadCodePanel.js";
import type { ModelLike, UnitInfoLike } from "../detector/index.js";
import { isScannableModule } from "../utils/moduleFilter.js";

type RawUnitInfo = {
    $ID?: string;
    $Type: string;
    moduleName?: string;
    name?: string;
    qualifiedName?: string;
    structureQualifiedName?: string;
    excluded?: boolean;
};

type ExcludableDocument = {
    excluded?: boolean;
};

function toUnitInfo(raw: RawUnitInfo): UnitInfoLike {
    const module = raw.moduleName ?? "";
    const name   = raw.name ?? "";
    const qualifiedName =
        raw.qualifiedName ??
        raw.structureQualifiedName ??
        (module ? module + "." + name : name);
    return {
        $ID:          raw.$ID ?? "",
        $Type:        raw.$Type,
        qualifiedName,
        moduleName:   module,
        name,
        excluded:     raw.excluded,
    };
}

function normalizeResolvableType(type: string): string {
    switch (type) {
        case "Menus$MenuDocument":        return "Pages$MenuDocument";
        case "Navigation$NavigationDocument": return "Pages$NavigationDocument";
        default: return type;
    }
}

async function loadMarketplaceModuleNames(
    studioPro: ReturnType<typeof getStudioProApi>
): Promise<ReadonlySet<string>> {
    try {
        const modules = await studioPro.app.model.projects.getModules();
        return new Set(modules.filter(m => m.fromAppStore).map(m => m.name));
    } catch {
        return new Set<string>();
    }
}

async function collectProjectUnits(
    studioPro: ReturnType<typeof getStudioProApi>
): Promise<UnitInfoLike[]> {
    const projectsApi = studioPro.app.model.projects;
    const projectId   = await projectsApi.getProjectId().catch(() => "");
    const modules     = await projectsApi.getModules();
    const collected   = new Map<string, UnitInfoLike>();

    async function walkContainer(
        containerId: string,
        pathPrefix: string,
        moduleName: string
    ): Promise<void> {
        const [documents, folders] = await Promise.all([
            projectsApi.getDocumentsInfo(containerId).catch(() => []),
            projectsApi.getFolders(containerId).catch(() => []),
        ]);
        for (const document of documents) {
            const qualifiedName =
                (document as RawUnitInfo).qualifiedName ??
                (document as RawUnitInfo).structureQualifiedName ??
                (document.name
                    ? (pathPrefix ? pathPrefix + "." : "") + document.name
                    : pathPrefix);
            const info = toUnitInfo({
                ...document,
                moduleName: document.moduleName ?? moduleName,
                qualifiedName,
            });
            collected.set(info.$Type + ":" + info.qualifiedName, info);
        }
        for (const folder of folders) {
            const nextPrefix = pathPrefix
                ? pathPrefix + "." + folder.name
                : folder.name;
            await walkContainer(folder.$ID, nextPrefix, moduleName);
        }
    }

    if (projectId) await walkContainer(projectId, "", "");
    for (const module of modules) {
        await walkContainer(module.$ID, module.name, module.name);
    }
    return [...collected.values()];
}

async function loadGeneratedClientReferences(
    studioPro: ReturnType<typeof getStudioProApi>
): Promise<{
    pages: ReadonlySet<string>;
    microflows: ReadonlySet<string>;
    nanoflows: ReadonlySet<string>;
    debug: {
        generatedRootJsFiles: string[];
        navigationFiles: string[];
        directOperationsJsonReadable: boolean;
        directOperationsJsonLength: number;
        altDeploymentJsonCount: number;
        altMprMxunitCount: number;
    };
}> {
    const filesApi    = studioPro.app.files;
    const pages       = new Set<string>();
    const microflows  = new Set<string>();
    const nanoflows   = new Set<string>();
    const generatedRootJsFiles: string[] = [];
    let directOperationsJsonReadable = false;
    let directOperationsJsonLength   = 0;

    try {
        const operationsById = new Map<string, string>();
        try {
            const raw = await filesApi.getFile("deployment/model/operations.json");
            const ops = JSON.parse(raw) as Array<{
                operationId?: string;
                constants?: { MicroflowName?: string };
            }>;
            for (const op of ops) {
                if (op.operationId && op.constants?.MicroflowName) {
                    operationsById.set(op.operationId, op.constants.MicroflowName);
                }
            }
            directOperationsJsonReadable = true;
            directOperationsJsonLength   = raw.length;
        } catch {}

        const distFiles = await filesApi
            .getFiles("deployment/web/dist/*.js")
            .catch(() => [] as string[]);
        generatedRootJsFiles.push(...distFiles);

        for (const path of distFiles) {
            let content = "";
            try { content = await filesApi.getFile(path); } catch { continue; }

            const constMap = new Map<string, string>();
            for (const m of content.matchAll(
                /const\s+([A-Za-z0-9_$]+)\s*=\s*"([A-Za-z0-9_.]+)"/g
            )) {
                if (m[1] && m[2]) constMap.set(m[1], m[2]);
            }

            for (const m of content.matchAll(
                /"type"\s*:\s*"openPage"[\s\S]{0,250}?"name"\s*:\s*"([^"]+?)\.page\.xml"/g
            )) {
                if (m[1]) pages.add(m[1].replace(/\//g, "."));
            }

            for (const m of content.matchAll(
                /"type"\s*:\s*"callMicroflow"[\s\S]{0,250}?"operationId"\s*:\s*"([^"]+)"/g
            )) {
                const qn = m[1] ? operationsById.get(m[1]) : undefined;
                if (qn) microflows.add(qn);
            }

            for (const m of content.matchAll(
                /"type"\s*:\s*"callNanoflow"[\s\S]{0,250}?"nanoflow"\s*:\s*\(\)\s*=>\s*([A-Za-z0-9_$]+)/g
            )) {
                const qn = m[1] ? constMap.get(m[1]) : undefined;
                if (qn) nanoflows.add(qn);
            }
        }
    } catch {}

    return {
        pages, microflows, nanoflows,
        debug: {
            generatedRootJsFiles,
            navigationFiles: [],
            directOperationsJsonReadable,
            directOperationsJsonLength,
            altDeploymentJsonCount: await filesApi
                .getFiles("deployment/model/*.json")
                .then(f => f.length).catch(() => 0),
            altMprMxunitCount: 0,
        },
    };
}

export const component: IComponent = {
    async loaded(componentContext) {
        const studioPro       = getStudioProApi(componentContext);
        const pagesApi        = studioPro.app.model.pages;
        const microflowsApi   = studioPro.app.model.microflows;
        const domainModelsApi = studioPro.app.model.domainModels;

        const marketplaceModuleNames = await loadMarketplaceModuleNames(studioPro);
        const exclusionCache = new Map<string, boolean>();

        const model: ModelLike = {
            async getUnitsInfo() {
                const [pages, mfs, dms, projectUnits] = await Promise.all([
                    pagesApi.getUnitsInfo(),
                    microflowsApi.getUnitsInfo(),
                    domainModelsApi.getUnitsInfo(),
                    collectProjectUnits(studioPro),
                ]);
                const merged = new Map<string, UnitInfoLike>();
                for (const raw of [...pages, ...mfs, ...dms]) {
                    const info = toUnitInfo(raw as RawUnitInfo);
                    merged.set(info.$Type + ":" + (info.$ID || info.qualifiedName), info);
                }
                for (const info of projectUnits) {
                    merged.set(info.$Type + ":" + (info.$ID || info.qualifiedName), info);
                }
                return [...merged.values()];
            },

            resetCaches() {
                exclusionCache.clear();
            },

            async getScannableModuleNames() {
                const modules = await studioPro.app.model.projects.getModules();
                return modules
                    .filter(m => isScannableModule(m.name, marketplaceModuleNames))
                    .map(m => m.name);
            },

            async getDomainModel(moduleName: string) {
                return domainModelsApi.getDomainModel(moduleName);
            },

            async isUnitExcluded(info: Readonly<UnitInfoLike>) {
                if (info.excluded === true) {
                    return true;
                }

                const cacheKey = info.$Type + ":" + (info.$ID || info.qualifiedName);
                const cached = exclusionCache.get(cacheKey);
                if (cached !== undefined) {
                    return cached;
                }

                let excluded = false;
                try {
                    const loaded = info.$ID
                        ? await this.load<ExcludableDocument>(info.$Type, info.$ID)
                        : await this.resolve<ExcludableDocument>(info.$Type, info.qualifiedName);
                    excluded = loaded?.excluded === true;
                } catch {
                    excluded = false;
                }

                exclusionCache.set(cacheKey, excluded);
                return excluded;
            },

            async getGeneratedClientReferences() {
                const refs = await loadGeneratedClientReferences(studioPro);
                return {
                    pages:      refs.pages,
                    microflows: refs.microflows,
                    nanoflows:  refs.nanoflows,
                    debug:      refs.debug,
                };
            },

            async load<T>(type: string, id: string): Promise<T | null> {
                const t = normalizeResolvableType(type);
                if (t.startsWith("Pages$") || t.startsWith("Navigation$") || t.startsWith("Menus$"))
                    return pagesApi.load(t, id) as Promise<T | null>;
                if (t.startsWith("Microflows$"))
                    return microflowsApi.load(t, id) as Promise<T | null>;
                if (t.startsWith("DomainModels$"))
                    return domainModelsApi.load(t, id) as Promise<T | null>;
                return null;
            },

            async resolve<T>(type: string, qualifiedName: string): Promise<T | null> {
                const t = normalizeResolvableType(type);
                if (t.startsWith("Pages$") || t.startsWith("Navigation$") || t.startsWith("Menus$"))
                    return pagesApi.resolve(t, qualifiedName) as Promise<T | null>;
                if (t.startsWith("Microflows$"))
                    return microflowsApi.resolve(t, qualifiedName) as Promise<T | null>;
                if (t.startsWith("DomainModels$"))
                    return domainModelsApi.resolve(t, qualifiedName) as Promise<T | null>;
                return null;
            },

            // ── API surface inspection ───────────────────────────────────────
        };

        const rootEl = document.getElementById("root");
        if (rootEl) {
            createRoot(rootEl).render(
                <StrictMode>
                    <DeadCodePanel
                        model={model}
                        marketplaceModuleNames={marketplaceModuleNames}
                    />
                </StrictMode>
            );
        }
    },
};

