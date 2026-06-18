import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Play,
  HelpCircle,
  FileText,
  Send,
  Sparkles,
  RefreshCw,
  Layers,
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
  Radio,
} from "lucide-react";
import { Occupant, LedgerBlock, DrillHistoryItem } from "../types";
import FloorMap from "./FloorMap";

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
}

const ROADMAP_ITEMS = {
  RESEARCH: [
    {
      key: "interview",
      title: "Warden & SME Interviews",
      subtitle: "74th, 59th, & East River offices",
      location: "74th St, 59th St, & East River",
      assigned: "EH&S & Wardens Team",
      desc: "Interview wardens and EH&S SMEs at 74th St, 59th St, and East River to understand information flow during drills.",
      outcome:
        "✓ Completed. Physical clipboards and hand-tallies are prone to dropouts or 18-minute transmission lags.",
    },
    {
      key: "live_drill",
      title: "Observe & Walk Live Drill",
      subtitle: "Process Auditing Walkthrough",
      location: "East River Facility",
      assigned: "EH&S & Robert",
      desc: "Observe or walk through a live drill if permitted to audit process bottlenecks in real time.",
      outcome:
        "✓ Observed. Paper clipboards introduce lag in distress message relay and coordinate alignment.",
    },
    {
      key: "map_evac",
      title: "Map current process",
      subtitle: "Works vs. Breaks Board",
      location: "Joint Office Pilot",
      assigned: "EH&S Joint Taskforce",
      desc: "Map the current evacuation process — what works, what breaks (e.g. communication stairwells vs. assembly points).",
      outcome:
        "✓ Mapped. Decibel sirens work well; staircase voice relays break down entirely under load.",
    },
    {
      key: "pain_point",
      title: "Identify #1 Pain Point",
      subtitle: "6-Week Target Focus Selection",
      location: "Muster Command Terminal",
      assigned: "Sam & Robert",
      desc: "Identify the #1 pain point to solve in 6 weeks to ensure rapid deployment of a reliable digital backup.",
      outcome:
        "✓ Identified. Distressed personnel identification time. Solution: Offline-first BLE QR muster scan.",
    },
  ],
  MOCKUPS: [
    {
      key: "feature_list",
      title: "MVP Feature Scoping",
      subtitle: "Lock Build vs. Mock Spec",
      location: "Product Management Board",
      assigned: "SMEs & Dev Team",
      desc: "Lock the must-have feature list and agree what gets mocked vs. built for the 6-week MVP timeline.",
      outcome:
        "✓ Agreed. Built: Cryptographic live hash-ledgers and offline scanner. Mocked: Real BLE mesh network bulk count.",
    },
    {
      key: "mobile_mockups",
      title: "Clickable Mobile Mockups",
      subtitle: "Warden interface flow",
      location: "UX Board & Tablets",
      assigned: "Design & UX Group",
      desc: "Design and export clickable mobile mockups — warden headcount flow, status taps, assembly point view.",
      outcome:
        "✓ Designed. Wardens loved the visual high-contrast layout and easy toggle tabs.",
    },
    {
      key: "feedback",
      title: "Week 2 SME Feedback",
      subtitle: "Design Iteration Reviews",
      location: "74th & 59th St Offices",
      assigned: "SMEs & Wardens",
      desc: "Review mockups with wardens and EH&S by end of Week 2 — get real feedback on ease of use under stress.",
      outcome:
        "✓ Integrated. Added persistent sector filters, unseal drawer, and pagination blocks.",
    },
  ],
  BUILD: [
    {
      key: "dev_env",
      title: "Environment & Spike",
      subtitle: "Sam & Robert Setup Phase",
      location: "ConEd Sandbox / Dev Repo",
      assigned: "Sam & Robert",
      desc: "Sam: spike on Photo System & ARCOS access. Robert: set up dev environment to configure the project.",
      outcome:
        "✓ Complete. Vite build configured and sandbox API connection established.",
    },
    {
      key: "backend_api",
      title: "Sam: Stand up backend",
      subtitle: "Model, Sync & API Scaffold",
      location: "Secure Cloud Run Pod",
      assigned: "Sam (Backend)",
      desc: "Sam: Stand up backend — data model, roster sync, API scaffold, mocked ARCOS & Photo data.",
      outcome:
        "✓ Complete. Serves live cryptographic token scans and secure TLS 1.3 decryptions.",
    },
    {
      key: "first_build",
      title: "Robert: Live Headcount Flow",
      subtitle: "Integrated Core Sprint",
      location: "Command Station Central",
      assigned: "Robert (Frontend)",
      desc: "Robert: First working build of headcount flow connected to Sam's API (showing live synchronization).",
      outcome:
        "★ Running load. Integrates real-time peer communication status with security vault unseals.",
    },
  ],
};

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

  // 6-Week EH&S Discovery & Implementation Roadmap States
  const [roadmapTab, setRoadmapTab] = useState<
    "RESEARCH" | "MOCKUPS" | "BUILD"
  >("RESEARCH");
  const [activeTaskKey, setActiveTaskKey] = useState<string>("interview");
  const [completedRoadmap, setCompletedRoadmap] = useState<
    Record<string, boolean>
  >({
    interview: true,
    live_drill: true,
    map_evac: true,
    pain_point: true,
    feature_list: true,
    mobile_mockups: true,
    feedback: true,
    dev_env: true,
    backend_api: true,
    first_build: false,
  });

  const handleToggleRoadmapTask = (key: string) => {
    setCompletedRoadmap((prev) => {
      const nextVal = !prev[key];
      // Find the task across all lists
      const allTasks = [
        ...ROADMAP_ITEMS.RESEARCH,
        ...ROADMAP_ITEMS.MOCKUPS,
        ...ROADMAP_ITEMS.BUILD,
      ];
      const taskItem = allTasks.find((t) => t.key === key);
      if (taskItem) {
        onLogEvent(
          `EH&S Roadmap task updated: [${taskItem.title}] set to ${nextVal ? "COMPLETED" : "IN-PROGRESS"}.`,
        );
      }
      return { ...prev, [key]: nextVal };
    });
  };

  // FDNY generated report state
  const [fdnyReport, setFdnyReport] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Headcount & Locator System States
  const [locatorTab, setLocatorTab] = useState<"ALL" | "AT_RISK" | "ACCOUNTED">(
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

  // Warden Acknowledgement Pipeline — tracks SENT -> DELIVERED -> ACKNOWLEDGED
  // for each quadrant warden whenever a new F-89 directive is broadcast.
  const WARDEN_SECTORS = ["NW", "NE", "SW", "SE"] as const;
  const [ackStage, setAckStage] = useState<Record<string, number>>({
    NW: 2,
    NE: 2,
    SW: 2,
    SE: 2,
  });

  useEffect(() => {
    // New directive -> reset and roll each warden through to acknowledged.
    setAckStage({ NW: 0, NE: 0, SW: 0, SE: 0 });
    const timers: number[] = [];
    WARDEN_SECTORS.forEach((s, i) => {
      timers.push(
        window.setTimeout(
          () => setAckStage((p) => ({ ...p, [s]: 1 })),
          400 + i * 220,
        ),
      );
      timers.push(
        window.setTimeout(
          () => setAckStage((p) => ({ ...p, [s]: 2 })),
          950 + i * 320,
        ),
      );
    });
    return () => timers.forEach((t) => clearTimeout(t));
  }, [activeDirective]);

  const ackCount = Object.values(ackStage).filter((v) => v === 2).length;

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

  // Generate compliance FDNY reports (NYC LL26 Rs-17 Audit checklist)
  const generateFdnyReport = () => {
    const uniqueTimeStr = new Date().toUTCString();
    const safeCount = occupants.filter((o) => o.status === "ACCOUNTED").length;
    const criticalCount = occupants.filter(
      (o) => o.status === "MEDICAL" && o.fallDetected,
    ).length;
    const needHelpCount = occupants.filter(
      (o) => o.status === "MEDICAL" && !o.fallDetected,
    ).length;
    const araCount = occupants.filter((o) => o.status === "ARA_STAGING").length;
    const missingCount = occupants.filter((o) => o.status === "MISSING").length;
    const drillRate = Math.round(
      (occupants.filter((o) => o.drillParticipant !== false).length /
        occupants.length) *
        100,
    );

    const formattedReport = `================================================================================
MUSTERCOMMAND LIFE-SAFETY COMPLIANCE AUDIT CERTIFICATE
REGULATORY CLEARANCE: NYC LL26 (RS-17) / OSHA 29 CFR 1910.38
CONEDISON FLOOR 7 PILOT DIVISION - 4 IRVING PLAZA, NEW YORK NY
================================================================================
INCIDENT TIMESTAMP : ${uniqueTimeStr}
MESSENGER SECTOR   : Life-Critical FSD Comm Station
INCIDENT LIFETIME   : ${formatElapsed(elapsedSeconds)} elapsed
NETWORK LINK TYPE  : ${isBlackout ? "HMAC Bluetooth Mesh - Backup Gateway" : "Primary Cloud Ingress Gateway"}

--------------------------------------------------------------------------------
1. COMPREHENSIVE HEADCOUNT STATS
--------------------------------------------------------------------------------
TOTAL ON-SITE ROSTER REGISTRATION : ${occupants.length} personnel
DECIPHERED AS SAFE (ACCOUNTED)    : ${safeCount}
STAGED AT AREA OF RESCUE (ARA)    : ${araCount}
DECLARED UNACCOUNTED (MISSING)    : ${missingCount}
REPORTED PHYSICAL DISTRESS (MIA)  : ${needHelpCount}
CRITICAL TELEMETRY FALL INJURY    : ${criticalCount}
OSHA 1910.38(e) DRILL PARTICIPATION: ${drillRate}% COMPLIANT

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
================================================================================`;

    setFdnyReport(formattedReport);
    onLogEvent(
      `Generated legal compliance pre-arrival FDNY incident report at ${uniqueTimeStr}.`,
    );
  };

  // Sort by DANGER LEVEL > PROXIMITY (Section 8.3 Wireframe)
  // Danger Weight: MEDICAL = 3, ARA_STAGING = 2, MISSING = 1, ACCOUNTED = 0.
  const getDangerWeight = (status: Occupant["status"]) => {
    if (status === "MEDICAL") return 3;
    if (status === "ARA_STAGING") return 2;
    if (status === "MISSING") return 1;
    return 0;
  };

  const sortedRedList = [...occupants]
    .filter((o) => o.status !== "ACCOUNTED")
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
      if (locatorTab === "AT_RISK" && o.status === "ACCOUNTED") return false;
      if (locatorTab === "ACCOUNTED" && o.status !== "ACCOUNTED") return false;

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
    <div className="w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex flex-col h-[1440px] xl:h-[710px] text-slate-100 overflow-hidden">
      {/* Commanding Header Ribbon */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-red-600 text-white font-bold text-[10px] uppercase font-mono px-2 py-0.5 rounded tracking-widest animate-pulse">
              INCIDENT ACTIVE
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-100 font-sans">
              MusterCommand{" "}
              <span className="text-slate-400 font-normal">Command Center</span>
            </h2>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-3">
            <span>LOCATION: Floor 7, 4 Irving Plaza</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={10} className="text-red-400 animate-spin" />
              <span>ELAPSED: {formatElapsed(elapsedSeconds)}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => {
              setElapsedSeconds(0);
              onLogEvent("FSD manually reset the incident elapsed timer.");
            }}
            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-300 font-bold text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"
            id="btn-fsd-reset-timer"
          >
            <RefreshCw size={12} className="text-amber-500" />
            RESET TIMER
          </button>
          <button
            onClick={onToggleStairB}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold border transition-all ${
              stairBBlocked
                ? "bg-yellow-950 text-yellow-400 border-yellow-700"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-755"
            }`}
          >
            {stairBBlocked ? "⚠️ BLOCK STAIR C (ACTIVE)" : "BLOCK STAIR C"}
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Confirm: Declare situation 100% CLEAR? This resolves current drill logs.",
                )
              ) {
                onClearIncident();
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 text-white font-bold text-sm py-1.5 px-4 rounded-lg flex items-center gap-1 transition-all active:scale-95"
          >
            <CheckCircle size={13} />
            DECLARE CLEAR
          </button>
        </div>
      </div>

      {/* Main Panel Content (Grid layout) */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-5 overflow-hidden">
        {/* PANEL 1: SITUATION RECON & CHECKLIST (3 Columns) */}
        <div className="xl:col-span-3 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-3.5 flex flex-col justify-between overflow-y-auto no-scrollbar">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Emergency Hazard
                </span>
                <Flame className="text-red-500 animate-pulse" size={14} />
              </div>
              <p className="text-base font-bold text-slate-100 uppercase font-sans">
                OFFICE FIRE IN NE SECTOR
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Floor 7 Breakroom, electrical box failure.
              </p>
            </div>

            <div className="border-t border-slate-850 pt-3">
              <h4 className="text-[11px] font-mono tracking-widest text-slate-300 uppercase mb-2">
                NYC LL26 Action Matrix
              </h4>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-900/40 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklist(item.id)}
                      className="mt-0.5 accent-amber-500 border-slate-700"
                    />
                    <span
                      className={`text-[10.5px] leading-tight ${item.done ? "line-through text-slate-500" : "text-slate-300"}`}
                    >
                      {item.task}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* NYC F-89 Command & Delegation Dispatch Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 mt-4 text-[10.5px] flex flex-col gap-2.5 shadow-md">
            <div>
              <span className="font-bold text-amber-500 flex items-center gap-1 uppercase text-[11px] mb-0.5">
                <AlertTriangle
                  size={12}
                  className="text-amber-500 animate-pulse"
                />{" "}
                F-89 Directive Dispatcher
              </span>
              <p className="text-[9.5px] text-slate-400 font-mono">
                NYC Local Law 26 Emergency Regulation Protocols
              </p>
            </div>

            {/* Current Active Broad Cast Display */}
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-850/80">
              <span className="text-[8px] font-mono tracking-wider uppercase text-slate-500 block">
                Current Active Broadcast:
              </span>
              <p className="text-slate-200 font-medium text-[10px] leading-tight mt-1">
                {activeDirective}
              </p>
            </div>

            {/* Warden Acknowledgement Pipeline */}
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-850/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-mono tracking-wider uppercase text-slate-400 font-bold flex items-center gap-1">
                  <Radio size={9} className="text-amber-500" /> Warden
                  Acknowledgement Pipeline
                </span>
                <span
                  className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    ackCount === 4
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-amber-950 text-amber-400"
                  }`}
                >
                  {ackCount}/4 ACK
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1.5 text-[7px] font-mono">
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{" "}
                  Sent
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{" "}
                  Delivered
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
                  Acknowledged
                </span>
              </div>
              <div className="space-y-1">
                {WARDEN_SECTORS.map((s) => {
                  const stage = ackStage[s] ?? 0;
                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="w-5 text-[9px] font-mono font-bold text-slate-400">
                        {s}
                      </span>
                      <div className="flex-1 flex items-center">
                        <span
                          className="w-2 h-2 rounded-full bg-amber-400"
                          title="Sent"
                        />
                        <span
                          className={`flex-1 h-0.5 ${stage >= 1 ? "bg-blue-400" : "bg-slate-800"}`}
                        />
                        <span
                          className={`w-2 h-2 rounded-full ${stage >= 1 ? "bg-blue-400" : "bg-slate-700"}`}
                          title="Delivered"
                        />
                        <span
                          className={`flex-1 h-0.5 ${stage >= 2 ? "bg-emerald-400" : "bg-slate-800"}`}
                        />
                        <span
                          className={`w-2 h-2 rounded-full ${stage >= 2 ? "bg-emerald-400" : "bg-slate-700"}`}
                          title="Acknowledged"
                        />
                      </div>
                      <span
                        className={`text-[7.5px] font-mono font-bold w-9 text-right ${
                          stage >= 2
                            ? "text-emerald-400"
                            : stage >= 1
                              ? "text-blue-400"
                              : "text-amber-400"
                        }`}
                      >
                        {stage >= 2 ? "ACK ✓" : stage >= 1 ? "DLVR" : "SENT"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Dispatch Presets */}
            <div className="space-y-1">
              <span className="text-[8.5px] font-mono uppercase text-slate-400 block font-bold">
                Standard Reg Presets:
              </span>
              <div className="grid grid-cols-1 gap-1">
                {[
                  {
                    title: "Buffer Relocation Directive",
                    text: "Phase 1 Relocation: Clear NE and SE occupants to NW safe zones immediately. Wardens secure landings.",
                  },
                  {
                    title: "Whole Floor Evacuation",
                    text: "Phase 2 Evacuation: Whole pilot floor evacuation declared. Proceed to designated safety exits.",
                  },
                  {
                    title: "Stairwell C Congestion/Blocked",
                    text: "Emergency Alert: Stair C (East 14th St) reported congested or blocked. All floor occupants divert to primary Stair A.",
                  },
                  {
                    title: "BLE Blackout Mesh Routing",
                    text: "BLE Mesh Sync Active: Switch tablet sync to local Mesh bypass. Log security tag keys at Stairwell nodes.",
                  },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onDispatchDirective(preset.text);
                    }}
                    className="w-full text-left bg-slate-950 hover:bg-slate-850 border border-slate-850/60 hover:border-slate-705 p-1.5 rounded text-[9.5px] font-mono text-slate-300 transition-all truncate block cursor-pointer"
                    title={preset.text}
                  >
                    ⚡{" "}
                    <span className="font-bold text-amber-500">
                      {preset.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Directive Input form */}
            <div className="pt-1.5 border-t border-slate-850">
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
                className="flex gap-1"
              >
                <input
                  type="text"
                  name="custom_directive"
                  placeholder="Custom F-89 protocol..."
                  className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[10px] text-slate-200 placeholder:text-slate-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-550 border border-amber-500/20 text-slate-950 px-2 py-1 rounded font-mono font-bold text-[9px] uppercase tracking-wider shrink-0 cursor-pointer"
                >
                  DISPATCH
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* PANEL 2: MAP & DYNAMIC REROUTING (4 Columns) */}
        <div className="xl:col-span-5 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-3.5 flex flex-col overflow-hidden">
          <FloorMap
            occupants={occupants}
            stairBBlocked={stairBBlocked}
            onToggleStairB={onToggleStairB}
            onOccupantClick={(occ) => handleUnsealFsd(occ.id)}
            selectedQuadrant={locatorSector === "ALL" ? null : locatorSector}
            onQuadrantClick={(quad) => {
              setLocatorSector(quad as any);
              setLocatorPage(1);
            }}
          />
        </div>

        {/* PANEL 3: HEADCOUNT & DYNAMIC LOCATOR BOARD */}
        <div className="xl:col-span-4 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-3.5 flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header Telemetry */}
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-sm font-mono tracking-wider text-slate-300 uppercase font-bold flex items-center gap-1">
                <MapPin size={12} className="text-amber-500 animate-pulse" />
                <span>Headcount & Locator</span>
              </h3>
              <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-lg font-mono font-medium">
                {occupants.filter((o) => o.status === "ACCOUNTED").length} /{" "}
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
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[10.5px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Category tabs */}
            <div className="grid grid-cols-3 gap-1 mb-2 bg-slate-900/40 p-1 rounded-xl border border-slate-850 shrink-0 select-none">
              {(["ALL", "AT_RISK", "ACCOUNTED"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setLocatorTab(tab);
                    setLocatorPage(1);
                  }}
                  className={`py-1 text-[9px] font-mono font-bold rounded-lg transition-all ${
                    locatorTab === tab
                      ? tab === "AT_RISK"
                        ? "bg-red-950/60 text-red-400 border border-red-900/40"
                        : tab === "ACCOUNTED"
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40"
                          : "bg-slate-800 text-white border border-slate-700"
                      : "text-slate-400 hover:text-slate-250 cursor-pointer"
                  }`}
                >
                  {tab === "ALL"
                    ? "ALL ROSTER"
                    : tab === "AT_RISK"
                      ? "MIA/AT RISK"
                      : "ACCOUNTED"}
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
                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono leading-none border transition-all ${
                      locatorSector === sect
                        ? "bg-amber-955 text-amber-400 border-amber-800 font-bold"
                        : "bg-slate-900/80 text-slate-500 border-slate-850/80 hover:text-slate-300 cursor-pointer"
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
                        ? "bg-slate-900 border-amber-500/70 shadow-lg"
                        : o.status === "MEDICAL"
                          ? "bg-red-950/20 border-red-900/50 hover:bg-red-900/10"
                          : o.status === "ARA_STAGING"
                            ? "bg-blue-950/20 border-blue-900/40 hover:bg-blue-900/10"
                            : o.status === "ACCOUNTED"
                              ? "bg-emerald-950/15 border-emerald-900/30 hover:bg-emerald-900/10"
                              : "bg-slate-900/40 border-slate-850 hover:bg-slate-850/50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex gap-2">
                        <div className="mt-1 shrink-0">
                          <span className={`relative flex h-2 w-2`}>
                            {o.status !== "ACCOUNTED" && (
                              <span
                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                  o.status === "MEDICAL"
                                    ? "bg-red-400"
                                    : "bg-blue-400"
                                }`}
                              />
                            )}
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${
                                o.status === "ACCOUNTED"
                                  ? "bg-emerald-500"
                                  : o.status === "MEDICAL"
                                    ? "bg-red-500"
                                    : o.status === "ARA_STAGING"
                                      ? "bg-blue-400"
                                      : "bg-slate-500"
                              }`}
                            />
                          </span>
                        </div>

                        <div>
                          <div className="text-[11px] font-bold font-mono text-slate-200 flex flex-wrap items-center gap-1">
                            <span>
                              {unsealedTokenId === o.id && unsealedDetails
                                ? unsealedDetails.name
                                : o.nameEncrypted}
                            </span>
                            <span className="text-[8px] text-slate-500 bg-slate-950 px-1 py-0.2 rounded font-normal font-mono border border-slate-850 uppercase">
                              {o.id}
                            </span>
                          </div>

                          <div className="text-[9px] text-slate-400 font-mono mt-0.5 leading-tight">
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
                        className={`text-[8px] font-mono font-bold leading-tight px-1.5 py-0.5 rounded border flex items-center gap-0.5 transition-all cursor-pointer ${
                          unsealedTokenId === o.id
                            ? "bg-yellow-600 text-slate-950 border-yellow-500"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
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
                      <div className="mt-2 bg-slate-950/80 p-2 rounded-lg border border-amber-600/30 text-[9.5px] font-mono space-y-1 animate-fadeIn">
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
                              className="w-8 h-8 rounded object-cover border border-slate-800 bg-slate-900 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-amber-400 font-bold font-sans text-[10px] leading-tight">
                                {unsealedDetails.name}{" "}
                                <span className="text-[7.5px] text-slate-500 font-mono">
                                  {unsealedDetails.role}
                                </span>
                              </p>
                              <p className="text-slate-400 text-[8.5px] mt-0.5 truncate">
                                Dept: {unsealedDetails.department}
                              </p>
                              <p className="text-slate-400 text-[8.5px] truncate">
                                Phone: {unsealedDetails.phone}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-red-400">
                            Authorization link timed out.
                          </p>
                        )}
                      </div>
                    )}

                    {o.alertNote && (
                      <div className="mt-1 bg-slate-950/40 px-1.5 py-0.5 rounded text-[8.5px] text-amber-300 italic line-clamp-1 border border-slate-900">
                        “{o.alertNote}”
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-1 text-[8px] font-mono text-slate-500">
                      <span>Last Seen log: {o.lastSeen}</span>
                      <span>Stairwell: {o.staircase || "Unverified"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 font-mono text-[9.5px] border border-dashed border-slate-850 rounded-xl">
                  No personnel matching this filter.
                </div>
              )}
            </div>

            {/* Pagination Panel (Click Page after Page) */}
            <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1.5 rounded-xl border border-slate-850 mt-2.5 shrink-0 select-none">
              <button
                disabled={activeLocatorPage === 1}
                onClick={() => setLocatorPage((prev) => Math.max(1, prev - 1))}
                className="text-[9px] font-mono bg-slate-950 hover:bg-slate-800 text-slate-350 border border-slate-800 px-2 py-1 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-slate-950 cursor-pointer flex items-center gap-0.5"
              >
                <ChevronLeft size={10} />
                <span>PREV</span>
              </button>

              <span className="text-[9px] font-mono text-slate-400">
                PAGE{" "}
                <span className="text-amber-400 font-bold">
                  {activeLocatorPage}
                </span>{" "}
                OF <span className="text-slate-200">{maxPage}</span>
              </span>

              <button
                disabled={activeLocatorPage === maxPage}
                onClick={() =>
                  setLocatorPage((prev) => Math.min(maxPage, prev + 1))
                }
                className="text-[9px] font-mono bg-slate-950 hover:bg-slate-800 text-slate-350 border border-slate-800 px-2 py-1 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-slate-950 cursor-pointer flex items-center gap-0.5"
              >
                <span>NEXT</span>
                <ChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Compliance generation */}
          <div className="border-t border-slate-850 pt-3 mt-3 shrink-0">
            <button
              onClick={generateFdnyReport}
              className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <FileText size={14} className="text-amber-500" />
              GENERATE PRE-ARRIVAL FDNY REPORT
            </button>
          </div>
        </div>
      </div>

      {/* Down Layer bento expansions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-5">
        {/* EH&S DISCOVERY & DEVELOPMENT ROADMAP (6 Columns) */}
        <div className="xl:col-span-6 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-4 flex flex-col h-[320px] overflow-hidden justify-between">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header Telemetry */}
            <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-2 shrink-0 select-none">
              <div className="flex items-center gap-1.5">
                <Layers className="text-amber-500 animate-pulse" size={13} />
                <span className="text-sm font-bold tracking-tight text-slate-200">
                  EH&S FEASIBILITY DISCOVERY ROADMAP
                </span>
              </div>
              <span className="text-[8px] bg-indigo-950/80 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                6-WEEK DRILL LIFE-CYCLE
              </span>
            </div>

            {/* Three-tab progress selector */}
            <div className="grid grid-cols-3 gap-1 mb-2 bg-slate-900/50 p-1 rounded-xl border border-slate-850/80 shrink-0 select-none">
              {(["RESEARCH", "MOCKUPS", "BUILD"] as const).map((tab) => {
                // Compute tab progress percentage
                const tabTasks = ROADMAP_ITEMS[tab];
                const completedCount = tabTasks.filter(
                  (t) => completedRoadmap[t.key],
                ).length;
                const tabPct = Math.round(
                  (completedCount / tabTasks.length) * 100,
                );

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setRoadmapTab(tab);
                      if (tab === "RESEARCH") setActiveTaskKey("interview");
                      if (tab === "MOCKUPS") setActiveTaskKey("feature_list");
                      if (tab === "BUILD") setActiveTaskKey("dev_env");
                      onLogEvent(`EH&S Roadmap switched to: ${tab}`);
                    }}
                    className={`py-1 text-[8.5px] font-mono font-bold rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center ${
                      roadmapTab === tab
                        ? "bg-amber-600 text-slate-950 shadow font-extrabold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>
                      {tab === "RESEARCH"
                        ? "W1-W2 STUDY"
                        : tab === "MOCKUPS"
                          ? "W2 DESIGN"
                          : "W3-W4 SPRINT"}
                    </span>
                    <span
                      className={`text-[7px] font-mono ${roadmapTab === tab ? "text-slate-900" : "text-amber-500/80"}`}
                    >
                      {tabPct}% DONE
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content: Task List on Left, Active Task details on Right (Interactive Page view) */}
            <div className="flex-1 grid grid-cols-12 gap-2.5 overflow-hidden">
              {/* Task Cards Left List */}
              <div className="col-span-5 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                {ROADMAP_ITEMS[roadmapTab].map((t) => {
                  const isDone = !!completedRoadmap[t.key];
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        setActiveTaskKey(t.key);
                      }}
                      className={`text-left p-1.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-start select-none relative overflow-hidden ${
                        activeTaskKey === t.key
                          ? "bg-slate-900 border-amber-500/65 shadow-md text-amber-300"
                          : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        {isDone ? (
                          <CheckCircle
                            className="text-emerald-500 shrink-0"
                            size={10}
                          />
                        ) : (
                          <Clock
                            className="text-slate-500 shrink-0 animate-pulse"
                            size={10}
                          />
                        )}
                        <span className="text-[10px] font-semibold font-sans leading-tight truncate flex-1">
                          {t.title}
                        </span>
                      </div>

                      <div className="flex justify-between items-center w-full mt-1">
                        <span className="text-[7.5px] font-mono text-slate-500 truncate max-w-[70px]">
                          {t.subtitle}
                        </span>
                        <span
                          className={`text-[7px] font-mono font-bold px-1 rounded uppercase ${
                            isDone
                              ? "bg-emerald-950/60 text-emerald-400"
                              : "bg-amber-950/60 text-amber-500"
                          }`}
                        >
                          {isDone ? "VERIFIED" : "PENDING"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Task Details Right Panel */}
              {(() => {
                const currentTask =
                  ROADMAP_ITEMS[roadmapTab].find(
                    (t) => t.key === activeTaskKey,
                  ) || ROADMAP_ITEMS[roadmapTab][0];
                const isTaskDone = !!completedRoadmap[currentTask.key];
                return (
                  <div className="col-span-7 bg-slate-950/60 rounded-xl border border-slate-900 p-2.5 flex flex-col justify-between overflow-y-auto no-scrollbar font-mono text-[9px] text-slate-400">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-amber-400 font-bold text-[10px] leading-tight font-sans truncate">
                          {currentTask.title}
                        </span>
                        <span className="text-[7.5px] text-slate-500 border border-slate-800 bg-slate-905 px-1 rounded truncate max-w-[90px] shrink-0">
                          {currentTask.location}
                        </span>
                      </div>

                      <p className="text-[8.5px] text-slate-350 leading-relaxed font-sans">
                        {currentTask.desc}
                      </p>
                    </div>

                    <div className="border-t border-slate-900 pt-1.5 mt-2 space-y-1.5">
                      <div className="flex justify-between items-center text-[7.5px] text-slate-500">
                        <span className="truncate max-w-[110px]">
                          ASSIGNED: {currentTask.assigned}
                        </span>
                        <span className="text-amber-500/70 font-semibold animate-pulse shrink-0">
                          ● OUTCOME
                        </span>
                      </div>

                      <div className="bg-slate-900/40 p-1.5 rounded border border-slate-850 text-slate-200 text-[8.5px] leading-tight font-sans italic">
                        {currentTask.outcome}
                      </div>

                      {/* Interactive toggle block */}
                      <button
                        onClick={() => handleToggleRoadmapTask(currentTask.key)}
                        className={`w-full py-1 rounded font-sans text-[9px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-97 select-none ${
                          isTaskDone
                            ? "bg-emerald-950/40 hover:bg-emerald-950/60 text-emerald-400 border-emerald-900/60"
                            : "bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-500"
                        }`}
                      >
                        {isTaskDone ? (
                          <>
                            <CheckCircle size={10} />
                            <span>APPROVED (CLICK TO RE-OPEN)</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} fill="currentColor" />
                            <span>APPROVE & VERIFY TARGET DELIVERABLE</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* AUDIT TIMELINE LEDGER SECURE HASH-CHAINING (6 Columns) */}
        <div className="xl:col-span-6 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-4 flex flex-col h-[320px]">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Database className="text-amber-500" size={15} />
              <span className="text-sm font-bold tracking-tight text-slate-200">
                HASH-CHAINED SECURE AUDIT LEDGER
              </span>
            </div>
            {ledgerIntegrity.verified ? (
              <span className="text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-0.5">
                <ShieldCheck size={9} /> INTEGRITY 100% PASS
              </span>
            ) : (
              <span className="text-[8px] bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 animate-pulse">
                <ShieldX size={9} /> LEDGER TAMPERED!
              </span>
            )}
          </div>

          {/* Ledger block list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 text-[10px] pr-1 font-mono text-slate-400 no-scrollbar">
            {ledger.map((b) => (
              <div
                key={b.index}
                className={`p-2 rounded-xl border flex flex-col gap-1 transition-all ${
                  isLedgerTampered && b.index === 1
                    ? "bg-red-950/20 border-red-500/50 text-red-300 animate-pulse"
                    : "bg-slate-900/30 border-slate-850"
                }`}
              >
                <div className="flex justify-between items-center text-[9px] pb-1 border-b border-slate-850/60 font-bold uppercase tracking-wide">
                  <span>Block #{b.index}</span>
                  <span className="text-slate-500 text-[8px]">
                    {b.timestamp}
                  </span>
                </div>
                <div className="text-[10px] text-slate-350 py-0.5">
                  Event:{" "}
                  <span className="font-sans text-slate-200">{b.event}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[8px] mt-1 pt-1 border-t border-slate-850/30">
                  <span className="truncate text-slate-500">
                    Prev: {b.prevHash}
                  </span>
                  <span
                    className={`truncate text-right ${isLedgerTampered && b.index === 1 ? "text-red-400 font-bold" : "text-slate-500"}`}
                  >
                    Hash: <span className="text-gray-400">{b.hash}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Hashing Ledger attack buttons */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-850">
            <button
              onClick={onTamperLedger}
              disabled={isLedgerTampered}
              className="bg-red-950/50 hover:bg-red-900/40 border border-red-900 text-red-200 text-[10px] font-bold py-1.5 rounded-xl transition-all disabled:opacity-40"
            >
              👿 SIMULATE LEDGER ATTACK (TAMPER BLOCK #1)
            </button>
            <button
              onClick={onResetLedger}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[10px] py-1.5 rounded-xl transition-all"
            >
              🔄 SECURE RESYNC & COMPROMISE ARREST
            </button>
          </div>
        </div>
      </div>

      {/* Pop up generated PDF Compliance report view */}
      {fdnyReport ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col h-[520px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-200">
                Legal Compliance Pre-Arrival Report
              </h3>
              <button
                onClick={() => setFdnyReport(null)}
                className="text-sm bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white px-2 py-1 rounded"
              >
                Close Report
              </button>
            </div>

            <pre className="flex-1 bg-slate-950 text-slate-300 p-4 rounded-xl font-mono text-[9px] leading-relaxed overflow-auto border border-slate-850 select-text">
              {fdnyReport}
            </pre>

            <div className="mt-4 flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>
                Ready for print output (FDNY handover time limit: &lt;5 mins)
              </span>
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-slate-800 hover:bg-slate-755 text-slate-200 text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-700"
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
