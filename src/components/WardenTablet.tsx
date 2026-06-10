import React, { useState, useEffect } from "react";
import { z } from "zod";
import { HardDrive, Search, ShieldAlert, Key, RefreshCw, UserCheck, AlertOctagon, Smartphone, Clock, Radio, QrCode, Camera, ScanLine } from "lucide-react";
import { Occupant } from "../types";
import { validateBadgeSyntax } from "../utils";

// Schema for manual scanner input
const scannerInputSchema = z.string().refine((val) => validateBadgeSyntax(val), {
  message: "Invalid badge syntax. Code pattern must match [A-Z]{2}\\d{6}."
});

interface WardenTabletProps {
  occupants: Occupant[];
  isBlackout: boolean;
  onUpdateStatus: (
    id: string,
    status: Occupant["status"],
    zone?: string,
    note?: string,
    fallDetected?: boolean
  ) => void;
  onLogEvent: (event: string) => void;
  activeDirective: string;
}

interface DecryptedProfile {
  name: string;
  role: string;
  photo: string;
  department: string;
  phone: string;
  verifiedAt: string;
}

export default function WardenTablet({
  occupants,
  isBlackout,
  onUpdateStatus,
  onLogEvent,
  activeDirective
}: WardenTabletProps) {
  const [badgeIdField, setBadgeIdField] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"MISSING" | "SAFE">("MISSING");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeScanMode, setActiveScanMode] = useState<"RFID" | "QR">("RFID");
  const [selectedQrUser, setSelectedQrUser] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  
  // Vault variables kept strictly in component RAM State (Nullified upon clear)
  const [decryptedProfile, setDecryptedProfile] = useState<DecryptedProfile | null>(null);
  const [decryptedToken, setDecryptedToken] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [autoClearTimer, setAutoClearTimer] = useState<number | null>(null);

  const setBadgeInputCombined = (pfx: string) => {
    setBadgeIdField(pfx);
  };

  // Keypad simulation inputs
  const handleKeypadPress = (val: string) => {
    setValidationError(null);
    if (val === "CLR") {
      setBadgeIdField("");
    } else if (val === "ENT") {
      simulateBadgeScan(badgeIdField);
    } else {
      if (badgeIdField.length < 8) {
        setBadgeIdField(prev => prev + val);
      }
    }
  };

  // Simulating NFC / Manual tap matching database keys
  const simulateBadgeScan = async (badgeId: string) => {
    setValidationError(null);
    const cleanBadge = badgeId.toUpperCase().trim();
    
    // Zod validation Layer 1
    const validation = scannerInputSchema.safeParse(cleanBadge);
    if (!validation.success) {
      setValidationError("Zod rejection: Badge must be 2 uppercase characters + 6 digits (e.g., NW112233)");
      onLogEvent(`Zod block: Malformed badge entered manually - "${cleanBadge}"`);
      return;
    }

    // Locate corresponding tokenized occupant
    const matchedOccupant = occupants.find(occ => occ.badgeId === cleanBadge);
    if (!matchedOccupant) {
      setValidationError("Warden DB Warning: Badge ID not found in current Floor 7 pilot index.");
      onLogEvent(`Warden error: Scanned unknown badge ${cleanBadge}`);
      return;
    }

    // Trigger check-in
    onUpdateStatus(matchedOccupant.id, "SAFE", "Zone A", "NFC scanned by Warden NW", false);
    onLogEvent(`Warden NW scanned RFID Badge ${cleanBadge} at Stair A landing: marked SAFE.`);

    // Perform JIT Decryption from Vault Node over simulated TLS 1.3
    requestVaultDecryption(matchedOccupant.id);
  };

  // Just-in-Time Decryption request (Layer 5)
  const requestVaultDecryption = async (token: string) => {
    setIsDecrypting(true);
    setDecryptedProfile(null);
    setDecryptedToken(token);

    try {
      // Endpoint retrieves dynamic encrypted data from memory Vault
      const response = await fetch("/api/vault/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          requesterId: "warden_NW" // Auth token
        })
      });

      if (!response.ok) {
        throw new Error("Vault authorization or mapping error.");
      }

      const data = await response.json();
      
      // Render JIT details directly into clean, volatile RAM State
      setDecryptedProfile({
        name: data.decrypted.name,
        role: data.decrypted.role,
        photo: data.decrypted.photo,
        department: data.decrypted.department,
        phone: data.decrypted.phone,
        verifiedAt: data.verifiedAt
      });

      onLogEvent(`Vault authorization valid. Dynamic decryption complete for token ${token}. Rendered strictly in Warden RAM.`);

      // Trigger automatic nullify countdown - 5 seconds
      if (autoClearTimer) clearTimeout(autoClearTimer);
      const timer = window.setTimeout(() => {
        nullifyMemory();
      }, 5000);
      setAutoClearTimer(timer);

    } catch (err: any) {
      setValidationError("Vault key rotation error: Failed to map JIT decryption.");
    } finally {
      setIsDecrypting(false);
    }
  };

  // Explicit dynamic nullification from RAM
  const nullifyMemory = () => {
    setDecryptedProfile(null);
    setDecryptedToken(null);
    if (autoClearTimer) clearTimeout(autoClearTimer);
    setAutoClearTimer(null);
  };

  // Attest remaining northwest quadrant occupants safe (OSHA compliance)
  const handleAttestQuadrant = () => {
    const nwCount = occupants.filter(o => o.quadrant === "NW" && o.status === "MISSING").length;
    if (nwCount === 0) {
      alert("All NW quadrant occupants are already accounted for!");
      return;
    }

    occupants.forEach(occ => {
      if (occ.quadrant === "NW" && occ.status === "MISSING") {
        onUpdateStatus(occ.id, "SAFE", "Zone A", "Quadrant Attestation by Warden NW", false);
      }
    });

    onLogEvent(`Warden NW issued dynamic Attestation: marked and verified all remaining ${nwCount} Northwest Quadrant occupants SAFE.`);
  };

  // Filter lists based on Tab & Search query
  const filteredOccupants = occupants.filter(occ => {
    const isTabMatch = activeTab === "SAFE" ? occ.status === "SAFE" : occ.status !== "SAFE";
    const cleanQuery = searchQuery.toLowerCase();
    const isQueryMatch = occ.id.toLowerCase().includes(cleanQuery) || 
                         occ.badgeId.toLowerCase().includes(cleanQuery) ||
                         (occ.alertNote && occ.alertNote.toLowerCase().includes(cleanQuery)) ||
                         occ.role.toLowerCase().includes(cleanQuery) ||
                         occ.quadrant.toLowerCase().includes(cleanQuery);
    return isTabMatch && isQueryMatch;
  });

  const missingCount = occupants.filter(o => o.status !== "SAFE").length;
  const safeCount = occupants.filter(o => o.status === "SAFE").length;

  return (
    <div className="w-full bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-2xl flex flex-col h-[710px] relative text-slate-100 overflow-hidden">
      
      {/* Kiosk Status Header */}
      <div className="flex justify-between items-center border-b border-slate-850 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-amber-500 text-sm">
            <Radio size={14} className="animate-pulse" />
            <span>WARDEN TACTICAL SHEATH</span>
          </div>
          <p className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
            [Kiosk Mode Active] QUADRANT: NW Engineering (4 Irving Plaza)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isBlackout ? (
            <span className="text-[10px] bg-yellow-950/80 text-yellow-500 border border-yellow-800/60 px-2 py-0.5 rounded font-mono font-bold animate-pulse flex items-center gap-1">
              <span>● MESH HOP</span>
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              ● REAL-TIME CLOUD
            </span>
          )}
          <span className="text-[11px] font-mono text-slate-400">Bat: 100% ⚡</span>
        </div>
      </div>

      {/* Real-time Emergency SOS Alert Notice Banner */}
      {occupants.some(o => o.status === "CRITICAL") && (
        <div className="bg-red-950/90 border border-red-500 rounded-2xl p-3 mb-3 text-xs flex flex-col gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" id="warden-sos-banner">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <AlertOctagon className="text-red-500 shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <span className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-widest block mb-0.5">⚠️ PRIORITY SOS PANIC ACTIVE</span>
                <p className="text-slate-205 font-sans text-[11px] leading-relaxed">
                  Crisis beacon active for occupant <span className="font-bold text-white bg-red-900/60 px-1.5 py-0.5 rounded font-mono select-all ml-0.5">{occupants.find(o => o.status === "CRITICAL")?.id}</span>.
                  Device tilt sensor registered emergency trigger. Immediate deployment/response recommended.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const emergencyUserId = occupants.find(o => o.status === "CRITICAL")?.id;
                if (emergencyUserId) {
                  setActiveTab("MISSING");
                  requestVaultDecryption(emergencyUserId);
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-mono text-[9px] font-bold px-2 py-1.5 rounded-lg uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              id="btn-unseal-emergency-user"
            >
              LOCATE & UNSEAL
            </button>
          </div>
        </div>
      )}

      {/* Active F-89 Strategic Directive Banner */}
      <div className="bg-gradient-to-r from-red-950/40 to-amber-950/30 border border-amber-900/40 rounded-2xl p-3 mb-3 text-xs flex flex-col gap-2 shadow-inner">
        <div className="flex-1">
          <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-widest block mb-1">🚨 FDNY DIRECTIVE FROM FSD CORE STATION</span>
          <p className="text-slate-100 font-sans text-[11px] font-semibold leading-relaxed">{activeDirective}</p>
        </div>
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={() => {
              onLogEvent("Warden NW acknowledged F-89 directive and deployed tactical sweep.");
              alert("Strategic directive acknowledged. Logged to BLE Mesh Ledger.");
            }}
            className="bg-amber-600 hover:bg-amber-550 border border-amber-500/20 text-slate-950 px-2.5 py-1.5 rounded-lg text-[9.5px] font-mono font-bold uppercase transition-all active:scale-95 cursor-pointer"
          >
            ACK & RUN
          </button>
          <button
            onClick={() => {
              onLogEvent("Warden NW completed tactical sweep: NORTHWEST SECTOR CONFIRMED 100% CLEAR OF PERSONNEL.");
              alert("Northwest sector sweep confirmation dispatched over primary/mesh routing.");
            }}
            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-emerald-400 px-2.5 py-1.5 rounded-lg text-[9.5px] font-mono font-bold uppercase transition-all active:scale-95 cursor-pointer"
          >
            CONFIRM CLEAR
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden mb-3">
        
        {/* LEFT COLUMN: SCANNER & Keypad input (5 Columns) */}
        <div className="md:col-span-6 bg-slate-950/70 rounded-2xl border border-slate-800/80 p-3.5 flex flex-col justify-between overflow-y-auto no-scrollbar">
          
          <div>
            {/* Segment Tab Selector */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl mb-3 shrink-0 col-span-2">
              <button
                onClick={() => { setActiveScanMode("RFID"); setValidationError(null); }}
                className={`py-1.5 text-[10px] font-mono font-bold rounded-lg transition-all uppercase cursor-pointer ${
                  activeScanMode === "RFID"
                    ? "bg-slate-800 text-slate-100 border border-slate-700 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-scan-rfid"
              >
                📟 RFID Keypad
              </button>
              <button
                onClick={() => { setActiveScanMode("QR"); setValidationError(null); }}
                className={`py-1.5 text-[10px] font-mono font-bold rounded-lg transition-all uppercase flex items-center justify-center gap-1 cursor-pointer ${
                  activeScanMode === "QR"
                    ? "bg-slate-800 text-slate-100 border border-slate-700 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-scan-qr"
              >
                <QrCode size={11} className="text-emerald-400" />
                📷 QR Code Reader
              </button>
            </div>

            {activeScanMode === "RFID" ? (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-mono tracking-wider text-slate-300 uppercase">RFID Badge Gateway</h3>
                  <span className="text-[9px] bg-indigo-950/90 text-indigo-400 border border-indigo-900/50 px-1.5 py-0.2 rounded font-mono">
                    HMAC-SHA256
                  </span>
                </div>

                {/* Tap Badge graphic & simple search bar */}
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-3.5 text-center mb-3">
                  <Smartphone className="mx-auto text-amber-500 animate-bounce mb-1" size={24} />
                  <span className="text-[10px] block font-mono text-slate-400 uppercase tracking-widest">TAP OCCUPANT ID BADGE</span>
                  <p className="text-[9px] text-slate-500 mt-1">Simulates NFC loop verification protocol.</p>
                </div>

                {/* Keypad entry input */}
                <div className="mb-2">
                  <input
                    type="text"
                    value={badgeIdField}
                    readOnly
                    placeholder="REGISTRATION CODE: e.g. NW112233"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-center font-mono text-sm text-yellow-400 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>

                {/* Keypad grids */}
                <div className="grid grid-cols-4 gap-1.5 max-w-[250px] mx-auto mb-3">
                  {["NW", "FA", "HR", "LS"].map(pfx => (
                    <button
                      key={pfx}
                      onClick={() => setBadgeInputCombined(pfx)}
                      className="bg-slate-850 hover:bg-slate-800 text-slate-100 font-mono text-[10px] py-1 border border-slate-750 rounded select-none font-bold active:bg-slate-700 cursor-pointer"
                    >
                      {pfx}
                    </button>
                  ))}
                  {["1", "2", "3", "4"].map(num => (
                    <button
                      key={num}
                      onClick={() => handleKeypadPress(num)}
                      className="bg-slate-900 hover:bg-slate-850 text-slate-200 font-mono text-xs py-2 rounded border border-slate-800 select-none active:bg-slate-700 cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  {["5", "6", "7", "8"].map(num => (
                    <button
                      key={num}
                      onClick={() => handleKeypadPress(num)}
                      className="bg-slate-900 hover:bg-slate-850 text-slate-200 font-mono text-xs py-2 rounded border border-slate-800 select-none active:bg-slate-700 cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <div className="col-span-4 grid grid-cols-4 gap-1.5">
                    {["9", "0"].map(num => (
                      <button
                        key={num}
                        onClick={() => handleKeypadPress(num)}
                        className="bg-slate-900 hover:bg-slate-850 text-slate-200 font-mono text-xs py-2 rounded border border-slate-800 select-none active:bg-slate-700 cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => handleKeypadPress("CLR")}
                      className="bg-red-950/60 text-red-400 hover:bg-red-900/40 text-[10px] font-mono py-2 rounded border border-red-900/60 font-bold active:bg-red-800/40 cursor-pointer"
                    >
                      CLR
                    </button>
                    <button
                      onClick={() => handleKeypadPress("ENT")}
                      className="bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/40 text-[10px] font-mono py-2 rounded border border-emerald-900/60 font-bold active:bg-emerald-800/40 cursor-pointer"
                    >
                      ENTER
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* QR CODE SCANNER VIEWPORT */
              <div className="space-y-3 animate-fadeIn">
                <div className="flex justify-between items-center bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-mono tracking-wider text-slate-300 uppercase">Muster Scan Reader</h3>
                  <span className={`text-[9px] border px-1.5 py-0.5 rounded font-mono font-bold ${
                    isScanning 
                      ? "bg-amber-950 text-amber-400 border-amber-800 animate-pulse" 
                      : "bg-emerald-950 text-emerald-400 border-emerald-800/40 animate-pulse"
                  }`}>
                    {isScanning ? "DECIPHERING ENVELOPE..." : "READY TO ACQUIRE"}
                  </span>
                </div>

                {/* Camera Viewfinder Mock */}
                <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 text-center shadow-2xl overflow-hidden min-h-[180px] flex flex-col justify-between items-center font-mono">
                  {/* Viewfinder Target Brackets */}
                  <div className="border-t-2 border-l-2 border-emerald-500 w-5 h-5 absolute top-3 left-3" />
                  <div className="border-t-2 border-r-2 border-emerald-500 w-5 h-5 absolute top-3 right-3" />
                  <div className="border-b-2 border-l-2 border-emerald-500 w-5 h-5 absolute bottom-3 left-3" />
                  <div className="border-b-2 border-r-2 border-emerald-500 w-5 h-5 absolute bottom-3 right-3" />

                  {/* Laser line moving across */}
                  <div className="absolute left-0 right-0 h-[1.5px] bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" style={{ top: isScanning ? "55%" : "35%", transition: "all 0.5s ease" }} />

                  {/* Top Feed Telemetry Overlay */}
                  <div className="w-full flex justify-between items-start text-[8px] text-emerald-500/80 uppercase tracking-wider select-none z-10">
                    <div className="flex flex-col text-left">
                      <span>REC: 4K 60FPS</span>
                      <span>DEV: TERM-NW01</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span>AUTO-EXTRACT: EN</span>
                      <span>ISO: 1200 F/2.0</span>
                    </div>
                  </div>

                  {/* Intermittent scan target graphic box */}
                  <div className="relative w-28 h-28 border border-emerald-500/30 rounded flex flex-col items-center justify-center bg-slate-900/40 my-1 animate-pulse select-none z-10">
                    <div className="grid grid-cols-3 gap-1 opacity-20">
                      <div className="w-4 h-4 border border-emerald-400" />
                      <div className="w-4 h-4 bg-emerald-400" />
                      <div className="w-4 h-4 border border-emerald-400" />
                      <div className="w-4 h-4 bg-emerald-400" />
                      <div className="w-4 h-4 border border-emerald-400" />
                      <div className="w-4 h-4 border border-emerald-400" />
                    </div>
                    <Camera className={`${isScanning ? "text-amber-400 scale-125" : "text-emerald-500/60"} absolute transition-all duration-300`} size={24} />
                    {isScanning && (
                      <div className="absolute inset-0 bg-emerald-500/15 flex items-center justify-center font-mono text-[9px] text-emerald-400 font-bold backdrop-blur-xs">
                        ACQUIRING...
                      </div>
                    )}
                  </div>

                  {/* Bottom Guide Text */}
                  <div className="w-full text-center z-10 select-none">
                    <span className="text-[9px] block text-emerald-400 font-bold uppercase tracking-widest leading-none">ALIGN ENCRYPTED PASS QR</span>
                    <p className="text-[7.5px] text-slate-500 mt-1 leading-none uppercase">SUPPORTED PROTOCOL: CRYPTO-MUSTER v2</p>
                  </div>
                </div>

                {/* Selected user qr code emulator selector */}
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 space-y-2">
                  <label className="block text-[9px] font-mono uppercase text-slate-400">Target Mobile Occupant to Scan:</label>
                  
                  <div className="flex gap-1.5">
                    <select
                      value={selectedQrUser}
                      onChange={(e) => setSelectedQrUser(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-805 rounded-lg px-2 py-1 text-xs text-slate-350 font-mono focus:outline-none"
                    >
                      <option value="">-- Choose scannable user --</option>
                      {occupants.map(occ => (
                        <option key={occ.id} value={occ.id}>
                          {occ.id === decryptedToken && decryptedProfile ? `${decryptedProfile.name} [${occ.id}]` : `${occ.id} - ${occ.status}`}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => {
                        const targetId = selectedQrUser || "usr_b3c7d6e5"; // Default mock Alice, which is the user on phone
                        const occ = occupants.find(o => o.id === targetId);
                        if (!occ) {
                          setValidationError("No target occupant selected to simulate QR acquisition.");
                          return;
                        }

                        // Trigger visual scan overlay
                        setIsScanning(true);
                        setValidationError(null);

                        setTimeout(() => {
                          setIsScanning(false);
                          
                          // Update status to safe and read qr payload
                          const finalZone = occ.id === "usr_b3c7d6e5" ? "Zone A" : (occ.musterZone || "Zone A");
                          onUpdateStatus(occ.id, "SAFE", finalZone, `Interactive QR check-in verified at muster terminal`, false);
                          onLogEvent(`Warden Tablet scanned dynamic QR Pass for occupant ${occ.id} (${occ.badgeId}). Marked SAFE in ${finalZone}.`);
                          
                          // Also trigger decryption on tablet RAM to simulate premium TLS unsealing
                          if (occ.badgeId) {
                            setBadgeIdField(occ.badgeId);
                            requestVaultDecryption(occ.id);
                          }
                        }, 750);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      SCAN QR
                    </button>
                  </div>
                  <p className="text-[8.5px] text-indigo-400 font-mono leading-tight">
                    💡 Tip: Alice (usr_b3c7d6e5) is the mock user on the left mobile device. Customize her options on the phone, generate the QR Pass, then scan her instantly here!
                  </p>
                </div>
              </div>
            )}

            {validationError && (
              <div className="bg-red-950/95 border border-red-800 text-red-200 rounded p-2 text-[9px] font-mono leading-tight mb-2">
                {validationError}
              </div>
            )}
          </div>

          {/* JIT Vault Decryption Panel (Layer 5) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-center min-h-[140px]">
            <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1 text-[11px] font-mono text-amber-500 font-semibold">
                <ShieldAlert size={12} />
                <span>JIT VAULT DISPLAY PLIABLE DECRYPTION</span>
              </div>
              <span className="text-[8px] bg-red-900/80 text-red-200 px-1 py-0.2 rounded font-mono uppercase">
                Active RAM Only
              </span>
            </div>

            {isDecrypting ? (
              <div className="text-center py-4 space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-amber-500" />
                <span className="text-[10px] font-mono text-slate-400">Unsealing key map via TLS 1.3...</span>
              </div>
            ) : decryptedProfile ? (
              <div className="text-gray-200 flex items-start gap-3 mt-1.5 animate-fadeIn">
                <img
                  src={decryptedProfile.photo}
                  alt="Decrypted occupant preview"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-700 bg-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold font-sans text-amber-400 flex items-center justify-between">
                    <span>{decryptedProfile.name}</span>
                    <span className="text-[8px] font-mono text-slate-500">Decrypted</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium">{decryptedProfile.role}</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{decryptedProfile.department}</div>
                  <div className="text-[9px] text-slate-400 font-mono">{decryptedProfile.phone}</div>
                  
                  {/* Dynamic clear badge */}
                  <div className="flex justify-between items-center mt-2 bg-slate-950/80 p-1 rounded border border-slate-800">
                    <span className="text-[8px] text-yellow-500 font-mono flex items-center gap-0.5">
                      <Clock size={8} /> Auto-wipe in progress
                    </span>
                    <button
                      onClick={nullifyMemory}
                      className="text-[8px] bg-red-950/85 hover:bg-red-900/50 text-red-400 px-1 rounded border border-red-900 font-mono"
                    >
                      NULLIFY RAM
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 font-mono text-[9px]">
                No active decryption lease in storage. Scanned cards will unseal a 5s memory leak-proof profile view.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ROSTER LIST (7 Columns) */}
        <div className="md:col-span-6 bg-slate-950/70 rounded-2xl border border-slate-800/80 p-3.5 flex flex-col justify-between overflow-hidden">
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and filtering */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-mono tracking-wider text-slate-300 uppercase">Interactive Roster Ledger</h3>
              <div className="relative w-36">
                <Search className="absolute left-2 top-2 text-slate-500" size={12} />
                <input
                  type="text"
                  placeholder="Filter occupant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Missing vs Safe tabs */}
            <div className="grid grid-cols-2 gap-1 mb-2.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab("MISSING")}
                className={`py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${
                  activeTab === "MISSING"
                    ? "bg-red-950 text-red-400 border border-red-900/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                MISSING ({missingCount})
              </button>
              <button
                onClick={() => setActiveTab("SAFE")}
                className={`py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${
                  activeTab === "SAFE"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                SAFE ({safeCount})
              </button>
            </div>

            {/* Scrollable roster items list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 no-scrollbar">
              {filteredOccupants.length > 0 ? (
                filteredOccupants.map(occ => (
                  <div
                    key={occ.id}
                    onClick={() => requestVaultDecryption(occ.id)}
                    className={`p-2 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      occ.status === "SAFE"
                        ? "bg-emerald-950/20 border-emerald-900/30 hover:bg-emerald-900/20"
                        : occ.status === "CRITICAL"
                        ? "bg-red-950/30 border-red-800/50 hover:bg-red-900/20 animate-pulse"
                        : occ.status === "NEED_HELP"
                        ? "bg-amber-950/30 border-amber-800/50 hover:bg-amber-900/20"
                        : "bg-slate-900/40 border-slate-800/85 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        occ.status === "SAFE" ? "bg-emerald-400" :
                        occ.status === "CRITICAL" ? "bg-red-500" :
                        occ.status === "NEED_HELP" ? "bg-amber-400" : "bg-gray-400"
                      }`} />
                      <div>
                        <div className="text-[11px] font-mono font-bold text-slate-200">
                          {occ.id === decryptedToken && decryptedProfile ? decryptedProfile.name : occ.nameEncrypted}
                          <span className="text-[8px] font-normal text-slate-400 bg-slate-850 border border-slate-800/80 px-1 rounded ml-1.5 font-mono">{occ.id}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400">
                          <span>Badge: {occ.badgeId}</span>
                          <span>|</span>
                          <span>Quadrant: {occ.quadrant}</span>
                        </div>
                        {occ.alertNote && (
                          <div className="text-[8.5px] text-amber-300 font-medium italic mt-0.5 line-clamp-1">
                            “{occ.alertNote}”
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[9px] font-mono font-bold text-slate-400">{occ.lastSeen}</div>
                      <span className={`text-[8px] font-bold font-mono uppercase px-1.5 py-0.2 rounded mt-1 inline-block ${
                        occ.status === "SAFE" ? "bg-emerald-950 text-emerald-400" :
                        occ.status === "CRITICAL" ? "bg-red-950 text-red-400 border border-red-900" :
                        occ.status === "NEED_HELP" ? "bg-amber-950 text-amber-500 border border-amber-900" :
                        "bg-gray-950 text-gray-400 border border-gray-800"
                      }`}>
                        {occ.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 font-mono text-[10px]">
                  No matching occupants under this filter.
                </div>
              )}
            </div>
          </div>

          {/* Table quick actions */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-850">
            <button
              onClick={handleAttestQuadrant}
              className="bg-amber-600 hover:bg-amber-500 border border-amber-400/30 text-slate-950 text-[10.5px] font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 shadow-md"
            >
              <UserCheck size={13} />
              ATTEST QUADRANT SAFE
            </button>
            <button
              onClick={() => {
                onLogEvent("Warden NW issued priority HOST notification: REQUESTING PARAMEDIC BACKUP NEAR SE QUADRANT COMPARTMENT.");
                alert("Incident Host successfully notified via Bluetooth Mesh packet sync!");
              }}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-[10px] font-mono font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95"
            >
              <AlertOctagon size={13} className="text-amber-500" />
              NOTIFY HOST
            </button>
          </div>
        </div>

      </div>

      {/* Sync footer */}
      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 border-t border-slate-850 pt-2.5">
        <span className="flex items-center gap-1">
          <HardDrive size={10} className="text-slate-400" />
          <span>Local Store Encrypted via AES-256 (SQLCipher)</span>
        </span>
        <span>Last Sync: Just Now via P2P Mesh</span>
      </div>
    </div>
  );
}
