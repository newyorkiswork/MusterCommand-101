export interface Occupant {
  id: string; // Token (e.g. usr_a7f8c9d1)
  badgeId: string; // e.g. FE019283
  nameEncrypted: string; // e.g. "************" (Tokenization-at-Rest placeholder)
  role:
    | "Warden"
    | "Occupant"
    | "Contractor"
    | "FSD"
    | "Visitor"
    | "Searcher"
    | "Deputy";
  status: "SAFE" | "MISSING" | "NEED_HELP" | "CRITICAL";
  quadrant: "NW" | "NE" | "SW" | "SE" | "Center";
  staircase?: "Stair A" | "Stair B";
  musterZone?: "Zone A" | "Zone B";
  lastSeen: string;
  alertNote?: string;
  fallDetected?: boolean;

  // ---- Pilot success-criteria fields (Floor 7 goals) ----
  mobilityImpaired?: boolean; // on the evac-chair / Area of Rescue Assistance list
  isAtARA?: boolean; // currently staged at an Area of Rescue Assistance
  isVisitor?: boolean; // lobby sign-in visitor (highest accountability risk)
  wearable?: boolean; // wears a fall/SOS wearable that can raise a critical event
  nextOfKinRegistered?: boolean; // has registered next-of-kin for family notification
  nextOfKinNotified?: boolean; // a "safe" SMS has been dispatched to next-of-kin
  drillParticipant?: boolean; // counted in the OSHA 1910.38(e) drill record
}

export interface LedgerBlock {
  index: number;
  timestamp: string;
  event: string;
  prevHash: string;
  hash: string;
}

export interface DrillHistoryItem {
  id: string;
  date: string;
  duration: number; // in seconds
  totalOccupants: number;
  safeCount: number;
  unaccountedCount: number;
  complianceRate: number; // percentage
  narrative: string;
}

// ============================================================================
// EAP — Emergency Action Plan types
// Per ConEdison Floor 7 EAP & FDNY F-89 protocol.
// ============================================================================
export type EAPEmergencyType =
  | "Fire/Smoke"
  | "Explosion"
  | "Medical"
  | "Biological"
  | "Chemical Release"
  | "Radiological"
  | "Nuclear"
  | "Natural Disaster"
  | "Active Shooter"
  | "Bomb Threat"
  | "Suspicious Package"
  | "Other";

export type EvacDecision =
  | "EVACUATE"
  | "SHELTER_IN_PLACE"
  | "IN_BUILDING_RELOCATION";

export interface ElevatorRecall {
  bank: "A-Bank" | "G-Bank";
  carNumber: number;
  status: "RECALLED_LOBBY" | "AUTHORIZED" | "OUT_OF_SERVICE";
}
