// src/utils/moduleFilter.ts

export const EXCLUDED_MODULES = new Set<string>([
    "System",
    "App",
    "Marketplace",
    "MxModelReflection",
    "CommunityCommons",
    "Atlas_Core",
    "Atlas_Web_Content",
    "Atlas_NativeMobile_Content",
    "Nanoflow Commons",
    "Native Mobile Resources",
]);

let customExclusions = new Set<string>();

export function addExcludedModule(moduleName: string): void {
    customExclusions.add(moduleName);
}

export function resetCustomExclusions(): void {
    customExclusions = new Set<string>();
}

export function isUserModule(moduleName: string): boolean {
    if (!moduleName) return false;
    if (EXCLUDED_MODULES.has(moduleName)) return false;
    if (customExclusions.has(moduleName)) return false;
    if (moduleName.startsWith("Mx")) return false;
    if (moduleName.startsWith("Atlas")) return false;
    if (moduleName.endsWith("_Core")) return false;
    if (moduleName.endsWith("Commons")) return false;
    return true;
}

/**
 * Modules to include in dead-code analysis: user modules only, excluding Mendix Marketplace (App Store) modules.
 */
export function isScannableModule(moduleName: string | undefined, marketplaceModuleNames: ReadonlySet<string>): boolean {
    const m = moduleName ?? "";
    if (!isUserModule(m)) return false;
    if (marketplaceModuleNames.has(m)) return false;
    return true;
}

export function getModuleName(qualifiedName: string): string {
    if (!qualifiedName) return "";
    const dotIndex = qualifiedName.indexOf(".");
    return dotIndex >= 0 ? qualifiedName.substring(0, dotIndex) : qualifiedName;
}

export function filterUserModuleItems<T extends { qualifiedName: string }>(
    items: T[]
): T[] {
    return items.filter(item => isUserModule(getModuleName(item.qualifiedName)));
}
