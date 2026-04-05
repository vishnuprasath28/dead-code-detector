// src/ui/TabBar.tsx

import React from "react"
import type { ResultTabKey } from "./DeadCodePanel.js"

const tabMeta: Record<ResultTabKey, { label: string }> = {
    pages: { label: "Pages" },
    microflows: { label: "Microflows" },
    nanoflows: { label: "Nanoflows" },
    entities: { label: "Entities" },
    attributes: { label: "Attributes" },
}

interface TabBarProps {
    activeTab: ResultTabKey
    onTabChange: (tab: ResultTabKey) => void
    counts: {
        pages: number
        microflows: number
        nanoflows: number
        entities: number
        attributes: number
    }
}

const order: ResultTabKey[] = ["pages", "microflows", "nanoflows", "entities", "attributes"]

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, counts }) => {
    return (
        <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, backgroundColor: "#0f141a", borderBottom: "1px solid #232b35" }}>
            {order.map(key => {
                const active = activeTab === key
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onTabChange(key)}
                        style={{
                            flex: "1 1 120px",
                            minHeight: 48,
                            borderRadius: 12,
                            border: active ? "1px solid #9fd3b4" : "1px solid #2a323c",
                            backgroundColor: active ? "#18221d" : "#141b22",
                            color: active ? "#effaf3" : "#a0adbc",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "0 14px",
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        <span>{tabMeta[key].label}</span>
                        <span style={{ minWidth: 28, height: 28, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px", backgroundColor: active ? "rgba(159,211,180,0.14)" : "#1d2530", color: active ? "#9fd3b4" : "#c2ccd8", fontSize: 12, fontWeight: 700 }}>
                            {counts[key]}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
