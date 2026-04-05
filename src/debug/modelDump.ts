// src/debug/modelDump.ts
// Temporarily add this call inside your DeadCodePanel scan button handler
// BEFORE runAllScanners is called

export async function dumpModelInfo(model: any): Promise<void> {
    console.log("=== MODEL DUMP START ===");
    
    try {
        const units = await model.getUnitsInfo();
        
        // Log every unique $Type
        const types = new Set(units.map((u: any) => u.$Type));
        console.log("ALL UNIT TYPES:", [...types].sort());
        
        // Log every nanoflow
        const nanoflows = units.filter((u: any) => 
            u.$Type.toLowerCase().includes("nanoflow")
        );
        console.log("NANOFLOWS FOUND:", nanoflows.map((u: any) => ({
            type: u.$Type,
            name: u.qualifiedName,
            module: u.moduleName
        })));
        
        // Log every navigation-related unit
        const navUnits = units.filter((u: any) => 
            u.$Type.toLowerCase().includes("nav") ||
            u.$Type.toLowerCase().includes("menu") ||
            u.$Type.toLowerCase().includes("profile")
        );
        console.log("NAV UNITS FOUND:", navUnits.map((u: any) => ({
            type: u.$Type,
            name: u.qualifiedName
        })));

        // Log pages
        const pages = units.filter((u: any) => u.$Type === "Pages$Page");
        console.log("PAGES FOUND:", pages.map((u: any) => u.qualifiedName));

        // Try resolving the first nav unit and dump its raw shape
        if (navUnits.length > 0) {
            const first = navUnits[0];
            console.log("RESOLVING NAV UNIT:", first.$Type, first.qualifiedName);
            try {
                const resolved = await model.resolve(first.$Type, first.qualifiedName);
                console.log("NAV DOC RAW KEYS:", Object.keys(resolved ?? {}));
                console.log("NAV DOC RAW:", JSON.stringify(resolved, null, 2).slice(0, 3000));
            } catch(e) {
                console.log("RESOLVE FAILED:", e);
            }
        }

    } catch(e) {
        console.log("DUMP FAILED:", e);
    }
    
    console.log("=== MODEL DUMP END ===");
}