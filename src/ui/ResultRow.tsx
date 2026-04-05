// src/ui/ResultRow.tsx

import React, { useState } from "react"

interface ResultRowProps {
    moduleName: string
    elementName: string
    index?: number
}

export const ResultRow: React.FC<ResultRowProps> = ({ moduleName, elementName, index = 0 }) => {
    const [copied, setCopied] = useState(false)
    const fullName = moduleName ? `${moduleName}.${elementName}` : elementName

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(fullName)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
        }
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #232b35", backgroundColor: index % 2 === 0 ? "#121820" : "#0f141a" }}>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8fa0b1", fontWeight: 700 }}>
                    {moduleName}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f2f6fb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fullName}>
                    {elementName}
                </div>
            </div>

            <button
                type="button"
                title={copied ? "Copied" : "Copy qualified name"}
                onClick={copy}
                style={{ height: 36, padding: "0 12px", borderRadius: 10, border: copied ? "1px solid #547765" : "1px solid #2b3440", backgroundColor: copied ? "#16221d" : "#141b22", color: copied ? "#9fd3b4" : "#c7d1dc", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, flexShrink: 0 }}
            >
                {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
            </button>
        </div>
    )
}
