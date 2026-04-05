// src/utils/scoring.ts

import type { DeadCodeReport, ScanTotals } from "../detector/index.js";

export function calculateHealthScore(report: DeadCodeReport, totals: ScanTotals): number {
    const total = totals.totalPages + totals.totalMicroflows + totals.totalNanoflows + totals.totalEntities + totals.totalAttributes;
    const dead = report.pages.length + report.microflows.length + report.nanoflows.length + report.entities.length + report.attributes.length;
    if (total === 0) return 100;
    return Math.round(((total - dead) / total) * 100);
}
