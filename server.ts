import express from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Initialize server-side Gemini client utility
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn(
    "WARNING: GEMINI_API_KEY environment variable is not set. Hermes will operate in fallback mode.",
  );
}

const app = express();
// Port is overridable via the PORT env var so multiple instances can run side-by-side.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-Memory Database for Vault Decryption
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
  usr_a7f8c9d1: {
    name: "Jane Doe",
    role: "Quadrant Warden",
    photo:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
    department: "NW Engineering",
    phone: "+1 (555) 019-2831",
  },
  usr_f9e3c2b8: {
    name: "Bob Jones",
    role: "Contractor (HVAC)",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    department: "Facilities External",
    phone: "+1 (555) 042-9988",
  },
  usr_b3c7d6e5: {
    name: "Alice Smith",
    role: "Occupant",
    photo:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80",
    department: "HR Operations",
    phone: "+1 (555) 011-4433",
  },
  usr_d4e3f2a1: {
    name: "Marcus Lee",
    role: "Lead FSD",
    photo:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    department: "Life Safety Command",
    phone: "+1 (555) 018-7722",
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
    department: "Finance Floor 7",
    phone: "+1 (555) 017-4488",
  },
};

// In-Memory ChromaDB (Vector database simulator for drill memories)
interface DrillVectorMemory {
  id: string;
  drillId: string;
  tags: string[];
  content: string;
  embedding: number[]; // Simulated for RAG keyword-vector overlap
}

const CHROMA_VECTOR_DB: DrillVectorMemory[] = [
  {
    id: "mem_1",
    drillId: "Drill_41",
    tags: ["Stair_A", "Telecom_Door", "Blockage", "NW_Quadrant"],
    content:
      "NW Quadrant evacuation through Stair A (North) was congested at the 7th-floor landing. The telecommunication wiring closet door was poorly latched and was hanging slightly ajar, narrowing the passage to less than 28 inches. Delay accrued: 120 seconds. Issue resolved after drill closed by tightening the door hinges.",
    embedding: [0.1, 0.8, 0.2, 0.9],
  },
  {
    id: "mem_2",
    drillId: "Drill_42",
    tags: ["Stair_B", "Gates", "Contractors", "Access_Delay"],
    content:
      "Stair B (South) experienced a delay in contractor throughput. High volumes of facilities engineering contractors from Third-Party agencies did not have active local RFIDs. Wardens spent 45 seconds per contractor to manually enter badge numbers. Recommend prioritizing standard NFC contractor preload into SQLCipher.",
    embedding: [0.9, 0.1, 0.9, 0.2],
  },
  {
    id: "mem_3",
    drillId: "Drill_43",
    tags: ["ARA_NW", "Ble_Mesh", "Comm_Failure", "Warden_Warden"],
    content:
      "Area of Rescue Assistance (ARA) northwest quadrant was briefly shown offline in the primary console, but successfully transmitted state using Warden peer-to-peer Bluetooth mesh hopping. The intermediate router failed but the decentralized CRDT kept the status accurate. Ensure HMAC signing is complete.",
    embedding: [0.3, 0.4, 0.3, 0.8],
  },
];

// SHA-256 Utility for Ledger Verification
function getSHA256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
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

  const decryptedRecord = VAULT_DATABASE[token];
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

// 2. Ingest drill logs into RAG memory (Hermes Ingestion Pipeline) (Section 4.1)
app.post("/api/hermes/ingest", (req, res) => {
  const { drillId, tags, content } = req.body;
  if (!drillId || !content) {
    return res
      .status(400)
      .json({ error: "drillId and content are required for ingestion." });
  }

  const newMemory: DrillVectorMemory = {
    id: `mem_${Date.now()}`,
    drillId,
    tags: tags || [],
    content,
    embedding: Array.from({ length: 4 }, () => Math.random()), // simulated vector coordinates
  };

  CHROMA_VECTOR_DB.push(newMemory);

  res.json({
    status: "success",
    message: `Securely ingested ${drillId} into in-memory ChromaDB vector store`,
    item: {
      id: newMemory.id,
      drillId: newMemory.drillId,
      tags: newMemory.tags,
    },
  });
});

// 3. Pose question to Hermes read-only AI agent (Section 4)
app.post("/api/hermes/query", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Question query is required." });
  }

  // A. ChromaDB Vector/Keyword retrieve
  const cleanQ = question.toLowerCase();
  const matchedMemories = CHROMA_VECTOR_DB.filter((mem) => {
    // Basic vector-like keyword matcher
    const matchTag = mem.tags.some(
      (t) =>
        cleanQ.includes(t.toLowerCase()) ||
        cleanQ.includes(t.toLowerCase().replace("_", " ")),
    );
    const matchContent =
      mem.content.toLowerCase().includes(cleanQ) ||
      cleanQ
        .split(" ")
        .some(
          (word) => word.length > 4 && mem.content.toLowerCase().includes(word),
        );
    return matchTag || matchContent;
  });

  // Fallback if no specific vector hits, include all logs to provide a strong RAG context
  const contextMemories =
    matchedMemories.length > 0 ? matchedMemories : CHROMA_VECTOR_DB;

  const memoriesContextString = contextMemories
    .map(
      (mem) =>
        `[Drill ID: ${mem.drillId}] [Tags: ${mem.tags.join(", ")}]
Memory Content: ${mem.content}`,
    )
    .join("\n\n");

  const systemInstruction = `You are "Hermes", the persistent-memory AI Operating System Analyst for the MusterCommand Life-Safety Platform deployed on Floor 7 of 4 Irving Plaza.
Your boundaries are strictly READ-ONLY. You cannot declare emergency clears, issue check-ins, or interact directly with live gates. Your purpose is post-incident drill analyses.
You have access to historical drill memories stored in a local ChromaDB database.
Whenever you answer the Fire Safety Director's query, you MUST:
1. Ground your reasoning in the provided history.
2. Strictly cite the Drill ID (e.g., [Drill_41], [Drill_42]) of any memory utilized, so the FSD can cross-verify against the source log. This is a life-safety audit requirement.
3. If no relevant drill memories match the user's specific query, politely state that you could not find incident history for that specific query, but offer general life-safety advice for Floor 7 (Stair A [North landing] and Stair B [South landing]).
4. Keep answers highly professional, clear, action-oriented, and structured. Do not exaggerate or hallucinate advice. Do not output raw PII. Use and mention GUIDs matching usr_... if needed.`;

  const prompt = `Fire Safety Director Query: "${question}"

--- CHROMADB HISTORICAL RAG CONTEXT ---
${memoriesContextString || "No matching historical vectors found."}
--- END CONTEXT ---

Analyze the query using the above memories, synthesize recommended FSD actionable safety tasks, and produce a response complying with your strict guidelines (citing specific Drill IDs). Keep the response brief (under 150 words).`;

  try {
    if (ai) {
      // Call Gemini API using modern @google/genai SDK
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1, // deep precision, low randomness
        },
      });

      res.json({
        answer: response.text,
        retrievedMemories: contextMemories.map((m) => ({
          drillId: m.drillId,
          tags: m.tags,
          summary: m.content.substring(0, 100) + "...",
        })),
        citedDrills: contextMemories.map((m) => m.drillId),
      });
    } else {
      // Offline / Developer Local Fallback simulation if no API key is specified
      const fallbackReplies = [
        `[Fallback Mode] I retrieved recollections of past Stair B contractor slowdowns ([Drill_42]). During that drill, contractor badges lacking NFC records preloaded into SQLCipher resulted in manual entries. I advise ensuring all Floor 7 contractors are preloaded before live operations.`,
        `[Fallback Mode] Consulting our local vector store, we see Stair A restrictions during [Drill_41]. A door hanging 28 inches open slowed traffic, especially near northwestern corners. Ensure Stair doors are fully unlatched and unblocked.`,
        `[Fallback Mode] Looking back at Area of Rescue Assistance connectivity ([Drill_43]), the local BLE mesh was critical to backup communications when standard Wi-Fi dropped. Ensure all Wardens carry peer-to-peer synced tablets.`,
      ];
      const match =
        cleanQ.includes("stair b") || cleanQ.includes("contractor")
          ? fallbackReplies[0]
          : cleanQ.includes("stair a") ||
              cleanQ.includes("door") ||
              cleanQ.includes("telecom")
            ? fallbackReplies[1]
            : fallbackReplies[2];

      setTimeout(() => {
        res.json({
          answer:
            match +
            " (Running in server-side local fallback mode - No API Key provided in environment).",
          retrievedMemories: contextMemories.map((m) => ({
            drillId: m.drillId,
            tags: m.tags,
            summary: m.content.substring(0, 100) + "...",
          })),
          citedDrills: contextMemories.map((m) => m.drillId),
        });
      }, 600);
    }
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res
      .status(500)
      .json({
        error: "Failed to communicate with AI model Hermes. " + err.message,
      });
  }
});

// 4. SHA-256 Chain Verification Endpoint (Section 2)
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MusterCommand (Life-Safety OS) server bound to port ${PORT}`);
  });
}

initServer();
