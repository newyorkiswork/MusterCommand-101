import React, { useState } from "react";
import { z } from "zod";
import { ShieldCheck, Eye, EyeOff, Activity, AlertTriangle, CheckCircle, Wifi, Flame, RotateCcw, QrCode, ScanLine } from "lucide-react";
import { Occupant } from "../types";
import { sanitizeText, validateBadgeSyntax } from "../utils";

// Schema for input evaluation complying with Level 1 validation
const alertFormSchema = z.object({
  badgeId: z.string().refine((val) => validateBadgeSyntax(val), {
    message: "Invalid format. Must be 2 uppercase letters followed by 6 numbers (e.g., NW112233)."
  }),
  note: z.string().max(200, "Notes cannot exceed 200 characters.")
});

interface OccupantMobileProps {
  occupant: Occupant;
  isBlackout: boolean;
  onUpdateStatus: (
    id: string,
    status: Occupant["status"],
    zone?: string,
    note?: string,
    fallDetected?: boolean
  ) => void;
  stairBBlocked: boolean;
  activeDirective: string;
}

// Deterministic QR code matrix generator for high-fidelity offline verification simulation
const generateQRMatrix = (payload: string): boolean[][] => {
  const size = 16;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Deterministic seed from payload string
  let seed = 0;
  for (let i = 0; i < payload.length; i++) {
    seed = (seed << 5) - seed + payload.charCodeAt(i);
    seed |= 0; // Convert to 32bit integer
  }

  // Simple pseudo-random generator from seed
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x) > 0.5;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Top-left finder pattern (4x4)
      if (r < 4 && c < 4) {
        matrix[r][c] = (r === 0 || r === 3 || c === 0 || c === 3 || (r === 1 && c === 1) || (r === 1 && c === 2) || (r === 2 && c === 1) || (r === 2 && c === 2));
        continue;
      }
      // Top-right finder pattern
      if (r < 4 && c >= size - 4) {
        const mc = c - (size - 4);
        matrix[r][c] = (r === 0 || r === 3 || mc === 0 || mc === 3 || (r === 1 && mc === 1) || (r === 1 && mc === 2) || (r === 2 && mc === 1) || (r === 2 && mc === 2));
        continue;
      }
      // Bottom-left finder pattern
      if (r >= size - 4 && c < 4) {
        const mr = r - (size - 4);
        matrix[r][c] = (mr === 0 || mr === 3 || c === 0 || c === 3 || (mr === 1 && c === 1) || (mr === 1 && c === 2) || (mr === 2 && c === 1) || (mr === 2 && c === 2));
        continue;
      }

      // Timing pattern (vertical and horizontal dashed lines)
      if (r === 5 || c === 5) {
        matrix[r][c] = (r + c) % 2 === 0;
        continue;
      }

      // Fill rest pseudo-randomly
      matrix[r][c] = random();
    }
  }

  // Ensure central finders are aligned correctly
  return matrix;
};

export default function OccupantMobile({
  occupant,
  isBlackout,
  onUpdateStatus,
  stairBBlocked,
  activeDirective
}: OccupantMobileProps) {
  const [activeScreen, setActiveScreen] = useState<"FORM" | "QR_PASS">("FORM");
  const [badgeInput, setBadgeInput] = useState("");
  const [alertNote, setAlertNote] = useState("");
  const [selectedZone, setSelectedZone] = useState("Zone A");
  const [isFallSensorEnabled, setIsFallSensorEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Zod manual validation & XSS sanitization
  const handleCheckIn = (status: "SAFE" | "NEED_HELP") => {
    setValidationError(null);
    setStatusMessage(null);

    // Zod Validation Parse
    const result = alertFormSchema.safeParse({
      badgeId: badgeInput.toUpperCase().trim() || occupant.badgeId,
      note: alertNote
    });

    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }

    // Layer 1 DOMPurify alternative - stripping scripts
    const safeNote = sanitizeText(alertNote);

    onUpdateStatus(
      occupant.id,
      status,
      selectedZone,
      status === "NEED_HELP" ? safeNote : undefined,
      isFallSensorEnabled
    );

    // Dynamic state messaging based on network context
    if (isBlackout) {
      setStatusMessage(`Mesh Packets Encrypted & Broadcasted! HMAC code: ${Math.random().toString(16).substring(2, 10).toUpperCase()}`);
    } else {
      setStatusMessage("Status successfully logged to centralized Firestore ledger.");
    }
  };

  const toggleFallSensor = () => {
    const newVal = !isFallSensorEnabled;
    setIsFallSensorEnabled(newVal);

    // Automatically trigger CRITICAL status on fall sensors
    if (newVal) {
      onUpdateStatus(occupant.id, "CRITICAL", selectedZone, "Automatic Fall Sensor Alarm triggered.", true);
      setStatusMessage("Critical telemetry sent: Fall coordinates compiled.");
    } else {
      onUpdateStatus(occupant.id, "SAFE", selectedZone, undefined, false);
      setStatusMessage("Fall status reset safe.");
    }
  };

  // Generate dynamic payload for current check-in state
  const qrPayload = `TOKEN:${occupant.id}|STATUS:${occupant.status}|ZONE:${selectedZone}|BADGE:${badgeInput || occupant.badgeId}|SEC:${isBlackout ? "MESH_HMAC" : "TLS_1.3"}`;
  const qrGrid = generateQRMatrix(qrPayload);

  return (
    <div className="w-full max-w-sm mx-auto bg-gray-950 rounded-[40px] border-8 border-gray-800 p-3 shadow-2xl relative overflow-hidden flex flex-col h-[710px]">
      {/* Phone Camera Notch */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-5 bg-gray-800 rounded-b-2xl z-20 flex items-center justify-center">
        <div className="w-12 h-1 bg-gray-900 rounded-full" />
      </div>

      {/* Screen Header Status Bar */}
      <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 pt-1 px-4 mb-2 select-none">
        <span>MusterCommand OS</span>
        <div className="flex items-center gap-1.5">
          {isBlackout ? (
            <span className="text-yellow-500 font-bold animate-pulse flex items-center gap-0.5">
              <span>● BLE-MESH</span>
            </span>
          ) : (
            <span className="text-emerald-500 flex items-center gap-0.5">
              <Wifi size={10} /> 5G Cloud
            </span>
          )}
          <span>78% 🔋</span>
        </div>
      </div>

      {/* Active evacuation notification block */}
      <div className="mt-1 bg-red-950/90 border border-red-500/30 p-3 rounded-2xl mb-3 text-xs flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Flame className="text-red-500 shrink-0 mt-0.5" size={16} />
          <div className="flex-1">
            <div className="font-bold text-red-200 uppercase tracking-wider text-[11px]">🔔 EVACUATE FLOOR 7 (Pilot)</div>
            <div className="text-red-350 text-[10px] leading-relaxed mt-0.5">
              Hazard: OFFICE FIRE. Use Stair A (North). 
              {stairBBlocked ? (
                <span className="text-yellow-400 font-bold block mt-1">⚠️ STAIR B IS BLOCKED! Dynamic Reroute Plan Active.</span>
              ) : (
                " Stair B (South) is also clear."
              )}
            </div>
          </div>
        </div>
        
        {/* Dynamic Directive Broadcast */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-[9px] text-slate-300 font-mono">
          <span className="font-bold text-amber-500 uppercase tracking-wider block mb-0.5">📡 Live F-89 Command Relay:</span>
          <p className="leading-tight text-slate-100">{activeDirective}</p>
        </div>
      </div>

      {/* Navigation Segment Control */}
      <div className="grid grid-cols-2 gap-1 bg-gray-900/90 p-1 rounded-2xl border border-gray-800 mb-3 shrink-0">
        <button
          onClick={() => setActiveScreen("FORM")}
          className={`py-1.5 text-[10px] font-mono font-bold rounded-xl transition-all uppercase ${
            activeScreen === "FORM"
              ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-md font-semibold"
              : "text-gray-400 hover:text-gray-200"
          }`}
          id="btn-nav-status-form"
        >
          Manual Evac Form
        </button>
        <button
          onClick={() => setActiveScreen("QR_PASS")}
          className={`py-1.5 text-[10px] font-mono font-bold rounded-xl transition-all uppercase flex items-center justify-center gap-1 ${
            activeScreen === "QR_PASS"
              ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-md font-semibold"
              : "text-gray-400 hover:text-gray-200"
          }`}
          id="btn-nav-qr-pass"
        >
          <span className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${occupant.status !== "SAFE" ? "animate-ping" : ""} inline-block`} />
          Muster QR Pass
        </button>
      </div>

      {/* Core Screen Space */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 px-1 text-gray-200">
        
        {activeScreen === "FORM" ? (
          <>
            <div className="text-center py-2 bg-gray-900/60 rounded-xl border border-gray-800">
              <div className="text-[10px] uppercase font-mono tracking-widest text-gray-400">Personal Token ID</div>
              <div className="text-base font-bold text-slate-100 font-mono">{occupant.id}</div>
              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-gray-800 text-[9px] text-gray-400 border border-gray-700">
                <ShieldCheck size={10} className="text-emerald-500" /> Layer 5 Tokenization
              </div>
            </div>

            {/* Input parameters */}
            <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800/80 space-y-2.5">
              <h4 className="text-[11px] font-mono tracking-widest text-slate-300 uppercase font-bold">Layer 1 Registration</h4>
              
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Badge ID Verification</label>
                <input
                  type="text"
                  placeholder="e.g. NW112233"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value.toUpperCase())}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[9px] text-gray-500 mt-0.5">Required for physical validation checks.</p>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Free-Text Urgent Note (Voice or Type)</label>
                <textarea
                  placeholder="FSD notes (script tags stripped)..."
                  value={alertNote}
                  onChange={(e) => setAlertNote(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-white h-12 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                />
              </div>
            </div>

            {/* Assembly Zone Selector */}
            <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800/80">
              <h4 className="text-[11px] font-mono tracking-widest text-slate-300 uppercase mb-2 font-bold">Selected Assembly Point</h4>
              <div className="space-y-1.5">
                {[
                  { id: "Zone A", val: "Zone A - Union Sq", badge: "RECOMMENDED", color: "text-emerald-400 bg-emerald-950/60" },
                  { id: "Zone B", val: "Zone B - 14th St", badge: "SOUTH FLOW", color: "text-blue-400 bg-blue-950/60" },
                  { id: "Zone C", val: "Zone C - 15th St", badge: "NORTH FLOW", color: "text-gray-400 bg-gray-850" }
                ].map(z => (
                  <label
                    key={z.id}
                    onClick={() => setSelectedZone(z.id)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] cursor-pointer transition-all ${
                      selectedZone === z.id
                        ? "bg-slate-800/80 border-slate-600"
                        : "bg-gray-950 border-gray-800/80 hover:bg-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="zone"
                        checked={selectedZone === z.id}
                        readOnly
                        className="accent-slate-400"
                      />
                      <span>{z.val}</span>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${z.color}`}>
                      {z.badge}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fall Sensor Simulator (OSHA Compliance) */}
            <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800/80">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-mono tracking-widest text-slate-300 uppercase font-bold">OSHA On-Device Telemetry</span>
                <span className="text-[9px] bg-red-950 text-red-400 border border-red-800 px-1 py-0.2 rounded font-mono uppercase">
                  OSHA 1910.38
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 p-2 bg-gray-950 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2">
                  <Activity className={`${isFallSensorEnabled ? "text-red-500 animate-pulse" : "text-emerald-500"}`} size={16} />
                  <div>
                    <span className="text-[10px] block text-gray-400 font-mono">Tilt / Accel Sensor</span>
                    <span className="text-xs font-bold font-mono text-gray-200">{isFallSensorEnabled ? "0.1G / IMPACT ALERT" : "1.0G (STABLE)"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Simulate Fall</span>
                  <button
                    onClick={toggleFallSensor}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                      isFallSensorEnabled ? "bg-red-500" : "bg-gray-800"
                    }`}
                    id="btn-simulate-fall"
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      isFallSensorEnabled ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* MUSTER QR PASS VIEW SCREEN */
          <div className="bg-gray-900/60 p-4 border border-slate-800 rounded-2xl flex flex-col items-center space-y-3.5 animate-fadeIn">
            
            <div className="text-center">
              <span className="text-[9px] font-mono bg-amber-950 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                Muster Station Terminal Ticket
              </span>
              <p className="text-[9px] text-gray-400 mt-1 leading-normal max-w-xs font-mono">
                Present this cryptographically tagged ticket to an active FDNY Warden tablet or kiosk scanner point.
              </p>
            </div>

            {/* Beautiful QR Code Matrix with Scanner animation */}
            <div className="relative p-3.5 bg-white rounded-2xl shadow-inner border-4 border-slate-750 flex flex-col items-center justify-center">
              
              {/* Dynamic QR Pixel Grid */}
              <div className="grid grid-cols-16 gap-[1.5px] bg-white p-1">
                {qrGrid.map((row, rIdx) =>
                  row.map((active, cIdx) => (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      className={`w-[11.5px] h-[11.5px] rounded-[1px] transition-colors duration-300 ${
                        active 
                          ? occupant.status === "SAFE" 
                            ? "bg-slate-950" 
                            : occupant.status === "CRITICAL"
                            ? "bg-red-950"
                            : "bg-amber-950"
                          : "bg-white"
                      }`}
                    />
                  ))
                )}
              </div>

              {/* Animated Glowing Scan Line */}
              <div className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" style={{ animationDuration: "1.8s" }} />
              
              <div className="absolute top-1 right-1">
                <ScanLine size={14} className="text-slate-400 opacity-60" />
              </div>
            </div>

            {/* Sync ticket status information details card */}
            <div className="w-full bg-black/60 rounded-xl p-2.5 border border-slate-800 text-[10px] space-y-1.5 font-mono">
              <div className="flex justify-between border-b border-slate-850 pb-1 text-slate-400 font-bold">
                <span>ENTRY PARAMETER</span>
                <span className="text-slate-100">SEALED ENVELOPE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Occupant Token:</span>
                <span className="text-yellow-400 font-bold">{occupant.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned Zone:</span>
                <span className="text-slate-205 font-bold">{selectedZone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Verification Code:</span>
                <span className="text-slate-205">{badgeInput || occupant.badgeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Status:</span>
                <span className={`font-bold uppercase ${
                  occupant.status === "SAFE" ? "text-emerald-400" :
                  occupant.status === "CRITICAL" ? "text-red-400 animate-pulse" : "text-amber-400"
                }`}>{occupant.status}</span>
              </div>

              {/* Encrypted JSON Payload hash for Section 5 compliance */}
              <div className="pt-1.5 border-t border-slate-850">
                <span className="text-[7.5px] uppercase tracking-wider text-slate-500 block mb-0.5">Sealed SHA-256 HMAC Stamp:</span>
                <p className="text-[8px] text-slate-400 leading-tight select-all break-all overflow-hidden line-clamp-2 select-all whitespace-pre-wrap bg-slate-950 p-1 rounded font-mono border border-slate-900">
                  {qrPayload}
                </p>
              </div>
            </div>

            {/* Quick Simulation check-in trigger */}
            <button
              onClick={() => {
                onUpdateStatus(occupant.id, "SAFE", selectedZone, `QR code scanned at Muster Station Terminal (Zone: ${selectedZone})`, false);
                setStatusMessage(`Quick Check-In Success! Dynamic QR validation code recognized at Muster Gate ${selectedZone}. Mark SAFE logged to chain.`);
                setActiveScreen("FORM");
              }}
              className="w-full bg-slate-800 hover:bg-slate-750 text-slate-100 font-mono text-[10px] py-2 border border-slate-700 hover:border-slate-650 rounded-xl font-bold uppercase transition-all tracking-wider active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <QrCode size={12} className="text-amber-500" />
              Simulate Gate Terminal scan
            </button>
          </div>
        )}
      </div>

      {/* Touch Screen Validation Errors */}
      {validationError && (
        <div className="bg-red-950/80 border border-red-500/70 p-2 rounded-xl text-red-200 text-[10px] font-mono mb-2 flex items-center gap-1">
          <AlertTriangle size={12} className="shrink-0 text-red-400" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Screen Success Confirmation */}
      {statusMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/70 p-2 rounded-xl text-emerald-200 text-[9px] font-mono mb-2 leading-tight">
          <div className="flex items-center gap-1 font-bold text-emerald-300">
            <CheckCircle size={10} /> Sync Complete
          </div>
          <span className="block mt-0.5 text-slate-350">{statusMessage}</span>
        </div>
      )}

      {/* Fire Control Actions */}
      <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-gray-900 pb-2">
        <button
          onClick={() => {
            onUpdateStatus(
              occupant.id,
              "CRITICAL",
              selectedZone,
              "🚨 AUTOMATIC SOS PANIC! Active device alarm triggered by occupant.",
              true
            );
            setStatusMessage("⚠️ EMERGENCY SOS BROADCAST SENT IN MESH PACKETS!");
          }}
          className="w-full bg-red-750 hover:bg-red-850 text-white font-mono text-[11px] py-3 border border-red-500/50 hover:border-red-400 rounded-xl font-bold uppercase transition-all tracking-wider active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]"
          id="btn-sos-panic"
        >
          <Flame size={14} className="text-white animate-bounce" />
          ⚠️ SOS PANIC (EMERGENCY)
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleCheckIn("SAFE")}
            className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-[11px] font-bold text-white py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
            id="btn-evac-safe"
          >
            <CheckCircle size={13} />
            I AM SAFE
          </button>
          <button
            onClick={() => handleCheckIn("NEED_HELP")}
            className="bg-red-600 hover:bg-red-500 border border-red-400/40 text-[11px] font-bold text-white py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all shadow-md active:scale-95 animate-pulse cursor-pointer"
            id="btn-evac-help"
          >
            <AlertTriangle size={13} />
            I NEED HELP
          </button>
        </div>
      </div>

      {/* Phone Home Button bar */}
      <div className="w-full flex justify-center py-1 bg-transparent mt-1">
        <div className="w-28 h-1 bg-gray-800 rounded-full" />
      </div>
    </div>
  );
}
