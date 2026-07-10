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
  Radio,
  Users,
  ClipboardCheck,
} from "lucide-react";
import {
  Occupant,
  LedgerBlock,
  DrillHistoryItem,
  EAPEmergencyType,
  EvacDecision,
} from "../types";
import { PILOT_GOALS, PilotGoalContext, FLOOR7_CENSUS } from "../pilotGoals";
import {
  EAP_EMERGENCY_TYPES,
  EAP_DECISIONS,
  ELEVATOR_RECALL,
  STAIRS,
} from "../data";
import { saveRecord, recordCounts } from "../recordStore";

interface FSDCommandCenterProps {
  occupants: Occupant[];
  ledger: LedgerBlock[];
  isBlackout: boolean;
  onClearIncident: () => void;
  onLogEvent: (event: string) => void;
  blockedStairs: string[];
  onToggleStair: (stairId: string) => void;
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
  blockedStairs,
  onToggleStair,
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

  // Every broadcast is explicitly tagged with the active mode so occupants
  // and wardens always know whether a command is a DRILL or a REAL order.
  const deployDirective = (txt: string) =>
    onDispatchDirective(isDrill ? `🟦 DRILL — ${txt}` : `🔴 REAL — ${txt}`);

  // ─── Command Deck primary tab: focuses admin on one surface at a time. ───
  // Reduces on-screen density without hiding any capability — every panel is
  // reachable in one click, but never all at once.
  const [activeTab, setActiveTab] = useState<
    "COMMAND" | "PEOPLE" | "COMPLIANCE"
  >("COMMAND");

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
            className="bg-slate-850 hover:bg-slate-800 border border-slate-300 text-slate-300 font-bold text-sm py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className="text-amber-500" />
            Reset Timer
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
                      <span className="text-xs font-bold text-slate-600 bg-slate-850 border border-slate-300 px-2.5 py-1 rounded-lg">
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
                          : "bg-slate-850 text-slate-300 border-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Unlock size={14} />
                      <span>
                        {isOpen ? "Seal Identity" : "Unseal Identity"}
                      </span>
                    </button>

                    {/* Unsealed identity panel */}
                    {isOpen && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3">
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

      {/* ── Primary Tab Bar — Command / People / Compliance ──────────────────────────── */}
      {/* Focused workspaces reduce visual load without hiding any capability.    */}
      {(() => {
        const tabs = [
          {
            id: "COMMAND" as const,
            label: "Command",
            desc: "Deploy directives, control stairs & elevators",
            icon: Radio,
            color: "bg-red-600 border-red-500",
          },
          {
            id: "PEOPLE" as const,
            label: "People",
            desc: "Headcount, locator & red list",
            icon: Users,
            color: "bg-blue-600 border-blue-500",
          },
          {
            id: "COMPLIANCE" as const,
            label: "Compliance",
            desc: "Metrics, ledger & FDNY reports",
            icon: ClipboardCheck,
            color: "bg-indigo-600 border-indigo-500",
          },
        ];
        return (
          <div
            role="tablist"
            aria-label="Command Deck workspace"
            className="mb-5 bg-white border border-slate-200 rounded-2xl p-1.5 grid grid-cols-3 gap-1.5 shadow-sm"
          >
            {tabs.map((t) => {
              const active = activeTab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all cursor-pointer border-2 ${
                    active
                      ? `${t.color} text-white shadow-md`
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-300"
                  }`}
                >
                  <Icon
                    size={20}
                    className={active ? "text-white shrink-0" : "shrink-0"}
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-black uppercase tracking-wide leading-none ${
                        active ? "text-white" : "text-slate-200"
                      }`}
                    >
                      {t.label}
                    </div>
                    <div
                      className={`text-xs mt-1 leading-tight truncate ${
                        active ? "text-white/85" : "text-slate-500"
                      }`}
                    >
                      {t.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ════ COMMAND TAB ═════════════════════════════════════════════════ */}
      {activeTab === "COMMAND" && (
        <>

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
                1 Classify → 2 Decide → command deploys to every phone & tablet
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

          {/* Mode banner — says exactly how the next command will deploy */}
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-2.5 ${
              isDrill
                ? "bg-blue-50 border-blue-300"
                : "bg-red-50 border-red-400"
            }`}
          >
            <span
              className={`text-sm font-black uppercase tracking-wide ${
                isDrill ? "text-blue-700" : "text-red-700"
              }`}
            >
              {isDrill
                ? "🟦 Commands deploy as DRILL"
                : "🔴 Commands deploy as REAL EVACUATION"}
            </span>
            <span
              className={`text-xs font-semibold ${
                isDrill ? "text-blue-600" : "text-red-600"
              }`}
            >
              {isDrill
                ? "Tagged “DRILL” on every device · family SMS off"
                : "No drill tag · family SAFE-SMS armed"}
            </span>
          </div>

          {/* ── EAP flow stepper — progress + live broadcast state ── */}
          <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 px-3 py-3">
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
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${selectedEmergency === e.id ? "bg-amber-600 text-slate-950 border-amber-400 font-bold shadow-md" : "bg-white hover:bg-white text-slate-300 border-slate-300"}`}
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
              Step 2 — Decide &amp; Deploy Command
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
                        deployDirective(
                          `EAP — ${selectedEmergency}: EVACUATE Floor 7. Use FSD-assigned stairs only. PRIMARY muster: Stuyvesant Square Park.`,
                        );
                      } else if (d.id === "SHELTER_IN_PLACE") {
                        deployDirective(
                          `EAP — ${selectedEmergency}: SHELTER IN PLACE. Remain in current secure area. Await FSD all-clear.`,
                        );
                      } else {
                        deployDirective(
                          `EAP — ${selectedEmergency}: IN-BUILDING RELOCATION. Move to FSD-designated safe floor/zone.`,
                        );
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected ? colors.active + " font-bold shadow-md" : "bg-white hover:bg-white text-slate-600 border-slate-200"}`}
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
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Flame size={16} className="text-red-600 shrink-0" />
            <span className="text-sm font-black text-slate-200 uppercase tracking-wide">
              Incident Control
            </span>
          </div>
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
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-850 cursor-pointer select-none border border-transparent hover:border-slate-200 transition-all"
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
            <div className="bg-white p-3 rounded-xl border border-slate-300">
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
                    title: "Stair Blocked — Reroute",
                    text: "Emergency Alert: A stairwell is reported blocked. Divert to the nearest CLEAR stair on the Stair Control board; wardens confirm landings.",
                  },
                  {
                    title: "BLE Mesh Routing",
                    text: "BLE Mesh Sync Active: Switch tablet sync to local Mesh bypass. Log security tag keys at Stairwell nodes.",
                  },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => deployDirective(preset.text)}
                    className="w-full text-left bg-white hover:bg-white border border-slate-300 hover:border-amber-600 px-3 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all cursor-pointer flex items-start gap-2"
                    title={preset.text}
                  >
                    <span className="text-amber-500 shrink-0 mt-0.5">⚡</span>
                    <span className="leading-snug">{preset.title}</span>
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
                    deployDirective(txt.trim());
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

          {/* STAIR CONTROL — tap any of the six real Floor-7 stairs to mark it
              blocked/clear. Drives map markers + occupant reroute warnings. */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold font-mono uppercase text-slate-600 tracking-wider">
                Stair Control — tap to block / clear
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                  blockedStairs.length > 0
                    ? "bg-red-100 text-red-700 border-red-300"
                    : "bg-emerald-100 text-emerald-700 border-emerald-300"
                }`}
              >
                {blockedStairs.length > 0
                  ? `${blockedStairs.length} BLOCKED`
                  : "ALL CLEAR"}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {STAIRS.map((s) => {
                const blocked = blockedStairs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onToggleStair(s.id)}
                    title={`${s.label} · ${s.area} — tap to mark ${blocked ? "CLEAR" : "BLOCKED"}`}
                    aria-pressed={blocked}
                    className={`py-2 rounded-xl border-2 text-center transition-all cursor-pointer active:scale-95 ${
                      blocked
                        ? "bg-red-600 border-red-500 text-white shadow-md"
                        : "bg-emerald-50 border-emerald-300 text-emerald-700 hover:border-emerald-500"
                    }`}
                  >
                    <span className="block text-sm font-black leading-none">
                      {s.id}
                    </span>
                    <span
                      className={`block text-xs font-bold mt-1 leading-none ${
                        blocked ? "text-red-100" : "text-emerald-600"
                      }`}
                    >
                      {blocked ? "BLOCKED" : "CLEAR"}
                    </span>
                  </button>
                );
              })}
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
            className={`bg-white border-2 border-slate-200 shadow-inner relative flex flex-col items-center justify-center overflow-hidden ${
              mapFullscreen
                ? "flex-1 h-full rounded-none"
                : "w-full aspect-[74/50] rounded-2xl"
            }`}
            style={{ cursor: mapDragRef.current ? "grabbing" : "grab" }}
          >
            {/* Zoom / pan / full-screen controls */}
            <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
              <button
                type="button"
                onClick={mapZoomIn}
                className="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-white hover:border-amber-600 shadow-sm transition-all cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={mapZoomOut}
                className="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-white hover:border-amber-600 shadow-sm transition-all cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={mapToggleFullscreen}
                className="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-white hover:border-amber-600 shadow-sm transition-all cursor-pointer"
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
                    stroke="#dbe4ee"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              {/* Apply technical grid background */}
              <rect width="100%" height="100%" fill="url(#arch-grid)" />

              {/* Real 7th-floor As-Built plan (public/floor7-plan.png) */}
              {hasPlan ? (
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
              ) : (
                <text
                  x="370"
                  y="250"
                  fill="#64748b"
                  fontSize="14"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Floor plan unavailable — marker positions approximate
                </text>
              )}

              {/* The six real Floor-7 egress stairs (A/C/D/E/F/G — no Stair B
                  on this floor). Click a stair to mark it BLOCKED / CLEAR. */}
              {STAIRS.map((s) => {
                const blocked = blockedStairs.includes(s.id);
                return (
                  <g
                    key={s.id}
                    onClick={() => onToggleStair(s.id)}
                    className="cursor-pointer"
                  >
                    <title>{`${s.label} · ${s.area} — click to mark ${blocked ? "CLEAR" : "BLOCKED"}`}</title>
                    {blocked && (
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r="20"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                        strokeOpacity="0.4"
                        className="animate-ping"
                        style={{
                          animationDuration: "1.4s",
                          transformOrigin: `${s.x}px ${s.y}px`,
                        }}
                      />
                    )}
                    <rect
                      x={s.x - 26}
                      y={s.y - 11}
                      width="52"
                      height="22"
                      rx="6"
                      fill={blocked ? "#dc2626" : "#ffffff"}
                      stroke={blocked ? "#991b1b" : "#059669"}
                      strokeWidth="2"
                    />
                    <text
                      x={s.x}
                      y={s.y - 1}
                      fill={blocked ? "#ffffff" : "#047857"}
                      fontSize="9"
                      fontFamily="system-ui, sans-serif"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      STAIR {s.id}
                    </text>
                    <text
                      x={s.x}
                      y={s.y + 8}
                      fill={blocked ? "#fecaca" : "#059669"}
                      fontSize="6.5"
                      fontFamily="system-ui, sans-serif"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {blocked ? "✕ BLOCKED" : "✓ CLEAR"}
                    </text>
                  </g>
                );
              })}

              {/* Occupants plotted by quadrant. SAFE & MISSING roll up into
                  per-zone count pills; only actionable people (Critical /
                  Need Help / ARA) get individual markers so labels never collide. */}
              {(() => {
                // Zone anchors calibrated to the real 7th-floor As-Built plan
                // (floor7-plan.png, 740x500 viewBox, xMidYMid meet, ~10px top letterbox).
                // West = Irving Place, East = Third Ave, North = E 15th, South = E 14th.
                const zones: Record<string, { x: number; y: number }> = {
                  NW: { x: 160, y: 135 }, // 07-800 Strategic Planning (Irving Pl / E15)
                  NE: { x: 470, y: 130 }, // 07-240 / 07-280 IRS (Third Ave / E15)
                  SW: { x: 180, y: 300 }, // 07-700 AMI Implementation (Irving Pl / E14)
                  SE: { x: 480, y: 305 }, // 07-400s office block (Third Ave / E14)
                  Center: { x: 335, y: 215 }, // ELEV LOBBY C / courtyard core
                };

                const statusColor = (s: string) =>
                  s === "SAFE"
                    ? "#10b981"
                    : s === "CRITICAL"
                      ? "#ef4444"
                      : s === "NEED_HELP"
                        ? "#f59e0b"
                        : "#94a3b8";
                const labelColor = (s: string) =>
                  s === "SAFE"
                    ? "#059669"
                    : s === "CRITICAL"
                      ? "#dc2626"
                      : s === "NEED_HELP"
                        ? "#d97706"
                        : "#475569";
                const roleChar = (r: string) =>
                  r === "Warden"
                    ? "W"
                    : r === "FSD"
                      ? "F"
                      : r === "Searcher"
                        ? "S"
                        : r === "Deputy"
                          ? "D"
                          : r === "Visitor"
                            ? "V"
                            : r === "Contractor"
                              ? "C"
                              : "O";

                return Object.entries(zones).map(([zoneKey, base]) => {
                  const group = occupants.filter((o) =>
                    zoneKey === "Center"
                      ? o.quadrant === "Center" || !(o.quadrant in zones)
                      : o.quadrant === zoneKey,
                  );
                  if (group.length === 0) return null;

                  // Individually plotted: needs action or ARA priority
                  const featured = group.filter(
                    (o) =>
                      o.status === "CRITICAL" ||
                      o.status === "NEED_HELP" ||
                      o.mobilityImpaired ||
                      o.isAtARA,
                  );
                  const safeOccs = group.filter(
                    (o) => o.status === "SAFE" && !featured.includes(o),
                  );
                  const missingOccs = group.filter(
                    (o) => !featured.includes(o) && !safeOccs.includes(o),
                  );

                  // Featured markers laid out in rows of 3, wide enough for label chips
                  const perRow = 3;
                  const rowCount = Math.ceil(featured.length / perRow);
                  const colGap = 50;
                  const rowGap = 48;

                  // Count pills sit below the featured block (or at the anchor)
                  const pillY =
                    featured.length > 0
                      ? base.y + ((rowCount - 1) / 2) * rowGap + 42
                      : base.y;
                  const bothPills =
                    safeOccs.length > 0 && missingOccs.length > 0;

                  return (
                    <g key={zoneKey} className="transition-all duration-500">
                      {featured.map((occ, i) => {
                        const row = Math.floor(i / perRow);
                        const inThisRow = Math.min(
                          perRow,
                          featured.length - row * perRow,
                        );
                        const col = i % perRow;
                        const coord = {
                          x: base.x + (col - (inThisRow - 1) / 2) * colGap,
                          y: base.y + (row - (rowCount - 1) / 2) * rowGap,
                        };
                        const color = statusColor(occ.status);
                        const isCritical = occ.status === "CRITICAL";
                        const isAlert =
                          isCritical || occ.status === "NEED_HELP";
                        const isARA = occ.mobilityImpaired || occ.isAtARA;

                        return (
                          <g key={occ.id}>
                            <title>{`${occ.badgeId} · ${occ.role} · ${occ.status.replace("_", " ")}`}</title>
                            {/* Outer detection pulse ring (critical/need-help) */}
                            {isAlert && (
                              <circle
                                cx={coord.x}
                                cy={coord.y}
                                r="17"
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                strokeOpacity="0.35"
                                className="animate-ping"
                                style={{
                                  animationDuration: isCritical
                                    ? "0.9s"
                                    : "1.6s",
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
                              stroke={color}
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
                              fill={color}
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
                              {roleChar(occ.role)}
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
                            {occ.wearable && (
                              <text
                                x={coord.x - 11}
                                y={coord.y - 7}
                                fontSize="9"
                                textAnchor="middle"
                              >
                                📡
                              </text>
                            )}
                            {/* Badge label on white chip so it stays legible */}
                            <rect
                              x={coord.x - 22}
                              y={coord.y + 14}
                              width="44"
                              height="12"
                              rx="6"
                              fill="white"
                              fillOpacity="0.95"
                              stroke={labelColor(occ.status)}
                              strokeWidth="0.75"
                            />
                            <text
                              x={coord.x}
                              y={coord.y + 22.5}
                              fill={labelColor(occ.status)}
                              fontSize="7"
                              fontFamily="monospace"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {occ.badgeId}
                            </text>
                          </g>
                        );
                      })}

                      {/* SAFE cluster pill */}
                      {safeOccs.length > 0 && (
                        <g>
                          <title>{`Safe in ${zoneKey}: ${safeOccs.map((o) => o.badgeId).join(", ")}`}</title>
                          <rect
                            x={(bothPills ? base.x - 60 : base.x - 29) + 0}
                            y={pillY - 9}
                            width="58"
                            height="18"
                            rx="9"
                            fill="#059669"
                            stroke="white"
                            strokeWidth="1.5"
                          />
                          <text
                            x={bothPills ? base.x - 31 : base.x}
                            y={pillY + 3.5}
                            fill="white"
                            fontSize="9"
                            fontFamily="system-ui, sans-serif"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            ✓ {safeOccs.length} SAFE
                          </text>
                        </g>
                      )}

                      {/* MISSING / unaccounted cluster pill */}
                      {missingOccs.length > 0 && (
                        <g>
                          <title>{`Unaccounted in ${zoneKey}: ${missingOccs.map((o) => o.badgeId).join(", ")}`}</title>
                          <rect
                            x={bothPills ? base.x + 2 : base.x - 33}
                            y={pillY - 9}
                            width="66"
                            height="18"
                            rx="9"
                            fill="#64748b"
                            stroke="white"
                            strokeWidth="1.5"
                          />
                          <text
                            x={bothPills ? base.x + 35 : base.x}
                            y={pillY + 3.5}
                            fill="white"
                            fontSize="9"
                            fontFamily="system-ui, sans-serif"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {missingOccs.length} MISSING
                          </text>
                        </g>
                      )}
                    </g>
                  );
                });
              })()}
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
            * Tap any stair — on the map or the Stair Control board — to mark it
            blocked or clear. Reroute alerts auto-dispatch to every phone and
            tablet over Bluetooth mesh. All 6 Floor-7 stair cores are LL26
            compliant.
          </p>
        </div>
      </div>
        </>
      )}

      {/* ════ PEOPLE TAB ══════════════════════════════════════════════════ */}
      {activeTab === "PEOPLE" && (
        <>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* PANEL 3: HEADCOUNT & DYNAMIC LOCATOR BOARD */}
        <div className="xl:col-span-12 min-h-[560px] bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header Telemetry */}
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-base font-black text-slate-200 flex items-center gap-2">
                <MapPin
                  size={16}
                  className="text-amber-500 animate-pulse shrink-0"
                />
                <span>Headcount & Locator</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black text-emerald-700">
                  {occupants.filter((o) => o.status === "SAFE").length}
                </span>
                <span className="text-sm text-slate-500 font-mono">
                  / {occupants.length}
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-lg font-bold ml-1">
                  ACCOUNTED
                </span>
              </div>
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
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Category tabs */}
            <div className="grid grid-cols-3 gap-1 mb-2 bg-slate-850 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
              {(["ALL", "AT_RISK", "SAFE"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setLocatorTab(tab);
                    setLocatorPage(1);
                  }}
                  className={`py-2.5 text-sm font-bold rounded-lg transition-all ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      locatorSector === sect
                        ? "bg-amber-600 text-white border-amber-500"
                        : "bg-white text-slate-500 border-slate-300 hover:text-slate-200 hover:border-amber-500 cursor-pointer"
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
                    className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                      o.id === unsealedTokenId
                        ? "bg-white border-amber-500/70 shadow-lg"
                        : o.status === "CRITICAL"
                          ? "bg-red-50 border-red-300 hover:bg-red-100/60"
                          : o.status === "NEED_HELP"
                            ? "bg-yellow-50 border-amber-300 hover:bg-yellow-100/60"
                            : o.status === "SAFE"
                              ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100/60"
                              : "bg-white border-slate-200 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex gap-2">
                        <div className="mt-1 shrink-0">
                          <span className={`relative flex h-3 w-3`}>
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
                              className={`relative inline-flex rounded-full h-3 w-3 ${
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
                          <div className="text-sm font-bold text-slate-200 flex flex-wrap items-center gap-1">
                            <span>
                              {unsealedTokenId === o.id && unsealedDetails
                                ? unsealedDetails.name
                                : o.nameEncrypted}
                            </span>
                            <span className="text-xs text-slate-400 font-mono hidden">
                              {o.id}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 font-mono leading-tight flex flex-wrap gap-2 mt-0.5">
                            <span className="bg-slate-850 px-1.5 py-0.5 rounded border border-slate-200">
                              {o.badgeId}
                            </span>
                            <span className="bg-slate-850 px-1.5 py-0.5 rounded border border-slate-200">
                              {o.role}
                            </span>
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-300 font-bold">
                              {o.quadrant}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Decrypt Actions trigger */}
                      <button
                        onClick={() => handleUnsealFsd(o.id)}
                        className={`text-xs font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                          unsealedTokenId === o.id
                            ? "bg-amber-500 text-white border-amber-400"
                            : "bg-white text-slate-500 border-slate-300 hover:text-slate-200 hover:border-amber-500"
                        }`}
                      >
                        <Unlock size={12} />
                        <span>
                          {unsealedTokenId === o.id ? "Seal" : "Unseal ID"}
                        </span>
                      </button>
                    </div>

                    {/* Interactive JIT Decrypted Vault detail inline drawer */}
                    {unsealedTokenId === o.id && (
                      <div className="mt-2 bg-white p-2 rounded-lg border border-amber-300 text-xs font-mono space-y-1 animate-fadeIn">
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
                              className="w-8 h-8 rounded object-cover border border-slate-200 bg-slate-850 shrink-0"
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
                      <div className="bg-amber-50 px-2.5 py-1.5 rounded-lg text-xs text-amber-800 font-medium border border-amber-200">
                        ⚠️ {o.alertNote}
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
            <div className="flex justify-between items-center bg-white px-2 py-1.5 rounded-xl border border-slate-200 mt-2.5 shrink-0 select-none">
              <button
                disabled={activeLocatorPage === 1}
                onClick={() => setLocatorPage((prev) => Math.max(1, prev - 1))}
                className="text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
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
                className="text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
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
              className="w-full bg-amber-600 hover:bg-amber-500 border border-amber-500 text-white text-sm font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <FileText size={16} className="text-white" />
              Generate FDNY Pre-Arrival Report
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
                <span className="text-base font-black text-amber-700">
                  ♿ EVAC-CHAIR LIST — Area of Rescue Assistance
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {inTransit.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded-lg font-bold uppercase animate-pulse">
                    {inTransit.length} IN TRANSIT
                  </span>
                )}
                <span className="text-xs bg-blue-100 text-blue-700 border border-blue-300 px-3 py-1.5 rounded-lg font-bold uppercase">
                  STAGED {staged.length}/{denominator}
                </span>
                <span className="text-xs bg-slate-850 text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg font-bold uppercase">
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
                          ? "border-amber-500/70 shadow-lg bg-white"
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
                        <span className="text-xs font-mono text-slate-600 bg-slate-850 border border-slate-200 px-1 py-0.5 rounded">
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
                        className={`mt-auto text-xs font-bold py-1.5 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isOpen
                            ? "bg-amber-500 text-white border-amber-400"
                            : "bg-white text-slate-500 border-slate-300 hover:text-slate-200 hover:border-amber-500"
                        }`}
                      >
                        <Unlock size={12} />
                        <span>{isOpen ? "Seal" : "Unseal ID"}</span>
                      </button>

                      {/* Inline vault drawer */}
                      {isOpen && (
                        <div className="bg-white p-2 rounded-lg border border-amber-300 text-xs font-mono space-y-1">
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
                          : "text-slate-300 bg-slate-850 border-slate-300";

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
                  className={`flex items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 border border-slate-200 ${
                    isCritical || isAlarm
                      ? "bg-red-50 border-l-red-500"
                      : isSafe
                        ? "bg-emerald-50 border-l-emerald-500"
                        : isDirective
                          ? "bg-amber-50 border-l-amber-500"
                          : isMesh
                            ? "bg-yellow-50 border-l-yellow-500"
                            : isFamily
                              ? "bg-blue-50 border-l-blue-500"
                              : "bg-slate-950 border-l-slate-400"
                  }`}
                >
                  {/* Event type badge */}
                  <span
                    className={`text-xs font-black px-2 py-1 rounded-lg border shrink-0 font-mono ${typeColor}`}
                  >
                    {typeLabel}
                  </span>

                  {/* Event description */}
                  <span className="text-xs text-slate-400 font-medium truncate flex-1 min-w-0">
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
                    <div className="font-bold text-slate-400">
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

        </>
      )}

      {/* ════ COMPLIANCE TAB ══════════════════════════════════════════════ */}
      {activeTab === "COMPLIANCE" && (
        <>
      {/* Down Layer bento expansions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-5">
        {/* LIVE INCIDENT KPIs — Floor 7 real-time metric board */}
        <div className="xl:col-span-6 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col h-[320px]">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <Activity className="text-amber-500" size={13} />
              <span className="text-base font-bold tracking-tight text-slate-200">
                LIVE INCIDENT KPIs
              </span>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
              FLOOR 7 · {occupants.length} OCCUPANTS
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
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
                Accounted
              </div>
              <div className="text-2xl font-mono font-black text-amber-700 leading-none">
                {occupants.filter((o) => o.status === "SAFE").length}
                <span className="text-sm text-slate-500">
                  /{occupants.length}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                &lt; 180 s target
              </div>
            </div>

            {/* ARA Evac-Chair */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
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
            <div
              className={`rounded-xl border-2 p-3 flex flex-col justify-between ${occupants.filter((o) => o.status === "CRITICAL" || o.fallDetected).length > 0 ? "bg-red-50 border-red-400" : "bg-emerald-50 border-emerald-300"}`}
            >
              <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
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
            <div
              className={`rounded-xl border-2 p-3 flex flex-col justify-between ${ledgerIntegrity.verified ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-400"}`}
            >
              <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
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
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
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
            <div
              className={`rounded-xl border-2 p-3 flex flex-col justify-between ${isBlackout ? "bg-yellow-50 border-yellow-400" : "bg-emerald-50 border-emerald-300"}`}
            >
              <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
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
                        Math.max(occupants.length, 1)) *
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
        <div className="xl:col-span-6 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col h-[320px]">
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
                className={`p-3 rounded-xl border-2 flex flex-col gap-1.5 transition-all ${
                  isLedgerTampered && b.index === 1
                    ? "bg-red-50 border-red-400 animate-pulse"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-800 font-black uppercase tracking-wide text-slate-300">
                  <span>Block #{b.index}</span>
                  <span className="text-slate-500 text-xs">{b.timestamp}</span>
                </div>
                <div className="text-xs text-slate-400 py-0.5">
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
              className="bg-slate-850 hover:bg-slate-800 border border-slate-300 text-slate-300 text-xs py-2.5 rounded-xl transition-all"
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
                  ? "bg-slate-850 text-slate-400 border-slate-200 cursor-not-allowed"
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
              className="text-xs bg-slate-850 border border-slate-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase"
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
        {/* Compliance-first: metrics grouped by the regulation that drove each
            requirement, so auditors can verify OSHA/LL26/FDNY/NFPA/ADA coverage
            without cross-referencing a separate PRD. */}
        {(() => {
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

          // Ordered so the highest-authority regulations render first
          const regulationOrder = [
            "OSHA 29 CFR 1910.38",
            "NYC Local Law 26 / RS-17",
            "FDNY F-89",
            "NFPA 72 / EAP",
            "ADA / EAP ARA",
          ] as const;

          const regColors: Record<
            string,
            { chip: string; accent: string }
          > = {
            "OSHA 29 CFR 1910.38": {
              chip: "bg-blue-100 text-blue-700 border-blue-300",
              accent: "border-l-blue-500",
            },
            "NYC Local Law 26 / RS-17": {
              chip: "bg-indigo-100 text-indigo-700 border-indigo-300",
              accent: "border-l-indigo-500",
            },
            "FDNY F-89": {
              chip: "bg-red-100 text-red-700 border-red-300",
              accent: "border-l-red-500",
            },
            "NFPA 72 / EAP": {
              chip: "bg-amber-100 text-amber-700 border-amber-300",
              accent: "border-l-amber-500",
            },
            "ADA / EAP ARA": {
              chip: "bg-emerald-100 text-emerald-700 border-emerald-300",
              accent: "border-l-emerald-500",
            },
          };

          return (
            <div className="space-y-5">
              {regulationOrder.map((reg) => {
                const goals = PILOT_GOALS.filter((g) => g.regulation === reg);
                if (goals.length === 0) return null;

                // Tally section status
                const results = goals.map((g) => g.evaluate(pilotCtx));
                const metCount = results.filter(
                  (r) => r.status === "MET",
                ).length;
                const atRiskCount = results.filter(
                  (r) => r.status === "AT_RISK",
                ).length;
                const sectionStatusChip =
                  atRiskCount > 0
                    ? "bg-red-100 text-red-700 border-red-300"
                    : metCount === goals.length
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-amber-100 text-amber-700 border-amber-300";

                return (
                  <section key={reg}>
                    {/* Regulation section header */}
                    <div className="flex items-center justify-between gap-2 mb-2.5 pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase border ${regColors[reg].chip}`}
                        >
                            {reg}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {goals.length} metric
                          {goals.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase border ${sectionStatusChip}`}
                      >
                        {metCount}/{goals.length} met
                        {atRiskCount > 0 && ` · ${atRiskCount} at risk`}
                      </span>
                    </div>

                    {/* Cards for this regulation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {goals.map((g, i) => {
                        const r = results[i];
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
                            className={`rounded-xl border border-slate-200 border-l-4 ${regColors[reg].accent} bg-white p-3.5 shadow-sm`}
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
                            <div className="text-xs text-slate-500 font-mono mt-1 leading-snug">
                              {g.citation}
                            </div>
                            <div className="text-xs text-slate-600 font-mono mt-1.5">
                              🎯 {g.target}
                              {g.stretch ? ` · stretch ${g.stretch}` : ""}
                            </div>
                            <div
                              className={`text-sm font-mono font-bold mt-0.5 ${valueColor}`}
                            >
                              {r.value}
                            </div>
                            {r.detail && (
                              <div className="text-xs text-slate-500 mt-1.5 leading-tight border-t border-slate-200 pt-1.5">
                                {r.detail}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })()}
      </div>

        </>
      )}

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
                className="text-xs bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-slate-100 px-2 py-1 rounded"
              >
                Close Report
              </button>
            </div>

            <pre className="flex-1 bg-white text-slate-300 p-4 rounded-xl font-mono text-xs leading-relaxed overflow-auto border border-slate-200 select-text">
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
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-mono px-3 py-2 rounded-lg border border-slate-300"
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
