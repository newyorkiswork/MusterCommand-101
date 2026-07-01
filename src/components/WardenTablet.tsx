import React, { useState, useEffect } from "react";
import { z } from "zod";
import {
  HardDrive,
  Search,
  ShieldAlert,
  Key,
  RefreshCw,
  UserCheck,
  AlertOctagon,
  Smartphone,
  Clock,
  Radio,
  QrCode,
  Camera,
  ScanLine,
  Accessibility,
} from "lucide-react";
import { Occupant } from "../types";
import { validateBadgeSyntax } from "../utils";

// Schema for manual scanner input
const scannerInputSchema = z
  .string()
  .refine((val) => validateBadgeSyntax(val), {
    message: "Invalid badge syntax. Code pattern must match [A-Z]{2}\\d{6}.",
  });

interface WardenTabletProps {
  occupants: Occupant[];
  isBlackout: boolean;
  onUpdateStatus: (
    id: string,
    status: Occupant["status"],
    zone?: string,
    note?: string,
    fallDetected?: boolean,
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
  activeDirective,
}: WardenTabletProps) {
  const [badgeIdField, setBadgeIdField] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"MISSING" | "SAFE" | "VISITORS">(
    "MISSING",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeScanMode, setActiveScanMode] = useState<"RFID" | "QR">("RFID");
  const [selectedQrUser, setSelectedQrUser] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);

  // Vault variables kept strictly in component RAM State (Nullified upon clear)
  const [decryptedProfile, setDecryptedProfile] =
    useState<DecryptedProfile | null>(null);
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
        setBadgeIdField((prev) => prev + val);
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
      setValidationError(
        "Zod rejection: Badge must be 2 uppercase characters + 6 digits (e.g., NW112233)",
      );
      onLogEvent(
        `Zod block: Malformed badge entered manually - "${cleanBadge}"`,
      );
      return;
    }

    // Locate corresponding tokenized occupant
    const matchedOccupant = occupants.find((occ) => occ.badgeId === cleanBadge);
    if (!matchedOccupant) {
      setValidationError(
        "Warden DB Warning: Badge ID not found in current Floor 7 pilot index.",
      );
      onLogEvent(`Warden error: Scanned unknown badge ${cleanBadge}`);
      return;
    }

    // Trigger check-in
    onUpdateStatus(
      matchedOccupant.id,
      "SAFE",
      "Zone A",
      "NFC scanned by Warden NW",
      false,
    );
    onLogEvent(
      `Warden NW scanned RFID Badge ${cleanBadge} at Stair A landing: marked SAFE.`,
    );

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
          requesterId: "warden_NW", // Auth token
        }),
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
        verifiedAt: data.verifiedAt,
      });

      onLogEvent(
        `Vault authorization valid. Dynamic decryption complete for token ${token}. Rendered strictly in Warden RAM.`,
      );

      // Trigger automatic nullify countdown - 5 seconds
      if (autoClearTimer) clearTimeout(autoClearTimer);
      const timer = window.setTimeout(() => {
        nullifyMemory();
      }, 5000);
      setAutoClearTimer(timer);
    } catch (err: any) {
      setValidationError(
        "Vault key rotation error: Failed to map JIT decryption.",
      );
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
    const nwCount = occupants.filter(
      (o) => o.quadrant === "NW" && o.status === "MISSING",
    ).length;
    if (nwCount === 0) {
      alert("All NW quadrant occupants are already accounted for!");
      return;
    }

    occupants.forEach((occ) => {
      if (occ.quadrant === "NW" && occ.status === "MISSING") {
        onUpdateStatus(
          occ.id,
          "SAFE",
          "Zone A",
          "Quadrant Attestation by Warden NW",
          false,
        );
      }
    });

    onLogEvent(
      `Warden NW issued dynamic Attestation: marked and verified all remaining ${nwCount} Northwest Quadrant occupants SAFE.`,
    );
  };

  // Filter lists based on Tab & Search query
  const filteredOccupants = occupants.filter((occ) => {
    const isTabMatch =
      activeTab === "SAFE"
        ? occ.status === "SAFE"
        : activeTab === "VISITORS"
          ? Boolean(occ.isVisitor)
          : occ.status !== "SAFE";
    const cleanQuery = searchQuery.toLowerCase();
    const isQueryMatch =
      occ.id.toLowerCase().includes(cleanQuery) ||
      occ.badgeId.toLowerCase().includes(cleanQuery) ||
      (occ.alertNote && occ.alertNote.toLowerCase().includes(cleanQuery)) ||
      occ.role.toLowerCase().includes(cleanQuery) ||
      occ.quadrant.toLowerCase().includes(cleanQuery);
    return isTabMatch && isQueryMatch;
  });

  const missingCount = occupants.filter((o) => o.status !== "SAFE").length;
  const safeCount = occupants.filter((o) => o.status === "SAFE").length;
  const visitorCount = occupants.filter((o) => Boolean(o.isVisitor)).length;
  const visitorUnaccounted = occupants.filter(
    (o) => o.isVisitor && o.status !== "SAFE",
  ).length;
  const araAll = occupants.filter((o) => o.mobilityImpaired || o.isAtARA);
  const araInTransit = araAll.filter((o) => !o.isAtARA);
  const araStaged = araAll.filter((o) => Boolean(o.isAtARA));

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 p-5 shadow-2xl flex flex-col min-h-[600px] relative text-slate-200 overflow-hidden">
      {/* Kiosk Status Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-amber-500">
            <Radio size={16} className="animate-pulse" />
            <span className="text-xl font-bold tracking-tight">
              WARDEN DECK
            </span>
          </div>
          <p className="text-sm text-slate-400 uppercase font-mono mt-1">
            [Kiosk Mode Active] QUADRANT: NW Engineering (4 Irving Plaza)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isBlackout ? (
            <span className="text-sm bg-yellow-100 text-yellow-800 border border-yellow-400 px-3 py-1.5 rounded-lg font-mono font-bold animate-pulse flex items-center gap-1.5">
              <span>● MESH HOP</span>
            </span>
          ) : (
            <span className="text-sm bg-emerald-100 text-emerald-800 border border-emerald-400 px-3 py-1.5 rounded-lg font-mono font-bold">
              ● REAL-TIME CLOUD
            </span>
          )}
          <span className="text-xs font-mono text-slate-400">Bat: 100% ⚡</span>
        </div>
      </div>

      {/* Real-time Emergency SOS Alert Notice Banner */}
      {occupants.some((o) => o.status === "CRITICAL") && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-2xl p-4 mb-4 flex flex-col gap-3 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
          id="warden-sos-banner"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertOctagon
                className="text-red-500 shrink-0 mt-0.5"
                size={20}
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-red-700 uppercase tracking-widest block mb-1">
                  ⚠️ PRIORITY SOS PANIC ACTIVE
                </span>
                <p className="text-base text-slate-300 font-sans leading-relaxed">
                  Crisis beacon active for occupant{" "}
                  <span className="font-bold text-white bg-red-600 px-2 py-0.5 rounded font-mono select-all ml-1">
                    {occupants.find((o) => o.status === "CRITICAL")?.id}
                  </span>
                  . Device tilt sensor registered emergency trigger. Immediate
                  deployment/response recommended.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const emergencyUserId = occupants.find(
                  (o) => o.status === "CRITICAL",
                )?.id;
                if (emergencyUserId) {
                  setActiveTab("MISSING");
                  requestVaultDecryption(emergencyUserId);
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-mono text-sm font-bold py-3 px-4 rounded-xl uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              id="btn-unseal-emergency-user"
            >
              LOCATE &amp; UNSEAL
            </button>
          </div>
        </div>
      )}

      {/* Active F-89 Strategic Directive Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4 flex flex-col gap-3">
        <div className="flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block mb-1.5">
            🚨 FSD DIRECTIVE — ACTION REQUIRED
          </span>
          <p className="text-base text-slate-200 font-sans font-semibold leading-relaxed">
            {activeDirective}
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              onLogEvent(
                "Warden NW acknowledged F-89 directive and deployed tactical sweep.",
              );
              alert(
                "Strategic directive acknowledged. Logged to BLE Mesh Ledger.",
              );
            }}
            className="bg-amber-600 text-white py-3 px-5 rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer"
          >
            ACK &amp; RUN
          </button>
          <button
            onClick={() => {
              onLogEvent(
                "Warden NW completed tactical sweep: NORTHWEST SECTOR CONFIRMED 100% CLEAR OF PERSONNEL.",
              );
              alert(
                "Northwest sector sweep confirmation dispatched over primary/mesh routing.",
              );
            }}
            className="bg-emerald-600 text-white py-3 px-5 rounded-xl text-sm font-bold border border-emerald-500 transition-all active:scale-95 cursor-pointer"
          >
            CONFIRM CLEAR
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden mb-3">
        {/* LEFT COLUMN: SCANNER & Keypad input (6 Columns) */}
        <div className="md:col-span-6 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between overflow-y-auto no-scrollbar">
          <div>
            {/* Step 1 · Scan & Account header */}
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                STEP 1 · SCAN &amp; ACCOUNT
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Scan each occupant's badge or QR to mark them SAFE.
              </p>
            </div>

            {/* Segment Tab Selector */}
            <div
              role="tablist"
              aria-label="Scan mode"
              className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 shrink-0"
            >
              <button
                onClick={() => {
                  setActiveScanMode("RFID");
                  setValidationError(null);
                }}
                role="tab"
                aria-selected={activeScanMode === "RFID"}
                className={`py-3 text-sm font-mono font-bold rounded-lg transition-all uppercase cursor-pointer ${
                  activeScanMode === "RFID"
                    ? "bg-white text-slate-200 border border-slate-300 shadow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                id="tab-scan-rfid"
              >
                📟 RFID Keypad
              </button>
              <button
                onClick={() => {
                  setActiveScanMode("QR");
                  setValidationError(null);
                }}
                role="tab"
                aria-selected={activeScanMode === "QR"}
                className={`py-3 text-sm font-mono font-bold rounded-lg transition-all uppercase flex items-center justify-center gap-2 cursor-pointer ${
                  activeScanMode === "QR"
                    ? "bg-white text-slate-200 border border-slate-300 shadow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                id="tab-scan-qr"
              >
                <QrCode size={14} className="text-emerald-400" />
                📷 QR Code Reader
              </button>
            </div>

            {activeScanMode === "RFID" ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-bold font-mono tracking-wider text-slate-300 uppercase">
                    RFID Badge Gateway
                  </h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300 px-2.5 py-1 rounded-lg font-mono font-bold">
                    HMAC-SHA256
                  </span>
                </div>

                {/* Tap Badge graphic & simple search bar */}
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center mb-4">
                  <Smartphone
                    className="mx-auto text-amber-500 animate-bounce mb-2"
                    size={28}
                  />
                  <span className="text-sm block font-mono text-slate-500 uppercase tracking-widest">
                    TAP OCCUPANT ID BADGE
                  </span>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Simulates NFC loop verification protocol.
                  </p>
                </div>

                {/* Keypad entry input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={badgeIdField}
                    readOnly
                    aria-label="Badge registration code"
                    placeholder="REGISTRATION CODE: e.g. NW112233"
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-center font-mono text-base text-slate-200 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                {/* Keypad grids */}
                <div className="grid grid-cols-4 gap-2 max-w-[260px] mx-auto mb-4">
                  {["NW", "FA", "HR", "LS"].map((pfx) => (
                    <button
                      key={pfx}
                      onClick={() => setBadgeInputCombined(pfx)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-mono text-sm py-2.5 border border-amber-500 rounded-lg select-none font-bold active:bg-amber-700 cursor-pointer"
                    >
                      {pfx}
                    </button>
                  ))}
                  {["1", "2", "3", "4"].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleKeypadPress(num)}
                      className="bg-white hover:bg-slate-50 text-slate-200 font-mono text-base font-bold py-3 rounded-lg border border-slate-300 select-none active:bg-slate-100 cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  {["5", "6", "7", "8"].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleKeypadPress(num)}
                      className="bg-white hover:bg-slate-50 text-slate-200 font-mono text-base font-bold py-3 rounded-lg border border-slate-300 select-none active:bg-slate-100 cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <div className="col-span-4 grid grid-cols-4 gap-2">
                    {["9", "0"].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleKeypadPress(num)}
                        className="bg-white hover:bg-slate-50 text-slate-200 font-mono text-base font-bold py-3 rounded-lg border border-slate-300 select-none active:bg-slate-100 cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => handleKeypadPress("CLR")}
                      className="bg-red-100 text-red-700 hover:bg-red-200 text-sm font-mono font-bold py-3 rounded-lg border border-red-300 active:bg-red-200 cursor-pointer"
                    >
                      CLR
                    </button>
                    <button
                      onClick={() => handleKeypadPress("ENT")}
                      className="bg-emerald-600 text-white hover:bg-emerald-500 text-sm font-mono font-bold py-3 rounded-lg border border-emerald-500 active:bg-emerald-700 cursor-pointer"
                    >
                      ENTER
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* QR CODE SCANNER VIEWPORT */
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <h3 className="text-base font-bold font-mono tracking-wider text-slate-300 uppercase">
                    Muster Scan Reader
                  </h3>
                  <span
                    className={`text-xs border px-3 py-1 rounded-lg font-mono font-bold ${
                      isScanning
                        ? "bg-amber-100 text-amber-700 border-amber-300 animate-pulse"
                        : "bg-emerald-100 text-emerald-700 border-emerald-300 animate-pulse"
                    }`}
                  >
                    {isScanning
                      ? "DECIPHERING ENVELOPE..."
                      : "READY TO ACQUIRE"}
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
                  <div
                    className="absolute left-0 right-0 h-[1.5px] bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse"
                    style={{
                      top: isScanning ? "55%" : "35%",
                      transition: "all 0.5s ease",
                    }}
                  />

                  {/* Top Feed Telemetry Overlay */}
                  <div className="w-full flex justify-between items-start text-xs text-emerald-500/80 uppercase tracking-wider select-none z-10">
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
                    <Camera
                      className={`${isScanning ? "text-amber-400 scale-125" : "text-emerald-500/60"} absolute transition-all duration-300`}
                      size={24}
                    />
                    {isScanning && (
                      <div className="absolute inset-0 bg-emerald-500/15 flex items-center justify-center font-mono text-xs text-emerald-400 font-bold backdrop-blur-xs">
                        ACQUIRING...
                      </div>
                    )}
                  </div>

                  {/* Bottom Guide Text */}
                  <div className="w-full text-center z-10 select-none">
                    <span className="text-sm block text-emerald-400 font-bold uppercase tracking-widest leading-none">
                      ALIGN ENCRYPTED PASS QR
                    </span>
                    <p className="text-xs text-slate-500 mt-1.5 leading-none uppercase">
                      SUPPORTED PROTOCOL: CRYPTO-MUSTER v2
                    </p>
                  </div>
                </div>

                {/* Selected user qr code emulator selector */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-mono uppercase text-slate-500 font-bold">
                    Target Mobile Occupant to Scan:
                  </label>

                  <div className="flex gap-2">
                    <select
                      value={selectedQrUser}
                      aria-label="Target mobile occupant to scan"
                      onChange={(e) => setSelectedQrUser(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-300 font-mono focus:outline-none"
                    >
                      <option value="">-- Choose scannable user --</option>
                      {occupants.map((occ) => (
                        <option key={occ.id} value={occ.id}>
                          {occ.id === decryptedToken && decryptedProfile
                            ? `${decryptedProfile.name} [${occ.id}]`
                            : `${occ.id} - ${occ.status}`}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const targetId = selectedQrUser || "usr_b3c7d6e5"; // Default mock Alice, which is the user on phone
                        const occ = occupants.find((o) => o.id === targetId);
                        if (!occ) {
                          setValidationError(
                            "No target occupant selected to simulate QR acquisition.",
                          );
                          return;
                        }

                        // Trigger visual scan overlay
                        setIsScanning(true);
                        setValidationError(null);

                        setTimeout(() => {
                          setIsScanning(false);

                          // Update status to safe and read qr payload
                          const finalZone =
                            occ.id === "usr_b3c7d6e5"
                              ? "Zone A"
                              : occ.musterZone || "Zone A";
                          onUpdateStatus(
                            occ.id,
                            "SAFE",
                            finalZone,
                            `Interactive QR check-in verified at muster terminal`,
                            false,
                          );
                          onLogEvent(
                            `Warden Tablet scanned dynamic QR Pass for occupant ${occ.id} (${occ.badgeId}). Marked SAFE in ${finalZone}.`,
                          );

                          // Also trigger decryption on tablet RAM to simulate premium TLS unsealing
                          if (occ.badgeId) {
                            setBadgeIdField(occ.badgeId);
                            requestVaultDecryption(occ.id);
                          }
                        }, 750);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl text-sm font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      SCAN QR
                    </button>
                  </div>
                  <p className="text-xs text-indigo-700 font-mono leading-snug">
                    💡 Tip: Alice (usr_b3c7d6e5) is the mock user on the left
                    mobile device. Customize her options on the phone, generate
                    the QR Pass, then scan her instantly here!
                  </p>
                </div>
              </div>
            )}

            {validationError && (
              <div className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-3 text-sm font-semibold mb-3">
                {validationError}
              </div>
            )}
          </div>

          {/* Step 2 · Verify Identity (JIT Vault) */}
          <div className="mt-4 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              STEP 2 · VERIFY IDENTITY
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Just-in-time vault decrypt — renders in RAM, auto-wipes in 5s.
            </p>
          </div>
          {/* JIT Vault Decryption Panel (Layer 5) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex-1 flex flex-col justify-center min-h-[140px]">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-bold font-mono text-amber-500">
                <ShieldAlert size={14} />
                <span>JIT VAULT · IDENTITY DECRYPT</span>
              </div>
              <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg font-mono uppercase font-bold">
                Active RAM Only
              </span>
            </div>

            {isDecrypting ? (
              <div className="text-center py-4 space-y-2">
                <RefreshCw
                  size={20}
                  className="animate-spin mx-auto text-amber-500"
                />
                <span className="text-xs font-mono text-slate-400">
                  Unsealing key map via TLS 1.3...
                </span>
              </div>
            ) : decryptedProfile ? (
              <div className="text-slate-300 flex items-start gap-3 mt-2 animate-fadeIn">
                <img
                  src={decryptedProfile.photo}
                  alt="Decrypted occupant preview"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl object-cover border border-slate-300 bg-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-slate-200 flex items-center justify-between">
                    <span>{decryptedProfile.name}</span>
                    <span className="text-xs font-mono text-slate-500 font-normal">
                      Decrypted
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 font-medium mt-0.5">
                    {decryptedProfile.role}
                  </div>
                  <div className="text-sm text-slate-500 font-mono mt-0.5">
                    {decryptedProfile.department}
                  </div>
                  <div className="text-sm text-slate-500 font-mono">
                    {decryptedProfile.phone}
                  </div>

                  {/* Dynamic clear badge */}
                  <div className="flex justify-between items-center mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <Clock size={10} /> Auto-wipe in progress
                    </span>
                    <button
                      onClick={nullifyMemory}
                      className="bg-red-100 hover:bg-red-200 text-red-700 py-2 px-3 rounded-lg border border-red-300 font-bold text-sm"
                    >
                      NULLIFY RAM
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 font-mono text-xs">
                No active decryption lease in storage. Scanned cards will unseal
                a 5s memory leak-proof profile view.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ROSTER LIST (6 Columns) */}
        <div className="md:col-span-6 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Step 3 · Sector Roster header */}
            <div className="flex justify-between items-start gap-3 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  STEP 3 · SECTOR ROSTER
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Track who is accounted for in your sector.
                </p>
              </div>
              <div className="relative w-44 shrink-0">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Filter occupant..."
                  aria-label="Filter sector roster"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* ARA Evac-Chair strip — always visible to warden */}
            {araAll.length > 0 && (
              <div
                role="group"
                aria-label={`ARA evac-chair priority: ${araInTransit.length} in transit, ${araStaged.length} staged, ${araAll.length} total`}
                className="mb-3 shrink-0 bg-amber-50 border border-amber-300 ring-1 ring-amber-200 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Accessibility
                    size={16}
                    className="text-amber-500 shrink-0"
                  />
                  <span className="text-sm font-bold font-mono text-amber-600 uppercase tracking-wide">
                    ♿ ARA · EVAC-CHAIR PRIORITY
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {araInTransit.length > 0 && (
                    <span className="text-xs font-mono font-bold bg-red-100 text-red-700 border border-red-300 px-3 py-1 rounded-lg uppercase animate-pulse">
                      {araInTransit.length} IN TRANSIT
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-700 border border-blue-300 px-3 py-1 rounded-lg uppercase">
                    {araStaged.length} STAGED
                  </span>
                  <span className="text-xs font-mono font-bold bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 rounded-lg uppercase">
                    {araAll.length} TOTAL
                  </span>
                </div>
              </div>
            )}

            {/* Missing vs Safe tabs */}
            <div
              role="tablist"
              aria-label="Roster filter"
              className="grid grid-cols-3 gap-2 mb-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "MISSING"}
                onClick={() => setActiveTab("MISSING")}
                className={`py-2.5 text-sm font-mono font-bold rounded-lg transition-all ${
                  activeTab === "MISSING"
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                MISSING ({missingCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "VISITORS"}
                onClick={() => setActiveTab("VISITORS")}
                className={`py-2.5 text-sm font-mono font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === "VISITORS"
                    ? "bg-amber-100 text-amber-700 border border-amber-300"
                    : visitorUnaccounted > 0
                      ? "text-amber-500 hover:text-amber-700"
                      : "text-slate-500 hover:text-slate-300"
                }`}
              >
                VISITORS ({visitorCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "SAFE"}
                onClick={() => setActiveTab("SAFE")}
                className={`py-2.5 text-sm font-mono font-bold rounded-lg transition-all ${
                  activeTab === "SAFE"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                SAFE ({safeCount})
              </button>
            </div>

            {/* Scrollable roster items list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 no-scrollbar">
              {filteredOccupants.length > 0 ? (
                filteredOccupants.map((occ) => (
                  <div
                    key={occ.id}
                    onClick={() => requestVaultDecryption(occ.id)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      occ.status === "SAFE"
                        ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                        : occ.status === "CRITICAL"
                          ? "bg-red-50 border-red-200 hover:bg-red-100 animate-pulse"
                          : occ.status === "NEED_HELP"
                            ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-3 h-3 rounded-full shrink-0 ${
                          occ.status === "SAFE"
                            ? "bg-emerald-400"
                            : occ.status === "CRITICAL"
                              ? "bg-red-500"
                              : occ.status === "NEED_HELP"
                                ? "bg-amber-400"
                                : "bg-gray-400"
                        }`}
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5 flex-wrap">
                          {occ.id === decryptedToken && decryptedProfile
                            ? decryptedProfile.name
                            : occ.nameEncrypted}
                          <span className="text-xs text-slate-500 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-mono">
                            {occ.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 flex-wrap">
                          <span>Badge: {occ.badgeId}</span>
                          <span>|</span>
                          <span>Quadrant: {occ.quadrant}</span>
                          {occ.isVisitor && (
                            <span className="text-xs font-mono font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-lg uppercase">
                              VISITOR
                            </span>
                          )}
                        </div>
                        {occ.alertNote && (
                          <div className="text-xs text-red-700 font-medium italic mt-0.5 line-clamp-1">
                            "{occ.alertNote}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-slate-400 mb-1">
                        {occ.lastSeen}
                      </div>
                      <span
                        className={`text-xs font-bold font-mono uppercase px-2.5 py-1 rounded-lg inline-block border ${
                          occ.status === "SAFE"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : occ.status === "CRITICAL"
                              ? "bg-red-100 text-red-700 border-red-300"
                              : occ.status === "NEED_HELP"
                                ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                : "bg-slate-100 text-slate-300 border-slate-300"
                        }`}
                      >
                        {occ.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  No matching occupants under this filter.
                </div>
              )}
            </div>
          </div>

          {/* Step 4 · Sector Actions */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              STEP 4 · SECTOR ACTIONS
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAttestQuadrant}
                className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <UserCheck size={15} />
                ATTEST QUADRANT SAFE
              </button>
              <button
                onClick={() => {
                  onLogEvent(
                    "Warden NW issued priority HOST notification: REQUESTING PARAMEDIC BACKUP NEAR SE QUADRANT COMPARTMENT.",
                  );
                  alert(
                    "Incident Host successfully notified via Bluetooth Mesh packet sync!",
                  );
                }}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-200 text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <AlertOctagon size={15} className="text-amber-500" />
                NOTIFY HOST
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sync footer */}
      <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-200 pt-3">
        <span className="flex items-center gap-1.5">
          <HardDrive size={12} className="text-slate-400" />
          <span>Local Store Encrypted via AES-256 (SQLCipher)</span>
        </span>
        <span>Last Sync: Just Now via P2P Mesh</span>
      </div>
    </div>
  );
}
