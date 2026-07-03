import React, { useState } from "react";
import { ChevronUp, MapPin, AlertTriangle } from "lucide-react";

interface FloorPlanHandheldProps {
  blockedStairs: string[];
  recommendedStair: string;
  recommendedStairArea: string;
}

/**
 * Clean, mobile-first floor plan for occupants.
 * Shows:
 * - Your location (current quadrant)
 * - Nearest clear stair (highlighted)
 * - Blocked stairs (red X)
 * - Assembly zones (A/B with color coding)
 * - Clear evacuation path
 *
 * Designed for 60-90 second comprehension at first glance.
 */
export default function FloorPlanHandheld({
  blockedStairs,
  recommendedStair,
  recommendedStairArea,
}: FloorPlanHandheldProps) {
  const [expanded, setExpanded] = useState(false);

  // Quick stair reference card
  const staircardClass = (stairId: string) => {
    const blocked = blockedStairs.includes(stairId);
    const recommended = stairId === recommendedStair;

    if (recommended && !blocked) {
      return "bg-emerald-100 border-emerald-400 text-emerald-900";
    }
    if (blocked) {
      return "bg-red-100 border-red-400 text-red-900";
    }
    return "bg-slate-50 border-slate-300 text-slate-700";
  };

  const stairIcon = (stairId: string) => {
    const blocked = blockedStairs.includes(stairId);
    const recommended = stairId === recommendedStair;

    if (recommended && !blocked) {
      return "✓"; // Check mark for recommended
    }
    if (blocked) {
      return "✕"; // X for blocked
    }
    return "○"; // Circle for available
  };

  return (
    <div className="space-y-3">
      {/* FLOOR PLAN DIAGRAM */}
      <div
        className={`bg-white border-2 border-blue-400 rounded-2xl overflow-hidden transition-all ${
          expanded ? "min-h-[400px]" : "h-auto"
        }`}
      >
        {/* SVG Floor Plan — simplified, clean, accessible */}
        <svg
          viewBox="0 0 740 500"
          className="w-full bg-white"
          style={{ minHeight: expanded ? "400px" : "auto" }}
        >
          {/* Border outline */}
          <rect
            x="60"
            y="30"
            width="620"
            height="440"
            fill="none"
            stroke="#0078c1"
            strokeWidth="3"
          />

          {/* STAIR LABELS & ICONS — LARGE & CLEAR */}
          {/* Stair A - Northwest (PRIMARY) */}
          <g>
            <circle
              cx="130"
              cy="120"
              r="18"
              fill={blockedStairs.includes("A") ? "#fecaca" : "#dbeafe"}
              stroke={
                recommendedStair === "A"
                  ? "#059669"
                  : blockedStairs.includes("A")
                    ? "#dc2626"
                    : "#0078c1"
              }
              strokeWidth="3"
            />
            <text
              x="130"
              y="128"
              fill={blockedStairs.includes("A") ? "#7f1d1d" : "#0369a1"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              A
            </text>
            <text
              x="130"
              y="155"
              fill="#0078c1"
              fontSize="10"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              NORTH
            </text>
            {blockedStairs.includes("A") && (
              <text
                x="130"
                y="172"
                fill="#dc2626"
                fontSize="12"
                fontWeight="bold"
                fontFamily="system-ui"
                textAnchor="middle"
              >
                BLOCKED
              </text>
            )}
            {recommendedStair === "A" && !blockedStairs.includes("A") && (
              <text
                x="130"
                y="172"
                fill="#059669"
                fontSize="12"
                fontWeight="bold"
                fontFamily="system-ui"
                textAnchor="middle"
              >
                USE THIS
              </text>
            )}
          </g>

          {/* Stair C - South Core */}
          <g>
            <circle
              cx="370"
              cy="420"
              r="18"
              fill={blockedStairs.includes("C") ? "#fecaca" : "#dbeafe"}
              stroke={
                recommendedStair === "C"
                  ? "#059669"
                  : blockedStairs.includes("C")
                    ? "#dc2626"
                    : "#0078c1"
              }
              strokeWidth="3"
            />
            <text
              x="370"
              y="428"
              fill={blockedStairs.includes("C") ? "#7f1d1d" : "#0369a1"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              C
            </text>
            <text
              x="370"
              y="453"
              fill="#0078c1"
              fontSize="10"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              SOUTH
            </text>
          </g>

          {/* Stair D - Southeast */}
          <g>
            <circle
              cx="600"
              cy="280"
              r="18"
              fill={blockedStairs.includes("D") ? "#fecaca" : "#dbeafe"}
              stroke={
                recommendedStair === "D"
                  ? "#059669"
                  : blockedStairs.includes("D")
                    ? "#dc2626"
                    : "#0078c1"
              }
              strokeWidth="3"
            />
            <text
              x="600"
              y="288"
              fill={blockedStairs.includes("D") ? "#7f1d1d" : "#0369a1"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              D
            </text>
            <text
              x="600"
              y="313"
              fill="#0078c1"
              fontSize="10"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              EAST
            </text>
          </g>

          {/* Stair E - Northwest Lobby */}
          <g>
            <circle
              cx="200"
              cy="90"
              r="18"
              fill={blockedStairs.includes("E") ? "#fecaca" : "#dbeafe"}
              stroke={
                recommendedStair === "E"
                  ? "#059669"
                  : blockedStairs.includes("E")
                    ? "#dc2626"
                    : "#0078c1"
              }
              strokeWidth="3"
            />
            <text
              x="200"
              y="98"
              fill={blockedStairs.includes("E") ? "#7f1d1d" : "#0369a1"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              E
            </text>
          </g>

          {/* Stair F - North Core */}
          <g>
            <circle
              cx="360"
              cy="90"
              r="18"
              fill={blockedStairs.includes("F") ? "#fecaca" : "#dbeafe"}
              stroke={
                recommendedStair === "F"
                  ? "#059669"
                  : blockedStairs.includes("F")
                    ? "#dc2626"
                    : "#0078c1"
              }
              strokeWidth="3"
            />
            <text
              x="360"
              y="98"
              fill={blockedStairs.includes("F") ? "#7f1d1d" : "#0369a1"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              F
            </text>
          </g>

          {/* Stair G - East Lobby */}
          <g>
            <circle
              cx="520"
              cy="140"
              r="18"
              fill={blockedStairs.includes("G") ? "#fecaca" : "#dbeafe"}
              stroke={
                recommendedStair === "G"
                  ? "#059669"
                  : blockedStairs.includes("G")
                    ? "#dc2626"
                    : "#0078c1"
              }
              strokeWidth="3"
            />
            <text
              x="520"
              y="148"
              fill={blockedStairs.includes("G") ? "#7f1d1d" : "#0369a1"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              G
            </text>
          </g>

          {/* ASSEMBLY ZONES - LARGE, COLOR-CODED */}
          {/* Zone A - Primary (Stuyvesant Sq) */}
          <g>
            <rect
              x="75"
              y="250"
              width="140"
              height="80"
              fill="#dcfce7"
              stroke="#22c55e"
              strokeWidth="2"
              strokeDasharray="5,5"
              rx="6"
            />
            <text
              x="145"
              y="275"
              fill="#166534"
              fontSize="12"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              ZONE A
            </text>
            <text
              x="145"
              y="295"
              fill="#15803d"
              fontSize="9"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Stuyvesant
            </text>
            <text
              x="145"
              y="310"
              fill="#15803d"
              fontSize="9"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              PRIMARY
            </text>
          </g>

          {/* Zone B - Secondary (Union Sq) */}
          <g>
            <rect
              x="525"
              y="350"
              width="140"
              height="80"
              fill="#dbeafe"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              rx="6"
            />
            <text
              x="595"
              y="375"
              fill="#1e40af"
              fontSize="12"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              ZONE B
            </text>
            <text
              x="595"
              y="395"
              fill="#1e3a8a"
              fontSize="9"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Union
            </text>
            <text
              x="595"
              y="410"
              fill="#1e3a8a"
              fontSize="9"
              fontWeight="bold"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              SECONDARY
            </text>
          </g>

          {/* CENTER LOBBY MARKER */}
          <circle
            cx="370"
            cy="240"
            r="12"
            fill="#f3f4f6"
            stroke="#4b5563"
            strokeWidth="2"
          />
          <text
            x="370"
            y="245"
            fill="#4b5563"
            fontSize="10"
            fontWeight="bold"
            fontFamily="system-ui"
            textAnchor="middle"
          >
            LOBBY C
          </text>
        </svg>
      </div>

      {/* STAIR STATUS LEGEND — ALWAYS VISIBLE */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Stair Status
        </p>
        <div className="grid grid-cols-3 gap-2">
          {["A", "C", "D", "E", "F", "G"].map((stairId) => (
            <button
              key={stairId}
              type="button"
              className={`py-2 rounded-lg border-2 text-center font-bold transition-all ${staircardClass(
                stairId
              )}`}
            >
              <span className="text-lg leading-none block">
                {stairIcon(stairId)}
              </span>
              <span className="text-sm font-black block mt-1">STAIR {stairId}</span>
              {blockedStairs.includes(stairId) && (
                <span className="text-xs font-bold block mt-0.5">BLOCKED</span>
              )}
              {stairId === recommendedStair && !blockedStairs.includes(stairId) && (
                <span className="text-xs font-bold block mt-0.5">→ GO HERE</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* RECOMMENDED ROUTE — HIGHLIGHTED */}
      {blockedStairs.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={16}
              className="text-yellow-700 mt-0.5 shrink-0"
            />
            <div>
              <p className="text-xs font-bold text-yellow-900 uppercase">
                Stair{blockedStairs.length > 1 ? "s" : ""} Blocked
              </p>
              <p className="text-sm font-black text-yellow-900 mt-1">
                Use <span className="text-emerald-700">{recommendedStair}</span> — {recommendedStairArea}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ASSEMBLY ZONE REMINDER */}
      <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-3">
        <p className="text-xs font-bold text-emerald-700 uppercase">
          After exiting:
        </p>
        <p className="text-sm font-black text-emerald-900 mt-1">
          Go to <span className="text-emerald-700">ZONE A</span> (Stuyvesant Square Park)
        </p>
        <p className="text-xs text-emerald-700 mt-1">Primary assembly point</p>
      </div>

      {/* EXPAND BUTTON */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-blue-400 text-blue-700 font-bold text-sm rounded-xl hover:bg-blue-50 transition-all"
        >
          <MapPin size={14} />
          See Full Map Details
          <ChevronUp size={14} className="rotate-180" />
        </button>
      )}
    </div>
  );
}
