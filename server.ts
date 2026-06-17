import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
// Port is configurable via env (PORT=3001 npm run dev). Defaults to 3000.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-Memory Database for Vault Decryption
// Maps tokenized GUIDs to PII stored at rest in HashiCorp Vault (simulated)
// Roles use official FDNY Fire Safety Plan designations (F-89, F-58)
const VAULT_DATABASE: Record<
  string,
  {
    name: string;
    role: string;
    photo: string;
    department: string;
    phone: string;
  }
> = {
  usr_d4e3f2a1: {
    name: "Marcus Lee",
    role: "F-89 Fire Safety Director",
    photo:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    department: "Life Safety Command",
    phone: "+1 (555) 018-7722",
  },
  usr_a7f8c9d1: {
    name: "Jane Doe",
    role: "F-58 Floor Warden (NW)",
    photo:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
    department: "NW Engineering",
    phone: "+1 (555) 019-2831",
  },
  usr_g2h3i4j5: {
    name: "Raul Pereira",
    role: "F-58 Floor Warden (SE)",
    photo:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
    department: "SE IT Infrastructure",
    phone: "+1 (555) 027-3311",
  },
  usr_b3c7d6e5: {
    name: "Alice Smith",
    role: "Occupant",
    photo:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80",
    department: "NE Legal",
    phone: "+1 (555) 011-4433",
  },
  usr_c1b2a3d4: {
    name: "Claire Jenkins",
    role: "Occupant",
    photo:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
    department: "NW Engineering",
    phone: "+1 (555) 013-1122",
  },
  usr_e5f6a7b8: {
    name: "David Miller",
    role: "Occupant",
    photo:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
    department: "SE Finance",
    phone: "+1 (555) 017-4488",
  },
  usr_f9e3c2b8: {
    name: "Bob Jones",
    role: "Contractor (HVAC)",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    department: "Facilities External",
    phone: "+1 (555) 042-9988",
  },
  usr_h5i6j7k8: {
    name: "Tom Rodriguez",
    role: "Contractor (Electrical)",
    photo:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
    department: "Electrical External",
    phone: "+1 (555) 039-7766",
  },
  usr_k9l0m1n2: {
    name: "Sharon White",
    role: "Visitor",
    photo:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
    department: "External Visitor — NW Meeting",
    phone: "+1 (555) 051-2200",
  },
  usr_o3p4q5r6: {
    name: "Elena Carter",
    role: "Occupant (Mobility-Impaired)",
    photo:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    department: "NW Engineering",
    phone: "+1 (555) 016-8899",
  },
  usr_s7t8u9v0: {
    name: "Luis Torres",
    role: "Occupant (Mobility-Impaired)",
    photo:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80",
    department: "SE IT Infrastructure",
    phone: "+1 (555) 022-5544",
  },
  usr_w1x2y3z4: {
    name: "Pat Gallagher",
    role: "Occupant",
    photo:
      "https://images.unsplash.com/photo-1548142813-c348350df52b?w=120&auto=format&fit=crop&q=80",
    department: "SW Comms & Gov Affairs",
    phone: "+1 (555) 014-3300",
  },
};

// SHA-256 Utility for Ledger Verification
function getSHA256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ----------------------------------------------------------------------------
// Synthetic Vault Records for the generated high-density cohort
// data.ts scales the Floor 7 roster to ~300 with deterministic tokens of the
// form `usr_gen######` (quadrant = index % 4, matching FILLER_QUADRANTS). The
// 12 hand-authored personnel live in VAULT_DATABASE above; every generated
// occupant resolves here so Warden/FSD JIT decryption works for the whole floor.
// ----------------------------------------------------------------------------
const FILLER_QUADRANTS = ["NW", "NE", "SW", "SE"] as const;
const SYNTH_FIRST_NAMES = [
  "Alex",
  "Sam",
  "Jordan",
  "Morgan",
  "Taylor",
  "Casey",
  "Riley",
  "Jamie",
  "Drew",
  "Quinn",
  "Avery",
  "Cameron",
  "Reese",
  "Skyler",
  "Hayden",
  "Rowan",
  "Parker",
  "Emerson",
];
const SYNTH_LAST_NAMES = [
  "Nguyen",
  "Patel",
  "Kim",
  "Garcia",
  "Murphy",
  "Bauer",
  "Costa",
  "Ali",
  "Walsh",
  "Reyes",
  "Okafor",
  "Larsen",
  "Petrov",
  "Haddad",
  "Mensah",
  "Silva",
  "Novak",
  "Cohen",
];
const SYNTH_DEPARTMENTS: Record<string, string> = {
  NW: "NW Engineering",
  NE: "NE Legal",
  SW: "SW Comms & Gov Affairs",
  SE: "SE IT Infrastructure",
};

// Must match generateRoster(288) in src/data.ts. Tokens outside this range do
// not correspond to a real occupant and must still 404, exactly like a
// completely unknown token.
const GENERATED_ROSTER_SIZE = 288;

function synthesizeOccupant(token: string) {
  const match = /^usr_gen(\d{6})$/.exec(token);
  if (!match) return null;
  const i = parseInt(match[1], 10);
  if (i < 0 || i >= GENERATED_ROSTER_SIZE) return null;
  const quadrant = FILLER_QUADRANTS[i % FILLER_QUADRANTS.length];
  const first = SYNTH_FIRST_NAMES[i % SYNTH_FIRST_NAMES.length];
  const last = SYNTH_LAST_NAMES[(i * 7) % SYNTH_LAST_NAMES.length];
  const exchange = String(100 + (i % 900)).padStart(3, "0");
  const line = String(1000 + ((i * 13) % 9000)).padStart(4, "0");
  return {
    name: `${first} ${last}`,
    role: "Occupant",
    photo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(`${first} ${last}`)}`,
    department: SYNTH_DEPARTMENTS[quadrant],
    phone: `+1 (555) ${exchange}-${line}`,
  };
}

// REST endpoints FIRST

// 1. Vault Just-In-Time Decryption API (Layer 5)
app.post("/api/vault/decrypt", (req, res) => {
  const { token, requesterId } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token GUID is required" });
  }

  // Simulate Role-Based Access Control check (FSD or Warden)
  if (requesterId !== "fsd_admin" && requesterId !== "warden_NW") {
    return res
      .status(403)
      .json({ error: "Access Denied: Requester must be FSD or Warden" });
  }

  const decryptedRecord = VAULT_DATABASE[token] || synthesizeOccupant(token);
  if (!decryptedRecord) {
    return res
      .status(404)
      .json({ error: "Token not found in Vault environment" });
  }

  // Simulate dynamic decryption over TLS 1.3
  res.json({
    token,
    decrypted: decryptedRecord,
    verifiedAt: new Date().toISOString(),
    protocol: "TLSv1.3_AES_256_GCM",
    integrityHash: getSHA256(JSON.stringify(decryptedRecord)),
  });
});

// 2. SHA-256 Chain Verification Endpoint (Section 2)
app.post("/api/ledger/verify", (req, res) => {
  const { ledger } = req.body; // Array of blocks
  if (!ledger || !Array.isArray(ledger)) {
    return res
      .status(400)
      .json({ error: "ledger must be an array of blocks." });
  }

  let valid = true;
  const auditLogs: string[] = [];

  for (let i = 0; i < ledger.length; i++) {
    const block = ledger[i];
    // Recalculate block hash
    const content =
      block.index + block.timestamp + block.event + block.prevHash;
    const computedHash = getSHA256(content);

    if (computedHash !== block.hash) {
      valid = false;
      auditLogs.push(
        `Block ${i} fails verification. Hash expected: ${computedHash}, got: ${block.hash}`,
      );
      break;
    }

    if (i > 0) {
      const prevBlock = ledger[i - 1];
      if (block.prevHash !== prevBlock.hash) {
        valid = false;
        auditLogs.push(
          `Block ${i} parent link broken. Expected prevHash: ${prevBlock.hash}, got: ${block.prevHash}`,
        );
        break;
      }
    }
  }

  res.json({
    verified: valid,
    scannedBlocks: ledger.length,
    timestamp: new Date().toISOString(),
    auditLogs:
      auditLogs.length > 0
        ? auditLogs
        : ["Full chain hash verification pass. Integrity 100%."],
  });
});

// Mount Vite middleware or static dist depending on environment
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("  MusterCommand (Life-Safety OS) is running.");
    console.log(`  ▶ Open your browser at:  http://localhost:${PORT}`);
    console.log("");
  });

  // If the port is taken, fail loudly with a clear instruction instead of a stack trace.
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n  ✖ Port ${PORT} is already in use.\n` +
          `    Either stop the other process (pkill -f "tsx server.ts")\n` +
          `    or start on another port:  PORT=3001 npm run dev\n`,
      );
      process.exit(1);
    }
    throw err;
  });
}

initServer();
