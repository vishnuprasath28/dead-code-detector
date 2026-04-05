// src/ui/HealthScoreCard.tsx

import React from "react"

function scoreColor(score: number): string {
    if (score >= 90) return "#8bffb8"
    if (score >= 70) return "#72e7ff"
    if (score >= 50) return "#ffe082"
    return "#ff7fa2"
}

function scoreLabel(score: number): string {
    if (score >= 90) return "Silent"
    if (score >= 70) return "Stable"
    if (score >= 50) return "Watchlist"
    return "Alert"
}

interface HealthScoreCardProps {
    score: number
    counts: {
        pages: number
        microflows: number
        nanoflows: number
        entities: number
        attributes: number
    }
    totalDead: number
    scannedAtLabel: string
}

const rows: { key: keyof HealthScoreCardProps["counts"]; label: string }[] = [
    { key: "pages", label: "Pages" },
    { key: "microflows", label: "Microflows" },
    { key: "nanoflows", label: "Nanoflows" },
    { key: "entities", label: "Entities" },
    { key: "attributes", label: "Attributes" },
]

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({
    score,
    counts,
    totalDead,
    scannedAtLabel,
}) => {
    const color = scoreColor(score)
    const label = scoreLabel(score)

    return (
        <div style={{ backgroundColor: "#121820", border: "1px solid #252d37", borderRadius: 18, padding: 24, boxShadow: "0 18px 36px rgba(0, 0, 0, 0.24)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr)", gap: 24, alignItems: "stretch" }}>
                <div style={{ borderRadius: 16, background: "linear-gradient(180deg, #171f28 0%, #11171d 100%)", border: "1px solid #29313b", padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 210 }}>
                    <div>
                        <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8fa0b1", fontWeight: 700 }}>
                            Health score
                        </div>
                        <div style={{ marginTop: 14, fontSize: 64, lineHeight: 0.95, fontWeight: 800, letterSpacing: "-0.05em", color }}>
                            {score}
                        </div>
                        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: "#e7edf5" }}>
                            {label}
                        </div>
                    </div>
                    <div style={{ marginTop: 18, fontSize: 14, color: "#97a4b5", lineHeight: 1.6 }}>
                        Based on the currently visible unused resources after manual navigation overrides are applied.
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                        {rows.map(row => (
                            <div key={row.key} style={{ borderRadius: 14, border: "1px solid #29313b", backgroundColor: "#161d25", padding: 16 }}>
                                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8fa0b1", fontWeight: 700 }}>
                                    {row.label}
                                </div>
                                <div style={{ marginTop: 12, fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "#f2f6fb" }}>
                                    {counts[row.key]}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid #232b35", color: "#97a4b5", fontSize: 13 }}>
                        <span>{totalDead} unused items total</span>
                        {scannedAtLabel && <span>Scanned {scannedAtLabel}</span>}
                    </div>
                </div>
            </div>
        </div>
    )
}
