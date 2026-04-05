
// src/ui/DeadCodePanel.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DeadCodeReport, DeadItem, ModelLike } from "../detector/index.js"
import { runAllScanners } from "../detector/index.js"
import { calculateHealthScore } from "../utils/scoring.js"
import { HealthScoreCard } from "./HealthScoreCard.js"
import { TabBar } from "./TabBar.js"
import { ResultList } from "./ResultList.js"

export type ResultTabKey = "pages" | "microflows" | "nanoflows" | "entities" | "attributes"
type ManualResourceType = "Page" | "Microflow" | "Nanoflow"

interface ManualNavigationEntry {
    type: ManualResourceType
    qualifiedName: string
}

interface DeadCodePanelProps {
    model: ModelLike
    marketplaceModuleNames: ReadonlySet<string>
}

interface MultiSelectDropdownProps {
    options: { qualifiedName: string; displayName: string }[]
    selected: string[]
    onChange: (selected: string[]) => void
    placeholder: string
    accentColor: string
}

const storageKey = "dead-code-detector.navigation-overrides"
const typeOptions: ManualResourceType[] = ["Page", "Microflow", "Nanoflow"]

const typeIcons: Record<ManualResourceType, string> = {
    Page: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm0 8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6z",
    Microflow: "M13 10V3L4 14h7v7l9-11h-7z",
    Nanoflow: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707",
}

const typeColors: Record<ManualResourceType, string> = {
    Page: "#8fb9c9",
    Microflow: "#9fd3b4",
    Nanoflow: "#d7b57a",
}

function normalizeName(value: string): string {
    return value.trim().replace(/\//g, ".").replace(/\$/g, ".")
}

function resultTabKeyForType(type: ManualResourceType): ResultTabKey {
    if (type === "Page") return "pages"
    if (type === "Microflow") return "microflows"
    return "nanoflows"
}

function loadManualEntries(): ManualNavigationEntry[] {
    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return []
        const parsed = JSON.parse(raw) as ManualNavigationEntry[]
        return parsed
            .filter(item => item?.qualifiedName && item?.type)
            .map(item => ({
                type: item.type,
                qualifiedName: normalizeName(item.qualifiedName),
            }))
    } catch {
        return []
    }
}

function saveManualEntries(entries: ManualNavigationEntry[]): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(entries))
    } catch {
    }
}

function matchesManualEntry(item: DeadItem, entry: ManualNavigationEntry): boolean {
    if (item.type !== entry.type) return false

    const normalizedQualifiedName = normalizeName(item.qualifiedName)
    const normalizedEntry = normalizeName(entry.qualifiedName)
    const moduleQualifiedName = item.module ? `${item.module}.${item.name}` : item.name

    return (
        normalizedQualifiedName === normalizedEntry ||
        normalizeName(moduleQualifiedName) === normalizedEntry ||
        normalizeName(item.name) === normalizedEntry
    )
}

function applyManualNavigationEntries(
    report: DeadCodeReport,
    entries: ManualNavigationEntry[]
): DeadCodeReport {
    if (entries.length === 0) return report

    const filtered = {
        ...report,
        pages: report.pages.filter(item => !entries.some(entry => matchesManualEntry(item, entry))),
        microflows: report.microflows.filter(item => !entries.some(entry => matchesManualEntry(item, entry))),
        nanoflows: report.nanoflows.filter(item => !entries.some(entry => matchesManualEntry(item, entry))),
    }

    return {
        ...filtered,
        healthScore: calculateHealthScore(filtered, report.totals),
    }
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    options,
    selected,
    onChange,
    placeholder,
    accentColor,
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState("")
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredOptions = options.filter(option =>
        option.displayName.toLowerCase().includes(search.toLowerCase())
    )

    const toggleOption = (qualifiedName: string) => {
        if (selected.includes(qualifiedName)) {
            onChange(selected.filter(value => value !== qualifiedName))
        } else {
            onChange([...selected, qualifiedName])
        }
    }

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <button
                type="button"
                onClick={() => setIsOpen(current => !current)}
                style={{
                    width: "100%",
                    minHeight: 48,
                    border: isOpen ? `1px solid ${accentColor}` : "1px solid #29313b",
                    borderRadius: 12,
                    backgroundColor: "#141a21",
                    padding: "10px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    textAlign: "left",
                    boxShadow: isOpen ? "0 0 0 3px rgba(159, 211, 180, 0.08)" : "none",
                    transition: "border-color 0.16s ease, box-shadow 0.16s ease",
                }}
            >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minWidth: 0, flex: 1 }}>
                    {selected.length === 0 ? (
                        <span style={{ color: "#8d98a7", fontSize: 13 }}>{placeholder}</span>
                    ) : (
                        selected.map(qualifiedName => {
                            const option = options.find(item => item.qualifiedName === qualifiedName)
                            return (
                                <span
                                    key={qualifiedName}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        maxWidth: 220,
                                        padding: "5px 8px",
                                        borderRadius: 999,
                                        backgroundColor: "#1d242d",
                                        border: "1px solid #313a46",
                                        color: "#e7edf5",
                                        fontSize: 12,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {option?.displayName || qualifiedName}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation()
                                            toggleOption(qualifiedName)
                                        }}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: "#8d98a7",
                                            cursor: "pointer",
                                            padding: 0,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            )
                        })
                    )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8d98a7" strokeWidth="2" style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.16s ease" }}>
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        backgroundColor: "#11171d",
                        border: "1px solid #29313b",
                        borderRadius: 14,
                        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.42)",
                        overflow: "hidden",
                    }}
                >
                    <div style={{ padding: 10, borderBottom: "1px solid #242b34" }}>
                        <div style={{ position: "relative" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#728093" strokeWidth="2" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                            </svg>
                            <input
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search resources"
                                autoFocus
                                style={{
                                    width: "100%",
                                    height: 40,
                                    borderRadius: 10,
                                    border: "1px solid #2b3440",
                                    padding: "0 12px 0 36px",
                                    fontSize: 13,
                                    color: "#e7edf5",
                                    outline: "none",
                                    backgroundColor: "#0c1116",
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: 280, overflow: "auto" }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: 18, color: "#8d98a7", fontSize: 13, textAlign: "center" }}>
                                No matching resources
                            </div>
                        ) : (
                            filteredOptions.map(option => {
                                const isSelected = selected.includes(option.qualifiedName)
                                return (
                                    <button
                                        key={option.qualifiedName}
                                        type="button"
                                        onClick={() => toggleOption(option.qualifiedName)}
                                        style={{
                                            width: "100%",
                                            border: "none",
                                            backgroundColor: isSelected ? "#16221d" : "#11171d",
                                            borderBottom: "1px solid #242b34",
                                            padding: "11px 14px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            textAlign: "left",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: 4,
                                                border: isSelected ? `1px solid ${accentColor}` : "1px solid #405062",
                                                backgroundColor: isSelected ? accentColor : "#11171d",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {isSelected && (
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#08100d" strokeWidth="3">
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: "#e7edf5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {option.displayName}
                                        </span>
                                    </button>
                                )
                            })
                        )}
                    </div>
                    <div style={{ padding: "10px 14px", backgroundColor: "#0d1318", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#8d98a7" }}>
                            {selected.length} selected
                        </span>
                        {selected.length > 0 && (
                            <button type="button" onClick={event => { event.stopPropagation(); onChange([]) }} style={{ border: "none", background: "transparent", color: accentColor, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export const DeadCodePanel: React.FC<DeadCodePanelProps> = ({
    model,
    marketplaceModuleNames,
}) => {
    const [activeTab, setActiveTab] = useState<ResultTabKey>("pages")
    const [report, setReport] = useState<DeadCodeReport | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [manualEntries, setManualEntries] = useState<ManualNavigationEntry[]>(() => loadManualEntries())
    const [overrideType, setOverrideType] = useState<ManualResourceType>("Page")
    const [overridesModalOpen, setOverridesModalOpen] = useState(false)

    const effectiveReport = report ? applyManualNavigationEntries(report, manualEntries) : null

    const handleScan = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await runAllScanners(model, marketplaceModuleNames)
            setReport(result)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [model, marketplaceModuleNames])

    const setEntriesForType = useCallback((type: ManualResourceType, qualifiedNames: string[]) => {
        const normalizedNames = new Set(qualifiedNames.map(normalizeName))
        setManualEntries(current => {
            const preserved = current.filter(entry => entry.type !== type)
            const next = [
                ...preserved,
                ...[...normalizedNames].map(qualifiedName => ({ type, qualifiedName })),
            ]
            saveManualEntries(next)
            return next
        })
    }, [])

    const removeManualEntry = useCallback((entryToRemove: ManualNavigationEntry) => {
        setManualEntries(current => {
            const next = current.filter(
                entry => !(
                    entry.type === entryToRemove.type &&
                    normalizeName(entry.qualifiedName) === normalizeName(entryToRemove.qualifiedName)
                )
            )
            saveManualEntries(next)
            return next
        })
    }, [])

    const clearAllOverrides = useCallback(() => {
        setManualEntries([])
        saveManualEntries([])
    }, [])

    const overrideSourceItems = (() => {
        if (!report) return [] as DeadItem[]
        return report[resultTabKeyForType(overrideType)]
    })()

    const dropdownOptions = useMemo(
        () => overrideSourceItems
            .filter((item, index, array) => array.findIndex(other => other.qualifiedName === item.qualifiedName) === index)
            .map(item => ({
                qualifiedName: normalizeName(item.qualifiedName),
                displayName: `${item.module}.${item.name}`,
            })),
        [overrideSourceItems]
    )

    const selectedValues = manualEntries
        .filter(entry => entry.type === overrideType)
        .map(entry => normalizeName(entry.qualifiedName))

    const counts = effectiveReport
        ? {
              pages: effectiveReport.pages.length,
              microflows: effectiveReport.microflows.length,
              nanoflows: effectiveReport.nanoflows.length,
              entities: effectiveReport.entities.length,
              attributes: effectiveReport.attributes.length,
          }
        : { pages: 0, microflows: 0, nanoflows: 0, entities: 0, attributes: 0 }

    const totalDead = counts.pages + counts.microflows + counts.nanoflows + counts.entities + counts.attributes
    const scannedLabel = effectiveReport ? effectiveReport.scannedAt.toLocaleString() : ""
    const currentAccent = typeColors[overrideType]

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "radial-gradient(circle at top, rgba(159, 211, 180, 0.08), transparent 22%), linear-gradient(180deg, #090d12 0%, #10151b 100%)",
                color: "#e7edf5",
                fontFamily: '"Bahnschrift", "Aptos", "Segoe UI", sans-serif',
            }}
        >
            <style>{`
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #38424f; border-radius: 999px; }
                ::-webkit-scrollbar-thumb:hover { background: #4c5867; }
                @keyframes dcd-pulse { 0%, 100% { opacity: 0.45; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1); } }
                @keyframes dcd-bar { 0%, 100% { transform: scaleY(0.45); opacity: 0.45; } 50% { transform: scaleY(1); opacity: 1; } }
                @keyframes dcd-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes dcd-fade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes dcd-modal { from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); } to { opacity: 1; transform: translate(-50%, -50%); } }
            `}</style>            <header
                style={{
                    flexShrink: 0,
                    padding: "18px 24px",
                    borderBottom: "1px solid #1d242d",
                    backgroundColor: "rgba(9, 13, 18, 0.9)",
                    backdropFilter: "blur(10px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 16, backgroundColor: "#121820", border: "1px solid #27303a", boxShadow: "0 18px 32px rgba(0, 0, 0, 0.28)" }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 18 }}>
                            {[0, 1, 2].map(index => (
                                <span key={index} style={{ width: 4, height: 18, borderRadius: 999, background: index === 1 ? "#9fd3b4" : "#617084", opacity: index === 1 ? 1 : 0.72 }} />
                            ))}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.08em", color: "#f3f7fb", lineHeight: 1 }}>
                            DCD
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
                        <button type="button" onClick={() => setOverridesModalOpen(true)} style={{ height: 42, padding: "0 14px", borderRadius: 10, border: "1px solid #27303a", backgroundColor: "#141a21", color: "#d7e0ea", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                            </svg>
                            Navigation overrides
                            {manualEntries.length > 0 && (
                                <span style={{ minWidth: 20, height: 20, borderRadius: 999, backgroundColor: "#9fd3b4", color: "#08100d", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                                    {manualEntries.length}
                                </span>
                            )}
                        </button>

                        <button type="button" onClick={handleScan} disabled={loading} style={{ height: 48, minWidth: 168, padding: "0 20px", borderRadius: 12, border: "1px solid #2e7a67", backgroundColor: loading ? "#4b5967" : "#1f6b59", color: "#f6fbf8", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 12px 30px rgba(31, 107, 89, 0.3)" }}>
                            {loading ? <>Scanning</> : <>Scan project</>}
                        </button>
                    </div>
                </div>

                <div style={{ fontSize: 15, color: "#94a1b2", lineHeight: 1.5 }}>
                    Review unused resources and override navigation-linked false positives.
                </div>
            </header>

            <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                {overridesModalOpen && (
                    <>
                        <div onClick={() => setOverridesModalOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", zIndex: 999, animation: "dcd-fade 0.16s ease" }} />
                        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(760px, 92vw)", maxHeight: "84vh", backgroundColor: "#121820", borderRadius: 18, border: "1px solid #27303a", boxShadow: "0 28px 60px rgba(0, 0, 0, 0.45)", zIndex: 1000, display: "flex", flexDirection: "column", overflow: "hidden", animation: "dcd-modal 0.2s ease" }}>
                            <div style={{ padding: "20px 24px 18px", borderBottom: "1px solid #222a34", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f2f6fb" }}>
                                        Navigation overrides
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 13, color: "#92a0b1", lineHeight: 1.5 }}>
                                        Select resources that are used from navigation so they are ignored in dead-code results.
                                    </div>
                                </div>
                                <button type="button" onClick={() => setOverridesModalOpen(false)} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #2b3440", backgroundColor: "#0f141a", color: "#92a0b1", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div style={{ padding: 24, overflow: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {typeOptions.map(option => {
                                        const isActive = overrideType === option
                                        const color = typeColors[option]
                                        const count = manualEntries.filter(entry => entry.type === option).length
                                        return (
                                            <button key={option} type="button" onClick={() => setOverrideType(option)} style={{ height: 40, padding: "0 14px", borderRadius: 999, border: isActive ? `1px solid ${color}` : "1px solid #2f3844", backgroundColor: isActive ? "#161f1d" : "#0f141a", color: isActive ? color : "#97a4b5", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d={typeIcons[option]} />
                                                </svg>
                                                {option}
                                                {count > 0 && (
                                                    <span style={{ minWidth: 18, height: 18, borderRadius: 999, backgroundColor: isActive ? color : "#1d2430", color: isActive ? "#08100d" : "#97a4b5", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>

                                <MultiSelectDropdown
                                    options={dropdownOptions}
                                    selected={selectedValues}
                                    onChange={values => setEntriesForType(overrideType, values)}
                                    placeholder={`Select ${overrideType.toLowerCase()} resources`}
                                    accentColor={currentAccent}
                                />

                                {manualEntries.length === 0 ? (
                                    <div style={{ borderRadius: 14, border: "1px dashed #394350", backgroundColor: "#10151b", padding: 18, color: "#92a0b1", fontSize: 13, lineHeight: 1.6 }}>
                                        No overrides selected yet.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#92a0b1" }}>
                                            Active overrides
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {manualEntries.map(entry => (
                                                <button key={`${entry.type}:${entry.qualifiedName}`} type="button" onClick={() => removeManualEntry(entry)} style={{ borderRadius: 999, border: "1px solid #313a46", backgroundColor: "#141b22", padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#e7edf5", fontSize: 12, fontWeight: 600 }}>
                                                    <span style={{ padding: "3px 7px", borderRadius: 999, backgroundColor: "#0f141a", color: typeColors[entry.type], fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        {entry.type}
                                                    </span>
                                                    <span>{entry.qualifiedName}</span>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92a0b1" strokeWidth="2">
                                                        <path d="M18 6L6 18M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {manualEntries.length > 0 && (
                                <div style={{ padding: "16px 24px", borderTop: "1px solid #222a34", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 13, color: "#92a0b1" }}>
                                        {manualEntries.length} override{manualEntries.length === 1 ? "" : "s"} active
                                    </span>
                                    <button type="button" onClick={clearAllOverrides} style={{ border: "none", background: "transparent", color: "#d98b8b", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {error && !loading && (
                    <div style={{ padding: "14px 16px", borderRadius: 14, backgroundColor: "#241417", border: "1px solid #573039", color: "#efb7bf", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M15 9l-6 6" />
                            <path d="M9 9l6 6" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {loading && (
                    <div style={{ minHeight: 320, borderRadius: 18, border: "1px solid #252d37", background: "radial-gradient(circle at top, rgba(159, 211, 180, 0.1), transparent 32%), linear-gradient(180deg, #121820 0%, #0d1217 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
                        <div style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: "#141b22", border: "1px solid #313a46", boxShadow: "0 18px 40px rgba(0, 0, 0, 0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 30 }}>
                                {[0, 1, 2, 3].map(index => (
                                    <div key={index} style={{ width: 8, height: 30, borderRadius: 999, background: index >= 2 ? "#9fd3b4" : "#6e7b8d", transformOrigin: "bottom center", animation: `dcd-bar 1s ${index * 0.12}s ease-in-out infinite` }} />
                                ))}
                            </div>
                        </div>
                        <div style={{ textAlign: "center", maxWidth: 480 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8fa0b1" }}>
                                Scan in progress
                            </div>
                            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em", color: "#f2f6fb" }}>
                                Building the usage map
                            </div>
                            <div style={{ marginTop: 10, fontSize: 14, color: "#97a4b5", lineHeight: 1.7 }}>
                                Checking references across pages, microflows, nanoflows, entities, and attributes to prepare the latest dead-code report.
                            </div>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, backgroundColor: "#171e26", color: "#c5d0dc", fontSize: 12, fontWeight: 600 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#9fd3b4", animation: "dcd-pulse 1.2s ease-in-out infinite" }} />
                            Please wait while DCD reviews the model
                        </div>
                    </div>
                )}

                {!loading && !error && !effectiveReport && (
                    <div style={{ minHeight: 280, borderRadius: 18, border: "1px solid #252d37", backgroundColor: "#121820", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: 32 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#161d25", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #2a323c" }}>
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#91a0b2" strokeWidth="1.6">
                                <path d="M12 2L2 7l10 5 10-5" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#f2f6fb" }}>Ready to scan</div>
                            <div style={{ marginTop: 8, fontSize: 14, color: "#97a4b5", lineHeight: 1.6, maxWidth: 420 }}>
                                Run a scan to review unused pages, flows, nanoflows, entities, and attributes in the current project.
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !error && effectiveReport && (
                    <>
                        <div style={{ animation: "dcd-rise 0.24s ease" }}>
                            <HealthScoreCard
                                score={effectiveReport.healthScore}
                                counts={counts}
                                totalDead={totalDead}
                                scannedAtLabel={scannedLabel}
                            />
                        </div>

                        <section style={{ backgroundColor: "#121820", borderRadius: 18, border: "1px solid #252d37", overflow: "hidden", animation: "dcd-rise 0.3s ease" }}>
                            <TabBar
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                counts={counts}
                            />
                            <ResultList
                                activeTab={activeTab}
                                data={{
                                    pages: effectiveReport.pages.map(item => ({ module: item.module, name: item.name })),
                                    microflows: effectiveReport.microflows.map(item => ({ module: item.module, name: item.name })),
                                    nanoflows: effectiveReport.nanoflows.map(item => ({ module: item.module, name: item.name })),
                                    entities: effectiveReport.entities.map(item => ({ module: item.module, name: item.name })),
                                    attributes: effectiveReport.attributes.map(item => ({ module: item.module, name: item.name })),
                                }}
                            />
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}

