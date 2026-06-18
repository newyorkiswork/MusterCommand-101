import React, { useState, useRef } from "react";
import { Occupant } from "../types";
import {
  Users,
  MapPin,
  Activity,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";

interface FloorMapProps {
  occupants: Occupant[];
  stairBBlocked: boolean; // controls the blockable secondary stair (Stair C)
  onToggleStairB: () => void;
  onOccupantClick?: (occupant: Occupant) => void;
  selectedQuadrant?: string | null;
  onQuadrantClick?: (quadrant: string) => void;
}

// Department label per departmental quadrant (4 Irving Plaza, Floor 7 pilot).
const QUAD_META: Record<string, { dept: string }> = {
  NW: { dept: "Engineering" },
  NE: { dept: "Comms & Gov Affairs" },
  SW: { dept: "Legal" },
  SE: { dept: "IT & Visitors" },
};

// Building features transcribed from the FDNY "Get to Know Your Building" plan.
// Coordinates are in the SVG viewBox (0 0 400 300). Each feature is tagged with
// the departmental quadrant it sits in so status overlays stay consistent.
const ELEVATOR_BANKS = [
  { id: "G", x: 92, y: 46, w: 36, h: 15, nums: "12", quad: "NW" },
  { id: "F", x: 76, y: 102, w: 36, h: 15, nums: "5·10", quad: "NW" },
  { id: "D", x: 224, y: 42, w: 44, h: 15, nums: "31·33-35", quad: "NE" },
  { id: "C", x: 252, y: 96, w: 44, h: 15, nums: "24-29", quad: "NE" },
  { id: "B", x: 220, y: 150, w: 44, h: 15, nums: "18-23", quad: "SE" },
  { id: "E", x: 76, y: 182, w: 36, h: 15, nums: "1·2", quad: "SW" },
  { id: "A", x: 290, y: 186, w: 44, h: 15, nums: "14-17", quad: "SE" },
];

// "Access Stair / Escalator" (orange) — Bank T, down to basement.
const ACCESS_STAIR = { id: "T", x: 94, y: 230, w: 36, h: 15, nums: "1" };

// Stairs (green, most with a standpipe). Stair A is the always-clear primary
// egress at the Main Entrance. Stair C is the interactive/blockable one and is
// rendered separately so it can react to the toggle.
const STAIRS = [
  { id: "G", x: 150, y: 40, sp: true },
  { id: "F", x: 140, y: 100, sp: true },
  { id: "D", x: 302, y: 40, sp: true },
  { id: "E", x: 140, y: 180, sp: true },
  { id: "A", x: 236, y: 230, sp: true, primary: true },
];

const BLIND_SHAFTS = [
  { x: 130, y: 74 },
  { x: 300, y: 118 },
  { x: 268, y: 168 },
];

const MER_ROOMS = [
  { x: 338, y: 168 },
  { x: 62, y: 64 },
];

// Combination FD Connections (yellow) around the building perimeter.
const FD_CONNECTIONS = [
  { x: 178, y: 262 },
  { x: 60, y: 150 },
  { x: 150, y: 33 },
  { x: 354, y: 118 },
];

export default function FloorMap({
  occupants,
  stairBBlocked,
  onToggleStairB,
  onOccupantClick,
  selectedQuadrant,
  onQuadrantClick,
}: FloorMapProps) {
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"MAP" | "LIST">("MAP");

  // Pan / zoom state for the building plan.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const clampZoom = (z: number) => Math.max(1, Math.min(3, z));
  const zoomIn = () => setZoom((z) => clampZoom(z * 1.25));
  const zoomOut = () =>
    setZoom((z) => {
      const next = clampZoom(z / 1.25);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.2 : -0.2)));
  };
  const handleDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = 400 / (rect.width || 400);
    const sy = 300 / (rect.height || 300);
    const dx = (e.clientX - dragRef.current.x) * sx;
    const dy = (e.clientY - dragRef.current.y) * sy;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const quadrants = ["NW", "NE", "SW", "SE"];

  const getQuadrantOccupants = (quadrant: string) => {
    return occupants.filter((o) => o.quadrant === quadrant);
  };

  const getQuadrantStats = (quadrant: string) => {
    const quadOccupants = getQuadrantOccupants(quadrant);
    const accounted = quadOccupants.filter(
      (o) => o.status === "ACCOUNTED",
    ).length;
    const medical = quadOccupants.filter((o) => o.status === "MEDICAL").length;
    const ara = quadOccupants.filter((o) => o.status === "ARA_STAGING").length;
    const missing = quadOccupants.filter((o) => o.status === "MISSING").length;
    return { total: quadOccupants.length, accounted, medical, ara, missing };
  };

  // Status fill tint for each quadrant zone.
  const getQuadrantColor = (quadrant: string) => {
    const stats = getQuadrantStats(quadrant);
    if (stats.medical > 0) return "rgba(239, 68, 68, 0.18)";
    if (stats.missing > 0) return "rgba(245, 158, 11, 0.15)";
    if (stats.ara > 0) return "rgba(59, 130, 246, 0.14)";
    if (stats.total > 0 && stats.accounted === stats.total)
      return "rgba(16, 185, 129, 0.12)";
    return "rgba(100, 116, 139, 0.06)";
  };

  // Quadrant zone geometry inside the building footprint.
  const ZONES: Record<string, { x: number; y: number; w: number; h: number }> =
    {
      NW: { x: 58, y: 30, w: 150, h: 119 },
      NE: { x: 208, y: 30, w: 150, h: 119 },
      SW: { x: 58, y: 149, w: 150, h: 119 },
      SE: { x: 208, y: 149, w: 150, h: 119 },
    };

  return (
    <div className="flex flex-col h-full">
      {/* Map Header with View Toggle */}
      <div className="flex justify-between items-center mb-2 shrink-0">
        <div>
          <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
            Get to Know Your Building · 4 Irving Plaza
          </span>
          <h3 className="text-sm font-bold text-slate-200 uppercase font-sans flex items-center gap-2">
            <Users size={14} className="text-amber-500" />
            {occupants.length} Occupants · Floor 7
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-indigo-950 text-indigo-400 px-1.5 rounded font-mono">
            RS-17 Compliant
          </span>
          <div className="flex gap-0.5 bg-slate-900 rounded p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("MAP")}
              className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all ${
                viewMode === "MAP"
                  ? "bg-amber-600 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              MAP
            </button>
            <button
              type="button"
              onClick={() => setViewMode("LIST")}
              className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all ${
                viewMode === "LIST"
                  ? "bg-amber-600 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              LIST
            </button>
          </div>
        </div>
      </div>

      {viewMode === "MAP" ? (
        <>
          {/* Building Plan — modeled on the FDNY "Get to Know Your Building" sheet */}
          <div
            className={`flex-1 bg-slate-950 rounded-xl border border-slate-850 p-3 relative overflow-hidden ${
              isExpanded ? "min-h-[560px]" : "min-h-[320px]"
            }`}
          >
            {/* Zoom / pan controls */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
              <button
                type="button"
                onClick={zoomIn}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-all cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={zoomOut}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-all cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-all cursor-pointer"
                title={isExpanded ? "Shrink map" : "Expand map"}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                <button
                  type="button"
                  onClick={resetView}
                  className="w-7 h-7 flex items-center justify-center bg-amber-900/80 border border-amber-700 rounded-lg text-amber-200 hover:text-white transition-all cursor-pointer"
                  title="Reset view"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>

            <svg
              viewBox="0 0 400 300"
              className="w-full h-full"
              style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onMouseDown={handleDown}
              onMouseMove={handleMove}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
            >
              <defs>
                <pattern
                  id="grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                </pattern>
                <pattern
                  id="stairHatch"
                  width="3"
                  height="3"
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="3" height="3" fill="#064e3b" />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="3"
                    stroke="#10b981"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {/* Street labels around the building */}
                <text
                  x="46"
                  y="150"
                  fill="#64748b"
                  fontSize="7"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  transform="rotate(-90 46 150)"
                >
                  EAST 15 STREET
                </text>
                <text
                  x="372"
                  y="150"
                  fill="#64748b"
                  fontSize="7"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  transform="rotate(90 372 150)"
                >
                  EAST 14 STREET
                </text>
                <text
                  x="208"
                  y="290"
                  fill="#64748b"
                  fontSize="7"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  IRVING PLACE
                </text>
                <text
                  x="150"
                  y="24"
                  fill="#475569"
                  fontSize="6"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  ▲ STEPS
                </text>
                <text
                  x="300"
                  y="24"
                  fill="#475569"
                  fontSize="5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  (2) 550 GAL DIESEL TANK
                </text>

                {/* Compass (rotated as on the FDNY sheet: E up, N left, S right, W down) */}
                <g transform="translate(34, 52)">
                  <circle
                    r="11"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    y1="-11"
                    x2="0"
                    y2="11"
                    stroke="#475569"
                    strokeWidth="0.7"
                  />
                  <line
                    x1="-11"
                    y1="0"
                    x2="11"
                    y2="0"
                    stroke="#475569"
                    strokeWidth="0.7"
                  />
                  <text
                    x="0"
                    y="-13"
                    fill="#94a3b8"
                    fontSize="5"
                    textAnchor="middle"
                  >
                    E
                  </text>
                  <text
                    x="0"
                    y="17"
                    fill="#94a3b8"
                    fontSize="5"
                    textAnchor="middle"
                  >
                    W
                  </text>
                  <text
                    x="-15"
                    y="2"
                    fill="#94a3b8"
                    fontSize="5"
                    textAnchor="middle"
                  >
                    N
                  </text>
                  <text
                    x="15"
                    y="2"
                    fill="#94a3b8"
                    fontSize="5"
                    textAnchor="middle"
                  >
                    S
                  </text>
                </g>

                {/* Building footprint */}
                <rect
                  x="58"
                  y="30"
                  width="300"
                  height="238"
                  rx="4"
                  fill="#0b1220"
                  stroke="#334155"
                  strokeWidth="2"
                />

                {/* Interactive departmental quadrant zones (status-tinted + clickable) */}
                {quadrants.map((quad) => {
                  const z = ZONES[quad];
                  const stats = getQuadrantStats(quad);
                  const isSelected = selectedQuadrant === quad;
                  const isHovered = hoveredQuadrant === quad;
                  const hasIssues = stats.medical > 0 || stats.missing > 0;
                  return (
                    <g
                      key={quad}
                      onMouseEnter={() => setHoveredQuadrant(quad)}
                      onMouseLeave={() => setHoveredQuadrant(null)}
                      onClick={() => onQuadrantClick && onQuadrantClick(quad)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={z.x}
                        y={z.y}
                        width={z.w}
                        height={z.h}
                        fill={getQuadrantColor(quad)}
                        stroke={
                          isSelected
                            ? "#f59e0b"
                            : isHovered
                              ? "#64748b"
                              : "#1e293b"
                        }
                        strokeWidth={isSelected ? "2" : "1"}
                        strokeDasharray={isSelected ? "none" : "4 4"}
                      />
                      <text
                        x={z.x + 6}
                        y={z.y + 12}
                        fill={isSelected ? "#fbbf24" : "#64748b"}
                        fontSize="7.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {quad} · {QUAD_META[quad].dept}
                      </text>
                      {/* Safe badge */}
                      <g transform={`translate(${z.x + z.w - 34}, ${z.y + 4})`}>
                        <rect
                          x="0"
                          y="0"
                          width="30"
                          height="14"
                          rx="3"
                          fill={hasIssues ? "#7f1d1d" : "#064e3b"}
                          opacity="0.85"
                        />
                        <text
                          x="15"
                          y="10"
                          fill="#fff"
                          fontSize="7"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {stats.accounted}/{stats.total}
                        </text>
                      </g>
                      {hasIssues && (
                        <text
                          x={z.x + 6}
                          y={z.y + z.h - 6}
                          fill="#fca5a5"
                          fontSize="6.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {stats.medical > 0 && `⚕${stats.medical} `}
                          {stats.missing > 0 && `?${stats.missing}`}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Blind shafts (cyan) */}
                {BLIND_SHAFTS.map((b, i) => (
                  <rect
                    key={`bs-${i}`}
                    x={b.x}
                    y={b.y}
                    width="11"
                    height="11"
                    rx="1.5"
                    fill="#0e7490"
                    stroke="#22d3ee"
                    strokeWidth="0.8"
                  />
                ))}

                {/* MER rooms (yellow) */}
                {MER_ROOMS.map((m, i) => (
                  <g key={`mer-${i}`}>
                    <rect
                      x={m.x}
                      y={m.y}
                      width="13"
                      height="11"
                      rx="1.5"
                      fill="#a16207"
                      stroke="#eab308"
                      strokeWidth="0.8"
                    />
                    <text
                      x={m.x + 6.5}
                      y={m.y + 8}
                      fill="#fde68a"
                      fontSize="5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      MER
                    </text>
                  </g>
                ))}

                {/* Elevator banks (blue) — tap to filter that quadrant */}
                {ELEVATOR_BANKS.map((bank) => (
                  <g
                    key={`bank-${bank.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuadrantClick && onQuadrantClick(bank.quad);
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x={bank.x}
                      y={bank.y}
                      width={bank.w}
                      height={bank.h}
                      rx="2"
                      fill="#1e3a8a"
                      stroke={
                        selectedQuadrant === bank.quad ? "#fbbf24" : "#3b82f6"
                      }
                      strokeWidth={selectedQuadrant === bank.quad ? "2" : "1"}
                    />
                    <text
                      x={bank.x + 7}
                      y={bank.y + 10.5}
                      fill="#bfdbfe"
                      fontSize="8"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {bank.id}
                    </text>
                    <text
                      x={bank.x + bank.w / 2 + 4}
                      y={bank.y + 10}
                      fill="#93c5fd"
                      fontSize="5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {bank.nums}
                    </text>
                  </g>
                ))}

                {/* Access stair / escalator (orange) — Bank T */}
                <g>
                  <rect
                    x={ACCESS_STAIR.x}
                    y={ACCESS_STAIR.y}
                    width={ACCESS_STAIR.w}
                    height={ACCESS_STAIR.h}
                    rx="2"
                    fill="#9a3412"
                    stroke="#f97316"
                    strokeWidth="1"
                  />
                  <text
                    x={ACCESS_STAIR.x + ACCESS_STAIR.w / 2}
                    y={ACCESS_STAIR.y + 7}
                    fill="#fed7aa"
                    fontSize="6"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    BANK T
                  </text>
                  <text
                    x={ACCESS_STAIR.x + ACCESS_STAIR.w / 2}
                    y={ACCESS_STAIR.y + 13}
                    fill="#fdba74"
                    fontSize="4.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    ↓ BSMT
                  </text>
                </g>

                {/* Stairs (green w/ standpipe). Stair A is primary egress. */}
                {STAIRS.map((s) => (
                  <g key={`stair-${s.id}`}>
                    <rect
                      x={s.x}
                      y={s.y}
                      width="24"
                      height="16"
                      rx="2"
                      fill="url(#stairHatch)"
                      stroke="#10b981"
                      strokeWidth={s.primary ? "2" : "1.2"}
                    />
                    <text
                      x={s.x + 12}
                      y={s.y + 7}
                      fill="#d1fae5"
                      fontSize="6.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      STR {s.id}
                    </text>
                    <text
                      x={s.x + 12}
                      y={s.y + 13}
                      fill="#6ee7b7"
                      fontSize="4.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {s.primary ? "✓ PRIMARY" : "✓ CLEAR"}
                    </text>
                    {s.sp && (
                      <circle
                        cx={s.x + 22}
                        cy={s.y - 1}
                        r="3"
                        fill="#dc2626"
                        stroke="#fca5a5"
                        strokeWidth="0.5"
                      />
                    )}
                  </g>
                ))}

                {/* Stair C — interactive blockable secondary egress */}
                <g
                  onClick={onToggleStairB}
                  className="cursor-pointer transition-all hover:opacity-80"
                >
                  <rect
                    x="318"
                    y="96"
                    width="28"
                    height="18"
                    rx="2"
                    fill={stairBBlocked ? "#7f1d1d" : "url(#stairHatch)"}
                    stroke={stairBBlocked ? "#ef4444" : "#10b981"}
                    strokeWidth="2"
                  />
                  <text
                    x="332"
                    y="104"
                    fill={stairBBlocked ? "#fca5a5" : "#d1fae5"}
                    fontSize="6.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    STR C
                  </text>
                  <text
                    x="332"
                    y="111"
                    fill={stairBBlocked ? "#fbbf24" : "#6ee7b7"}
                    fontSize="4.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    className={stairBBlocked ? "animate-pulse" : ""}
                  >
                    {stairBBlocked ? "⚠ BLOCKED" : "✓ CLEAR"}
                  </text>
                  <circle
                    cx="344"
                    cy="95"
                    r="3"
                    fill="#dc2626"
                    stroke="#fca5a5"
                    strokeWidth="0.5"
                  />
                </g>

                {/* Fire Command Station (FCS) near Bank A / Main Entrance */}
                <g>
                  <rect
                    x="338"
                    y="204"
                    width="16"
                    height="14"
                    rx="2"
                    fill="#b45309"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                  <text
                    x="346"
                    y="213"
                    fill="#fde68a"
                    fontSize="6"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    FCS
                  </text>
                </g>

                {/* Combination FD Connections (yellow) on the perimeter */}
                {FD_CONNECTIONS.map((f, i) => (
                  <g key={`fd-${i}`}>
                    <circle
                      cx={f.x}
                      cy={f.y}
                      r="4"
                      fill="#facc15"
                      stroke="#854d0e"
                      strokeWidth="0.7"
                    />
                    <text
                      x={f.x}
                      y={f.y + 2.4}
                      fill="#713f12"
                      fontSize="5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      Y
                    </text>
                  </g>
                ))}

                {/* Main Entrance marker (Irving Place) */}
                <g>
                  <rect
                    x="196"
                    y="258"
                    width="60"
                    height="10"
                    rx="2"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="0.8"
                  />
                  <text
                    x="226"
                    y="265"
                    fill="#cbd5e1"
                    fontSize="5.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    MAIN ENTRANCE
                  </text>
                </g>

                {/* Fire hazard indicator over the NE office */}
                <g>
                  <circle
                    cx="300"
                    cy="70"
                    r="14"
                    fill="#7f1d1d"
                    fillOpacity="0.3"
                    className="animate-pulse"
                  />
                  <circle
                    cx="300"
                    cy="70"
                    r="9"
                    fill="#ef4444"
                    fillOpacity="0.7"
                  />
                  <circle
                    cx="300"
                    cy="70"
                    r="12"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    className="animate-ping"
                  />
                  <text
                    x="300"
                    y="72"
                    fill="#fef08a"
                    fontSize="6"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    FIRE
                  </text>
                </g>

                {/* Area of Rescue Assistance (ARA) staging per quadrant */}
                {(
                  [
                    { x: 64, y: 130, label: "ARA NW", quad: "NW" },
                    { x: 320, y: 130, label: "ARA NE", quad: "NE" },
                    { x: 64, y: 249, label: "ARA SW", quad: "SW" },
                    { x: 320, y: 249, label: "ARA SE", quad: "SE" },
                  ] as const
                ).map((ara, index) => {
                  const araOccupants = occupants.filter(
                    (o) =>
                      o.quadrant === ara.quad && o.status === "ARA_STAGING",
                  );
                  const hasOccupants = araOccupants.length > 0;
                  return (
                    <g key={`ara-${index}`}>
                      <rect
                        x={ara.x}
                        y={ara.y}
                        width="34"
                        height="15"
                        rx="2"
                        fill={hasOccupants ? "#1e3a8a" : "#172554"}
                        stroke="#3b82f6"
                        strokeWidth={hasOccupants ? "1.5" : "0.8"}
                        className={hasOccupants ? "animate-pulse" : ""}
                      />
                      <text
                        x={ara.x + 17}
                        y={ara.y + 7}
                        fill="#93c5fd"
                        fontSize="5.5"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ♿ {ara.label}
                      </text>
                      {hasOccupants && (
                        <text
                          x={ara.x + 17}
                          y={ara.y + 13}
                          fill="#fbbf24"
                          fontSize="5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {araOccupants.length} WAITING
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Interaction hint */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[8px] font-mono text-slate-500 bg-slate-950/70 px-2 py-0.5 rounded-full border border-slate-850 whitespace-nowrap pointer-events-none">
              Scroll / pinch to zoom · drag to pan · tap a bank to filter
            </div>
          </div>

          {/* Building legend (matches the FDNY plan key) */}
          <div className="mt-2 shrink-0 bg-slate-900/40 border border-slate-850 rounded-lg px-3 py-2">
            <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Building Legend
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[8px] font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1e3a8a] border border-[#3b82f6]" />
                Elevator
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#064e3b] border border-[#10b981]" />
                Stair
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                Standpipe
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0e7490] border border-[#22d3ee]" />
                Blind Shaft
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#9a3412] border border-[#f97316]" />
                Access Stair
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#a16207] border border-[#eab308]" />
                MER Rooms
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#b45309] border border-[#f59e0b]" />
                Fire Command
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#facc15]" />
                FD Connection
              </span>
            </div>
          </div>
        </>
      ) : (
        /* LIST VIEW - Detailed breakdown for all occupants */
        <div className="flex-1 bg-slate-950 rounded-xl border border-slate-850 overflow-hidden">
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {quadrants.map((quad) => {
              const quadOccupants = getQuadrantOccupants(quad);
              const stats = getQuadrantStats(quad);

              if (quadOccupants.length === 0) return null;

              return (
                <div key={quad} className="space-y-1">
                  {/* Quadrant Header */}
                  <div
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                      selectedQuadrant === quad
                        ? "bg-amber-950/30 border-amber-600"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                    onClick={() => onQuadrantClick && onQuadrantClick(quad)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-amber-500" />
                      <span className="text-sm font-bold text-slate-200 font-mono">
                        {quad} · {QUAD_META[quad].dept}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({stats.total} {stats.total === 1 ? "person" : "people"}
                        )
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      {stats.accounted > 0 && (
                        <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                          ✓ {stats.accounted}
                        </span>
                      )}
                      {stats.medical > 0 && (
                        <span className="bg-red-950 text-red-400 px-1.5 py-0.5 rounded font-mono animate-pulse">
                          ⚕ {stats.medical}
                        </span>
                      )}
                      {stats.ara > 0 && (
                        <span className="bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded font-mono">
                          ♿ {stats.ara}
                        </span>
                      )}
                      {stats.missing > 0 && (
                        <span className="bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                          ? {stats.missing}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Occupant List - Only show if quadrant is selected or if there are issues */}
                  {(selectedQuadrant === quad ||
                    stats.medical > 0 ||
                    stats.missing > 0) && (
                    <div className="ml-4 space-y-1">
                      {quadOccupants
                        .filter(
                          (occ) =>
                            selectedQuadrant === quad ||
                            occ.status === "MEDICAL" ||
                            occ.status === "MISSING",
                        )
                        .slice(0, 20)
                        .map((occ) => (
                          <button
                            type="button"
                            key={occ.id}
                            onClick={() =>
                              onOccupantClick && onOccupantClick(occ)
                            }
                            className="w-full flex items-center justify-between p-1.5 rounded bg-slate-900/30 border border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/60 transition-all text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Activity
                                size={10}
                                className={
                                  occ.status === "ACCOUNTED"
                                    ? "text-emerald-500"
                                    : occ.status === "MEDICAL"
                                      ? "text-red-500 animate-pulse"
                                      : occ.status === "ARA_STAGING"
                                        ? "text-blue-500"
                                        : "text-amber-500"
                                }
                              />
                              <span className="text-[10px] text-slate-300 font-mono">
                                {occ.badgeId}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {occ.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {occ.mobilityImpaired && (
                                <span className="text-[9px] text-blue-400">
                                  ♿
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-bold font-mono ${
                                  occ.status === "ACCOUNTED"
                                    ? "text-emerald-500"
                                    : occ.status === "MEDICAL"
                                      ? "text-red-500"
                                      : occ.status === "ARA_STAGING"
                                        ? "text-blue-500"
                                        : "text-amber-500"
                                }`}
                              >
                                {occ.status}
                              </span>
                            </div>
                          </button>
                        ))}
                      {quadOccupants.length > 20 &&
                        selectedQuadrant === quad && (
                          <div className="text-[9px] text-slate-500 text-center py-1 font-mono">
                            ... and {quadOccupants.length - 20} more (use FSD
                            Locator panel for full list)
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className="mt-2 grid grid-cols-4 gap-1.5 shrink-0">
        {quadrants.map((quad) => {
          const stats = getQuadrantStats(quad);
          const completionRate =
            stats.total > 0
              ? Math.round((stats.accounted / stats.total) * 100)
              : 0;

          return (
            <button
              type="button"
              key={quad}
              onClick={() => onQuadrantClick && onQuadrantClick(quad)}
              className={`p-1.5 rounded-lg border transition-all text-left ${
                selectedQuadrant === quad
                  ? "bg-amber-950/40 border-amber-700"
                  : "bg-slate-900/40 border-slate-800 hover:bg-slate-850 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-mono font-bold text-slate-300">
                  {quad}
                </span>
                <span
                  className={`text-[8px] font-bold ${
                    completionRate === 100
                      ? "text-emerald-400"
                      : completionRate >= 75
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}
                >
                  {completionRate}%
                </span>
              </div>
              <div className="text-[7.5px] text-slate-500 font-mono">
                {stats.accounted}/{stats.total} safe
              </div>
              {(stats.medical > 0 || stats.ara > 0) && (
                <div className="text-[7px] text-red-400 font-bold mt-0.5">
                  {stats.medical > 0 && `${stats.medical} medical `}
                  {stats.ara > 0 && `${stats.ara} ARA`}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
