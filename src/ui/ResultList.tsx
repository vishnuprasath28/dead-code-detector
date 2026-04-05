// src/ui/ResultList.tsx

import React, { useMemo, useState } from "react"
import type { ResultTabKey } from "./DeadCodePanel.js"
import { ResultRow } from "./ResultRow.js"

const tabLabels: Record<ResultTabKey, string> = {
    pages: "pages",
    microflows: "microflows",
    nanoflows: "nanoflows",
    entities: "entities",
    attributes: "attributes",
}

interface ResultItem {
    module: string
    name: string
}

interface ResultListProps {
    activeTab: ResultTabKey
    data: {
        pages: ResultItem[]
        microflows: ResultItem[]
        nanoflows: ResultItem[]
        entities: ResultItem[]
        attributes: ResultItem[]
    }
}

export const ResultList: React.FC<ResultListProps> = ({ activeTab, data }) => {
    const items = data[activeTab]
    const [search, setSearch] = useState("")

    const filteredItems = useMemo(() => {
        if (!search.trim()) return items
        const query = search.toLowerCase().trim()
        return items.filter(
            item =>
                item.name.toLowerCase().includes(query) ||
                item.module.toLowerCase().includes(query) ||
                `${item.module}.${item.name}`.toLowerCase().includes(query)
        )
    }, [items, search])

    if (items.length === 0) {
        return (
            <div style={{ padding: "56px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, backgroundColor: "#121820" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#161d25", border: "1px solid #29313b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8fb9c9" strokeWidth="1.8">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f2f6fb" }}>No unused {tabLabels[activeTab]}</div>
                <div style={{ maxWidth: 360, fontSize: 14, lineHeight: 1.6, color: "#97a4b5" }}>
                    The current scan did not find any unused {tabLabels[activeTab]}.
                </div>
            </div>
        )
    }

    return (
        <div style={{ backgroundColor: "#121820" }}>
            <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #232b35", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#f2f6fb" }}>{filteredItems.length}</span>
                    <span style={{ fontSize: 13, color: "#97a4b5" }}>
                        {filteredItems.length === items.length ? `unused ${tabLabels[activeTab]}` : `matching ${tabLabels[activeTab]}`}
                    </span>
                </div>
                <div style={{ position: "relative", width: "min(260px, 100%)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7b8796" strokeWidth="2" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Filter by module or resource"
                        style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #2b3440", backgroundColor: "#0c1116", padding: "0 12px 0 36px", fontSize: 13, color: "#e7edf5", outline: "none" }}
                    />
                </div>
            </div>

            <div>
                {filteredItems.length === 0 ? (
                    <div style={{ padding: 24, fontSize: 13, color: "#97a4b5", textAlign: "center" }}>
                        No results matching "{search}"
                    </div>
                ) : (
                    filteredItems.map((item, index) => (
                        <ResultRow key={`${activeTab}:${item.module}:${item.name}`} moduleName={item.module} elementName={item.name} index={index} />
                    ))
                )}
            </div>
        </div>
    )
}
