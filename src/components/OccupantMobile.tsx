import React, { useState } from "react";
import { z } from "zod";
import {
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle,
  Wifi,
  Flame,
  QrCode,
  ScanLine,
  Navigation,
  ChevronRight,
  DoorOpen,
  MapPin,
  User,
  Radio,
  Map,
  Maximize2,
  X,
} from "lucide-react";
import { Occupant } from "../types";
import { sanitizeText, validateBadgeSyntax } from "../utils";

// Schema for input evaluation complying with Level 1 validation
const alertFormSchema = z.object({
  badgeId: z.string().refine((val) => validateBadgeSyntax(val), {
    message:
      "Invalid format. Must be 2 uppercase letters + 6 numbers (e.g., NW112233).",
  }),
  note: z.string().max(200, "Notes cannot exceed 200 characters."),
});

interface OccupantMobileProps {
  occupant: Occupant;
  isBlackout: boolean;
  onUpdateStatus: (
    id: string,
    status: Occupant["status"],
    zone?: string,
    note?: string,
    fallDetected?: boolean,
  ) => void;
  stairBBlocked: boolean;
  activeDirective: string;
}

// Deterministic QR code matrix generator
const generateQRMatrix = (payload: string): boolean[][] => {
  const size = 16;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false),
  );
  let seed = 0;
  for (let i = 0; i < payload.length; i++) {
    seed = (seed << 5) - seed + payload.charCodeAt(i);
    seed |= 0;
  }
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x) > 0.5;
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r < 4 && c < 4) {
        matrix[r][c] =
          r === 0 ||
          r === 3 ||
          c === 0 ||
          c === 3 ||
          (r === 1 && c === 1) ||
          (r === 1 && c === 2) ||
          (r === 2 && c === 1) ||
          (r === 2 && c === 2);
        continue;
      }
      if (r < 4 && c >= size - 4) {
        const mc = c - (size - 4);
        matrix[r][c] =
          r === 0 ||
          r === 3 ||
          mc === 0 ||
          mc === 3 ||
          (r === 1 && mc === 1) ||
          (r === 1 && mc === 2) ||
          (r === 2 && mc === 1) ||
          (r === 2 && mc === 2);
        continue;
      }
      if (r >= size - 4 && c < 4) {
        const mr = r - (size - 4);
        matrix[r][c] =
          mr === 0 ||
          mr === 3 ||
          c === 0 ||
          c === 3 ||
          (mr === 1 && c === 1) ||
          (mr === 1 && c === 2) ||
          (mr === 2 && c === 1) ||
          (mr === 2 && c === 2);
        continue;
      }
      if (r === 5 || c === 5) {
        matrix[r][c] = (r + c) % 2 === 0;
        continue;
      }
      matrix[r][c] = random();
    }
  }
  return matrix;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  SAFE: {
    bg: "bg-emerald-600",
    text: "text-white",
    label: "SAFE",
    card: "bg-emerald-50 border-emerald-200",
  },
  MISSING: {
    bg: "bg-slate-500",
    text: "text-white",
    label: "MISSING",
    card: "bg-slate-100 border-slate-300",
  },
  NEED_HELP: {
    bg: "bg-amber-600",
    text: "text-white",
    label: "NEED HELP",
    card: "bg-amber-50 border-amber-200",
  },
  CRITICAL: {
    bg: "bg-red-600",
    text: "text-white",
    label: "CRITICAL",
    card: "bg-red-50 border-red-300",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function OccupantMobile({
  occupant,
  isBlackout,
  onUpdateStatus,
  stairBBlocked,
  activeDirective,
}: OccupantMobileProps) {
  const [activeScreen, setActiveScreen] = useState<"PROTOCOL" | "QR_PASS">(
    "PROTOCOL",
  );
  const [badgeInput, setBadgeInput] = useState("");
  const [alertNote, setAlertNote] = useState("");
  const [selectedZone, setSelectedZone] = useState("Zone A");
  const [isFallSensorEnabled, setIsFallSensorEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showBuildingMap, setShowBuildingMap] = useState(false);

  // ── Handlers (all logic preserved) ─────────────────────────────────────────
  const handleCheckIn = (status: "SAFE" | "NEED_HELP") => {
    setValidationError(null);
    setStatusMessage(null);
    const result = alertFormSchema.safeParse({
      badgeId: badgeInput.toUpperCase().trim() || occupant.badgeId,
      note: alertNote,
    });
    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }
    const safeNote = sanitizeText(alertNote);
    onUpdateStatus(
      occupant.id,
      status,
      selectedZone,
      status === "NEED_HELP" ? safeNote : undefined,
      isFallSensorEnabled,
    );
    setStatusMessage(
      isBlackout
        ? `BLE Mesh packet sent. HMAC: ${Math.random().toString(16).substring(2, 10).toUpperCase()}`
        : "Status logged to the secure chain.",
    );
  };

  const toggleFallSensor = () => {
    const newVal = !isFallSensorEnabled;
    setIsFallSensorEnabled(newVal);
    if (newVal) {
      onUpdateStatus(
        occupant.id,
        "CRITICAL",
        selectedZone,
        "Fall sensor triggered.",
        true,
      );
      setStatusMessage("⚠️ Fall alert broadcast to FSD Red List.");
    } else {
      onUpdateStatus(occupant.id, "SAFE", selectedZone, undefined, false);
      setStatusMessage("Fall sensor reset — status set to SAFE.");
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const qrPayload = `TOKEN:${occupant.id}|STATUS:${occupant.status}|ZONE:${selectedZone}|BADGE:${badgeInput || occupant.badgeId}|SEC:${isBlackout ? "MESH_HMAC" : "TLS_1.3"}`;
  const qrGrid = generateQRMatrix(qrPayload);
  const checkedIn = occupant.status === "SAFE";
  const sc = STATUS_CONFIG[occupant.status] ?? STATUS_CONFIG.MISSING;

  const ZONES = [
    {
      id: "Zone A",
      label: "Zone A — Stuyvesant Square Park",
      badge: "PRIMARY",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    {
      id: "Zone B",
      label: "Zone B — Union Square Park",
      badge: "SECONDARY",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col bg-slate-900 rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden">
      {/* ── TOP STATUS BAR ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center px-4 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Radio size={13} className="text-amber-500" />
          <span className="text-xs font-bold font-mono text-slate-300 tracking-wider">
            MusterCommand OS
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isBlackout ? (
            <span className="text-xs font-bold text-yellow-600 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
              BLE MESH
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <Wifi size={12} /> 5G Cloud
            </span>
          )}
          <span className="text-xs text-slate-400">🔋 78%</span>
        </div>
      </div>

      {/* ── CURRENT STATUS CARD ─────────────────────────────────────────────── */}
      <div
        className={`mx-4 mt-4 rounded-2xl border p-4 flex items-center gap-4 ${sc.card}`}
      >
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${sc.bg}`}
        >
          {occupant.status === "SAFE" && (
            <CheckCircle size={28} className="text-white" />
          )}
          {occupant.status === "CRITICAL" && (
            <Flame size={28} className="text-white animate-pulse" />
          )}
          {occupant.status === "NEED_HELP" && (
            <AlertTriangle size={26} className="text-white" />
          )}
          {occupant.status === "MISSING" && (
            <User size={26} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-0.5">
            Your Status
          </div>
          <div
            className={`text-2xl font-black uppercase leading-none ${
              occupant.status === "SAFE"
                ? "text-emerald-700"
                : occupant.status === "CRITICAL"
                  ? "text-red-700"
                  : occupant.status === "NEED_HELP"
                    ? "text-amber-700"
                    : "text-slate-300"
            }`}
          >
            {sc.label}
          </div>
          <div className="text-xs text-slate-500 font-mono mt-1 truncate">
            {occupant.id} · Badge {occupant.badgeId}
          </div>
        </div>
        <ShieldCheck size={18} className="text-slate-400 shrink-0" />
      </div>

      {/* ── ACTIVE FSD DIRECTIVE ────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-600 border-b border-amber-500">
          <Flame size={14} className="text-white shrink-0" />
          <span className="text-xs font-black text-white uppercase tracking-wider">
            FSD Active Directive
          </span>
          <span className="ml-auto text-xs font-mono text-amber-200 font-bold">
            F-89
          </span>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-200 leading-snug">
            {activeDirective}
          </p>
          {stairBBlocked && (
            <div className="mt-2 flex items-center gap-2 bg-yellow-100 border border-yellow-400 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-yellow-700 shrink-0" />
              <span className="text-xs font-bold text-yellow-900">
                STAIR B BLOCKED — Use Stair A (North) only
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── SCREEN TABS ─────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Screen selection"
        className="mx-4 mt-3 grid grid-cols-2 gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800"
      >
        {(
          [
            {
              id: "PROTOCOL" as const,
              label: "Protocol & Check-in",
              dot: false,
            },
            {
              id: "QR_PASS" as const,
              label: "Muster QR Pass",
              dot: !checkedIn,
            },
          ] satisfies Array<{
            id: "PROTOCOL" | "QR_PASS";
            label: string;
            dot: boolean;
          }>
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeScreen === tab.id}
            onClick={() => setActiveScreen(tab.id)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeScreen === tab.id
                ? "bg-slate-900 text-slate-100 border border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {tab.dot && (
              <span
                aria-label="Pending"
                className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"
              />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SCROLLABLE MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
        {activeScreen === "PROTOCOL" ? (
          <>
            {/* ── KNOW YOUR BUILDING — orientation map at the front ───── */}
            <section aria-labelledby="building-heading">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Map size={15} />
                </span>
                <h3
                  id="building-heading"
                  className="text-sm font-black text-slate-200 uppercase tracking-wide"
                >
                  Know Your Building
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBuildingMap(true)}
                aria-label="Open full building map"
                className="w-full relative bg-white border-2 border-blue-400 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-600 hover:shadow-lg transition-all group"
              >
                <img
                  src="/building-plan.png"
                  alt="4 Irving Place building plan showing elevator banks, stairs and exits"
                  className="w-full h-44 object-contain bg-white p-1"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-blue-600 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    4 Irving Place · Elevator banks, stairs &amp; exits
                  </p>
                  <span className="flex items-center gap-1 text-xs text-blue-100 font-semibold shrink-0">
                    <Maximize2 size={12} /> Full map
                  </span>
                </div>
              </button>
              <p className="text-xs text-slate-400 mt-2 leading-snug">
                Locate{" "}
                <span className="font-black text-emerald-700">
                  Stair A (North)
                </span>{" "}
                and the main lobby before an emergency.{" "}
                <span className="font-semibold text-blue-700">
                  Tap the map to enlarge.
                </span>
              </p>
            </section>

            {/* ── STEP 1: YOUR EVACUATION ROUTE ───────────────── */}
            <section aria-labelledby="step1-heading">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-sm font-black shrink-0">
                  1
                </span>
                <h3
                  id="step1-heading"
                  className="text-sm font-black text-slate-200 uppercase tracking-wide"
                >
                  Your Evacuation Route
                </h3>
              </div>

              {/* Stair blocked warning */}
              {stairBBlocked && (
                <div className="mb-3 bg-yellow-100 border-2 border-yellow-500 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <AlertTriangle
                    size={16}
                    className="text-yellow-700 shrink-0"
                  />
                  <p className="text-xs font-black text-yellow-900 uppercase tracking-wide">
                    Stair B BLOCKED — Use Stair A (North) only
                  </p>
                </div>
              )}

              {/* 3-step route — clear, full names, color-coded */}
              <div className="flex flex-col gap-2">
                {/* Step A: Exit */}
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <DoorOpen size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-0.5">
                      A · Exit the Floor
                    </div>
                    <div className="text-sm font-black text-emerald-900">
                      {stairBBlocked
                        ? "Stair A (North) — ONLY ROUTE"
                        : "Stair A (North) • 7th Fl Corridor"}
                    </div>
                    <div className="text-xs text-emerald-700 mt-0.5">
                      Do NOT use elevators. Stairs only.
                    </div>
                  </div>
                  <CheckCircle
                    size={18}
                    className="text-emerald-500 shrink-0"
                  />
                </div>

                {/* Step B: Assemble — dynamically matches selected zone */}
                <div className="bg-blue-50 border-2 border-blue-400 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <MapPin size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-0.5">
                      B · Assemble Outside
                    </div>
                    <div className="text-sm font-black text-blue-900">
                      {selectedZone === "Zone A"
                        ? "Stuyvesant Square Park"
                        : "Union Square Park"}
                    </div>
                    <div className="text-xs text-blue-700 mt-0.5">
                      {selectedZone === "Zone A"
                        ? "Between 17th & 15th St — PRIMARY zone"
                        : "Along East 14th St — SECONDARY zone"}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-black px-2 py-1 rounded-lg border ${
                      selectedZone === "Zone A"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-400"
                        : "bg-blue-100 text-blue-700 border-blue-400"
                    }`}
                  >
                    {selectedZone === "Zone A" ? "PRIMARY" : "SECONDARY"}
                  </span>
                </div>

                {/* Step C: Check in */}
                <div
                  className={`rounded-xl px-4 py-3 flex items-center gap-3 border-2 ${
                    checkedIn
                      ? "bg-emerald-50 border-emerald-400"
                      : "bg-slate-50 border-slate-300"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      checkedIn ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <CheckCircle size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${
                        checkedIn ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      C · Check In with Warden
                    </div>
                    <div
                      className={`text-sm font-black ${
                        checkedIn ? "text-emerald-900" : "text-slate-400"
                      }`}
                    >
                      {checkedIn ? "✓ Accounted for" : "Tap I'M SAFE below"}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── STEP 2: CONFIRM ASSEMBLY ZONE ───────────────────────────── */}
            <section aria-labelledby="step2-heading">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-sm font-black shrink-0">
                  2
                </span>
                <h3
                  id="step2-heading"
                  className="text-sm font-black text-slate-200 uppercase tracking-wide"
                >
                  Confirm Assembly Zone
                </h3>
              </div>
              <div className="space-y-2">
                {ZONES.map((z) => (
                  <label
                    key={z.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedZone === z.id
                        ? "bg-amber-50 border-amber-400 shadow-sm"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="zone"
                        checked={selectedZone === z.id}
                        onChange={() => setSelectedZone(z.id)}
                        className="w-4 h-4 accent-amber-600"
                        aria-label={z.label}
                      />
                      <span
                        className={`text-sm font-semibold ${selectedZone === z.id ? "text-slate-200" : "text-slate-200"}`}
                      >
                        {z.label}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${z.badgeColor}`}
                    >
                      {z.badge}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* ── STEP 3: CONFIRM YOUR IDENTITY ───────────────────────────── */}
            <section aria-labelledby="step3-heading">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-sm font-black shrink-0">
                  3
                </span>
                <h3
                  id="step3-heading"
                  className="text-sm font-black text-slate-200 uppercase tracking-wide"
                >
                  Confirm Your Identity
                </h3>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div>
                  <label
                    htmlFor="badge-input"
                    className="block text-sm font-semibold text-slate-300 mb-1.5"
                  >
                    Badge ID
                  </label>
                  <input
                    id="badge-input"
                    type="text"
                    placeholder={`e.g. ${occupant.badgeId}`}
                    value={badgeInput}
                    onChange={(e) =>
                      setBadgeInput(e.target.value.toUpperCase())
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-500"
                    aria-describedby="badge-hint"
                  />
                  <p id="badge-hint" className="text-xs text-slate-400 mt-1.5">
                    2 letters + 6 digits (pre-filled if scanned at gate)
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="alert-note"
                    className="block text-sm font-semibold text-slate-300 mb-1.5"
                  >
                    Alert Note{" "}
                    <span className="text-slate-500 font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="alert-note"
                    placeholder="Describe any hazard, injury, or situation…"
                    value={alertNote}
                    onChange={(e) => setAlertNote(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 resize-none placeholder:text-slate-500"
                  />
                </div>
              </div>
            </section>

            {/* ── FALL DETECTION SENSOR — always visible, prominent ───────── */}
            <section aria-labelledby="fall-heading">
              <div
                className={`rounded-2xl border overflow-hidden ${
                  isFallSensorEnabled
                    ? "border-red-400 bg-red-50"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                {/* Header */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 border-b ${
                    isFallSensorEnabled
                      ? "bg-red-600 border-red-500"
                      : "bg-slate-800/60 border-slate-700"
                  }`}
                >
                  <Activity
                    size={18}
                    className={
                      isFallSensorEnabled
                        ? "text-white animate-pulse"
                        : "text-emerald-500"
                    }
                  />
                  <div className="flex-1">
                    <h3
                      id="fall-heading"
                      className={`text-sm font-black uppercase tracking-wide ${
                        isFallSensorEnabled ? "text-white" : "text-slate-200"
                      }`}
                    >
                      Fall Detection Sensor
                    </h3>
                    <p
                      className={`text-xs font-mono ${
                        isFallSensorEnabled ? "text-red-100" : "text-slate-400"
                      }`}
                    >
                      OSHA 1910.38 · Tilt / Accelerometer
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border font-mono ${
                      isFallSensorEnabled
                        ? "bg-white/20 text-white border-white/40"
                        : "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                    }`}
                  >
                    {isFallSensorEnabled ? "ALERT" : "STABLE"}
                  </span>
                </div>

                {/* Body */}
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Sensor reading */}
                    <div>
                      <div
                        className={`text-xl font-black font-mono leading-tight ${
                          isFallSensorEnabled
                            ? "text-red-700"
                            : "text-slate-200"
                        }`}
                      >
                        {isFallSensorEnabled ? "0.1 G — IMPACT" : "1.0 G"}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {isFallSensorEnabled
                          ? "Impact detected — alert sent to FSD"
                          : "Normal reading — sensor monitoring"}
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={toggleFallSensor}
                        aria-label={
                          isFallSensorEnabled
                            ? "Reset fall sensor"
                            : "Simulate fall detection"
                        }
                        aria-pressed={isFallSensorEnabled}
                        className={`w-14 h-7 rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          isFallSensorEnabled
                            ? "bg-red-600 focus:ring-red-400"
                            : "bg-slate-600 focus:ring-slate-400"
                        }`}
                        id="btn-simulate-fall"
                      >
                        <div
                          className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ${
                            isFallSensorEnabled ? "translate-x-7" : ""
                          }`}
                        />
                      </button>
                      <span className="text-xs text-slate-400">Simulate</span>
                    </div>
                  </div>

                  {/* Active alert banner */}
                  {isFallSensorEnabled && (
                    <div className="mt-3 bg-red-100 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-2">
                      <AlertTriangle
                        size={16}
                        className="text-red-700 shrink-0 mt-0.5"
                      />
                      <p className="text-sm font-bold text-red-800">
                        Emergency broadcast sent to FSD Red List. FDNY response
                        initiated. Stay in place if safe to do so.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : (
          /* ── QR PASS SCREEN ─────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-5 animate-fadeIn">
            <div className="text-center">
              <span className="inline-block text-sm font-bold px-4 py-2 bg-amber-600 text-white rounded-xl uppercase tracking-wider">
                Muster Station QR Pass
              </span>
              <p className="text-sm text-slate-300 mt-2.5 leading-relaxed max-w-xs">
                Show this QR to a warden tablet or muster gate scanner to log
                your check-in.
              </p>
            </div>

            {/* QR Code */}
            <div className="relative p-4 bg-white rounded-2xl shadow-xl border-2 border-slate-200 flex flex-col items-center justify-center">
              <div className="grid grid-cols-16 gap-[1.5px] bg-white p-1">
                {qrGrid.map((row, rIdx) =>
                  row.map((active, cIdx) => (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      className={`w-[11.5px] h-[11.5px] rounded-[1px] transition-colors duration-300 ${
                        active
                          ? occupant.status === "SAFE"
                            ? "bg-[#0f172a]"
                            : occupant.status === "CRITICAL"
                              ? "bg-[#7f1d1d]"
                              : "bg-[#08263f]"
                          : "bg-white"
                      }`}
                    />
                  )),
                )}
              </div>
              <div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse opacity-70"
                style={{ animationDuration: "1.8s" }}
              />
              <div className="absolute top-2 right-2">
                <ScanLine size={14} className="text-slate-400 opacity-60" />
              </div>
            </div>

            {/* Pass details */}
            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5 font-mono">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Field
                </span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Value
                </span>
              </div>
              {[
                { label: "Token", value: occupant.id, color: "text-amber-400" },
                { label: "Zone", value: selectedZone, color: "text-slate-200" },
                {
                  label: "Badge",
                  value: badgeInput || occupant.badgeId,
                  color: "text-slate-200",
                },
                {
                  label: "Status",
                  value: occupant.status,
                  color:
                    occupant.status === "SAFE"
                      ? "text-emerald-400"
                      : occupant.status === "CRITICAL"
                        ? "text-red-400"
                        : "text-amber-400",
                  pulse: occupant.status === "CRITICAL",
                },
              ].map(({ label, value, color, pulse }) => (
                <div
                  key={label}
                  className="flex justify-between items-center gap-4"
                >
                  <span className="text-sm text-slate-500">{label}:</span>
                  <span
                    className={`text-sm font-bold uppercase truncate ${color} ${pulse ? "animate-pulse" : ""}`}
                  >
                    {value}
                  </span>
                </div>
              ))}

              <div className="pt-2.5 border-t border-slate-800">
                <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">
                  HMAC / SHA-256 Payload
                </span>
                <p className="text-xs text-slate-400 leading-tight select-all break-all bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  {qrPayload}
                </p>
              </div>
            </div>

            {/* Simulate gate scan */}
            <button
              type="button"
              aria-label="Simulate muster gate scan and check in as safe"
              onClick={() => {
                onUpdateStatus(
                  occupant.id,
                  "SAFE",
                  selectedZone,
                  `QR scanned at Muster Gate ${selectedZone}`,
                  false,
                );
                setStatusMessage(`Check-in logged via QR at ${selectedZone}.`);
                setActiveScreen("PROTOCOL");
              }}
              className="w-full min-h-14 bg-slate-800 hover:bg-slate-700 text-slate-100 text-base font-bold border border-slate-700 rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-4 focus:ring-slate-400/40"
            >
              <QrCode size={20} aria-hidden="true" className="text-amber-500" />
              Simulate Gate Scan
            </button>
          </div>
        )}
      </div>

      {/* ── FEEDBACK MESSAGES ────────────────────────────────────────────────── */}
      {validationError && (
        <div
          role="alert"
          className="mx-4 mb-3 bg-red-50 border border-red-300 p-3.5 rounded-2xl flex items-start gap-3"
        >
          <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm font-semibold text-red-800">
            {validationError}
          </p>
        </div>
      )}
      {statusMessage && (
        <div
          role="status"
          className="mx-4 mb-3 bg-emerald-50 border border-emerald-300 p-3.5 rounded-2xl flex items-start gap-3"
        >
          <CheckCircle size={18} className="shrink-0 text-emerald-600 mt-0.5" />
          <p className="text-sm font-semibold text-emerald-800">
            {statusMessage}
          </p>
        </div>
      )}

      {/* ── FIXED ACTION BUTTONS ─────────────────────────────────────────────── */}
      <div className="px-4 pb-5 pt-3 border-t border-slate-800 flex flex-col gap-3 bg-slate-900">
        {/* PRIMARY — I'm Safe */}
        <button
          type="button"
          onClick={() => handleCheckIn("SAFE")}
          aria-label="I am safe — check in now"
          className="w-full min-h-16 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xl rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-400/60"
          id="btn-evac-safe"
        >
          <CheckCircle size={26} aria-hidden="true" />
          I'M SAFE
        </button>

        {/* SECONDARY — Need Help / SOS */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleCheckIn("NEED_HELP")}
            aria-label="I need help — notify warden"
            className="min-h-14 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition-all active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-400/50"
            id="btn-evac-help"
          >
            <AlertTriangle size={20} aria-hidden="true" />
            Need Help
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateStatus(
                occupant.id,
                "CRITICAL",
                selectedZone,
                "🚨 SOS PANIC — active device alarm triggered.",
                true,
              );
              setStatusMessage("⚠️ SOS broadcast sent to FSD and warden.");
            }}
            aria-label="Emergency SOS — alert FSD immediately"
            className="min-h-14 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-md shadow-red-600/20 transition-all active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-4 focus:ring-red-400/50"
            id="btn-sos-panic"
          >
            <Flame size={20} aria-hidden="true" />
            SOS
          </button>
        </div>
      </div>

      {/* ── FULLSCREEN BUILDING MAP MODAL ──────────────────────── */}
      {showBuildingMap && (
        <div
          role="dialog"
          aria-label="Building map"
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowBuildingMap(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-blue-600">
              <div className="flex items-center gap-2">
                <Map size={18} className="text-white" />
                <span className="text-sm font-black text-white uppercase tracking-wide">
                  Know Your Building — 4 Irving Place
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowBuildingMap(false)}
                aria-label="Close building map"
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50">
              {/* Building overview */}
              <div className="p-3 border-b border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                    1
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Building Overview — Elevator Banks &amp; Stairs
                  </span>
                </div>
                <img
                  src="/building-plan.png"
                  alt="Full 4 Irving Place building plan with elevator banks, stairs, standpipes and FD connections"
                  className="w-full h-auto rounded-xl border-2 border-slate-200"
                />
              </div>

              {/* Floor 7 As-Built */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                    2
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Floor 7 As-Built — Your Workspace
                  </span>
                </div>
                <img
                  src="/floor7-plan.png"
                  alt="7th floor As-Built plan showing all office suites, elevator lobbies C/D/E/G, stairs A/B/C/D"
                  className="w-full h-auto rounded-xl border-2 border-slate-200"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-white">
              <p className="text-xs text-slate-400 leading-snug">
                Find{" "}
                <span className="font-black text-emerald-700">
                  Stair A (North)
                </span>{" "}
                on Floor 7 and the{" "}
                <span className="font-black text-blue-700">Bank A Car #14</span>{" "}
                elevator (FSD/FDNY only). In a fire, use stairs only.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
