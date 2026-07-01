import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Play,
  HelpCircle,
  FileText,
  Send,
  Sparkles,
  RefreshCw,
  Activity,
  ShieldCheck,
  Database,
  Flame,
  Clock,
  Trash2,
  ShieldX,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Unlock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Accessibility,
  ArrowUpDown,
} from "lucide-react";
import {
  Occupant,
  LedgerBlock,
  DrillHistoryItem,
  EAPEmergencyType,
  EvacDecision,
} from "../types";
import { PILOT_GOALS, PilotGoalContext, FLOOR7_CENSUS } from "../pilotGoals";
import { EAP_EMERGENCY_TYPES, EAP_DECISIONS, ELEVATOR_RECALL } from "../data";
import { saveRecord, recordCounts } from "../recordStore";

interface FSDCommandCenterProps {
  occupants: Occupant[];
  ledger: LedgerBlock[];
  isBlackout: boolean;
  onClearIncident: () => void;
  onLogEvent: (event: string) => void;
  stairBBlocked: boolean;
  onToggleStairB: () => void;
  onTamperLedger: () => void;
  onResetLedger: () => void;
  isLedgerTampered: boolean;
  ledgerIntegrity: { verified: boolean; auditLogs: string[] };
  activeDirective: string;
  onDispatchDirective: (directive: string) => void;
  onDispatchFamilySms?: () => void;
}

export default function FSDCommandCenter({
  occupants,
  ledger,
  isBlackout,
  onClearIncident,
  onLogEvent,
  stairBBlocked,
  onToggleStairB,
  onTamperLedger,
  onResetLedger,
  isLedgerTampered,
  ledgerIntegrity,
  activeDirective,
  onDispatchDirective,
  onDispatchFamilySms,
}: FSDCommandCenterProps) {
  // Safety Checklist State (OSHA 1910.38 & NYC RS-17 compliance)
  const [checklist, setChecklist] = useState([
    {
      id: "check_1",
      task: "Confirm FSD Desk Fire Command Station Enclosure (NYC RS-17)",
      done: true,
    },
    {
      id: "check_2",
      task: "Transmit evacuation signals to Floor 7 Pilot Strobe lamps",
      done: true,
    },
    {
      id: "check_3",
      task: "Establish BLE Mesh peer routing backup links",
      done: true,
    },
    {
      id: "check_4",
      task: "Dispatch Quadrant Wardens to Stairwell landings",
      done: false,
    },
    {
      id: "check_5",
      task: "Cross-verify hash-chained rosters against gate sensor cards",
      done: false,
    },
    {
      id: "check_6",
      task: "Generate pre-arrival incident reports to bundle for FDNY arrival Liaison",
      done: false,
    },
  ]);

  // FDNY generated report state
  const [fdnyReport, setFdnyReport] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Counts of persisted records in the two *isolated* sets (drill vs real).
  // Goal #6: zero drill data ever lands in a real FDNY submission.
  const [recordStats, setRecordStats] = useState(() => recordCounts());

  // Headcount & Locator System States
  const [locatorTab, setLocatorTab] = useState<"ALL" | "AT_RISK" | "SAFE">(
    "ALL",
  );
  const [locatorSector, setLocatorSector] = useState<
    "ALL" | "NW" | "NE" | "SW" | "SE" | "Center"
  >("ALL");
  const [locatorPage, setLocatorPage] = useState(1);
  const [fsdSearchQuery, setFsdSearchQuery] = useState("");
  const [unsealedTokenId, setUnsealedTokenId] = useState<string | null>(null);
  const [unsealedDetails, setUnsealedDetails] = useState<any | null>(null);
  const [isUnsealing, setIsUnsealing] = useState(false);

  const handleUnsealFsd = async (tokenId: string) => {
    if (unsealedTokenId === tokenId) {
      setUnsealedTokenId(null);
      setUnsealedDetails(null);
      return;
    }
    setIsUnsealing(true);
    setUnsealedTokenId(tokenId);
    setUnsealedDetails(null);
    try {
      const res = await fetch("/api/vault/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenId, requesterId: "fsd_admin" }),
      });
      if (res.ok) {
        const data = await res.json();
        setUnsealedDetails(data.decrypted);
        onLogEvent(
          `Security unseal authorised: Command decrypted identity for token ${tokenId} over TLS 1.3.`,
        );
      } else {
        onLogEvent(
          `Unseal error: Secure Vault Node rejected request for token ${tokenId}.`,
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUnsealing(false);
    }
  };

  // Dynamic incident clock
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (sec: number) => {
    const mm = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    );
    onLogEvent(`FSD updated emergency checklist safety parameter.`);
  };

  // Drill vs. real-incident mode. Gates family-notification SMS and keeps
  // drill records quarantined from any real FDNY submission.
  const [isDrill, setIsDrill] = useState(true);

  // ─── EAP Emergency Declaration state ───────────────────────────────────
  const [selectedEmergency, setSelectedEmergency] =
    useState<EAPEmergencyType>("Fire/Smoke");
  const [evacDecision, setEvacDecision] = useState<EvacDecision>("EVACUATE");
  const [elevatorRecall, setElevatorRecall] = useState(
    ELEVATOR_RECALL.map((e) => ({ ...e })),
  );
  // Broadcast flow state for the EAP stepper (ready → broadcasting → sent)
  const [broadcastState, setBroadcastState] = useState<
    "ready" | "broadcasting" | "sent"
  >("ready");

  // ---- Interactive map: zoom / pan / full screen over the real floor plan ----
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const mapDragRef = useRef<{ x: number; y: number } | null>(null);

  // Preload the real 7th-floor As-Built plan; only use it if it genuinely decodes.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasPlan(true);
    img.onerror = () => setHasPlan(false);
    img.src = "/floor7-plan.png";
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  useEffect(() => {
    const onFs = () => setMapFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const mapClampZoom = (z: number) => Math.max(1, Math.min(8, z));
  const mapZoomIn = () => setMapZoom((z) => mapClampZoom(z * 1.4));
  const mapZoomOut = () =>
    setMapZoom((z) => {
      const n = mapClampZoom(z / 1.4);
      if (n === 1) setMapPan({ x: 0, y: 0 });
      return n;
    });
  const mapReset = () => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  };
  const mapToggleFullscreen = () => {
    const el = mapBoxRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el.requestFullscreen) el.requestFullscreen();
    else setMapFullscreen((v) => !v);
  };
  const mapOnWheel = (e: React.WheelEvent) =>
    setMapZoom((z) => mapClampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  const mapOnDown = (e: React.MouseEvent) => {
    mapDragRef.current = { x: e.clientX, y: e.clientY };
  };
  const mapOnMove = (e: React.MouseEvent) => {
    if (!mapDragRef.current) return;
    setMapPan((p) => ({
      x: p.x + (e.clientX - mapDragRef.current!.x),
      y: p.y + (e.clientY - mapDragRef.current!.y),
    }));
    mapDragRef.current = { x: e.clientX, y: e.clientY };
  };
  const mapEndDrag = () => {
    mapDragRef.current = null;
  };

  // Generate compliance FDNY reports (NYC LL26 Rs-17 Audit checklist)
  const generateFdnyReport = () => {
    const uniqueTimeStr = new Date().toUTCString();
    const safeCount = occupants.filter((o) => o.status === "SAFE").length;
    const criticalCount = occupants.filter(
      (o) => o.status === "CRITICAL",
    ).length;
    const needHelpCount = occupants.filter(
      (o) => o.status === "NEED_HELP",
    ).length;
    const missingCount = occupants.filter((o) => o.status === "MISSING").length;

    const recordMode = isDrill ? "drill" : "real";
    const formattedReport = `================================================================================
MUSTERCOMMAND LIFE-SAFETY COMPLIANCE AUDIT CERTIFICATE
REGULATORY CLEARANCE: NYC LL26 (RS-17) / OSHA 29 CFR 1910.38
CONEDISON FLOOR 7 PILOT DIVISION - 4 IRVING PLAZA, NEW YORK NY
================================================================================
RECORD CLASSIFICATION : ${isDrill ? "*** DRILL — NOT FOR FDNY SUBMISSION ***" : "REAL INCIDENT — FDNY SUBMISSION ELIGIBLE"}
INCIDENT TIMESTAMP : ${uniqueTimeStr}
MESSENGER SECTOR   : Life-Critical FSD Comm Station
INCIDENT LIFETIME   : ${formatElapsed(elapsedSeconds)} elapsed
NETWORK LINK TYPE  : ${isBlackout ? "HMAC Bluetooth Mesh - Backup Gateway" : "Primary Cloud Ingress Gateway"}
OSHA ACCOUNTABILITY: 29 CFR 1910.38 ceiling < 12 min · Floor 7 target < 3 min (stretch < 90 s)
RECORDS RETENTION  : 10 years (NYC Local Law 26 / FDNY F-89)
PRIMARY MUSTER     : Stuyvesant Square Park (btwn 17th & 15th St)
SECONDARY MUSTER   : Union Square Park (along E 14th St)
AUTH'D ELEVATORS   : A-Bank Car #14 · G-Bank Car #1 (all others recalled to lobby)

--------------------------------------------------------------------------------
1. COMPREHENSIVE HEADCOUNT STATS
--------------------------------------------------------------------------------
TOTAL ON-SITE ROSTER REGISTRATION : ${occupants.length} personnel
DECIPHERED AS SAFE (ACCOUNTED)    : ${safeCount}
DECLARED UNACCOUNTED (MISSING)    : ${missingCount}
REPORTED PHYSICAL DISTRESS (MIA)  : ${needHelpCount}
CRITICAL TELEMETRY FALL INJURY    : ${criticalCount}

--------------------------------------------------------------------------------
2. COMPLIANCE SIGNATURE & INTEGRITY CHAIN (VERIFIED IN-MEMORY LEDGER)
--------------------------------------------------------------------------------
LEDGER BLOCKS COMPILED : ${ledger.length} verified operations
LEDGER SECURITY HASH   : Verified ${ledgerIntegrity.verified ? "PASS" : "FAIL"}
ROOT ANCHOR SIGNATURE  : Block 0 Base [${ledger[0]?.hash.substring(0, 16)}...]
LEDGER TAIL HASH       : Tail Block [${ledger[ledger.length - 1]?.hash.substring(0, 16)}...]

CERTIFIED BY:
Fire Safety Director (F-89 Designation Logged)
MusterCommand OS Integration Engine

--------------------------------------------------------------------------------
3. AREA OF RESCUE ASSISTANCE (ARA) — MOBILITY-IMPAIRED EVAC-CHAIR LIST
--------------------------------------------------------------------------------
${(() => {
  const ara = occupants.filter((o) => o.mobilityImpaired || o.isAtARA);
  if (ara.length === 0) return "  No mobility-impaired occupants registered.";
  return ara
    .map(
      (o) =>
        `  Token: ${o.id} | Badge: ${o.badgeId} | Quadrant: ${o.quadrant} | ` +
        `Status: ${o.isAtARA ? "STAGED AT ARA" : "IN TRANSIT"} | ` +
        `Incident Status: ${o.status}`,
    )
    .join("\n");
})()}
ARA TOTAL     : ${occupants.filter((o) => o.mobilityImpaired || o.isAtARA).length} occupants
STAGED        : ${occupants.filter((o) => o.isAtARA).length} confirmed at Area of Rescue
IN TRANSIT    : ${occupants.filter((o) => (o.mobilityImpaired || o.isAtARA) && !o.isAtARA).length} en route — evac-chair dispatch required
================================================================================`;

    setFdnyReport(formattedReport);

    // Persist into the isolated record set for the active mode and refresh the
    // live counts so Goal #6 can prove drill vs. real separation.
    saveRecord(recordMode, {
      total: occupants.length,
      safe: safeCount,
      missing: missingCount,
      needHelp: needHelpCount,
      critical: criticalCount,
      ledgerBlocks: ledger.length,
      ledgerVerified: ledgerIntegrity.verified,
      report: formattedReport,
    });
    setRecordStats(recordCounts());

    onLogEvent(
      `Generated ${isDrill ? "DRILL" : "REAL-INCIDENT"} compliance report at ${uniqueTimeStr} — filed to the ${recordMode.toUpperCase()} record set (drill/real kept isolated).`,
    );
  };

  // Sort by DANGER LEVEL > PROXIMITY (Section 8.3 Wireframe)
  // Danger Weight: CRITICAL = 3, NEED_HELP = 2, MISSING = 1, SAFE = 0.
  const getDangerWeight = (status: Occupant["status"]) => {
    if (status === "CRITICAL") return 3;
    if (status === "NEED_HELP") return 2;
    if (status === "MISSING") return 1;
    return 0;
  };

  const sortedRedList = [...occupants]
    .filter((o) => o.status !== "SAFE")
    .sort((a, b) => {
      const wa = getDangerWeight(a.status);
      const wb = getDangerWeight(b.status);
      if (wb !== wa) return wb - wa; // higher danger first
      // simple alphabetical fallback
      return a.id.localeCompare(b.id);
    });

  const filteredLocatorOccupants = [...occupants]
    .filter((o) => {
      // 1. Tab Status Filter
      if (locatorTab === "AT_RISK" && o.status === "SAFE") return false;
      if (locatorTab === "SAFE" && o.status !== "SAFE") return false;

      // 2. Sector Filter
      if (locatorSector !== "ALL" && o.quadrant !== locatorSector) return false;

      // 3. Text Search Query
      if (fsdSearchQuery) {
        const query = fsdSearchQuery.toLowerCase();
        const matchesName =
          o.nameEncrypted.toLowerCase().includes(query) ||
          o.id.toLowerCase().includes(query);
        const matchesBadge = o.badgeId.toLowerCase().includes(query);
        const matchesRole = o.role.toLowerCase().includes(query);
        const matchesNote =
          o.alertNote && o.alertNote.toLowerCase().includes(query);
        if (!matchesName && !matchesBadge && !matchesRole && !matchesNote)
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      const wa = getDangerWeight(a.status);
      const wb = getDangerWeight(b.status);
      if (wb !== wa) return wb - wa; // higher danger first
      return a.id.localeCompare(b.id);
    });

  // Calculate items for pagination
  const PAGE_SIZE = 3;
  const maxPage = Math.max(
    1,
    Math.ceil(filteredLocatorOccupants.length / PAGE_SIZE),
  );
  const activeLocatorPage = Math.min(locatorPage, maxPage);
  const paginatedLocatorOccupants = filteredLocatorOccupants.slice(
    (activeLocatorPage - 1) * PAGE_SIZE,
    activeLocatorPage * PAGE_SIZE,
  );

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col text-slate-200">
      {/* Commanding Header Ribbon */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-5 mb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white font-black text-xs uppercase font-mono px-3 py-1 rounded-lg tracking-widest animate-pulse">
              INCIDENT ACTIVE
            </span>
            <h2 className="text-xl font-black tracking-tight text-slate-200">
              Command Deck
              <span className="text-slate-500 font-normal text-base ml-2">
                FSD Station
              </span>
            </h2>
          </div>
          <div className="text-sm text-slate-600 font-mono mt-2 flex items-center gap-3 flex-wrap">
            <span>Floor 7 · 4 Irving Plaza</span>
            <span className="text-slate-400">·</span>
            <span className="flex items-center gap-1.5 font-bold text-slate-300">
              <Clock size={13} className="text-red-600 animate-spin" />
              <span>ELAPSED: {formatElapsed(elapsedSeconds)}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              const next = !isDrill;
              setIsDrill(next);
              onLogEvent(
                next
                  ? "🟦 Mode set to DRILL. Records quarantined; family SMS suppressed."
                  : "🔴 Mode set to REAL INCIDENT. Family SAFE-SMS dispatch armed.",
              );
            }}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 active:scale-95 cursor-pointer ${
              isDrill
                ? "bg-blue-100 text-blue-700 border-blue-300"
                : "bg-red-100 text-red-700 border-red-300 animate-pulse"
            }`}
          >
            {isDrill ? "🟦 DRILL MODE" : "🔴 REAL INCIDENT"}
          </button>
          <button
            onClick={() => {
              setElapsedSeconds(0);
              onLogEvent("FSD manually reset the incident elapsed timer.");
            }}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-300 font-bold text-sm py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className="text-amber-500" />
            Reset Timer
          </button>
          <button
            onClick={onToggleStairB}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
              stairBBlocked
                ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                : "bg-slate-100 text-slate-300 border-slate-300 hover:bg-slate-200"
            }`}
          >
            {stairBBlocked ? "⚠️ Stair B BLOCKED" : "Block Stair B"}
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Declare situation 100% CLEAR? This closes the current logs.",
                )
              ) {
                onClearIncident();
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/40 text-white font-bold text-sm py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle size={15} />
            Declare Clear
          </button>
        </div>
      </div>

      {/* WEARABLE RED LIST — Goal #7: critical events surface in < 10 s */}
      {(() => {
        const redList = occupants.filter(
          (o) => o.status === "CRITICAL" || o.fallDetected,
        );
        if (redList.length === 0) return null;
        return (
          <div
            role="alert"
            className="mb-5 bg-red-50 border-2 border-red-400 rounded-2xl overflow-hidden"
          >
            {/* Banner header */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-600">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-white shrink-0" />
                <span className="text-sm font-black text-white uppercase tracking-wide">
                  Wearable Red List &mdash; {redList.length} Active Alert
                  {redList.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-xs font-bold text-red-100 bg-red-700/60 border border-red-400/40 px-2.5 py-1 rounded-lg">
                FSD Priority &lt; 10 s
              </span>
            </div>

            {/* Alert cards */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {redList.map((o) => {
                const isOpen = unsealedTokenId === o.id;
                const eventLabel = o.fallDetected
                  ? "Fall Detected"
                  : "SOS / Critical";
                return (
                  <div
                    key={o.id}
                    className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-all ${
                      isOpen
                        ? "bg-white border-amber-400 shadow-lg"
                        : "bg-white border-red-300"
                    }`}
                  >
                    {/* Alert type + quadrant */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-red-700 bg-red-100 border border-red-300 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                        {eventLabel}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg">
                        {o.quadrant}
                      </span>
                    </div>

                    {/* Name + IDs */}
                    <div>
                      <p className="text-base font-bold text-slate-200 leading-tight">
                        {isOpen && unsealedDetails
                          ? unsealedDetails.name
                          : o.nameEncrypted}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {o.id} &middot; {o.badgeId}
                      </p>
                      {o.alertNote && (
                        <p className="text-xs text-red-700 font-medium italic mt-1 leading-snug">
                          &ldquo;{o.alertNote}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Unseal button */}
                    <button
                      type="button"
                      onClick={() => handleUnsealFsd(o.id)}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isOpen
                          ? "bg-amber-500 text-white border-amber-400 hover:bg-amber-600"
                          : "bg-slate-100 text-slate-300 border-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      <Unlock size={14} />
                      <span>
                        {isOpen ? "Seal Identity" : "Unseal Identity"}
                      </span>
                    </button>

                    {/* Unsealed identity panel */}
                    {isOpen && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        {isUnsealing ? (
                          <div className="flex items-center gap-2 text-slate-600">
                            <RefreshCw
                              size={14}
                              className="animate-spin text-amber-600"
                            />
                            <span className="text-sm">
                              Verifying identity via vault&hellip;
                            </span>
                          </div>
                        ) : unsealedDetails ? (
                          <div className="flex gap-3 items-start">
                            <img
                              src={unsealedDetails.photo}
                              alt={`Photo of ${unsealedDetails.name}`}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-xl object-cover border-2 border-slate-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-200 truncate">
                                {unsealedDetails.name}
                              </p>
                              <p className="text-xs text-slate-600 font-medium">
                                {unsealedDetails.role}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {unsealedDetails.department}
                              </p>
                              <p className="text-xs text-amber-700 font-semibold mt-0.5">
                                ☎ {unsealedDetails.phone}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-red-600 font-medium">
                            Vault timeout &mdash; retry.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* EAP EMERGENCY DECLARATION + ELEVATOR RECALL — full-width row above panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-5">
        {/* EAP Declaration (8 cols) */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-md">
          {/* Panel header + live status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-black text-amber-500 flex items-center gap-2 uppercase text-base">
                <Flame
                  size={16}
                  className="text-amber-500 animate-pulse shrink-0"
                />
                EAP Emergency Declaration
              </span>
              <p className="text-xs text-slate-600 font-mono mt-1">
                Classify the incident → choose LSD decision → directive
                auto-broadcasts
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Active
              </div>
              <div className="text-sm font-bold text-slate-200 mt-0.5">
                {
                  EAP_EMERGENCY_TYPES.find((e) => e.id === selectedEmergency)
                    ?.icon
                }{" "}
                {selectedEmergency}
              </div>
              <div
                className={`text-xs font-bold mt-0.5 ${evacDecision === "EVACUATE" ? "text-red-600" : evacDecision === "SHELTER_IN_PLACE" ? "text-blue-600" : "text-yellow-600"}`}
              >
                {EAP_DECISIONS.find((d) => d.id === evacDecision)?.label}
              </div>
            </div>
          </div>

          {/* ── EAP flow stepper — progress + live broadcast state ── */}
          <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl border border-slate-200 px-3 py-3">
            {/* Step 1 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  1 · Classify
                </div>
                <div className="text-xs text-amber-600 font-semibold truncate">
                  {selectedEmergency}
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
            {/* Step 2 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  2 · Decide
                </div>
                <div className="text-xs text-amber-600 font-semibold truncate">
                  {EAP_DECISIONS.find((d) => d.id === evacDecision)?.label}
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
            {/* Step 3 — broadcast state */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  broadcastState === "broadcasting"
                    ? "bg-blue-600 text-white"
                    : broadcastState === "sent"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-400"
                }`}
              >
                {broadcastState === "broadcasting" ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : broadcastState === "sent" ? (
                  <CheckCircle size={16} />
                ) : (
                  <Send size={15} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  3 · Broadcast
                </div>
                <div
                  className={`text-xs font-semibold truncate ${
                    broadcastState === "broadcasting"
                      ? "text-blue-600"
                      : broadcastState === "sent"
                        ? "text-emerald-600"
                        : "text-slate-500"
                  }`}
                >
                  {broadcastState === "broadcasting"
                    ? "Dispatching…"
                    : broadcastState === "sent"
                      ? "Live to all units"
                      : "Awaiting decision"}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1 — Emergency Type chips (3 cols, icon + full label) */}
          <div className="space-y-2">
            <span className="text-xs font-bold font-mono uppercase text-slate-600 tracking-wider block">
              Step 1 — Emergency Type
            </span>
            <div className="grid grid-cols-3 gap-2">
              {EAP_EMERGENCY_TYPES.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSelectedEmergency(e.id as EAPEmergencyType);
                    setBroadcastState("ready");
                    onLogEvent(`EAP emergency classified: ${e.icon} ${e.id}`);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${selectedEmergency === e.id ? "bg-amber-600 text-slate-950 border-amber-400 font-bold shadow-md" : "bg-white hover:bg-slate-50 text-slate-300 border-slate-300"}`}
                >
                  <span className="text-base leading-none shrink-0">
                    {e.icon}
                  </span>
                  <span className="text-xs font-semibold leading-tight">
                    {e.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Decision branches (full-width stacked rows) */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <span className="text-xs font-bold font-mono uppercase text-slate-600 tracking-wider block">
              Step 2 — LSD / FSD Decision
            </span>
            <div className="flex flex-col gap-2">
              {EAP_DECISIONS.map((d) => {
                const isSelected = evacDecision === d.id;
                const colors =
                  d.id === "EVACUATE"
                    ? {
                        active: "bg-red-600 border-red-500 text-white",
                        icon: "🚨",
                        accent: "text-red-50",
                      }
                    : d.id === "SHELTER_IN_PLACE"
                      ? {
                          active: "bg-blue-600 border-blue-500 text-white",
                          icon: "🛡️",
                          accent: "text-blue-50",
                        }
                      : {
                          // Gold/amber (real yellow, not the blue-remapped amber)
                          // so this decision stays visually distinct from Shelter.
                          active:
                            "bg-yellow-500 border-yellow-600 text-slate-100",
                          icon: "🏢",
                          accent: "text-slate-300",
                        };
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      setEvacDecision(d.id as EvacDecision);
                      onLogEvent(`LSD decision: ${d.label}`);
                      setBroadcastState("broadcasting");
                      window.setTimeout(() => setBroadcastState("sent"), 900);
                      if (d.id === "EVACUATE") {
                        onDispatchDirective(
                          `EAP — ${selectedEmergency}: EVACUATE Floor 7. Gather at corridor; FSD-assigned stairs only. PRIMARY muster: Stuyvesant Square Park.`,
                        );
                      } else if (d.id === "SHELTER_IN_PLACE") {
                        onDispatchDirective(
                          `EAP — ${selectedEmergency}: SHELTER IN PLACE. Remain in current secure area. Await FSD all-clear.`,
                        );
                      } else {
                        onDispatchDirective(
                          `EAP — ${selectedEmergency}: IN-BUILDING RELOCATION. Move to FSD-designated safe floor/zone.`,
                        );
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected ? colors.active + " font-bold shadow-md" : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"}`}
                  >
                    <span className="text-xl shrink-0 leading-none">
                      {colors.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">
                        {d.label}
                      </div>
                      <div
                        className={`text-xs leading-tight mt-0.5 ${isSelected ? colors.accent : "text-slate-500"}`}
                      >
                        {d.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle size={18} className="shrink-0 opacity-90" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Elevator Recall (4 cols) */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-md">
          <div>
            <span className="font-black text-amber-500 flex items-center gap-2 uppercase text-base">
              <ArrowUpDown size={16} className="text-amber-500 shrink-0" />
              Elevator Recall
            </span>
            <p className="text-xs text-slate-600 font-mono mt-1">
              All cars recalled to lobby. Only FSD/FDNY-authorized cars may
              move.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {elevatorRecall.map((el, idx) => (
              <div
                key={el.bank}
                className={`p-4 rounded-xl border ${el.status === "AUTHORIZED" ? "bg-emerald-50 border-emerald-300" : "bg-yellow-50 border-yellow-300"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-slate-200">
                      {el.bank} · Car #{el.carNumber}
                    </div>
                    <div
                      className={`text-xs font-mono font-semibold mt-0.5 ${el.status === "AUTHORIZED" ? "text-emerald-700" : "text-yellow-700"}`}
                    >
                      {el.status === "AUTHORIZED"
                        ? "● AUTHORIZED"
                        : "○ RECALLED TO LOBBY"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next =
                        el.status === "AUTHORIZED"
                          ? "RECALLED_LOBBY"
                          : "AUTHORIZED";
                      setElevatorRecall((prev) =>
                        prev.map((e, i) =>
                          i === idx ? { ...e, status: next } : e,
                        ),
                      );
                      onLogEvent(
                        `Elevator ${el.bank} Car #${el.carNumber} → ${next}`,
                      );
                    }}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold border transition-all cursor-pointer ${el.status === "AUTHORIZED" ? "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200" : "bg-yellow-100 border-yellow-300 text-yellow-700 hover:bg-yellow-200"}`}
                  >
                    {el.status === "AUTHORIZED" ? "Recall" : "Authorize"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto bg-red-50 border border-red-300 rounded-xl p-3">
            <p className="text-xs font-semibold text-red-700 leading-snug">
              ⚠️ No occupant elevator use during fire or explosion. Stairways
              only unless directed by FDNY.
            </p>
          </div>
        </div>
      </div>

      {/* Main Panel Content (Grid layout) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* PANEL 1: INCIDENT STATUS & F-89 DISPATCH */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-5 overflow-y-auto no-scrollbar">
          {/* Incident summary */}
          <div className="bg-red-50 border border-red-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-red-700 uppercase tracking-widest flex items-center gap-1.5">
                <Flame size={14} className="text-red-500 animate-pulse" />
                Active Hazard
              </span>
            </div>
            <p className="text-base font-black text-slate-200 uppercase">
              OFFICE FIRE — NE SECTOR
            </p>
            <p className="text-xs text-slate-600 font-mono mt-1">
              Floor 7 Breakroom · Electrical box failure
            </p>
          </div>

          {/* NYC LL26 Checklist */}
          <div>
            <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck size={15} className="text-amber-500" />
              NYC LL26 Action Matrix
            </h4>
            <div className="space-y-2">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-100 cursor-pointer select-none border border-transparent hover:border-slate-200 transition-all"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklist(item.id)}
                    className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0"
                  />
                  <span
                    className={`text-sm leading-snug ${item.done ? "line-through text-slate-500" : "text-slate-200"}`}
                  >
                    {item.task}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* F-89 Directive Dispatcher */}
          <div className="bg-white border border-slate-300 rounded-2xl p-4 flex flex-col gap-4">
            <div>
              <span className="font-black text-amber-500 flex items-center gap-2 uppercase text-base">
                <AlertTriangle
                  size={16}
                  className="text-amber-500 animate-pulse"
                />
                F-89 Directive Dispatcher
              </span>
              <p className="text-xs text-slate-600 font-mono mt-1">
                NYC Local Law 26 · Emergency Regulation Protocols
              </p>
            </div>

            {/* Current Active Broadcast */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-300">
              <span className="text-xs font-mono font-bold uppercase text-slate-500 tracking-wider block mb-1">
                Active Broadcast
              </span>
              <p className="text-sm font-semibold text-slate-200 leading-snug">
                {activeDirective}
              </p>
            </div>

            {/* Quick Dispatch Presets */}
            <div className="space-y-2">
              <span className="text-xs font-bold font-mono uppercase text-slate-600 tracking-wider block">
                Quick Presets
              </span>
              <div className="flex flex-col gap-2">
                {[
                  {
                    title: "Buffer Relocation",
                    text: "Phase 1 Relocation: Clear NE and SE occupants to NW safe zones immediately. Wardens secure landings.",
                  },
                  {
                    title: "Full Floor Evacuation",
                    text: "Phase 2 Evacuation: Whole pilot floor evacuation declared. Proceed to designated safety exits.",
                  },
                  {
                    title: "Stair B Blocked",
                    text: "Emergency Alert: Stair B reported congested or blocked. All floor components divert to northwest Stair A.",
                  },
                  {
                    title: "BLE Mesh Routing",
                    text: "BLE Mesh Sync Active: Switch tablet sync to local Mesh bypass. Log security tag keys at Stairwell nodes.",
                  },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => onDispatchDirective(preset.text)}
                    className="w-full text-left bg-white hover:bg-slate-50 border border-slate-300 hover:border-amber-600 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all cursor-pointer flex items-center gap-2"
                    title={preset.text}
                  >
                    <span className="text-amber-500 shrink-0">⚡</span>
                    <span className="truncate">{preset.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Directive */}
            <div className="pt-3 border-t border-slate-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const txt = fd.get("custom_directive") as string;
                  if (txt && txt.trim()) {
                    onDispatchDirective(txt.trim());
                    e.currentTarget.reset();
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  name="custom_directive"
                  placeholder="Custom F-89 protocol..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-sans"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide shrink-0 cursor-pointer transition-all"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* PANEL 2: MAP & DYNAMIC REROUTING (4 Columns) */}
        <div className="xl:col-span-5 min-h-[560px] bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-black text-slate-200 tracking-tight">
                Floor 7 — 4 Irving Place HQ
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                As-Built · Jan 14 2026 · Drag to pan · Scroll to zoom
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded-lg font-bold">
                RS-17 ✓
              </span>
              <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300 px-2.5 py-1 rounded-lg font-bold">
                NYC LL26
              </span>
            </div>
          </div>

          {/* Interactive architectural Floor plan (real photo + pan/zoom/fullscreen) */}
          <div
            ref={mapBoxRef}
            onMouseDown={mapOnDown}
            onMouseMove={mapOnMove}
            onMouseUp={mapEndDrag}
            onMouseLeave={mapEndDrag}
            onWheel={mapOnWheel}
            className={`flex-1 bg-white border-2 border-slate-200 shadow-inner relative flex flex-col items-center justify-center overflow-hidden ${
              mapFullscreen
                ? "h-full rounded-none"
                : "rounded-2xl min-h-[420px]"
            }`}
            style={{ cursor: mapDragRef.current ? "grabbing" : "grab" }}
          >
            {/* Zoom / pan / full-screen controls */}
            <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
              <button
                type="button"
                onClick={mapZoomIn}
                className="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-slate-50 hover:border-amber-600 shadow-sm transition-all cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={mapZoomOut}
                className="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-slate-50 hover:border-amber-600 shadow-sm transition-all cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={mapToggleFullscreen}
                className="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-slate-50 hover:border-amber-600 shadow-sm transition-all cursor-pointer"
                title={mapFullscreen ? "Exit full screen" : "Open full screen"}
              >
                {mapFullscreen ? (
                  <Minimize2 size={15} />
                ) : (
                  <Maximize2 size={15} />
                )}
              </button>
              {(mapZoom !== 1 || mapPan.x !== 0 || mapPan.y !== 0) && (
                <button
                  type="button"
                  onClick={mapReset}
                  className="w-9 h-9 flex items-center justify-center bg-amber-600 border border-amber-500 rounded-xl text-white hover:bg-amber-500 shadow-sm transition-all cursor-pointer"
                  title="Reset view"
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>

            <svg
              viewBox="0 0 740 500"
              className="w-full h-full select-none"
              style={{
                transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
                transformOrigin: "center",
                transition: mapDragRef.current
                  ? "none"
                  : "transform 0.12s ease-out",
              }}
            >
              {/* Grid Background */}
              <defs>
                <pattern
                  id="arch-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="#0e1726"
                    strokeWidth="1"
                  />
                </pattern>

                {/* Radial Gradients for Division overlays */}
                <radialGradient id="grad-nw" cx="25%" cy="25%" r="40%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </radialGradient>
                <radialGradient id="grad-ne" cx="75%" cy="25%" r="40%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </radialGradient>
                <radialGradient id="grad-sw" cx="25%" cy="75%" r="40%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </radialGradient>
                <radialGradient id="grad-se" cx="75%" cy="75%" r="40%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </radialGradient>
              </defs>

              {/* Apply technical grid background */}
              <rect width="100%" height="100%" fill="url(#arch-grid)" />

              {/* STREET REPR - North (E 15th St) */}
              <rect
                x="60"
                y="5"
                width="620"
                height="25"
                fill="#090d16"
                rx="4"
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x="370"
                y="21"
                fill="#475569"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="2"
              >
                ▲ EAST 15TH STREET ▲
              </text>

              {/* STREET REPR - South (E 14th St) */}
              <rect
                x="60"
                y="470"
                width="620"
                height="25"
                fill="#090d16"
                rx="4"
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x="370"
                y="486"
                fill="#475569"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="2"
              >
                ▼ EAST 14TH STREET ▼
              </text>

              {/* STREET REPR - West (Irving Place) */}
              <rect
                x="5"
                y="55"
                width="25"
                height="385"
                fill="#090d16"
                rx="4"
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x="18"
                y="248"
                fill="#475569"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="2"
                transform="rotate(-90, 18, 248)"
              >
                ◀ IRVING PLACE ◀
              </text>

              {/* STREET REPR - East (Third Avenue) */}
              <rect
                x="710"
                y="55"
                width="25"
                height="385"
                fill="#090d16"
                rx="4"
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x="723"
                y="248"
                fill="#475569"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="2"
                transform="rotate(90, 723, 248)"
              >
                ▶ THIRD AVENUE ▶
              </text>

              {/* Outer Architectural Wall Boundary - Floor 7 Pilot, 4 Irving Plaza */}
              <rect
                x="60"
                y="55"
                width="620"
                height="385"
                rx="14"
                fill="#0a0e19"
                fillOpacity="0.85"
                stroke="#334155"
                strokeWidth="3"
              />

              {/* Zone / Division Aesthetic Background Overlays */}
              {/* NW Zone */}
              <rect
                x="62"
                y="57"
                width="308"
                height="193"
                fill="url(#grad-nw)"
                rx="10"
              />
              {/* NE Zone */}
              <rect
                x="370"
                y="57"
                width="308"
                height="193"
                fill="url(#grad-ne)"
                rx="10"
              />
              {/* SW Zone */}
              <rect
                x="62"
                y="250"
                width="308"
                height="188"
                fill="url(#grad-sw)"
                rx="10"
              />
              {/* SE Zone */}
              <rect
                x="370"
                y="250"
                width="308"
                height="188"
                fill="url(#grad-se)"
                rx="10"
              />

              {/* Quadrant Demarcation Guidelines */}
              <line
                x1="370"
                y1="55"
                x2="370"
                y2="440"
                stroke="#1e293b"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
              <line
                x1="60"
                y1="250"
                x2="680"
                y2="250"
                stroke="#1e293b"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />

              {/* TWO CENTRAL COURTYARDS (Double Donut Architecture) */}
              {/* Left Courtyard */}
              <g className="opacity-95">
                <rect
                  x="180"
                  y="155"
                  width="120"
                  height="120"
                  rx="8"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                <rect
                  x="190"
                  y="165"
                  width="100"
                  height="100"
                  rx="4"
                  fill="none"
                  stroke="#2a3d5e"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                />
                {/* Visual Tree Glyphs */}
                <circle
                  cx="210"
                  cy="195"
                  r="7"
                  fill="#13281e"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <circle
                  cx="270"
                  cy="235"
                  r="7"
                  fill="#13281e"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <text
                  x="240"
                  y="218"
                  fill="#3b4d66"
                  fontSize="7.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  COURTYARD A (W)
                </text>
              </g>

              {/* Right Courtyard */}
              <g className="opacity-95">
                <rect
                  x="440"
                  y="155"
                  width="120"
                  height="120"
                  rx="8"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                <rect
                  x="450"
                  y="165"
                  width="100"
                  height="100"
                  rx="4"
                  fill="none"
                  stroke="#2a3d5e"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                />
                <circle
                  cx="470"
                  cy="235"
                  r="7"
                  fill="#13281e"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <circle
                  cx="530"
                  cy="195"
                  r="7"
                  fill="#13281e"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <text
                  x="500"
                  y="218"
                  fill="#3b4d66"
                  fontSize="7.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  COURTYARD B (E)
                </text>
              </g>

              {/* ELEVATOR LOBBIES & elevator cars */}
              {/* Elev Lobby C (Center Corridor) */}
              <g
                onClick={() =>
                  onLogEvent(
                    "FSD Command checked Elevator Lobby C status: Cars recall locked at Lobby 1.",
                  )
                }
                className="cursor-pointer group"
              >
                <rect
                  x="325"
                  y="185"
                  width="90"
                  height="60"
                  rx="6"
                  fill="#030712"
                  stroke="#1d4ed8"
                  strokeWidth="1.2"
                />
                <text
                  x="370"
                  y="200"
                  fill="#60a5fa"
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ELEV LOBBY C
                </text>
                {/* Tiny Elevator Cars */}
                <rect
                  x="335"
                  y="210"
                  width="12"
                  height="14"
                  rx="1.5"
                  fill="#1e293b"
                  stroke="#3b82f6"
                  strokeWidth="0.8"
                />
                <rect
                  x="351"
                  y="210"
                  width="12"
                  height="14"
                  rx="1.5"
                  fill="#1e293b"
                  stroke="#3b82f6"
                  strokeWidth="0.8"
                />
                <rect
                  x="377"
                  y="210"
                  width="12"
                  height="14"
                  rx="1.5"
                  fill="#1e293b"
                  stroke="#3b82f6"
                  strokeWidth="0.8"
                />
                <rect
                  x="393"
                  y="210"
                  width="12"
                  height="14"
                  rx="1.5"
                  fill="#1e293b"
                  stroke="#3b82f6"
                  strokeWidth="0.8"
                />
                <text
                  x="370"
                  y="235"
                  fill="#3b82f6"
                  fontSize="5.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  PHASE I RECALLED
                </text>
              </g>

              {/* Elev Lobby D */}
              <g
                onClick={() =>
                  onLogEvent(
                    "FSD Command checked Elevator Lobby D structure: Isolation doors closed.",
                  )
                }
                className="cursor-pointer"
              >
                <rect
                  x="575"
                  y="185"
                  width="45"
                  height="40"
                  rx="4"
                  fill="#030712"
                  stroke="#1d4ed8"
                  strokeWidth="1"
                />
                <text
                  x="597"
                  y="196"
                  fill="#60a5fa"
                  fontSize="6.5"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ELEV D
                </text>
                <rect
                  x="581"
                  y="205"
                  width="14"
                  height="12"
                  rx="1"
                  fill="#111827"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <rect
                  x="599"
                  y="205"
                  width="14"
                  height="12"
                  rx="1"
                  fill="#111827"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
              </g>

              {/* Elev Lobby E */}
              <g
                onClick={() =>
                  onLogEvent(
                    "FSD Command logged Elev Lobby E air handlers checked.",
                  )
                }
                className="cursor-pointer"
              >
                <rect
                  x="120"
                  y="65"
                  width="55"
                  height="35"
                  rx="4"
                  fill="#030712"
                  stroke="#1d4ed8"
                  strokeWidth="1"
                />
                <text
                  x="147"
                  y="76"
                  fill="#60a5fa"
                  fontSize="6.5"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ELEV E
                </text>
                <rect
                  x="126"
                  y="83"
                  width="12"
                  height="12"
                  rx="1"
                  fill="#111827"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <rect
                  x="142"
                  y="83"
                  width="12"
                  height="12"
                  rx="1"
                  fill="#111827"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
              </g>

              {/* Elev Lobby G */}
              <g
                onClick={() =>
                  onLogEvent(
                    "FSD Command logged Elev Lobby G: Inactive corridor secured.",
                  )
                }
                className="cursor-pointer"
              >
                <rect
                  x="595"
                  y="110"
                  width="35"
                  height="45"
                  rx="4"
                  fill="#030712"
                  stroke="#1d4ed8"
                  strokeWidth="1"
                />
                <text
                  x="612"
                  y="121"
                  fill="#60a5fa"
                  fontSize="6.5"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ELEV G
                </text>
                <rect
                  x="600"
                  y="130"
                  width="11"
                  height="11"
                  rx="1"
                  fill="#111827"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <rect
                  x="614"
                  y="130"
                  width="11"
                  height="11"
                  rx="1"
                  fill="#111827"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
              </g>

              {/* SECTORS / OPERATIONS LABELS */}
              {/* NW: Strategic Planning & AMI Team */}
              <g className="opacity-80">
                <text
                  x="110"
                  y="125"
                  fill="#22d3ee"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  STRATEGIC PLANNING
                </text>
                <text
                  x="110"
                  y="135"
                  fill="#0891b2"
                  fontSize="7"
                  fontFamily="sans-serif"
                >
                  Office Roster [NW] Floor 7
                </text>
                <text
                  x="210"
                  y="100"
                  fill="#a5f3fc"
                  fontSize="7.5"
                  fontFamily="monospace"
                >
                  AMI DEV UNIT
                </text>
              </g>

              {/* NE: Public Service Commission & Facilities */}
              <g className="opacity-80">
                <text
                  x="510"
                  y="130"
                  fill="#818cf8"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  PUBLIC SERVICE COMM
                </text>
                <text
                  x="510"
                  y="140"
                  fill="#4f46e5"
                  fontSize="7"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  07-100 Service Offices [NE]
                </text>
                {/* Facilities Room */}
                <rect
                  x="445"
                  y="80"
                  width="110"
                  height="40"
                  rx="3"
                  fill="#10172a"
                  stroke="#4338ca"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
                <text
                  x="500"
                  y="94"
                  fill="#a5b4fc"
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  07-220 FACILITIES
                </text>
                <text
                  x="500"
                  y="104"
                  fill="#6366f1"
                  fontSize="6"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  STAIR F ACCESS PORTAL
                </text>
              </g>

              {/* SW: Operations Division & Seating */}
              <g className="opacity-80">
                <text
                  x="110"
                  y="325"
                  fill="#34d399"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  GAS OPERATIONS CENTRE
                </text>
                <text
                  x="110"
                  y="335"
                  fill="#059669"
                  fontSize="7"
                  fontFamily="sans-serif"
                >
                  Muster Zone A Primary Dispatch
                </text>
              </g>

              {/* SE: Corp Security & Steam Ops */}
              <g className="opacity-85">
                <text
                  x="525"
                  y="320"
                  fill="#fbbf24"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  VP STEAM OPERATIONS
                </text>
                <text
                  x="525"
                  y="330"
                  fill="#d97706"
                  fontSize="7"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  Corp HQ Systems [SE]
                </text>
                {/* 07-500 Secure Archives */}
                <rect
                  x="475"
                  y="345"
                  width="100"
                  height="35"
                  rx="3"
                  fill="#121824"
                  stroke="#b45309"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
                <text
                  x="525"
                  y="358"
                  fill="#f59e0b"
                  fontSize="6.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  07-500 FILE ROOM
                </text>
                <text
                  x="525"
                  y="368"
                  fill="#92400e"
                  fontSize="6.2"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  Authorized Sec Key Cards Only
                </text>
              </g>

              {/* ARCHITECTURAL COMPASS / NORTH INDICATOR */}
              <g className="opacity-90">
                <circle
                  cx="650"
                  cy="115"
                  r="16"
                  fill="#0f172a"
                  stroke="#475569"
                  strokeWidth="1"
                />
                <line
                  x1="650"
                  y1="127"
                  x2="650"
                  y2="103"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <polygon points="650,99 646,108 654,108" fill="#ef4444" />
                <text
                  x="650"
                  y="123"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  N
                </text>
                <text
                  x="650"
                  y="137"
                  fill="#475569"
                  fontSize="6.5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  FL_7
                </text>
              </g>

              {/* NE BREAKROOM FIRE HAZARD OVERLAY */}
              <g
                className="cursor-help"
                onClick={() =>
                  onLogEvent(
                    "ALERT FEED: Active smoke sensor logged in NE Breakroom (Sector 07-220). Fire suppression engaged.",
                  )
                }
              >
                <circle
                  cx="510"
                  cy="85"
                  r="28"
                  fill="#7f1d1d"
                  fillOpacity="0.25"
                />
                <circle
                  cx="510"
                  cy="85"
                  r="16"
                  fill="#ef4444"
                  fillOpacity="0.6"
                  className="animate-ping"
                  style={{ animationDuration: "2s" }}
                />
                <path
                  d="M510,73 L518,87 L502,87 Z"
                  fill="#fef08a"
                  stroke="#b91c1c"
                  strokeWidth="1"
                />
                <text
                  x="510"
                  y="97"
                  fill="#ef4444"
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="black"
                  textAnchor="middle"
                  className="tracking-wide"
                >
                  NE FLAME
                </text>
              </g>

              {/* -------------------- ALL 7 CODE-COMPLIANT STAIRWELLS -------------------- */}

              {/* Stair A - North West Corridor (Primary exit route for NW) */}
              <g
                onClick={() =>
                  onLogEvent(
                    "Tactical assessment of Stair A: checked and clear of smoke.",
                  )
                }
                className="cursor-pointer group"
              >
                <rect
                  x="70"
                  y="195"
                  width="55"
                  height="35"
                  rx="4"
                  fill="#022c22"
                  stroke="#059669"
                  strokeWidth="1.5"
                />
                <line
                  x1="70"
                  y1="212"
                  x2="125"
                  y2="212"
                  stroke="#10b981"
                  strokeWidth="0.8"
                  strokeDasharray="2 1"
                />
                <text
                  x="97"
                  y="210"
                  fill="#34d399"
                  fontSize="7.5"
                  fontFamily="monospace"
                  fontWeight="black"
                  textAnchor="middle"
                >
                  STAIR A
                </text>
                <text
                  x="97"
                  y="222"
                  fill="#a7f3d0"
                  fontSize="5.5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  CLEAR EXIT
                </text>
              </g>

              {/* Stair B - South East Corner (Dynamic blockade indicator) */}
              <g
                onClick={onToggleStairB}
                className="cursor-pointer transition-all"
              >
                <rect
                  x="615"
                  y="355"
                  width="55"
                  height="35"
                  rx="4"
                  fill={stairBBlocked ? "#450a0a" : "#022c22"}
                  stroke={stairBBlocked ? "#ef4444" : "#059669"}
                  strokeWidth="1.8"
                />
                <line
                  x1="615"
                  y1="372"
                  x2="670"
                  y2="372"
                  stroke={stairBBlocked ? "#ef4444" : "#10b981"}
                  strokeWidth="0.8"
                  strokeDasharray="2 1"
                />
                <text
                  x="642"
                  y="370"
                  fill={stairBBlocked ? "#fecaca" : "#34d399"}
                  fontSize="7.5"
                  fontFamily="monospace"
                  fontWeight="black"
                  textAnchor="middle"
                >
                  STAIR B
                </text>
                <text
                  x="642"
                  y="382"
                  fill={stairBBlocked ? "#ef4444" : "#a7f3d0"}
                  fontSize="5.5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  className={
                    stairBBlocked ? "font-bold animate-pulse text-[6px]" : ""
                  }
                >
                  {stairBBlocked ? "BLOCKED ⚠️" : "CLEAR EXIT"}
                </text>
              </g>

              {/* Stair C - South Central core */}
              <g
                onClick={() =>
                  onLogEvent(
                    "Stair C (South Portal) audited by Floor Marshal: Currently safe.",
                  )
                }
                className="cursor-pointer"
              >
                <rect
                  x="345"
                  y="395"
                  width="50"
                  height="30"
                  rx="4"
                  fill="#022c22"
                  stroke="#059669"
                  strokeWidth="1.2"
                />
                <text
                  x="370"
                  y="408"
                  fill="#34d399"
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  STAIR C
                </text>
                <text
                  x="370"
                  y="418"
                  fill="#a7f3d0"
                  fontSize="5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  SECURE
                </text>
              </g>

              {/* Stair D - Far East wing page boundary */}
              <g
                onClick={() =>
                  onLogEvent("Stair D (East Wall Landing) verified secure.")
                }
                className="cursor-pointer"
              >
                <rect
                  x="635"
                  y="235"
                  width="40"
                  height="35"
                  rx="4"
                  fill="#022c22"
                  stroke="#059669"
                  strokeWidth="1.2"
                />
                <text
                  x="655"
                  y="247"
                  fill="#34d399"
                  fontSize="6.8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  STAIR D
                </text>
                <text
                  x="655"
                  y="258"
                  fill="#a7f3d0"
                  fontSize="5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  SECURE
                </text>
              </g>

              {/* Stair E - Northwest corner core lobby */}
              <g
                onClick={() =>
                  onLogEvent("Stair E (NW Lobby Portal) verified secure.")
                }
                className="cursor-pointer"
              >
                <rect
                  x="195"
                  y="65"
                  width="45"
                  height="30"
                  rx="4"
                  fill="#022c22"
                  stroke="#059669"
                  strokeWidth="1.2"
                />
                <text
                  x="217"
                  y="78"
                  fill="#34d399"
                  fontSize="6.8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  STAIR E
                </text>
                <text
                  x="217"
                  y="88"
                  fill="#a7f3d0"
                  fontSize="5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  SECURE
                </text>
              </g>

              {/* Stair F - North Central Core corridor */}
              <g
                onClick={() =>
                  onLogEvent(
                    "Stair F (North Central Corridor) verified secure.",
                  )
                }
                className="cursor-pointer"
              >
                <rect
                  x="345"
                  y="65"
                  width="45"
                  height="30"
                  rx="4"
                  fill="#022c22"
                  stroke="#059669"
                  strokeWidth="1.2"
                />
                <text
                  x="367"
                  y="78"
                  fill="#34d399"
                  fontSize="6.8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  STAIR F
                </text>
                <text
                  x="367"
                  y="88"
                  fill="#a7f3d0"
                  fontSize="5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  SECURE
                </text>
              </g>

              {/* Stair G - East Central sector */}
              <g
                onClick={() =>
                  onLogEvent("Stair G (East Core Corridor) verified secure.")
                }
                className="cursor-pointer"
              >
                <rect
                  x="500"
                  y="135"
                  width="45"
                  height="30"
                  rx="4"
                  fill="#022c22"
                  stroke="#059669"
                  strokeWidth="1.2"
                />
                <text
                  x="522"
                  y="148"
                  fill="#34d399"
                  fontSize="6.8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  STAIR G
                </text>
                <text
                  x="522"
                  y="158"
                  fill="#a7f3d0"
                  fontSize="5"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  SECURE
                </text>
              </g>

              {/* Area of Rescue Assistance x4 (For high-contrast audit) */}
              {[
                { x: 70, y: 165, label: "ARA NW" },
                { x: 625, y: 165, label: "ARA NE" },
                { x: 70, y: 395, label: "ARA SW" },
                { x: 625, y: 305, label: "ARA SE" },
              ].map((ara, index) => (
                <g key={index}>
                  <rect
                    x={ara.x}
                    y={ara.y}
                    width="42"
                    height="15"
                    rx="3"
                    fill="#172554"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                  <text
                    x={ara.x + 21}
                    y={ara.y + 10}
                    fill="#93c5fd"
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {ara.label}
                  </text>
                </g>
              ))}

              {/* Real building plan photo (public/building-plan.png) — covers the
                  drawn schematic when present so the map matches the actual sheet. */}
              {hasPlan && (
                <>
                  <rect x="0" y="0" width="740" height="500" fill="#ffffff" />
                  <image
                    href="/floor7-plan.png"
                    x="0"
                    y="0"
                    width="740"
                    height="500"
                    preserveAspectRatio="xMidYMid meet"
                  />
                </>
              )}

              {/* Occupants dynamically plotted based on quadrant — real building coordinates */}
              {occupants.map((occ, idx) => {
                // Coordinate zones calibrated to the real 7th-floor As-Built plan
                // (floor7-plan.png, 740x500 viewBox, xMidYMid meet, ~10px top letterbox).
                // West = Irving Place, East = Third Ave, North = E 15th, South = E 14th.
                const zones: Record<string, { x: number; y: number }> = {
                  NW: { x: 160, y: 135 }, // 07-800 Strategic Planning (Irving Pl / E15)
                  NE: { x: 470, y: 130 }, // 07-240 / 07-280 IRS (Third Ave / E15)
                  SW: { x: 180, y: 300 }, // 07-700 AMI Implementation (Irving Pl / E14)
                  SE: { x: 480, y: 305 }, // 07-400s office block (Third Ave / E14)
                  Center: { x: 335, y: 215 }, // ELEV LOBBY C / courtyard core
                };
                const base = zones[occ.quadrant] || zones.Center;
                // Spread occupants within each zone so dots don't overlap
                const ring = idx % 8;
                const spreadX = ((ring % 4) - 1.5) * 20;
                const spreadY = (Math.floor(ring / 4) - 0.5) * 22;
                const coord = { x: base.x + spreadX, y: base.y + spreadY };

                // Status colors
                const statusColor =
                  occ.status === "SAFE"
                    ? "#10b981"
                    : occ.status === "CRITICAL"
                      ? "#ef4444"
                      : occ.status === "NEED_HELP"
                        ? "#f59e0b"
                        : "#94a3b8";

                const isCritical = occ.status === "CRITICAL";
                const isNeedHelp = occ.status === "NEED_HELP";
                const isAlert = isCritical || isNeedHelp;
                const isARA = occ.mobilityImpaired || occ.isAtARA;
                const isWearable = occ.wearable;

                // Short role label (2 chars)
                const roleLabel =
                  occ.role === "Warden"
                    ? "W"
                    : occ.role === "FSD"
                      ? "F"
                      : occ.role === "Searcher"
                        ? "S"
                        : occ.role === "Deputy"
                          ? "D"
                          : occ.role === "Visitor"
                            ? "V"
                            : occ.role === "Contractor"
                              ? "C"
                              : "O";

                return (
                  <g key={occ.id} className="transition-all duration-500">
                    {/* Outer detection pulse ring (critical/need-help) */}
                    {isAlert && (
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r="18"
                        fill="none"
                        stroke={statusColor}
                        strokeWidth="2"
                        strokeOpacity="0.35"
                        className="animate-ping"
                        style={{
                          animationDuration: isCritical ? "0.9s" : "1.6s",
                          transformOrigin: `${coord.x}px ${coord.y}px`,
                        }}
                      />
                    )}
                    {/* Secondary ring */}
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="13"
                      fill="none"
                      stroke={statusColor}
                      strokeWidth="1.5"
                      strokeDasharray={isAlert ? "none" : "3 3"}
                      strokeOpacity={isAlert ? "0.7" : "0.5"}
                      className={isAlert ? "animate-pulse" : ""}
                      style={{
                        animationDuration: "2s",
                        transformOrigin: `${coord.x}px ${coord.y}px`,
                      }}
                    />
                    {/* Main occupant dot */}
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="9"
                      fill={statusColor}
                      stroke="white"
                      strokeWidth="2"
                    />
                    {/* Role character inside dot */}
                    <text
                      x={coord.x}
                      y={coord.y + 3.5}
                      fill="white"
                      fontSize="8"
                      fontFamily="system-ui, sans-serif"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {roleLabel}
                    </text>
                    {/* ARA wheelchair icon */}
                    {isARA && (
                      <text
                        x={coord.x + 11}
                        y={coord.y - 7}
                        fontSize="9"
                        textAnchor="middle"
                      >
                        ♿
                      </text>
                    )}
                    {/* Wearable sensor icon */}
                    {isWearable && (
                      <text
                        x={coord.x - 11}
                        y={coord.y - 7}
                        fontSize="9"
                        textAnchor="middle"
                      >
                        📡
                      </text>
                    )}
                    {/* Name label */}
                    <text
                      x={coord.x}
                      y={coord.y + 23}
                      fill={
                        occ.status === "SAFE"
                          ? "#059669"
                          : occ.status === "CRITICAL"
                            ? "#dc2626"
                            : occ.status === "NEED_HELP"
                              ? "#d97706"
                              : "#475569"
                      }
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {occ.badgeId}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Map Legend — light theme */}
            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-3 bg-white/98 px-4 py-2.5 rounded-2xl border border-slate-300 shadow-md text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block" />{" "}
                Safe
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 inline-block" />{" "}
                Need Help
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" />{" "}
                Critical / Fall
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 inline-block" />{" "}
                Missing
              </span>
              <span className="flex items-center gap-1.5 ml-auto text-slate-400 font-normal italic">
                Drag to pan · scroll to zoom
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 mt-2 font-mono">
            * Stair B registers blockages on-click. Dynamic mesh notifications
            auto-dispatch reroute alerts over Bluetooth. All 7 emergency stair
            cores are LL26 and ConEdison pilot-compliant.
          </p>
        </div>

        {/* PANEL 3: HEADCOUNT & DYNAMIC LOCATOR BOARD */}
        <div className="xl:col-span-4 min-h-[560px] bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header Telemetry */}
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-xs font-mono tracking-wider text-slate-300 uppercase font-bold flex items-center gap-1">
                <MapPin size={12} className="text-amber-500 animate-pulse" />
                <span>Headcount & Locator</span>
              </h3>
              <span className="text-xs bg-slate-100 border border-slate-300 text-slate-300 px-2 py-0.5 rounded-lg font-mono font-medium">
                {occupants.filter((o) => o.status === "SAFE").length} /{" "}
                {occupants.length} ACCOUNTED
              </span>
            </div>

            {/* Inline search filter */}
            <div className="mb-2 shrink-0">
              <input
                type="text"
                placeholder="Search by name, badge, role or alert..."
                value={fsdSearchQuery}
                onChange={(e) => {
                  setFsdSearchQuery(e.target.value);
                  setLocatorPage(1); // Reset page on filter
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Category tabs */}
            <div className="grid grid-cols-3 gap-1 mb-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
              {(["ALL", "AT_RISK", "SAFE"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setLocatorTab(tab);
                    setLocatorPage(1);
                  }}
                  className={`py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                    locatorTab === tab
                      ? tab === "AT_RISK"
                        ? "bg-red-100 text-red-700 border border-red-300"
                        : tab === "SAFE"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-amber-600 text-white border border-amber-500"
                      : "text-slate-500 hover:text-slate-300 cursor-pointer"
                  }`}
                >
                  {tab === "ALL"
                    ? "ALL ROSTER"
                    : tab === "AT_RISK"
                      ? "MIA/AT RISK"
                      : "SAFE"}
                </button>
              ))}
            </div>

            {/* Sector/Quadrant pills selection */}
            <div className="flex flex-wrap gap-1 mb-2.5 shrink-0">
              {(["ALL", "NW", "NE", "SW", "SE", "Center"] as const).map(
                (sect) => (
                  <button
                    key={sect}
                    onClick={() => {
                      setLocatorSector(sect);
                      setLocatorPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded text-xs font-mono leading-none border transition-all ${
                      locatorSector === sect
                        ? "bg-amber-600 text-white border-amber-500 font-bold"
                        : "bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-300 cursor-pointer"
                    }`}
                  >
                    {sect === "ALL" ? "All Sectors" : sect}
                  </button>
                ),
              )}
            </div>

            {/* Paginated elements listing (Scroll-free, strictly formatted to fit height) */}
            <div className="flex-1 space-y-1.5 overflow-hidden">
              {paginatedLocatorOccupants.length > 0 ? (
                paginatedLocatorOccupants.map((o) => (
                  <div
                    key={o.id}
                    className={`p-2 rounded-xl border flex flex-col justify-between transition-all ${
                      o.id === unsealedTokenId
                        ? "bg-slate-50 border-amber-500/70 shadow-lg"
                        : o.status === "CRITICAL"
                          ? "bg-red-50 border-red-300 hover:bg-red-100/60"
                          : o.status === "NEED_HELP"
                            ? "bg-yellow-50 border-amber-300 hover:bg-yellow-100/60"
                            : o.status === "SAFE"
                              ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100/60"
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex gap-2">
                        <div className="mt-1 shrink-0">
                          <span className={`relative flex h-2 w-2`}>
                            {o.status !== "SAFE" && (
                              <span
                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                  o.status === "CRITICAL"
                                    ? "bg-red-400"
                                    : "bg-amber-400"
                                }`}
                              />
                            )}
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${
                                o.status === "SAFE"
                                  ? "bg-emerald-500"
                                  : o.status === "CRITICAL"
                                    ? "bg-red-500"
                                    : o.status === "NEED_HELP"
                                      ? "bg-amber-400"
                                      : "bg-slate-500"
                              }`}
                            />
                          </span>
                        </div>

                        <div>
                          <div className="text-sm font-bold font-mono text-slate-200 flex flex-wrap items-center gap-1">
                            <span>
                              {unsealedTokenId === o.id && unsealedDetails
                                ? unsealedDetails.name
                                : o.nameEncrypted}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-100 px-1 py-0.2 rounded font-normal font-mono border border-slate-200 uppercase">
                              {o.id}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 font-mono mt-0.5 leading-tight">
                            Badge {o.badgeId} • Role: {o.role} • Quadrant:{" "}
                            <span className="text-amber-400 font-semibold">
                              {o.quadrant}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Decrypt Actions trigger */}
                      <button
                        onClick={() => handleUnsealFsd(o.id)}
                        className={`text-xs font-mono font-bold leading-tight px-1.5 py-0.5 rounded border flex items-center gap-0.5 transition-all cursor-pointer ${
                          unsealedTokenId === o.id
                            ? "bg-yellow-600 text-slate-950 border-yellow-500"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <Unlock size={8} />
                        <span>
                          {unsealedTokenId === o.id ? "SEAL" : "JIT UNSEAL"}
                        </span>
                      </button>
                    </div>

                    {/* Interactive JIT Decrypted Vault detail inline drawer */}
                    {unsealedTokenId === o.id && (
                      <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-amber-300 text-xs font-mono space-y-1 animate-fadeIn">
                        {isUnsealing ? (
                          <div className="flex items-center gap-1 text-slate-500">
                            <RefreshCw
                              size={10}
                              className="animate-spin text-amber-500"
                            />
                            <span>Unsealing Vault over TLS 1.3...</span>
                          </div>
                        ) : unsealedDetails ? (
                          <div className="flex gap-2.5 items-start">
                            <img
                              src={unsealedDetails.photo}
                              alt="Unsealed preview"
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded object-cover border border-slate-200 bg-slate-100 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-amber-400 font-bold font-sans text-sm leading-tight">
                                {unsealedDetails.name}{" "}
                                <span className="text-xs text-slate-500 font-mono">
                                  {unsealedDetails.role}
                                </span>
                              </p>
                              <p className="text-slate-400 text-xs mt-0.5 truncate">
                                Dept: {unsealedDetails.department}
                              </p>
                              <p className="text-slate-400 text-xs truncate">
                                Phone: {unsealedDetails.phone}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-red-700">
                            Authorization link timed out.
                          </p>
                        )}
                      </div>
                    )}

                    {o.alertNote && (
                      <div className="mt-1 bg-slate-50 px-1.5 py-0.5 rounded text-xs text-amber-700 italic line-clamp-1 border border-slate-200">
                        “{o.alertNote}”
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-1 text-xs font-mono text-slate-500">
                      <span>Last Seen log: {o.lastSeen}</span>
                      <span>Stairwell: {o.staircase || "Unverified"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-600 font-mono text-xs border border-dashed border-slate-300 rounded-xl">
                  No personnel matching this filter.
                </div>
              )}
            </div>

            {/* Pagination Panel (Click Page after Page) */}
            <div className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-200 mt-2.5 shrink-0 select-none">
              <button
                disabled={activeLocatorPage === 1}
                onClick={() => setLocatorPage((prev) => Math.max(1, prev - 1))}
                className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-300 border border-slate-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft size={10} />
                <span>PREV</span>
              </button>

              <span className="text-xs font-mono text-slate-400">
                PAGE{" "}
                <span className="text-amber-400 font-bold">
                  {activeLocatorPage}
                </span>{" "}
                OF <span className="text-slate-300">{maxPage}</span>
              </span>

              <button
                disabled={activeLocatorPage === maxPage}
                onClick={() =>
                  setLocatorPage((prev) => Math.min(maxPage, prev + 1))
                }
                className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-300 border border-slate-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>NEXT</span>
                <ChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Compliance generation */}
          <div className="border-t border-slate-200 pt-3 mt-3 shrink-0">
            <button
              onClick={generateFdnyReport}
              className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <FileText size={14} className="text-amber-500" />
              GENERATE PRE-ARRIVAL FDNY REPORT
            </button>
          </div>
        </div>
      </div>

      {/* ♿ ARA PRIORITY BOARD — Evac-Chair List, always visible to FSD + FDNY */}
      {(() => {
        const araAll = occupants.filter((o) => o.mobilityImpaired || o.isAtARA);
        const inTransit = araAll.filter((o) => !o.isAtARA);
        const staged = araAll.filter((o) => Boolean(o.isAtARA));
        const sorted = [...inTransit, ...staged];
        const denominator = Math.max(
          sorted.length,
          FLOOR7_CENSUS.evacChairOccupants,
        );
        return (
          <div className="mt-5 bg-white border border-amber-200 rounded-2xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-200 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Accessibility className="text-amber-400" size={14} />
                <span className="text-xs font-bold tracking-tight text-amber-700">
                  ♿ EVAC-CHAIR LIST — Area of Rescue Assistance
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {inTransit.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
                    {inTransit.length} IN TRANSIT
                  </span>
                )}
                <span className="text-xs bg-blue-100 text-blue-700 border border-blue-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                  STAGED {staged.length}/{denominator}
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded font-mono uppercase">
                  FDNY PRIORITY
                </span>
              </div>
            </div>

            {/* Cards */}
            {sorted.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-1">
                No evac-chair occupants in this roster.
              </p>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                {sorted.map((o) => {
                  const isStaged = Boolean(o.isAtARA);
                  const isOpen = unsealedTokenId === o.id;
                  return (
                    <div
                      key={o.id}
                      className={`rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all ${
                        isOpen
                          ? "border-amber-500/70 shadow-lg bg-slate-50"
                          : isStaged
                            ? "bg-blue-50 border-blue-300"
                            : "bg-red-50 border-red-300"
                      }`}
                    >
                      {/* Status + quadrant row */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-1 rounded uppercase border ${
                            isStaged
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : "bg-red-100 text-red-700 border-red-300"
                          }`}
                        >
                          {isStaged ? "STAGED" : "IN TRANSIT"}
                        </span>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                          {o.quadrant}
                        </span>
                      </div>

                      {/* Name / token */}
                      <div>
                        <p className="text-sm font-bold text-slate-200 leading-tight truncate">
                          {isOpen && unsealedDetails
                            ? unsealedDetails.name
                            : o.nameEncrypted}
                        </p>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {o.id}
                        </p>
                      </div>

                      {/* Badge ID */}
                      <p className="text-xs font-mono text-slate-600">
                        Badge:{" "}
                        <span className="text-slate-300">{o.badgeId}</span>
                      </p>

                      {/* Alert note */}
                      {o.alertNote && (
                        <p className="text-xs text-amber-700 italic leading-tight line-clamp-2">
                          {o.alertNote}
                        </p>
                      )}

                      {/* JIT Unseal button */}
                      <button
                        type="button"
                        onClick={() => handleUnsealFsd(o.id)}
                        className={`mt-auto text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                          isOpen
                            ? "bg-yellow-600 text-slate-950 border-yellow-500"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <Unlock size={8} />
                        <span>{isOpen ? "SEAL" : "JIT UNSEAL"}</span>
                      </button>

                      {/* Inline vault drawer */}
                      {isOpen && (
                        <div className="bg-slate-50 p-2 rounded-lg border border-amber-300 text-xs font-mono space-y-1">
                          {isUnsealing ? (
                            <div className="flex items-center gap-1 text-slate-500">
                              <RefreshCw
                                size={10}
                                className="animate-spin text-amber-500"
                              />
                              <span>Unsealing Vault over TLS 1.3…</span>
                            </div>
                          ) : unsealedDetails ? (
                            <div className="flex gap-2 items-start">
                              <img
                                src={unsealedDetails.photo}
                                alt="Unsealed preview"
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded object-cover border border-slate-800 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-amber-400 font-bold leading-tight truncate">
                                  {unsealedDetails.name}
                                </p>
                                <p className="text-slate-400 truncate">
                                  Dept: {unsealedDetails.department}
                                </p>
                                <p className="text-slate-400 truncate">
                                  ☎ {unsealedDetails.phone}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-red-700">
                              Authorization timed out.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── ACTION PIPELINE — shows start-to-end flow for each ledger event ── */}
      <div className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-base font-black text-slate-200 uppercase tracking-wide">
              Action Pipeline
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Start → Validate → Encrypt → Chain → Confirm
          </span>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-44 no-scrollbar">
          {ledger
            .slice()
            .reverse()
            .slice(0, 8)
            .map((block, i) => {
              // Classify the event type
              const isCritical =
                block.event.toLowerCase().includes("critical") ||
                block.event.toLowerCase().includes("fall");
              const isSafe = block.event.toLowerCase().includes("safe");
              const isDirective =
                block.event.toLowerCase().includes("directive") ||
                block.event.toLowerCase().includes("broadcast");
              const isMesh =
                block.event.toLowerCase().includes("mesh") ||
                block.event.toLowerCase().includes("hmac");
              const isFamily =
                block.event.toLowerCase().includes("family") ||
                block.event.toLowerCase().includes("sms");
              const isAlarm =
                block.event.toLowerCase().includes("alarm") ||
                block.event.toLowerCase().includes("fire");

              const typeColor = isCritical
                ? "text-red-700 bg-red-100 border-red-300"
                : isSafe
                  ? "text-emerald-700 bg-emerald-100 border-emerald-300"
                  : isDirective
                    ? "text-amber-700 bg-amber-100 border-amber-300"
                    : isMesh
                      ? "text-yellow-700 bg-yellow-100 border-yellow-300"
                      : isFamily
                        ? "text-blue-700 bg-blue-100 border-blue-300"
                        : isAlarm
                          ? "text-red-700 bg-red-100 border-red-300"
                          : "text-slate-300 bg-slate-100 border-slate-300";

              const typeLabel = isCritical
                ? "CRITICAL"
                : isSafe
                  ? "CHECK-IN"
                  : isDirective
                    ? "DIRECTIVE"
                    : isMesh
                      ? "MESH SYNC"
                      : isFamily
                        ? "FAMILY SMS"
                        : isAlarm
                          ? "ALARM"
                          : "SYSTEM";

              // Pipeline steps — all complete for past events (ledger blocks are immutable)
              const steps = [
                { label: "Trigger", done: true, icon: "⚡" },
                { label: "Validate", done: true, icon: "✓" },
                { label: "Encrypt", done: true, icon: "🔒" },
                { label: "Chain", done: true, icon: "⛓" },
                { label: "Confirmed", done: true, icon: "✅" },
              ];

              return (
                <div
                  key={block.index}
                  className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                >
                  {/* Event type badge */}
                  <span
                    className={`text-xs font-black px-2 py-1 rounded-lg border shrink-0 font-mono ${typeColor}`}
                  >
                    {typeLabel}
                  </span>

                  {/* Event description */}
                  <span className="text-xs text-slate-600 font-medium truncate flex-1 min-w-0">
                    {block.event.length > 60
                      ? block.event.slice(0, 60) + "…"
                      : block.event}
                  </span>

                  {/* Pipeline steps */}
                  <div className="flex items-center gap-1 shrink-0">
                    {steps.map((step, si) => (
                      <div key={si} className="flex items-center gap-1">
                        <div
                          title={step.label}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 shrink-0"
                        >
                          {step.icon}
                        </div>
                        {si < steps.length - 1 && (
                          <div className="w-3 h-0.5 bg-emerald-300 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Block number + hash */}
                  <div className="text-xs font-mono text-slate-400 shrink-0 text-right hidden lg:block">
                    <div className="font-bold text-slate-600">
                      #{block.index}
                    </div>
                    <div className="text-[10px]">{block.hash.slice(0, 8)}…</div>
                  </div>
                </div>
              );
            })}
          {ledger.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">
              No pipeline events yet. Actions will appear here as they are
              recorded.
            </div>
          )}
        </div>
      </div>

      {/* Down Layer bento expansions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-5">
        {/* LIVE INCIDENT KPIs — Floor 7 real-time metric board */}
        <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col h-[320px]">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <Activity className="text-amber-500" size={13} />
              <span className="text-base font-bold tracking-tight text-slate-200">
                LIVE INCIDENT KPIs
              </span>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
              FLOOR 7 · {FLOOR7_CENSUS.totalOccupants} OCCUPANTS
            </span>
          </div>

          {/* Elapsed timer + mode badges */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div>
              <div
                className={`text-3xl font-mono font-black tracking-tight leading-none ${
                  elapsedSeconds > 180
                    ? "text-red-700"
                    : elapsedSeconds > 90
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {formatElapsed(elapsedSeconds)}
              </div>
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mt-0.5">
                ELAPSED · TARGET &lt; 3 MIN &middot; STRETCH &lt; 90 S
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isDrill
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-red-100 text-red-700 border-red-300"
                }`}
              >
                {isDrill ? "● DRILL MODE" : "● REAL INCIDENT"}
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isBlackout
                    ? "bg-yellow-100 text-yellow-700 border-yellow-300 animate-pulse"
                    : "bg-emerald-100 text-emerald-700 border-emerald-300"
                }`}
              >
                {isBlackout ? "⚠ MESH BLACKOUT" : "✓ CLOUD LINK UP"}
              </span>
            </div>
          </div>

          {/* 6 KPI mini-cards */}
          <div className="grid grid-cols-3 gap-2 flex-1">
            {/* Accounted */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                Accounted
              </div>
              <div className="text-2xl font-mono font-black text-amber-700 leading-none">
                {occupants.filter((o) => o.status === "SAFE").length}
                <span className="text-sm text-slate-500">
                  /{FLOOR7_CENSUS.totalOccupants}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                &lt; 180 s target
              </div>
            </div>

            {/* ARA Evac-Chair */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                ARA Red List
              </div>
              <div
                className={`text-2xl font-mono font-black leading-none ${
                  occupants.filter((o) => o.mobilityImpaired || o.isAtARA)
                    .length >= FLOOR7_CENSUS.evacChairOccupants
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {
                  occupants.filter((o) => o.mobilityImpaired || o.isAtARA)
                    .length
                }
                <span className="text-sm text-slate-500">
                  /{FLOOR7_CENSUS.evacChairOccupants}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                &lt; 30 s target
              </div>
            </div>

            {/* Wearable Alerts */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                Wearable Alerts
              </div>
              <div
                className={`text-2xl font-mono font-black leading-none ${
                  occupants.filter(
                    (o) => o.status === "CRITICAL" || o.fallDetected,
                  ).length > 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {
                  occupants.filter(
                    (o) => o.status === "CRITICAL" || o.fallDetected,
                  ).length
                }
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Red List &lt; 10 s
              </div>
            </div>

            {/* Chain Integrity */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                Chain Integrity
              </div>
              <div
                className={`text-2xl font-mono font-black leading-none ${
                  ledgerIntegrity.verified
                    ? "text-emerald-700"
                    : "text-red-700 animate-pulse"
                }`}
              >
                {ledgerIntegrity.verified ? "100%" : "FAIL"}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {ledger.length} blocks
              </div>
            </div>

            {/* Zone Sweep Completion */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                Zone Sweep
              </div>
              {(() => {
                const quadrants = ["NW", "NE", "SW", "SE", "Center"] as const;
                const swept = quadrants.filter((q) => {
                  const inQuad = occupants.filter((o) => o.quadrant === q);
                  return (
                    inQuad.length === 0 ||
                    inQuad.every((o) => o.status !== "MISSING")
                  );
                }).length;
                const rate = Math.round((swept / quadrants.length) * 100);
                return (
                  <>
                    <div
                      className={`text-2xl font-mono font-black leading-none ${
                        rate >= 98
                          ? "text-emerald-700"
                          : rate >= 80
                            ? "text-amber-700"
                            : "text-red-700"
                      }`}
                    >
                      {rate}%
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      ≥ 98% target ({swept}/{quadrants.length})
                    </div>
                  </>
                );
              })()}
            </div>

            {/* FSD Coverage */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                FSD Coverage
              </div>
              <div
                className={`text-2xl font-mono font-black leading-none ${
                  isBlackout ? "text-yellow-700" : "text-emerald-700"
                }`}
              >
                {isBlackout
                  ? `${Math.round(
                      (occupants.filter((o) => Boolean(o.status)).length /
                        FLOOR7_CENSUS.totalOccupants) *
                        100,
                    )}%`
                  : "100%"}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {isBlackout ? "BLE Mesh" : "SSE · ≥ 95% target"}
              </div>
            </div>
          </div>
        </div>

        {/* AUDIT TIMELINE LEDGER SECURE HASH-CHAINING (6 Columns) */}
        <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col h-[320px]">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Database className="text-amber-500" size={15} />
              <span className="text-base font-black tracking-tight text-slate-200 uppercase">
                Hash-Chained Audit Ledger
              </span>
            </div>
            {ledgerIntegrity.verified ? (
              <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
                <ShieldCheck size={13} /> Chain Verified
              </span>
            ) : (
              <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 animate-pulse">
                <ShieldX size={13} /> Chain Tampered!
              </span>
            )}
          </div>

          {/* Ledger block list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 text-xs pr-1 font-mono text-slate-600 no-scrollbar">
            {ledger.map((b) => (
              <div
                key={b.index}
                className={`p-2 rounded-xl border flex flex-col gap-1 transition-all ${
                  isLedgerTampered && b.index === 1
                    ? "bg-red-50 border-red-400/50 text-red-700 animate-pulse"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-850/60 font-bold uppercase tracking-wide">
                  <span>Block #{b.index}</span>
                  <span className="text-slate-500 text-xs">{b.timestamp}</span>
                </div>
                <div className="text-xs text-slate-350 py-0.5">
                  Event:{" "}
                  <span className="font-sans text-slate-300">{b.event}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-1 pt-1 border-t border-slate-850/30">
                  <span className="truncate text-slate-500">
                    Prev: {b.prevHash}
                  </span>
                  <span
                    className={`truncate text-right ${isLedgerTampered && b.index === 1 ? "text-red-700 font-bold" : "text-slate-500"}`}
                  >
                    Hash: <span className="text-gray-400">{b.hash}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Hashing Ledger attack buttons */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200">
            <button
              onClick={onTamperLedger}
              disabled={isLedgerTampered}
              className="bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 text-xs font-bold py-2.5 rounded-xl transition-all disabled:opacity-40"
            >
              👿 SIMULATE LEDGER ATTACK (TAMPER BLOCK #1)
            </button>
            <button
              onClick={onResetLedger}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-300 text-xs py-2.5 rounded-xl transition-all"
            >
              🔄 SECURE RESYNC & COMPROMISE ARREST
            </button>
          </div>
        </div>
      </div>

      {/* PILOT SUCCESS METRICS — Floor 7 objectives scored live */}
      <div className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="text-amber-500" size={15} />
            <span className="text-base font-black tracking-tight text-slate-200 uppercase">
              Pilot Success Metrics — Floor 7
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isDrill) {
                  onLogEvent(
                    "Family SAFE-SMS blocked: DRILL mode (no real next-of-kin contact).",
                  );
                  return;
                }
                onDispatchFamilySms && onDispatchFamilySms();
              }}
              disabled={isDrill}
              className={`text-xs font-mono font-bold px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                isDrill
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer active:scale-95"
              }`}
              title={
                isDrill
                  ? "Enabled only in REAL INCIDENT mode"
                  : "Dispatch a SAFE SMS to every registered next-of-kin"
              }
            >
              📱 Dispatch Family SAFE-SMS
            </button>
            <span
              className="text-xs bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase"
              title="Persisted records are kept in two isolated sets so drill data can never enter a real FDNY filing"
            >
              <span className="text-red-700">REAL {recordStats.real}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-blue-700">DRILL {recordStats.drill}</span>
            </span>
            <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
              Target vs Live
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {PILOT_GOALS.map((g) => {
            const pilotCtx: PilotGoalContext = {
              occupants,
              ledger,
              ledgerVerified: ledgerIntegrity.verified,
              elapsedSeconds,
              isBlackout,
              isDrill,
              activeDirective,
              records: recordStats,
            };
            const r = g.evaluate(pilotCtx);
            const badge =
              r.status === "MET"
                ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                : r.status === "AT_RISK"
                  ? "bg-red-100 text-red-700 border-red-300"
                  : r.status === "PENDING"
                    ? "bg-slate-100 text-slate-600 border-slate-300"
                    : "bg-amber-100 text-amber-700 border-amber-300";
            const valueColor =
              r.status === "MET"
                ? "text-emerald-700"
                : r.status === "AT_RISK"
                  ? "text-red-700"
                  : r.status === "PENDING"
                    ? "text-slate-600"
                    : "text-amber-700";
            return (
              <div
                key={g.id}
                className="rounded-xl border bg-white border-slate-200 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-slate-200 leading-tight">
                    {g.title}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded uppercase shrink-0 border ${badge}`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-mono mt-1">
                  🎯 {g.target}
                  {g.stretch ? ` · stretch ${g.stretch}` : ""}
                </div>
                <div
                  className={`text-sm font-mono font-bold mt-0.5 ${valueColor}`}
                >
                  {r.value}
                </div>
                {r.detail && (
                  <div className="text-xs text-slate-500 mt-1 leading-tight border-t border-slate-200 pt-1">
                    {r.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pop up generated PDF Compliance report view */}
      {fdnyReport ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col h-[520px]">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-200">
                Legal Compliance Pre-Arrival Report
              </h3>
              <button
                onClick={() => setFdnyReport(null)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-300 hover:text-slate-100 px-2 py-1 rounded"
              >
                Close Report
              </button>
            </div>

            <pre className="flex-1 bg-slate-50 text-slate-300 p-4 rounded-xl font-mono text-xs leading-relaxed overflow-auto border border-slate-200 select-text">
              {fdnyReport}
            </pre>

            <div className="mt-4 flex justify-between items-center text-xs font-mono text-slate-500">
              <span>
                Ready for print output (FDNY handover time limit: &lt;5 mins)
              </span>
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-300 text-xs font-mono px-3 py-2 rounded-lg border border-slate-300"
              >
                Print PDF File
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
