import React, { useState, useEffect } from "react";
import { INITIAL_OCCUPANTS, SEED_LEDGER, MUSTER_ZONES } from "./data";
import { Occupant, LedgerBlock } from "./types";
import { clientSHA256, createNextBlock, sanitizeText } from "./utils";
import OccupantMobile from "./components/OccupantMobile";
import WardenTablet from "./components/WardenTablet";
import FSDCommandCenter from "./components/FSDCommandCenter";
import { ShieldCheck, Eye, EyeOff, Radio, Lock, RefreshCw, AlertOctagon, Activity, Grid, Maximize2, Minimize2, Smartphone, Tablet, Monitor } from "lucide-react";

export default function App() {
  // Occupants roster (Tokenized at Rest)
  const [occupants, setOccupants] = useState<Occupant[]>(INITIAL_OCCUPANTS);
  // Hash-Chained ledger
  const [ledger, setLedger] = useState<LedgerBlock[]>(SEED_LEDGER);

  // View mode switcher: ALL (Split screen), OCCUPANT, WARDEN, FSD
  const [viewMode, setViewMode] = useState<"ALL" | "OCCUPANT" | "WARDEN" | "FSD">("ALL");
  
  // Incident Master Operations
  const [isBlackout, setIsBlackout] = useState(false);
  const [stairBBlocked, setStairBBlocked] = useState(false);
  const [isLedgerTampered, setIsLedgerTampered] = useState(false);
  
  // NYC F-89 Emergency Broadcast Directive State
  const [activeDirective, setActiveDirective] = useState<string>("Phase 1 Evacuation: NE Office Fire hazard detected. NW and SE core team wardens sweep stairwells. Reroute SW occupants via Stair A.");

  const handleDispatchDirective = async (newDirective: string) => {
    setActiveDirective(newDirective);
    logEvent(`[F-89 FLSD Dispatch] Broadcasted new protocol: "${newDirective}"`);
    
    // Log directive to the cryptographic ledger chain
    const lastBlock = ledger[ledger.length - 1];
    const newBlock = await createNextBlock(lastBlock, ledger.length, `FSD BROADCAST DIRECTIVE: ${newDirective}`);
    setLedger(prev => [...prev, newBlock]);
  };
  
  // Ledger chain verification state
  const [ledgerIntegrity, setLedgerIntegrity] = useState<{ verified: boolean; auditLogs: string[] }>({
    verified: true,
    auditLogs: ["Roster chain intact."]
  });

  // Mesh queues (caches updates during blackout to sync later)
  const [meshQueue, setMeshQueue] = useState<Array<{
    id: string;
    status: Occupant["status"];
    zone?: string;
    note?: string;
    fallDetected?: boolean;
    timestamp: string;
    hmacSignature: string;
  }>>([]);

  // Dynamic system events log console represented at bottom of screen
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[System Initialization] MusterCommand life safety database successfully bootstrapped.",
    `[Compliance Log] Sandbox active simulating Floor 7 Pilot coordinates at 4 Irving Plaza.`,
    "[Hash Tokenizer] Dynamic 5-Layer Defense encryption keys rotational loop active."
  ]);

  const logEvent = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${ts}] ${msg}`, ...prev.slice(0, 31)]);
  };

  // Cryptographic Ledger chain verifier (Section 5 Layer 4)
  const verifyChain = async (blocks: LedgerBlock[]) => {
    let isValid = true;
    const errors: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      // Recalculate block hash exactly as computed by server
      const content = b.index + b.timestamp + b.event + b.prevHash;
      const computedHash = await clientSHA256(content);

      if (computedHash !== b.hash) {
        isValid = false;
        errors.push(`Block #${i} tampered! Computed hash: ${computedHash.substring(0, 12)}..., stored: ${b.hash.substring(0, 12)}...`);
        break; // break early on mismatch
      }

      if (i > 0) {
        if (b.prevHash !== blocks[i - 1].hash) {
          isValid = false;
          errors.push(`Chain broken at Block #${i}. prevHash link disconnected.`);
          break;
        }
      }
    }

    setLedgerIntegrity({
      verified: isValid,
      auditLogs: errors.length > 0 ? errors : ["Ledger chain verified via SHA-256. Cryptographic integrity certified."]
    });
  };

  // Run audit chain verification every time the ledger state changes
  useEffect(() => {
    verifyChain(ledger);
  }, [ledger]);

  // Sync mesh queue automatically when network comes back online
  useEffect(() => {
    if (!isBlackout && meshQueue.length > 0) {
      logEvent(`Cloud coverage restored! Syncing ${meshQueue.length} queued HMAC BLE packets securely to centralized Firestore ledger...`);
      
      const processQueue = async () => {
        let currentLedgerState = [...ledger];
        let currentOccupantsState = [...occupants];

        for (const item of meshQueue) {
          // Update status in central roster
          currentOccupantsState = currentOccupantsState.map(o => o.id === item.id ? {
            ...o,
            status: item.status,
            musterZone: item.zone as any,
            alertNote: sanitizeText(item.note || ""),
            fallDetected: item.fallDetected,
            lastSeen: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          } : o);

          // Append check-in log to chain
          const lastBlock = currentLedgerState[currentLedgerState.length - 1];
          const newBlock = await createNextBlock(
            lastBlock,
            currentLedgerState.length,
            `Mesh Synced Block: token ${item.id} logged status ${item.status}. Zone: ${item.zone || "Zone A"}. HMAC verified: ${item.hmacSignature.substring(0, 12)}`
          );
          currentLedgerState.push(newBlock);
        }

        setOccupants(currentOccupantsState);
        setLedger(currentLedgerState);
        setMeshQueue([]);
        logEvent(`P2P Sync successful. All cached operations incorporated into cryptographic ledger.`);
      };

      processQueue();
    }
  }, [isBlackout, meshQueue]);

  // Master handler updating occupant properties
  const updateOccupantStatus = async (
    id: string,
    status: Occupant["status"],
    zone?: string,
    note?: string,
    fallDetected?: boolean
  ) => {
    const timestampString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isBlackout) {
      // Offline Mesh Mode: HMAC Packet verification
      const rawText = id + status + (zone || "") + (note || "") + String(fallDetected);
      const hmacSignature = await clientSHA256(rawText + "BT_SECURE_HMAC_SECRET_KEY");
      
      setMeshQueue(prev => [...prev, {
        id,
        status,
        zone,
        note,
        fallDetected,
        timestamp: timestampString,
        hmacSignature
      }]);

      setOccupants(prev => prev.map(o => o.id === id ? {
        ...o,
        status,
        musterZone: zone as any,
        alertNote: note,
        fallDetected,
        lastSeen: timestampString
      } : o));

      logEvent(`Offline. HMAC packet signed [${hmacSignature.substring(0, 8)}] & enqueued for token ${id}.`);
    } else {
      // Standard Online Flow: Write direct block onto Ledger Chain (Section 2/5)
      setOccupants(prev => prev.map(o => o.id === id ? {
        ...o,
        status,
        musterZone: zone as any,
        alertNote: note,
        fallDetected,
        lastSeen: timestampString
      } : o));

      const lastBlock = ledger[ledger.length - 1];
      const logMsg = `Security Check-in: token ${id} status: ${status}. Zone: ${zone || "Zone A"}. note: "${note || "none"}".`;
      const newBlock = await createNextBlock(lastBlock, ledger.length, logMsg);
      
      setLedger(prev => [...prev, newBlock]);
      logEvent(`Online. Added hash Block #${newBlock.index} for token ${id}.`);
    }
  };

  // Malicious ledger tampering (Section 8.3 & Section 5 compliance Demo)
  const tamperLedgerChain = () => {
    setIsLedgerTampered(true);
    setLedger(prev => prev.map(b => b.index === 1 ? {
      ...b,
      event: "MALICIOUS TAMPER: Token usr_a7f8c9d1 changed check-in state parameters without key."
    } : b));
    logEvent("⚠️ WARNING: Local database altered maliciously. Block #1 event parameters compromised.");
  };

  // Restore chain / arrest tamper
  const resyncLedgerChain = async () => {
    setIsLedgerTampered(false);
    // Fully restore pristine seed ledger checks
    setLedger(SEED_LEDGER);
    logEvent("🔐 Security Sync active. Centralised Vault cryptographic records pulled over TLS 1.3. Tamper arrested.");
  };

  // Reset/Declare Clear (Section 8.3 wireframe action)
  const clearIncident = () => {
    setOccupants(INITIAL_OCCUPANTS);
    setLedger(SEED_LEDGER);
    setMeshQueue([]);
    setStairBBlocked(false);
    setIsLedgerTampered(false);
    setActiveDirective("Phase 1 Evacuation: NE Office Fire hazard detected. NW and SE core team wardens sweep stairwells. Reroute SW occupants via Stair A.");
    logEvent("🟢 Fire safety declared CLEAR. Drill successfully closed. Metrics archived.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      
      {/* Master Pilot Header banner */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-600/10 border border-orange-500/20 text-orange-500">
                <Radio className="animate-spin text-orange-400" size={18} />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
                  MusterCommand
                  <span className="text-[10px] font-mono tracking-widest bg-slate-800 text-slate-300 font-bold border border-slate-700 px-1.5 py-0.2 rounded">
                    PHASE 1 - FLOOR 7 PILOT
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  ConEdison Headcount Operating System • FOSS Dockerized Pilot Platform Model 9.0
                </p>
              </div>
            </div>
          </div>

          {/* Master Controller Dashboard Toggles */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            
            {/* Blackout toggle */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs w-full sm:w-auto">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider pl-1.5 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isBlackout ? "bg-yellow-500 animate-pulse" : "bg-emerald-500"}`} />
                <span>Simulation Mesh Blackout</span>
              </span>
              <button
                onClick={() => {
                  setIsBlackout(!isBlackout);
                  logEvent(isBlackout ? "Online sync restored. Defaulting 5G/Wi-Fi router links." : "BLACKOUT TRIGGERED. Defaulting communications safely to local BLE Mesh.");
                }}
                className={`ml-2 px-3 py-1 rounded font-mono font-bold text-[10px] transition-all uppercase ${
                  isBlackout 
                    ? "bg-yellow-600 text-slate-950" 
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {isBlackout ? "Active" : "Trigger Blackout"}
              </button>
            </div>

            {/* Static Vault rotation panel */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950/60 font-mono text-[9px] text-slate-500 px-3 py-2 rounded-xl border border-slate-800/80 select-none">
              <Lock size={10} className="text-emerald-500" />
              <span>VAULT RE-ENCRYPTION KEY ROTATING</span>
            </div>

          </div>

        </div>
      </header>

      {/* Central Interactive View Switcher Toolbar - Let users press and go in each */}
      <div className="bg-slate-900/85 border-b border-slate-800/80 py-3 px-4 sticky top-[73px] z-20 backdrop-blur-md select-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-amber-500 font-bold">👁️ SELECT PERSPECTIVE:</span>
            <span className="hidden md:inline">Click any option or card header below to focus full screen:</span>
          </div>
          
          <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex items-center gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setViewMode("ALL");
                logEvent("Switched View Layout to: Multi-View Split Desk Grid.");
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-[9.5px] tracking-wider transition-all uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${
                viewMode === "ALL"
                  ? "bg-amber-600 text-slate-950 font-extrabold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Grid size={11} />
              <span>Split Grid</span>
            </button>

            <button
              onClick={() => {
                setViewMode("OCCUPANT");
                logEvent("Maximized viewpoint to View A: Occupant Handheld Phone.");
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-[9.5px] tracking-wider transition-all uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${
                viewMode === "OCCUPANT"
                  ? "bg-amber-600 text-slate-950 font-extrabold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Smartphone size={11} />
              <span>Occupant Handheld</span>
            </button>

            <button
              onClick={() => {
                setViewMode("WARDEN");
                logEvent("Maximized viewpoint to View B: Warden Tablet NW.");
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-[9.5px] tracking-wider transition-all uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${
                viewMode === "WARDEN"
                  ? "bg-amber-600 text-slate-950 font-extrabold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Tablet size={11} />
              <span>Warden Tablet</span>
            </button>

            <button
              onClick={() => {
                setViewMode("FSD");
                logEvent("Maximized viewpoint to View C: Command Station Deck.");
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-[9.5px] tracking-wider transition-all uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${
                viewMode === "FSD"
                  ? "bg-amber-600 text-slate-950 font-extrabold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Monitor size={11} />
              <span>Command Deck</span>
            </button>
          </div>
        </div>
      </div>

      {/* Roster alerts and Blackout warning */}
      {isBlackout && (
        <div className="bg-yellow-905 border-b border-yellow-800 text-yellow-500 p-2.5 text-center text-[10px] font-mono leading-relaxed tracking-wider animate-pulse font-semibold">
          ⚠️ BLACKOUT ACTIVE: ALL SIGNALS FALL BACK SATELLITE FREE TO BLE MESH LOCAL CRYPTOGRAPHIC TRANSACTIONS.
        </div>
      )}

      {/* Main Grid Viewport holding Occupant, Warden and FSD views altogether */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        
        {/* The Tri-Panel grid alignment */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 1. OCCUPANT (Phone View) */}
          {(viewMode === "ALL" || viewMode === "OCCUPANT") && (
            <section className={`${viewMode === "OCCUPANT" ? "col-span-12 max-w-sm md:max-w-md mx-auto w-full" : "lg:col-span-3"} flex flex-col gap-2 transition-all duration-300`}>
              <div 
                onClick={() => {
                  const next = viewMode === "OCCUPANT" ? "ALL" : "OCCUPANT";
                  setViewMode(next);
                  logEvent(next === "ALL" ? "Returned to Split Desk." : "Maximized View A: Occupant Handheld.");
                }}
                className="flex items-center justify-between px-2.5 bg-slate-900 border border-slate-800 p-1.5 rounded-xl font-mono text-[9px] text-slate-400 uppercase tracking-widest mb-1 select-none cursor-pointer hover:bg-slate-850 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-1.5">
                  <Smartphone size={11} className="text-amber-500" />
                  <span>View A: Occupant Handheld</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-bold">
                  {viewMode === "OCCUPANT" ? (
                    <>
                      <Minimize2 size={9} />
                      <span>MINIMIZE</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={9} className="group-hover:scale-110 transition-transform" />
                      <span>PRESS & ENTER</span>
                    </>
                  )}
                </div>
              </div>
              <OccupantMobile
                occupant={occupants[2]} // Alice Smith
                isBlackout={isBlackout}
                onUpdateStatus={updateOccupantStatus}
                stairBBlocked={stairBBlocked}
                activeDirective={activeDirective}
              />
            </section>
          )}

          {/* 2. WARDEN (Tablet View) */}
          {(viewMode === "ALL" || viewMode === "WARDEN") && (
            <section className={`${viewMode === "WARDEN" ? "col-span-full" : "lg:col-span-4"} flex flex-col gap-2 transition-all duration-300`}>
              <div 
                onClick={() => {
                  const next = viewMode === "WARDEN" ? "ALL" : "WARDEN";
                  setViewMode(next);
                  logEvent(next === "ALL" ? "Returned to Split Desk." : "Maximized View B: Warden Tablet.");
                }}
                className="flex items-center justify-between px-2.5 bg-slate-900 border border-slate-800 p-1.5 rounded-xl font-mono text-[9px] text-slate-400 uppercase tracking-widest mb-1 select-none cursor-pointer hover:bg-slate-850 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-1.5">
                  <Tablet size={11} className="text-amber-500" />
                  <span>View B: Warden Tablet (NW Sect)</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-bold">
                  {viewMode === "WARDEN" ? (
                    <>
                      <Minimize2 size={9} />
                      <span>MINIMIZE</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={9} className="group-hover:scale-110 transition-transform" />
                      <span>PRESS & ENTER</span>
                    </>
                  )}
                </div>
              </div>
              <WardenTablet
                occupants={occupants}
                isBlackout={isBlackout}
                onUpdateStatus={updateOccupantStatus}
                onLogEvent={logEvent}
                activeDirective={activeDirective}
              />
            </section>
          )}

          {/* 3. FSD (Desktop command) */}
          {(viewMode === "ALL" || viewMode === "FSD") && (
            <section className={`${viewMode === "FSD" ? "col-span-full" : "lg:col-span-5"} flex flex-col gap-2 transition-all duration-300`}>
              <div 
                onClick={() => {
                  const next = viewMode === "FSD" ? "ALL" : "FSD";
                  setViewMode(next);
                  logEvent(next === "ALL" ? "Returned to Split Desk." : "Maximized View C: Command Station Deck.");
                }}
                className="flex items-center justify-between px-2.5 bg-slate-900 border border-slate-800 p-1.5 rounded-xl font-mono text-[9px] text-slate-400 uppercase tracking-widest mb-1 select-none cursor-pointer hover:bg-slate-850 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-1.5">
                  <Monitor size={11} className="text-amber-500" />
                  <span>View C: Command Station Deck</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-bold">
                  {viewMode === "FSD" ? (
                    <>
                      <Minimize2 size={9} />
                      <span>MINIMIZE</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={9} className="group-hover:scale-110 transition-transform" />
                      <span>PRESS & ENTER</span>
                    </>
                  )}
                </div>
              </div>
              <FSDCommandCenter
                occupants={occupants}
                ledger={ledger}
                isBlackout={isBlackout}
                onClearIncident={clearIncident}
                onLogEvent={logEvent}
                stairBBlocked={stairBBlocked}
                onToggleStairB={() => {
                  setStairBBlocked(!stairBBlocked);
                  logEvent(stairBBlocked ? "Stair B blockage cleared. Wardens reporting free passage." : "Stair B blockage logged near NW landing! Bluetooth rerouting plan dispatched.");
                }}
                onTamperLedger={tamperLedgerChain}
                onResetLedger={resyncLedgerChain}
                isLedgerTampered={isLedgerTampered}
                ledgerIntegrity={ledgerIntegrity}
                activeDirective={activeDirective}
                onDispatchDirective={handleDispatchDirective}
              />
            </section>
          )}

        </div>

        {/* Real-time systems logs terminal under the dashboard grids */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-900 mb-3 text-xs font-mono">
            <span className="text-slate-400 font-bold uppercase tracking-widest text-[9.5px]">SYSTEMS LIFE-SAFETY LOGS CONSOLE</span>
            <span className="text-slate-500 text-[9px]">Continuous Cryptographic Audit Thread</span>
          </div>
          <div className="bg-black/40 rounded-xl max-h-[140px] overflow-y-auto p-3 font-mono text-[10px] text-slate-350 space-y-1 pr-1 border border-slate-900 no-scrollbar">
            {systemLogs.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-slate-600 select-none">&gt;</span>
                <span className={log.includes("WARNING") ? "text-red-400 font-bold animate-pulse" : ""}>{log}</span>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Humble, literal human copyright stamp of the dashboard deck */}
      <footer className="bg-slate-950 border-t border-slate-900 text-center py-4 text-[10px] text-slate-500 font-mono">
        <p>MusterCommand v9.0 • Free and Open Source (FOSS) • Sandboxed Parity Deployed over Cloud Run Platform</p>
      </footer>

    </div>
  );
}
