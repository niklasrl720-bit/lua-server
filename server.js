const http = require("node:http");const fs = require("node:fs");const path = require("node:path");const crypto = require("node:crypto");
// V148: Neustartfeste, signierte Dashboard-Sitzungen und stabiler Owner-Rundsendungszugriff.

const PORT = Number(process.env.PORT || 3000);const HEARTBEAT_TOKEN = String(process.env.HEARTBEAT_TOKEN || "");const ONLINE_TIMEOUT_MS = (() => {const configured = Number(process.env.PRESENCE_TIMEOUT_MS || 5 * 60_000);return Number.isFinite(configured) ? Math.min(15 * 60_000, Math.max(3 * 60_000, Math.floor(configured))) : 5 * 60_000;})();const SERVER_STARTED_AT_MS = Date.now();const PRESENCE_RESTART_GRACE_MS = 90_000;const PRESENCE_RESTORE_WINDOW_MS = Math.max(ONLINE_TIMEOUT_MS, 5 * 60_000);const MAX_BODY_BYTES = 100_000;const AVATAR_CACHE_MS = 10 * 60_000;const GLOBAL_SHUTDOWN_COMMAND_TTL_MS = 5 * 60_000;const NEXU_LOADER_COMMAND = 'loadstring(game:HttpGet("https://raw.githubusercontent.com/niklasrl720-bit/Nexu-Menu/refs/heads/main/Nexu%20Main"))()';const MAX_MENU_UPDATE_MINUTES = 24 * 60;const MENU_CREATOR_USER_ID = "10199760908";const MENU_CREATOR_RANK_ENABLED = true;const DEFAULT_SUPPORTER_USER_IDS = new Set(["11203703629"]);const PLAYER_ROLE_KEYS = new Set(["player", "supporter"]);const PLAYER_ROLE_TITLES = {player: "PLAYERS", supporter: "SUPPORTER"};const BRING_COMMAND_TTL_MS = 2 * 60_000;const DM_MAX_LENGTH = 240;const DM_TTL_MS = 10 * 60_000;const DM_QUEUE_LIMIT = 12;const DM_RATE_WINDOW_MS = 30_000;const DM_RATE_LIMIT = 10;const OWNER_ACCOUNT_USERNAME = "OwnerAccount";const DASHBOARD_DEFAULT_USERNAME = String(process.env.DASHBOARD_USERNAME || OWNER_ACCOUNT_USERNAME);const DASHBOARD_DEFAULT_EMAIL = String(process.env.DASHBOARD_EMAIL || "owner@nexu.local");const DASHBOARD_DEFAULT_PASSWORD_HASH = String(process.env.DASHBOARD_PASSWORD_HASH ||"df3b0f6227afa43d620dc1c5c639dab7036878674a3c7e699c9583be6425f2d8").toLowerCase();const DASHBOARD_SESSION_COOKIE = "nexu_dashboard_session";const DASHBOARD_REMEMBER_COOKIE = "nexu_dashboard_remember";const DASHBOARD_SESSION_TTL_MS = 12 * 60 * 60_000;const DASHBOARD_REMEMBER_TTL_MS = 30 * 24 * 60 * 60_000;const LOGIN_RATE_WINDOW_MS = 10 * 60_000;const LOGIN_RATE_LIMIT = 8;const JOIN_COMMAND_TTL_MS = 2 * 60_000;const BAN_FILE_PATH = String(process.env.BAN_FILE_PATH || path.join(process.cwd(), "data", "nexu-bans.json"));const REMEMBER_FILE_PATH = String(process.env.REMEMBER_FILE_PATH ||path.join(path.dirname(BAN_FILE_PATH), "nexu-remembered-accounts.json"));const KNOWN_PLAYERS_FILE_PATH = String(process.env.KNOWN_PLAYERS_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-known-players.json"));const DASHBOARD_ACCOUNT_FILE_PATH = String(process.env.DASHBOARD_ACCOUNT_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-dashboard-account.json"));const MENU_UPDATE_FILE_PATH = String(process.env.MENU_UPDATE_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-menu-update.json"));

const GITHUB_DATA_TOKEN = String(process.env.GITHUB_DATA_TOKEN || "").trim();
const GITHUB_DATA_OWNER = String(process.env.GITHUB_DATA_OWNER || "").trim();
const GITHUB_DATA_REPO = String(process.env.GITHUB_DATA_REPO || "").trim();
const GITHUB_DATA_BRANCH = String(process.env.GITHUB_DATA_BRANCH || "main").trim() || "main";
const GITHUB_DATA_PATH = String(process.env.GITHUB_DATA_PATH || "data/nexu-storage.json").trim() || "data/nexu-storage.json";
const GITHUB_STORAGE_API_VERSION = "2022-11-28";
const GITHUB_STORAGE_USER_AGENT = "Nexu-Presence-Storage/1.0";
const GITHUB_STORAGE_DEFAULT_DELAY_MS = 12_000;
const DASHBOARD_SESSION_TOKEN_VERSION = "nxs2";
const DASHBOARD_SESSION_SIGNING_SECRET = String(process.env.DASHBOARD_SESSION_SECRET || "").trim() || crypto
    .createHash("sha256")
    .update([
        DASHBOARD_DEFAULT_PASSWORD_HASH,
        HEARTBEAT_TOKEN,
        GITHUB_DATA_TOKEN,
        DASHBOARD_DEFAULT_EMAIL,
        OWNER_ACCOUNT_USERNAME,
    ].join("|"), "utf8")
    .digest("hex");

const presence = new Map();const knownPlayers = new Map();const dashboardAccounts = new Map();const bans = new Map();const avatarCache = new Map();const directMessages = new Map();const dmRateLimits = new Map();const dashboardSessions = new Map();const rememberedDashboardDevices = new Map();const loginRateLimits = new Map();const joinCommands = new Map();const bringCommands = new Map();const shutdownCommandsBySession = new Map();const shutdownCommandsByUser = new Map();let nextDirectMessageId = 1;let nextJoinCommandId = 1;let nextBringCommandId = 1;let nextShutdownCommandId = 1;let menuUpdateMutationRevision = 0;let menuUpdateState = {active:false,startedAtMs:0,endsAtMs:0,durationMinutes:0,startedBy:"",startedAt:"",endsAt:""};let githubStorageSha = "";let githubStorageReady = false;let githubStorageDirty = false;let githubStorageTimer = null;let githubStorageDueAtMs = 0;let githubStorageWriteChain = Promise.resolve();const githubStorageReasons = new Set();

function sendJson(res, statusCode, data, extraHeaders = {}) {res.writeHead(statusCode, {"Content-Type": "application/json; charset=utf-8","Cache-Control": "no-store","X-Content-Type-Options": "nosniff",...extraHeaders,});res.end(JSON.stringify(data));}

function sendHtml(res, statusCode, html, extraHeaders = {}) {res.writeHead(statusCode, {"Content-Type": "text/html; charset=utf-8","Cache-Control": "no-store","X-Content-Type-Options": "nosniff","Referrer-Policy": "no-referrer","Content-Security-Policy":"default-src 'self'; " +"img-src 'self' https: data:; " +"style-src 'unsafe-inline'; " +"script-src 'unsafe-inline'; " +"connect-src 'self'; " +"form-action 'self'; " +"base-uri 'none'; " +"frame-ancestors 'none'",...extraHeaders,});res.end(html);}

function redirect(res, location, extraHeaders = {}) {res.writeHead(303, {Location: location,"Cache-Control": "no-store","X-Content-Type-Options": "nosniff",...extraHeaders,});res.end();}

function escapeHtml(value) {return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");}

function cleanText(value, maxLength) {return typeof value === "string"? value.trim().slice(0, maxLength): "";}

function cleanNumericId(value) {const text = String(value ?? "").trim();return /^\d{1,30}$/.test(text) ? text : "";}

function cleanInteger(value) {const number = Number(value);return Number.isSafeInteger(number) && number >= 0 ? number : 0;}

function isGitHubStorageConfigured() {
    return Boolean(
        GITHUB_DATA_TOKEN &&
        GITHUB_DATA_OWNER &&
        GITHUB_DATA_REPO &&
        GITHUB_DATA_BRANCH &&
        GITHUB_DATA_PATH
    );
}

function githubStorageEndpoint() {
    const encodedPath = GITHUB_DATA_PATH
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
    return `https://api.github.com/repos/${encodeURIComponent(GITHUB_DATA_OWNER)}/${encodeURIComponent(GITHUB_DATA_REPO)}/contents/${encodedPath}`;
}

function githubStorageHeaders(extra = {}) {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_DATA_TOKEN}`,
        "X-GitHub-Api-Version": GITHUB_STORAGE_API_VERSION,
        "User-Agent": GITHUB_STORAGE_USER_AGENT,
        ...extra,
    };
}

function decodeGitHubBase64(value) {
    return Buffer.from(String(value || "").replace(/\s+/g, ""), "base64").toString("utf8");
}

function encodeGitHubBase64(value) {
    return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function normalizeStoredBan(raw) {
    const userId = cleanNumericId(raw && raw.userId);
    if (!userId) return null;
    return {
        userId,
        username: cleanText(raw && raw.username, 40),
        displayName: cleanText(raw && raw.displayName, 80),
        reason: cleanText(raw && raw.reason, 240) || "Vom Nexu-Menü ausgeschlossen",
        bannedAt: cleanText(raw && raw.bannedAt, 64) || new Date().toISOString(),
        bannedBy: cleanText(raw && raw.bannedBy, 80) || "dashboard",
    };
}

function buildGitHubStorageSnapshot() {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        players: [...knownPlayers.values()].sort(
            (a, b) => (Number(b.lastSeenMs) || 0) - (Number(a.lastSeenMs) || 0)
        ),
        bans: [...bans.values()].sort((a, b) =>
            String(a.displayName || a.username || a.userId).localeCompare(
                String(b.displayName || b.username || b.userId),
                "de",
                { sensitivity: "base" }
            )
        ),
        updateState: getMenuUpdateStatus(),
    };
}

function applyGitHubStorageSnapshot(payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const playerRows = Array.isArray(source.players) ? source.players : [];
    const banRows = Array.isArray(source.bans) ? source.bans : [];

    knownPlayers.clear();
    for (const raw of playerRows) {
        const playerEntry = normalizeKnownPlayer(raw);
        if (playerEntry) knownPlayers.set(playerEntry.userId, playerEntry);
    }

    bans.clear();
    for (const raw of banRows) {
        const banEntry = normalizeStoredBan(raw);
        if (banEntry) bans.set(banEntry.userId, banEntry);
    }

    menuUpdateState = normalizeMenuUpdateState(source.updateState || source.update || {});
}

async function fetchGitHubStorageFile() {
    const endpoint = `${githubStorageEndpoint()}?ref=${encodeURIComponent(GITHUB_DATA_BRANCH)}`;
    const response = await fetch(endpoint, {
        method: "GET",
        headers: githubStorageHeaders(),
    });

    if (response.status === 404) {
        return { exists: false, sha: "", payload: { players: [], bans: [], updateState: null } };
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            `GitHub-Speicher konnte nicht gelesen werden: HTTP ${response.status}` +
            (body && body.message ? ` // ${body.message}` : "")
        );
    }

    const rawText = decodeGitHubBase64(body.content || "");
    const payload = rawText ? JSON.parse(rawText) : {};
    return {
        exists: true,
        sha: cleanText(body.sha, 100),
        payload,
    };
}

async function loadGitHubStorage() {
    if (!isGitHubStorageConfigured()) {
        console.warn("[NEXU] GitHub-Speicher ist nicht vollständig konfiguriert; lokale JSON-Dateien bleiben als Fallback aktiv.");
        githubStorageReady = true;
        return false;
    }

    try {
        const remote = await fetchGitHubStorageFile();
        githubStorageSha = remote.sha || "";
        applyGitHubStorageSnapshot(remote.payload);
        githubStorageReady = true;

        // Lokale Fallback-Dateien aktualisieren, damit der Server auch bei einem
        // vorübergehenden GitHub-Ausfall mit dem letzten Stand weiterarbeiten kann.
        saveKnownPlayers(false);
        saveBans(false);
        saveMenuUpdateState(false);

        console.log(
            `[NEXU] GitHub-Speicher geladen: ${knownPlayers.size} Spieler, ` +
            `${bans.size} Bans, Update ${menuUpdateState.active ? "AKTIV" : "INAKTIV"}`
        );

        if (!remote.exists) {
            scheduleGitHubStorageSave("initial-create", 1_000);
        }
        return true;
    } catch (error) {
        githubStorageReady = true;
        console.warn("[NEXU] GitHub-Speicher konnte nicht geladen werden:", error.message);
        return false;
    }
}

async function writeGitHubStorageNow() {
    if (!githubStorageReady || !isGitHubStorageConfigured() || !githubStorageDirty) {
        return false;
    }

    const snapshot = buildGitHubStorageSnapshot();
    const content = encodeGitHubBase64(JSON.stringify(snapshot, null, 2));
    const reasons = [...githubStorageReasons];
    githubStorageReasons.clear();
    githubStorageDirty = false;

    const writeAttempt = async (refreshSha) => {
        if (refreshSha || !githubStorageSha) {
            const remote = await fetchGitHubStorageFile();
            githubStorageSha = remote.sha || "";
        }

        const body = {
            message: `Nexu data update${reasons.length ? `: ${reasons.slice(0, 4).join(", ")}` : ""}`,
            content,
            branch: GITHUB_DATA_BRANCH,
        };
        if (githubStorageSha) body.sha = githubStorageSha;

        const response = await fetch(githubStorageEndpoint(), {
            method: "PUT",
            headers: githubStorageHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(
                `GitHub-Speicher konnte nicht geschrieben werden: HTTP ${response.status}` +
                (payload && payload.message ? ` // ${payload.message}` : "")
            );
            error.statusCode = response.status;
            throw error;
        }

        githubStorageSha = cleanText(
            payload && payload.content && payload.content.sha,
            100
        ) || githubStorageSha;
        console.log(
            `[NEXU] GitHub-Speicher aktualisiert (${knownPlayers.size} Spieler, ${bans.size} Bans).`
        );
        return true;
    };

    try {
        return await writeAttempt(false);
    } catch (error) {
        if (error && (error.statusCode === 409 || error.statusCode === 422)) {
            try {
                return await writeAttempt(true);
            } catch (retryError) {
                githubStorageDirty = true;
                for (const reason of reasons) githubStorageReasons.add(reason);
                console.warn("[NEXU] GitHub-Speicher Retry fehlgeschlagen:", retryError.message);
                return false;
            }
        }

        githubStorageDirty = true;
        for (const reason of reasons) githubStorageReasons.add(reason);
        console.warn("[NEXU] GitHub-Speicher fehlgeschlagen:", error.message);
        return false;
    }
}

function scheduleGitHubStorageSave(reason = "change", delayMs = GITHUB_STORAGE_DEFAULT_DELAY_MS) {
    if (!githubStorageReady || !isGitHubStorageConfigured()) return false;

    githubStorageDirty = true;
    githubStorageReasons.add(cleanText(reason, 80) || "change");

    const safeDelay = Math.max(500, Math.min(10 * 60_000, Number(delayMs) || GITHUB_STORAGE_DEFAULT_DELAY_MS));
    const desiredDueAt = Date.now() + safeDelay;

    if (githubStorageTimer && githubStorageDueAtMs <= desiredDueAt) {
        return true;
    }

    if (githubStorageTimer) clearTimeout(githubStorageTimer);
    githubStorageDueAtMs = desiredDueAt;
    githubStorageTimer = setTimeout(() => {
        githubStorageTimer = null;
        githubStorageDueAtMs = 0;
        githubStorageWriteChain = githubStorageWriteChain
            .then(() => writeGitHubStorageNow())
            .catch((error) => {
                githubStorageDirty = true;
                console.warn("[NEXU] GitHub-Speicherwarteschlange:", error.message);
            });
    }, safeDelay);
    if (typeof githubStorageTimer.unref === "function") githubStorageTimer.unref();
    return true;
}


function cleanPlayerRoleAssignment(value) {const role = String(value ?? "").trim().toLowerCase();if (role === "players") {return "player";}return PLAYER_ROLE_KEYS.has(role) ? role : "";}

function getAssignedPlayerRoleKey(userId) {const id = cleanNumericId(userId);if (!id) {return "player";}const stored = knownPlayers.get(id);const assigned = cleanPlayerRoleAssignment(stored && (stored.roleKey || stored.role || stored.assignedRole));if (assigned) {return assigned;}return DEFAULT_SUPPORTER_USER_IDS.has(id) ? "supporter" : "player";}

function getNexuRoleInfo(userId) {const id = cleanNumericId(userId);if (MENU_CREATOR_RANK_ENABLED && id === MENU_CREATOR_USER_ID) {return {title: "MENU CREATOR", key: "creator", canBring: true};}const key = getAssignedPlayerRoleKey(id);if (key === "supporter") {return {title: "SUPPORTER", key: "supporter", canBring: true};}return {title: PLAYER_ROLE_TITLES.player, key: "player", canBring: false};}

function canUseNexuBringRole(userId) {const role = getNexuRoleInfo(userId);return role.key === "creator" || role.key === "supporter" || role.canBring === true;}

function readRawBody(req) {return new Promise((resolve, reject) => {let raw = "";let tooLarge = false;

    req.on("data", (chunk) => {
        raw += chunk.toString("utf8");
        if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
            tooLarge = true;
        }
    });

    req.on("end", () => {
        if (tooLarge) {
            reject(new Error("BODY_TOO_LARGE"));
            return;
        }
        resolve(raw);
    });

    req.on("error", reject);
});

}

async function readJsonBody(req) {const raw = await readRawBody(req);try {return raw ? JSON.parse(raw) : {};} catch {throw new Error("INVALID_JSON");}}

async function readFormBody(req) {const raw = await readRawBody(req);const params = new URLSearchParams(raw);const result = {};for (const [key, value] of params.entries()) {result[key] = value;}if (!("username" in result)) result.username = "";if (!("password" in result)) result.password = "";return result;}

function isHeartbeatAuthorized(req) {// Ohne HEARTBEAT_TOKEN läuft der Server im Kompatibilitätsmodus.if (HEARTBEAT_TOKEN === "") {return true;}

const supplied = String(req.headers["x-nexu-heartbeat-token"] || "");
return supplied === HEARTBEAT_TOKEN;

}

function prunePresence() {const now = Date.now();

for (const [key, entry] of presence) {
    const expired = now - entry.lastSeenMs > ONLINE_TIMEOUT_MS;
    const banned = bans.has(entry.userId);

    if (expired || banned) {
        presence.delete(key);
    }
}

}

function removePresenceForUser(userId) {let removed = 0;

for (const [key, entry] of presence) {
    if (entry.userId === userId) {
        presence.delete(key);
        removed += 1;
    }
}

return removed;

}

function findLatestPresenceForUser(userId) {let latest = null;

for (const entry of presence.values()) {
    if (
        entry.userId === userId &&
        (!latest || entry.lastSeenMs > latest.lastSeenMs)
    ) {
        latest = entry;
    }
}

return latest;

}

function restoreRecentPresenceFromKnownPlayers() {
    const now = Date.now();
    let restored = 0;
    for (const row of knownPlayers.values()) {
        if (!row || bans.has(row.userId)) continue;
        const lastSeenMs = cleanInteger(row.lastSeenMs);
        const sessionId = cleanText(row.sessionId, 100);
        if (!lastSeenMs || !sessionId || now - lastSeenMs > PRESENCE_RESTORE_WINDOW_MS) continue;
        const key = `${row.userId}:${sessionId}`;
        if (presence.has(key)) continue;
        presence.set(key, {
            ...row,
            sessionId,
            joinedAtMs: cleanInteger(row.joinedAtMs) || cleanInteger(row.firstSeenMs) || lastSeenMs,
            lastSeenMs,
            restoredAfterRestart: true,
        });
        restored += 1;
    }
    if (restored > 0) {
        console.log(`[NEXU] ${restored} kürzlich aktive Script-Sitzungen nach Neustart wiederhergestellt`);
    }
    return restored;
}

function countActivePresenceUsers() {
    prunePresence();
    const userIds = new Set();
    for (const entry of presence.values()) {
        if (entry && entry.userId && !bans.has(entry.userId)) {
            userIds.add(entry.userId);
        }
    }
    return userIds.size;
}

function loadBans() {try {if (!fs.existsSync(BAN_FILE_PATH)) {return;}

    const parsed = JSON.parse(fs.readFileSync(BAN_FILE_PATH, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed.bans;

    if (!Array.isArray(rows)) {
        return;
    }

    for (const raw of rows) {
        const userId = cleanNumericId(raw && raw.userId);
        if (!userId) {
            continue;
        }

        bans.set(userId, {
            userId,
            username: cleanText(raw.username, 40),
            displayName: cleanText(raw.displayName, 80),
            reason:
                cleanText(raw.reason, 240) ||
                "Vom Nexu-Menü ausgeschlossen",
            bannedAt:
                cleanText(raw.bannedAt, 64) || new Date().toISOString(),
            bannedBy: cleanText(raw.bannedBy, 80) || "dashboard",
        });
    }

    console.log(`[NEXU] ${bans.size} gespeicherte Bans geladen`);
} catch (error) {
    console.warn(
        "[NEXU] Ban-Datei konnte nicht geladen werden:",
        error.message
    );
}

}

function saveBans(syncGitHub = true) {try {fs.mkdirSync(path.dirname(BAN_FILE_PATH), { recursive: true });

    const tempPath = `${BAN_FILE_PATH}.tmp`;
    fs.writeFileSync(
        tempPath,
        JSON.stringify({ bans: [...bans.values()] }, null, 2),
        "utf8"
    );
    fs.renameSync(tempPath, BAN_FILE_PATH);
    if (syncGitHub) scheduleGitHubStorageSave("bans", 2_500);
    return true;
} catch (error) {
    console.warn(
        "[NEXU] Ban-Datei konnte nicht gespeichert werden:",
        error.message
    );
    return false;
}

}

function normalizeMenuUpdateState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const startedAtMs = cleanInteger(source.startedAtMs);
    const endsAtMs = cleanInteger(source.endsAtMs);
    const durationMinutes = Math.min(MAX_MENU_UPDATE_MINUTES, Math.max(0, cleanInteger(source.durationMinutes)));
    const active = source.active === true && endsAtMs > Date.now();
    return {
        active,
        startedAtMs: active ? startedAtMs : 0,
        endsAtMs: active ? endsAtMs : 0,
        durationMinutes: active ? durationMinutes : 0,
        startedBy: active ? cleanText(source.startedBy, 80) : "",
        startedAt: active ? (cleanText(source.startedAt, 64) || new Date(startedAtMs || Date.now()).toISOString()) : "",
        endsAt: active ? (cleanText(source.endsAt, 64) || new Date(endsAtMs).toISOString()) : "",
    };
}

function saveMenuUpdateState(syncGitHub = true) {
    try {
        fs.mkdirSync(path.dirname(MENU_UPDATE_FILE_PATH), { recursive: true });
        const tempPath = `${MENU_UPDATE_FILE_PATH}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify({ update: menuUpdateState }, null, 2), "utf8");
        fs.renameSync(tempPath, MENU_UPDATE_FILE_PATH);
        if (syncGitHub) scheduleGitHubStorageSave("update-state", 1_500);
        return true;
    } catch (error) {
        console.warn("[NEXU] Update-Status konnte nicht gespeichert werden:", error.message);
        return false;
    }
}

function loadMenuUpdateState() {
    try {
        if (!fs.existsSync(MENU_UPDATE_FILE_PATH)) return;
        const parsed = JSON.parse(fs.readFileSync(MENU_UPDATE_FILE_PATH, "utf8"));
        menuUpdateState = normalizeMenuUpdateState(parsed && (parsed.update || parsed));
        if (!menuUpdateState.active) saveMenuUpdateState();
        console.log(`[NEXU] Script-Update: ${menuUpdateState.active ? "AKTIV" : "INAKTIV"}`);
    } catch (error) {
        console.warn("[NEXU] Update-Status konnte nicht geladen werden:", error.message);
        menuUpdateState = normalizeMenuUpdateState({});
    }
}

function getMenuUpdateStatus() {
    if (menuUpdateState.active && Date.now() >= menuUpdateState.endsAtMs) {
        menuUpdateState = normalizeMenuUpdateState({});
        saveMenuUpdateState();
    }
    const remainingSeconds = menuUpdateState.active
        ? Math.max(0, Math.ceil((menuUpdateState.endsAtMs - Date.now()) / 1000))
        : 0;
    return {
        active: menuUpdateState.active === true,
        startedAt: menuUpdateState.startedAt || "",
        endsAt: menuUpdateState.endsAt || "",
        startedAtMs: menuUpdateState.startedAtMs || 0,
        endsAtMs: menuUpdateState.endsAtMs || 0,
        durationMinutes: menuUpdateState.durationMinutes || 0,
        remainingSeconds,
        startedBy: menuUpdateState.startedBy || "",
    };
}

function startMenuUpdate(durationMinutes, startedBy) {
    const normalizedMinutes = Math.floor(Number(durationMinutes));
    if (!Number.isFinite(normalizedMinutes) || normalizedMinutes < 1 || normalizedMinutes > MAX_MENU_UPDATE_MINUTES) {
        return { error: `Dauer muss zwischen 1 und ${MAX_MENU_UPDATE_MINUTES} Minuten liegen.` };
    }
    const now = Date.now();
    const endsAtMs = now + normalizedMinutes * 60_000;
    menuUpdateMutationRevision += 1;
    menuUpdateState = {
        active: true,
        startedAtMs: now,
        endsAtMs,
        durationMinutes: normalizedMinutes,
        startedBy: cleanText(startedBy, 80) || "dashboard",
        startedAt: new Date(now).toISOString(),
        endsAt: new Date(endsAtMs).toISOString(),
    };
    const persisted = saveMenuUpdateState();
    return { persisted, status: getMenuUpdateStatus() };
}

function cancelMenuUpdate() {
    const wasActive = getMenuUpdateStatus().active;
    menuUpdateMutationRevision += 1;
    menuUpdateState = {
        active: false,
        startedAtMs: 0,
        endsAtMs: 0,
        durationMinutes: 0,
        startedBy: "",
        startedAt: "",
        endsAt: "",
    };
    const persisted = saveMenuUpdateState();
    return { wasActive, persisted, status: getMenuUpdateStatus() };
}

function formatMenuUpdateDuration(totalSeconds) {
    const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
}


function pruneShutdownCommands() {
    const now = Date.now();

    for (const [sessionId, command] of shutdownCommandsBySession) {
        if (!command || command.expiresAtMs <= now) {
            shutdownCommandsBySession.delete(sessionId);
        }
    }

    for (const [userId, command] of shutdownCommandsByUser) {
        if (!command || command.expiresAtMs <= now) {
            shutdownCommandsByUser.delete(userId);
        }
    }
}

function queueGlobalScriptShutdown(startedBy) {
    prunePresence();
    pruneShutdownCommands();

    const now = Date.now();
    const commandId = `${now}-${nextShutdownCommandId++}`;
    const sessions = new Set();
    const users = new Map();
    const issuedBy = cleanText(startedBy, 80) || "dashboard";

    for (const entry of presence.values()) {
        const userId = cleanNumericId(entry && entry.userId);
        if (!userId) continue;

        const sessionId = cleanText(entry && entry.sessionId, 100);
        const userState = users.get(userId) || {
            sessionIds: new Set(),
            oldestJoinedAtMs: cleanInteger(entry && entry.joinedAtMs) || now,
        };

        if (sessionId) {
            sessions.add(sessionId);
            userState.sessionIds.add(sessionId);
        }
        userState.oldestJoinedAtMs = Math.min(
            userState.oldestJoinedAtMs || now,
            cleanInteger(entry && entry.joinedAtMs) || now
        );
        users.set(userId, userState);
    }

    const baseCommand = {
        active: true,
        id: commandId,
        issuedAt: new Date(now).toISOString(),
        issuedAtMs: now,
        expiresAtMs: now + GLOBAL_SHUTDOWN_COMMAND_TTL_MS,
        issuedBy,
        reason: "Vom Dashboard deaktiviert",
    };

    for (const sessionId of sessions) {
        shutdownCommandsBySession.set(sessionId, {
            ...baseCommand,
            sessionId,
        });
    }

    for (const [userId, userState] of users) {
        shutdownCommandsByUser.set(userId, {
            ...baseCommand,
            userId,
            sessionIds: [...userState.sessionIds],
            oldestJoinedAtMs: userState.oldestJoinedAtMs,
        });
    }

    return {
        id: commandId,
        targetedSessions: sessions.size,
        targetedPlayers: users.size,
        issuedAt: baseCommand.issuedAt,
        issuedBy,
    };
}

function serializeShutdownCommand(command) {
    if (!command) return { active: false };
    return {
        active: true,
        id: command.id,
        issuedAt: command.issuedAt,
        issuedBy: command.issuedBy,
        reason: command.reason,
    };
}

function getShutdownCommandForClient(userId, sessionId) {
    pruneShutdownCommands();

    const cleanUserId = cleanNumericId(userId);
    const cleanSessionId = cleanText(sessionId, 100);

    if (cleanSessionId) {
        const exact = shutdownCommandsBySession.get(cleanSessionId);
        if (exact) return serializeShutdownCommand(exact);
    }

    if (!cleanUserId) return { active: false };
    const userCommand = shutdownCommandsByUser.get(cleanUserId);
    if (!userCommand) return { active: false };

    if (
        cleanSessionId &&
        Array.isArray(userCommand.sessionIds) &&
        userCommand.sessionIds.includes(cleanSessionId)
    ) {
        return serializeShutdownCommand(userCommand);
    }

    // Fallback für Sitzungen, die beim Klick zwar online waren, deren Session-ID
    // aber erst mit dem nächsten Heartbeat sichtbar wurde.
    const currentPresence = [...presence.values()].find((entry) =>
        entry &&
        entry.userId === cleanUserId &&
        (
            !cleanSessionId ||
            !entry.sessionId ||
            entry.sessionId === cleanSessionId
        )
    );
    if (
        currentPresence &&
        (cleanInteger(currentPresence.joinedAtMs) || Date.now()) <= userCommand.issuedAtMs
    ) {
        return serializeShutdownCommand(userCommand);
    }

    return { active: false };
}

function normalizeKnownPlayer(raw, now = Date.now()) {const userId = cleanNumericId(raw && raw.userId);if (!userId) {return null;}const firstSeenMs = cleanInteger(raw && raw.firstSeenMs) || now;const lastSeenMs = cleanInteger(raw && raw.lastSeenMs) || now;const roleKey = cleanPlayerRoleAssignment(raw && (raw.roleKey || raw.role || raw.assignedRole));return {userId,username: cleanText(raw && raw.username, 40) || `User${userId}`,displayName: cleanText(raw && raw.displayName, 80) || cleanText(raw && raw.username, 40) || `User ${userId}`,gameName: cleanText(raw && raw.gameName, 120),placeId: cleanInteger(raw && raw.placeId),jobId: cleanText(raw && raw.jobId, 100),sessionId: cleanText(raw && raw.sessionId, 100),executionSource: cleanText(raw && raw.executionSource, 80),executionVersion: cleanText(raw && raw.executionVersion, 80),clientPlatform: cleanText(raw && raw.clientPlatform, 40),scriptBuild: cleanText(raw && raw.scriptBuild, 120),roleKey,firstSeen: cleanText(raw && raw.firstSeen, 64) || new Date(firstSeenMs).toISOString(),lastSeen: cleanText(raw && raw.lastSeen, 64) || new Date(lastSeenMs).toISOString(),firstSeenMs,lastSeenMs,};}

function loadKnownPlayers() {try {if (!fs.existsSync(KNOWN_PLAYERS_FILE_PATH)) {return;}const parsed = JSON.parse(fs.readFileSync(KNOWN_PLAYERS_FILE_PATH, "utf8"));const rows = Array.isArray(parsed) ? parsed : parsed.players;if (!Array.isArray(rows)) {return;}for (const raw of rows) {const entry = normalizeKnownPlayer(raw);if (entry) {knownPlayers.set(entry.userId, entry);}}console.log(`[NEXU] ${knownPlayers.size} gespeicherte Spieler geladen`);} catch (error) {console.warn("[NEXU] Gespeicherte Spieler konnten nicht geladen werden:", error.message);}}

function saveKnownPlayers(syncGitHub = false) {try {fs.mkdirSync(path.dirname(KNOWN_PLAYERS_FILE_PATH), { recursive: true });const tempPath = `${KNOWN_PLAYERS_FILE_PATH}.tmp`;const rows = [...knownPlayers.values()].sort((a, b) => (b.lastSeenMs || 0) - (a.lastSeenMs || 0));fs.writeFileSync(tempPath, JSON.stringify({ players: rows }, null, 2), "utf8");fs.renameSync(tempPath, KNOWN_PLAYERS_FILE_PATH);if (syncGitHub) scheduleGitHubStorageSave("players", 5_000);return true;} catch (error) {console.warn("[NEXU] Gespeicherte Spieler konnten nicht gespeichert werden:", error.message);return false;}}



function normalizePasswordHash(value) {
    const hash = String(value || "").trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(hash) ? hash : "df3b0f6227afa43d620dc1c5c639dab7036878674a3c7e699c9583be6425f2d8";
}

function cleanDashboardUsername(value) {
    const username = cleanText(value, 80);
    if (!/^[A-Za-z0-9_.@-]{3,80}$/.test(username)) {
        return "";
    }
    return username;
}

function cleanDashboardEmail(value) {
    const email = cleanText(value, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return "";
    }
    return email;
}

function internalDashboardEmailForUsername(username) {
    const cleanUsername = cleanDashboardUsername(username);
    if (!cleanUsername) {
        return "";
    }
    const hash = crypto.createHash("sha256").update(cleanUsername.toLowerCase(), "utf8").digest("hex").slice(0, 24);
    return `account-${hash}@nexu.local`;
}

const DASHBOARD_PERMISSION_DEFINITIONS = [
    { key: "menuServer", formName: "menuServerAccess", title: "Dashboard öffnen", description: "Darf den Menu Server ansehen." },
    { key: "dm", formName: "dashboardDm", title: "Nachrichten senden", description: "Darf DMs und Rundsendungen an aktive Nexu-Spieler senden." },
    { key: "bring", formName: "dashboardBring", title: "Bring benutzen", description: "Darf Spieler per Website zum Creator bringen." },
    { key: "serverJoin", formName: "dashboardJoin", title: "Server Join", description: "Darf den Creator zu einem Spieler-Server schicken." },
    { key: "managePlayerRoles", formName: "dashboardRole", title: "Ränge einstellen", description: "Darf PLAYERS/SUPPORTER für gespeicherte Spieler ändern." },
    { key: "banPlayers", formName: "dashboardBan", title: "Bannen/Entbannen", description: "Darf Spieler bannen, entbannen und die Sperrliste sehen." },
    { key: "updateScript", formName: "dashboardUpdateScript", title: "Script-Update", description: "Darf den zeitgesteuerten Wartungsmodus starten und vorzeitig beenden." },
    { key: "shutdownScript", formName: "dashboardShutdownScript", title: "Scripts deaktivieren", description: "Darf alle aktuell verbundenen Lua-Sitzungen einmalig deaktivieren." },
];

function isOwnerDashboardIdentity(username = "", email = "", explicitOwner = false) {
    if (explicitOwner === true) return true;
    const normalizedUsername = cleanDashboardUsername(username).toLowerCase();
    const configuredOwnerUsername = cleanDashboardUsername(OWNER_ACCOUNT_USERNAME).toLowerCase();
    if (normalizedUsername && normalizedUsername === configuredOwnerUsername) return true;
    const normalizedEmail = cleanDashboardEmail(email);
    const configuredOwnerEmail = cleanDashboardEmail(DASHBOARD_DEFAULT_EMAIL);
    return Boolean(normalizedEmail && configuredOwnerEmail && normalizedEmail === configuredOwnerEmail);
}

function normalizeDashboardAccess(raw, username = "", email = "") {
    const source = raw && typeof raw === "object" ? raw : {};
    const nested = source.access && typeof source.access === "object"
        ? source.access
        : source.permissions && typeof source.permissions === "object"
            ? source.permissions
            : {};
    const merged = { ...source, ...nested };
    const isOwner = isOwnerDashboardIdentity(username, email, source.isOwner === true || source.owner === true);
    const enabled = (value) => value === true || value === "true" || value === "1" || value === "on" || value === 1;
    const dashboardAccess = isOwner || enabled(merged.menuServer) || enabled(merged.menuServerAccess);
    return {
        menuServer: dashboardAccess,
        dm: isOwner || (dashboardAccess && (enabled(merged.dm) || enabled(merged.dashboardDm) || enabled(merged.dmSend))),
        bring: isOwner || (dashboardAccess && (enabled(merged.bring) || enabled(merged.dashboardBring))),
        serverJoin: isOwner || (dashboardAccess && (enabled(merged.serverJoin) || enabled(merged.dashboardJoin) || enabled(merged.join))),
        managePlayerRoles: isOwner || (dashboardAccess && (enabled(merged.managePlayerRoles) || enabled(merged.dashboardRole) || enabled(merged.roles))),
        banPlayers: isOwner || (dashboardAccess && (enabled(merged.banPlayers) || enabled(merged.dashboardBan) || enabled(merged.bans))),
        updateScript: isOwner || (dashboardAccess && (enabled(merged.updateScript) || enabled(merged.dashboardUpdateScript) || enabled(merged.maintenance))),
        shutdownScript: isOwner || (dashboardAccess && (enabled(merged.shutdownScript) || enabled(merged.dashboardShutdownScript) || enabled(merged.shutdownAll))),
        accountManager: isOwner,
    };
}

function isOwnerDashboardAccount(account) {
    return Boolean(account && isOwnerDashboardIdentity(account.username, account.email, account.isOwner === true));
}

function canManageDashboardAccounts(account) {
    return isOwnerDashboardAccount(account);
}

function hasDashboardPermission(account, permissionKey) {
    if (!account) return false;
    if (isOwnerDashboardAccount(account)) return true;
    const access = account.access || {};
    if (permissionKey === "accountManager") return false;
    if (permissionKey !== "menuServer" && access.menuServer !== true) return false;
    return access[permissionKey] === true;
}

function canAccessMenuServer(account) {
    return hasDashboardPermission(account, "menuServer");
}

function getDashboardPermissionSnapshot(account) {
    const snapshot = {};
    for (const definition of DASHBOARD_PERMISSION_DEFINITIONS) {
        snapshot[definition.key] = hasDashboardPermission(account, definition.key);
    }
    snapshot.accountManager = canManageDashboardAccounts(account);
    return snapshot;
}

function isDashboardPermissionSession(req, permissionKey) {
    const session = getDashboardSession(req);
    return Boolean(
        session &&
        (session.isOwner === true || hasDashboardPermission(session.account, permissionKey))
    );
}

function dashboardPermissionError(permissionKey) {
    const definition = DASHBOARD_PERMISSION_DEFINITIONS.find((entry) => entry.key === permissionKey);
    return definition ? `${definition.title} Zugriff erforderlich` : "Dashboard-Zugriff erforderlich";
}

function normalizeDashboardAccount(raw) {
    const username = cleanDashboardUsername(raw && raw.username);
    const email = cleanDashboardEmail(raw && raw.email) || internalDashboardEmailForUsername(username);
    const passwordHash = normalizePasswordHash(raw && raw.passwordHash);
    if (!username || !email || !/^[a-f0-9]{64}$/.test(passwordHash)) {
        return null;
    }
    const isOwner = isOwnerDashboardIdentity(username, email, raw && (raw.isOwner === true || raw.owner === true));
    const access = normalizeDashboardAccess(raw || {}, username, email);
    return {
        username,
        email,
        passwordHash,
        isOwner,
        access,
        createdAt: cleanText(raw && raw.createdAt, 64) || new Date().toISOString(),
        updatedAt: cleanText(raw && raw.updatedAt, 64) || "",
    };
}

function getDashboardAccountByEmail(email) {
    return dashboardAccounts.get(cleanDashboardEmail(email)) || null;
}

function getDashboardAccountByUsername(username) {
    const cleanUsername = cleanDashboardUsername(username);
    if (!cleanUsername) return null;
    const wanted = cleanUsername.toLowerCase();
    for (const account of dashboardAccounts.values()) {
        if (String(account.username || "").toLowerCase() === wanted) {
            return account;
        }
    }
    return null;
}

function getFirstDashboardAccount() {
    return dashboardAccounts.values().next().value || null;
}

function getOwnerDashboardAccount() {
    for (const account of dashboardAccounts.values()) {
        if (isOwnerDashboardAccount(account)) return account;
    }
    return null;
}

function getDashboardUsername() {
    const owner = getOwnerDashboardAccount();
    const first = getFirstDashboardAccount();
    return (owner && owner.username) || (first && first.username) || OWNER_ACCOUNT_USERNAME;
}

function getDashboardPasswordHash() {
    const owner = getOwnerDashboardAccount();
    const first = getFirstDashboardAccount();
    return normalizePasswordHash((owner && owner.passwordHash) || (first && first.passwordHash) || DASHBOARD_DEFAULT_PASSWORD_HASH);
}

function putDashboardAccount(account) {
    const normalized = normalizeDashboardAccount(account);
    if (!normalized) return null;
    dashboardAccounts.set(normalized.email, normalized);
    return normalized;
}

function loadDashboardAccount() {
    dashboardAccounts.clear();
    try {
        if (fs.existsSync(DASHBOARD_ACCOUNT_FILE_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(DASHBOARD_ACCOUNT_FILE_PATH, "utf8"));
            const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.accounts) ? parsed.accounts : [];
            if (rows.length > 0) {
                for (const raw of rows) {
                    putDashboardAccount(raw);
                }
            } else if (parsed && (parsed.username || parsed.passwordHash)) {
                putDashboardAccount({
                    username: parsed.username || DASHBOARD_DEFAULT_USERNAME,
                    email: parsed.email || DASHBOARD_DEFAULT_EMAIL,
                    passwordHash: parsed.passwordHash || DASHBOARD_DEFAULT_PASSWORD_HASH,
                    createdAt: parsed.createdAt || new Date().toISOString(),
                    updatedAt: parsed.updatedAt || "",
                });
            }
        }
    } catch (error) {
        console.warn("[NEXU] Dashboard-Accounts konnten nicht geladen werden:", error.message);
    }

    if (dashboardAccounts.size === 0) {
        putDashboardAccount({
            username: cleanDashboardUsername(DASHBOARD_DEFAULT_USERNAME) || OWNER_ACCOUNT_USERNAME,
            email: cleanDashboardEmail(DASHBOARD_DEFAULT_EMAIL) || "owner@nexu.local",
            passwordHash: normalizePasswordHash(DASHBOARD_DEFAULT_PASSWORD_HASH),
            isOwner: true,
            createdAt: new Date().toISOString(),
            updatedAt: "",
        });
        saveDashboardAccount();
    }

    // Migration für ältere Account-Dateien: Falls durch eine frühere Umbenennung
    // kein Owner mehr erkannt wird, wird der konfigurierte bzw. älteste Account
    // einmalig als Owner markiert. Dadurch gehen Owner-Rechte nie verloren.
    if (!getOwnerDashboardAccount() && dashboardAccounts.size > 0) {
        const configuredEmail = cleanDashboardEmail(DASHBOARD_DEFAULT_EMAIL);
        const configuredUsername = cleanDashboardUsername(DASHBOARD_DEFAULT_USERNAME).toLowerCase();
        let ownerCandidate = configuredEmail ? getDashboardAccountByEmail(configuredEmail) : null;
        if (!ownerCandidate && configuredUsername) {
            ownerCandidate = [...dashboardAccounts.values()].find(
                (account) => String(account.username || "").toLowerCase() === configuredUsername
            ) || null;
        }
        if (!ownerCandidate) {
            ownerCandidate = [...dashboardAccounts.values()].sort((left, right) =>
                String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
            )[0] || null;
        }
        if (ownerCandidate) {
            const promotedOwner = normalizeDashboardAccount({
                ...ownerCandidate,
                isOwner: true,
                access: normalizeDashboardAccess({ ...ownerCandidate, isOwner: true }, ownerCandidate.username, ownerCandidate.email),
                updatedAt: new Date().toISOString(),
            });
            if (promotedOwner) {
                dashboardAccounts.set(promotedOwner.email, promotedOwner);
                saveDashboardAccount();
                console.warn(`[NEXU] Owner-Rechte für ${promotedOwner.username} automatisch wiederhergestellt`);
            }
        }
    }

    console.log(`[NEXU] ${dashboardAccounts.size} Dashboard-Account(s) geladen`);
}

function saveDashboardAccount() {
    try {
        fs.mkdirSync(path.dirname(DASHBOARD_ACCOUNT_FILE_PATH), { recursive: true });
        const tempPath = `${DASHBOARD_ACCOUNT_FILE_PATH}.tmp`;
        const accounts = [...dashboardAccounts.values()].sort((a, b) => String(a.username).localeCompare(String(b.username)));
        fs.writeFileSync(tempPath, JSON.stringify({ accounts }, null, 2), "utf8");
        fs.renameSync(tempPath, DASHBOARD_ACCOUNT_FILE_PATH);
        return true;
    } catch (error) {
        console.warn("[NEXU] Dashboard-Accounts konnten nicht gespeichert werden:", error.message);
        return false;
    }
}

function updateDashboardAccount(username, passwordHash, email = "") {
    const current = email ? getDashboardAccountByEmail(email) : getOwnerDashboardAccount() || getFirstDashboardAccount();
    if (!current) return false;
    const next = normalizeDashboardAccount({
        ...current,
        username: cleanDashboardUsername(username) || current.username,
        passwordHash: normalizePasswordHash(passwordHash || current.passwordHash),
        updatedAt: new Date().toISOString(),
    });
    if (!next) return false;
    dashboardAccounts.delete(current.email);
    dashboardAccounts.set(next.email, next);
    return saveDashboardAccount();
}

function deleteDashboardAccount(email) {
    const cleanEmail = cleanDashboardEmail(email);
    if (!cleanEmail || !dashboardAccounts.has(cleanEmail)) {
        return false;
    }
    dashboardAccounts.delete(cleanEmail);
    return saveDashboardAccount();
}

function dashboardUsernameExists(username, exceptEmail = "") {
    const wanted = cleanDashboardUsername(username).toLowerCase();
    const except = cleanDashboardEmail(exceptEmail);
    if (!wanted) return false;
    for (const account of dashboardAccounts.values()) {
        if (account.email !== except && String(account.username || "").toLowerCase() === wanted) {
            return true;
        }
    }
    return false;
}

function validDashboardAccountPassword(account, password) {
    if (!account || !/^[a-f0-9]{64}$/.test(account.passwordHash || "")) {return false;}
    const suppliedHash = sha256(password);
    const expectedHash = Buffer.from(account.passwordHash, "hex");
    return suppliedHash.length === expectedHash.length && crypto.timingSafeEqual(suppliedHash, expectedHash);
}

function persistentPlayerSignature(row) {
    const source = row && typeof row === "object" ? row : {};
    return JSON.stringify({
        userId: cleanNumericId(source.userId),
        username: cleanText(source.username, 40),
        displayName: cleanText(source.displayName, 80),
        gameName: cleanText(source.gameName, 120),
        placeId: cleanInteger(source.placeId),
        executionSource: cleanText(source.executionSource, 80),
        executionVersion: cleanText(source.executionVersion, 80),
        clientPlatform: cleanText(source.clientPlatform, 40),
        scriptBuild: cleanText(source.scriptBuild, 120),
        roleKey: cleanPlayerRoleAssignment(source.roleKey || source.role || source.assignedRole),
    });
}

function rememberKnownPlayer(raw, now = Date.now()) {
    const incoming = normalizeKnownPlayer({
        ...(raw || {}),
        lastSeenMs: now,
        lastSeen: new Date(now).toISOString(),
    }, now);
    if (!incoming) return false;

    const existing = knownPlayers.get(incoming.userId);
    const next = {
        userId: incoming.userId,
        username: incoming.username || (existing && existing.username) || `User${incoming.userId}`,
        displayName: incoming.displayName || (existing && existing.displayName) || incoming.username || `User ${incoming.userId}`,
        gameName: incoming.gameName || (existing && existing.gameName) || "",
        placeId: incoming.placeId || (existing && existing.placeId) || 0,
        jobId: incoming.jobId || (existing && existing.jobId) || "",
        sessionId: incoming.sessionId || (existing && existing.sessionId) || "",
        executionSource: incoming.executionSource || (existing && existing.executionSource) || "",
        executionVersion: incoming.executionVersion || (existing && existing.executionVersion) || "",
        clientPlatform: incoming.clientPlatform || (existing && existing.clientPlatform) || "",
        scriptBuild: incoming.scriptBuild || (existing && existing.scriptBuild) || "",
        roleKey: (existing && cleanPlayerRoleAssignment(existing.roleKey || existing.role || existing.assignedRole)) || incoming.roleKey || "",
        firstSeen: existing && existing.firstSeen ? existing.firstSeen : new Date(now).toISOString(),
        firstSeenMs: existing && existing.firstSeenMs ? existing.firstSeenMs : now,
        lastSeen: new Date(now).toISOString(),
        lastSeenMs: now,
    };

    const importantChanged = !existing || persistentPlayerSignature(existing) !== persistentPlayerSignature(next);
    const timestampCheckpoint = Boolean(
        existing &&
        now - (cleanInteger(existing.lastSeenMs) || 0) >= 15 * 60_000
    );

    knownPlayers.set(next.userId, next);
    if (importantChanged) return "important";
    if (timestampCheckpoint) return "timestamp";
    return false;
}

function markKnownPlayerOffline(userId, sessionId, now = Date.now(), identity = {}) {const id = cleanNumericId(userId);if (!id) {return false;}const existing = knownPlayers.get(id);if (!existing) {return false;}if (sessionId && existing.sessionId && existing.sessionId !== sessionId) {return false;}const username = cleanText(identity.username, 40);const displayName = cleanText(identity.displayName, 80);knownPlayers.set(id, {...existing,username: username || existing.username,displayName: displayName || existing.displayName,lastSeen: new Date(now).toISOString(),lastSeenMs: now,});return true;}

function getClientIp(req) {const forwarded = String(req.headers["x-forwarded-for"] || "");const firstForwarded = forwarded.split(",")[0].trim();return firstForwarded || String(req.socket.remoteAddress || "unknown");}

function requestUsesHttps(req) {const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();return forwardedProto === "https" || req.socket.encrypted === true;}

function parseCookies(req) {const result = new Map();const header = String(req.headers.cookie || "");

for (const section of header.split(";")) {
    const separatorIndex = section.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = section.slice(0, separatorIndex).trim();
    const rawValue = section.slice(separatorIndex + 1).trim();
    try {
        result.set(name, decodeURIComponent(rawValue));
    } catch {
        result.set(name, rawValue);
    }
}

return result;

}

function dashboardCookie(req, token, maxAgeSeconds) {const parts = [`${DASHBOARD_SESSION_COOKIE}=${encodeURIComponent(token)}`,"Path=/","HttpOnly","SameSite=Strict",`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,];

if (requestUsesHttps(req)) {
    parts.push("Secure");
}

return parts.join("; ");

}

function dashboardRememberCookie(req, token, maxAgeSeconds) {const parts = [`${DASHBOARD_REMEMBER_COOKIE}=${encodeURIComponent(token)}`,"Path=/","HttpOnly","SameSite=Strict",`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,];

if (requestUsesHttps(req)) {
    parts.push("Secure");
}

return parts.join("; ");

}


function encodeDashboardSessionPayload(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeDashboardSessionPayload(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(String(encoded || ""), "base64url").toString("utf8"));
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function signDashboardSessionPayload(encodedPayload) {
    return crypto
        .createHmac("sha256", DASHBOARD_SESSION_SIGNING_SECRET)
        .update(String(encodedPayload || ""), "utf8")
        .digest("base64url");
}

function createSignedDashboardSessionToken(account) {
    const now = Date.now();
    const payload = {
        version: DASHBOARD_SESSION_TOKEN_VERSION,
        username: cleanDashboardUsername(account && account.username),
        email: cleanDashboardEmail(account && account.email),
        isOwner: isOwnerDashboardAccount(account),
        issuedAtMs: now,
        expiresAtMs: now + DASHBOARD_SESSION_TTL_MS,
    };
    const encodedPayload = encodeDashboardSessionPayload(payload);
    return `${DASHBOARD_SESSION_TOKEN_VERSION}.${encodedPayload}.${signDashboardSessionPayload(encodedPayload)}`;
}

function readSignedDashboardSessionToken(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3 || parts[0] !== DASHBOARD_SESSION_TOKEN_VERSION) return null;

    const encodedPayload = parts[1];
    const suppliedSignature = parts[2];
    const expectedSignature = signDashboardSessionPayload(encodedPayload);
    const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (suppliedBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;

    const payload = decodeDashboardSessionPayload(encodedPayload);
    if (!payload || payload.version !== DASHBOARD_SESSION_TOKEN_VERSION) return null;

    const username = cleanDashboardUsername(payload.username);
    const email = cleanDashboardEmail(payload.email);
    const expiresAtMs = Number(payload.expiresAtMs) || 0;
    if ((!username && !email) || expiresAtMs <= Date.now()) return null;

    return {
        username,
        email,
        isOwner: payload.isOwner === true || isOwnerDashboardIdentity(username, email, false),
        expiresAtMs,
    };
}

function getDashboardSessionEntry(token) {
    const signedEntry = readSignedDashboardSessionToken(token);
    if (signedEntry) return signedEntry;

    const raw = dashboardSessions.get(token);
    if (!raw) return null;

    if (typeof raw === "number") {
        const owner = getOwnerDashboardAccount() || getFirstDashboardAccount();
        return owner
            ? {
                username: owner.username,
                email: owner.email,
                isOwner: true,
                expiresAtMs: raw,
            }
            : null;
    }

    const email = cleanDashboardEmail(raw.email);
    const username = cleanDashboardUsername(raw.username);
    const storedOwnerFlag = raw.isOwner === true;
    const identityOwnerFlag = isOwnerDashboardIdentity(username, email, false);

    // Bestehende Sitzungen dürfen bei einer geänderten Account-E-Mail nicht
    // ungültig werden. Deshalb immer E-Mail und Benutzername probieren.
    let account = getDashboardAccountByEmail(email) || getDashboardAccountByUsername(username);
    if (!account && (storedOwnerFlag || identityOwnerFlag)) {
        account = getOwnerDashboardAccount() || getFirstDashboardAccount();
    }
    if (!account) return null;

    return {
        username: account.username,
        email: account.email,
        isOwner: storedOwnerFlag || identityOwnerFlag || isOwnerDashboardAccount(account),
        expiresAtMs: Number(raw.expiresAtMs) || 0,
    };
}

function pruneDashboardAuth() {const now = Date.now();

for (const [token, rawEntry] of dashboardSessions) {
    const entry = typeof rawEntry === "number" ? { expiresAtMs: rawEntry } : rawEntry;
    if (!entry || Number(entry.expiresAtMs) <= now) {
        dashboardSessions.delete(token);
    }
}

for (const [ip, state] of loginRateLimits) {
    if (now - state.windowStartedAtMs > LOGIN_RATE_WINDOW_MS) {
        loginRateLimits.delete(ip);
    }
}

}

function getDashboardSession(req) {
    pruneDashboardAuth();
    const token = parseCookies(req).get(DASHBOARD_SESSION_COOKIE) || "";
    const entry = getDashboardSessionEntry(token);

    if (!token || !entry || entry.expiresAtMs <= Date.now()) {
        if (token) dashboardSessions.delete(token);
        return null;
    }

    let account =
        getDashboardAccountByEmail(entry.email) ||
        getDashboardAccountByUsername(entry.username);

    if (!account && entry.isOwner === true) {
        account = getOwnerDashboardAccount() || getFirstDashboardAccount();
    }
    if (!account) {
        dashboardSessions.delete(token);
        return null;
    }

    const isOwner = entry.isOwner === true || isOwnerDashboardAccount(account);
    const effectiveAccount = isOwner
        ? {
            ...account,
            isOwner: true,
            access: normalizeDashboardAccess(
                { ...account, isOwner: true },
                account.username,
                account.email
            ),
        }
        : account;

    return {
        token,
        username: effectiveAccount.username,
        email: effectiveAccount.email,
        account: effectiveAccount,
        isOwner,
        expiresAtMs: entry.expiresAtMs,
    };
}

function isDashboardAuthenticated(req) {return Boolean(getDashboardSession(req));}

function isOwnerAccountSession(req) {
    const session = getDashboardSession(req);
    return Boolean(session && (session.isOwner === true || canManageDashboardAccounts(session.account)));
}
function isMenuServerAccountSession(req) {
    const session = getDashboardSession(req);
    return Boolean(session && (session.isOwner === true || canAccessMenuServer(session.account)));
}

function createDashboardSession(account = getOwnerDashboardAccount() || getFirstDashboardAccount()) {
    pruneDashboardAuth();
    const normalized = typeof account === "string"
        ? (getDashboardAccountByEmail(account) || getDashboardAccountByUsername(account))
        : account;
    if (!normalized) return "";

    const token = createSignedDashboardSessionToken(normalized);
    const signedEntry = readSignedDashboardSessionToken(token);
    dashboardSessions.set(token, signedEntry || {
        username: normalized.username,
        email: normalized.email,
        isOwner: isOwnerDashboardAccount(normalized),
        expiresAtMs: Date.now() + DASHBOARD_SESSION_TTL_MS,
    });
    return token;
}

function removeDashboardSession(req) {const token = parseCookies(req).get(DASHBOARD_SESSION_COOKIE) || "";if (token) dashboardSessions.delete(token);}

function sha256(value) {return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest();}

function safeTextEqual(left, right) {return crypto.timingSafeEqual(sha256(left), sha256(right));}

function rememberTokenHash(token) {return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");}

function pruneRememberedDashboardDevices(saveAfterPrune = false) {const now = Date.now();let changed = false;

for (const [tokenHash, entry] of rememberedDashboardDevices) {
    if (!entry || entry.expiresAtMs <= now) {
        rememberedDashboardDevices.delete(tokenHash);
        changed = true;
    }
}

if (changed && saveAfterPrune) {
    saveRememberedDashboardDevices();
}

}

function loadRememberedDashboardDevices() {try {if (!fs.existsSync(REMEMBER_FILE_PATH)) {return;}

    const parsed = JSON.parse(fs.readFileSync(REMEMBER_FILE_PATH, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed.devices;
    if (!Array.isArray(rows)) {
        return;
    }

    for (const raw of rows) {
        const tokenHash = cleanText(raw && raw.tokenHash, 64).toLowerCase();
        const username = cleanDashboardUsername(raw && raw.username);
        const email = cleanDashboardEmail(raw && raw.email);
        const expiresAtMs = Number(raw && raw.expiresAtMs) || 0;
        const account = email ? getDashboardAccountByEmail(email) : getDashboardAccountByUsername(username);

        if (/^[a-f0-9]{64}$/.test(tokenHash) && account && expiresAtMs > Date.now()) {
            rememberedDashboardDevices.set(tokenHash, {
                username: account.username,
                email: account.email,
                expiresAtMs,
                createdAt: cleanText(raw && raw.createdAt, 64) || new Date().toISOString(),
            });
        }
    }

    pruneRememberedDashboardDevices(false);
    console.log(
        `[NEXU] ${rememberedDashboardDevices.size} gespeicherte Dashboard-Geräte geladen`
    );
} catch (error) {
    console.warn(
        "[NEXU] Gespeicherte Dashboard-Accounts konnten nicht geladen werden:",
        error.message
    );
}

}

function saveRememberedDashboardDevices() {try {fs.mkdirSync(path.dirname(REMEMBER_FILE_PATH), { recursive: true });const tempPath = `${REMEMBER_FILE_PATH}.tmp`;fs.writeFileSync(tempPath,JSON.stringify({devices: [...rememberedDashboardDevices.entries()].map(([tokenHash, entry]) => ({tokenHash,username: entry.username,email: entry.email,expiresAtMs: entry.expiresAtMs,createdAt: entry.createdAt,})),},null,2),"utf8");fs.renameSync(tempPath, REMEMBER_FILE_PATH);return true;} catch (error) {console.warn("[NEXU] Gespeicherte Dashboard-Accounts konnten nicht gespeichert werden:",error.message);return false;}}

function createRememberedDashboardDevice(account = getOwnerDashboardAccount() || getFirstDashboardAccount()) {pruneRememberedDashboardDevices(false);const normalized = typeof account === "string" ? (getDashboardAccountByEmail(account) || getDashboardAccountByUsername(account)) : account;if (!normalized) {return "";}

const rawToken = crypto.randomBytes(32).toString("hex");
const tokenHash = rememberTokenHash(rawToken);
rememberedDashboardDevices.set(tokenHash, {
    username: normalized.username,
    email: normalized.email,
    expiresAtMs: Date.now() + DASHBOARD_REMEMBER_TTL_MS,
    createdAt: new Date().toISOString(),
});

// Pro Account höchstens zehn gespeicherte Geräte behalten.
const ordered = [...rememberedDashboardDevices.entries()].sort(
    (a, b) => b[1].expiresAtMs - a[1].expiresAtMs
);
for (const [oldHash] of ordered.slice(10)) {
    rememberedDashboardDevices.delete(oldHash);
}

saveRememberedDashboardDevices();
return rawToken;

}

function parseRememberedDashboardTokens(req) {
    const rawValue = parseCookies(req).get(DASHBOARD_REMEMBER_COOKIE) || "";
    const tokens = [];
    for (const rawToken of String(rawValue).split(/[,.|]/)) {
        const token = rawToken.trim();
        if (/^[a-f0-9]{64}$/i.test(token) && !tokens.includes(token)) {
            tokens.push(token);
        }
    }
    return tokens.slice(0, 8);
}

function getRememberedDashboardAccounts(req) {
    pruneRememberedDashboardDevices(true);
    const result = [];
    const seenEmails = new Set();
    for (const rawToken of parseRememberedDashboardTokens(req)) {
        const entry = rememberedDashboardDevices.get(rememberTokenHash(rawToken));
        if (!entry || entry.expiresAtMs <= Date.now()) {
            continue;
        }
        const account = getDashboardAccountByEmail(entry.email) || getDashboardAccountByUsername(entry.username);
        if (!account || seenEmails.has(account.email)) {
            continue;
        }
        seenEmails.add(account.email);
        result.push({
            username: account.username,
            email: account.email,
            expiresAtMs: entry.expiresAtMs,
            rememberToken: rawToken,
        });
    }
    return result;
}

function getRememberedDashboardAccount(req) {
    return getRememberedDashboardAccounts(req)[0] || null;
}

function rememberCookieValueWithNewToken(req, rawToken) {
    const tokens = parseRememberedDashboardTokens(req).filter((token) => token !== rawToken);
    if (/^[a-f0-9]{64}$/i.test(rawToken || "")) {
        tokens.unshift(rawToken);
    }
    return tokens.slice(0, 8).join(".");
}

function rememberCookieValueWithoutToken(req, rawToken = "") {
    const tokens = parseRememberedDashboardTokens(req);
    if (!rawToken) {
        return "";
    }
    return tokens.filter((token) => token !== rawToken).slice(0, 8).join(".");
}

function removeRememberedDashboardDevice(req, rawToken = "") {
    const tokens = rawToken ? [rawToken] : parseRememberedDashboardTokens(req);
    let changed = false;
    for (const token of tokens) {
        if (/^[a-f0-9]{64}$/i.test(token)) {
            rememberedDashboardDevices.delete(rememberTokenHash(token));
            changed = true;
        }
    }
    if (changed) {
        saveRememberedDashboardDevices();
    }
}

function validDashboardPassword(password) {const account = getOwnerDashboardAccount() || getFirstDashboardAccount();return validDashboardAccountPassword(account, password);}

function sha256Hex(value) {return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");}

function allowLoginAttempt(req) {pruneDashboardAuth();const ip = getClientIp(req);const now = Date.now();let state = loginRateLimits.get(ip);

if (!state || now - state.windowStartedAtMs > LOGIN_RATE_WINDOW_MS) {
    state = { windowStartedAtMs: now, count: 0 };
    loginRateLimits.set(ip, state);
}

state.count += 1;
return state.count <= LOGIN_RATE_LIMIT;

}

function clearLoginAttempts(req) {loginRateLimits.delete(getClientIp(req));}

function pruneDirectMessages() {const now = Date.now();

for (const [userId, queue] of directMessages) {
    const fresh = queue.filter((entry) => now - entry.sentAtMs <= DM_TTL_MS);
    if (fresh.length > 0) {
        directMessages.set(userId, fresh);
    } else {
        directMessages.delete(userId);
    }
}

for (const [ip, state] of dmRateLimits) {
    if (now - state.windowStartedAtMs > DM_RATE_WINDOW_MS) {
        dmRateLimits.delete(ip);
    }
}

}

function allowDirectMessageSend(req) {pruneDirectMessages();

const ip = getClientIp(req);
const now = Date.now();
let state = dmRateLimits.get(ip);

if (!state || now - state.windowStartedAtMs > DM_RATE_WINDOW_MS) {
    state = {
        windowStartedAtMs: now,
        count: 0,
    };
    dmRateLimits.set(ip, state);
}

state.count += 1;
return state.count <= DM_RATE_LIMIT;

}

function queueDirectMessage(userId, message, sender = "NEXU") {pruneDirectMessages();

const now = Date.now();
const entry = {
    id: `${now}-${nextDirectMessageId++}`,
    userId,
    sender: cleanText(sender, 40) || "NEXU",
    message: cleanText(message, DM_MAX_LENGTH),
    sentAt: new Date(now).toISOString(),
    sentAtMs: now,
};

const queue = directMessages.get(userId) || [];
queue.push(entry);

while (queue.length > DM_QUEUE_LIMIT) {
    queue.shift();
}

directMessages.set(userId, queue);
return entry;

}

function takeDirectMessages(userId) {pruneDirectMessages();

const queue = directMessages.get(userId) || [];
directMessages.delete(userId);

return queue.map((entry) => ({
    id: entry.id,
    sender: entry.sender,
    message: entry.message,
    sentAt: entry.sentAt,
}));

}

async function fetchAvatarUrls(userIds) {const now = Date.now();const result = new Map();const missing = [];

for (const id of userIds) {
    const cached = avatarCache.get(id);

    if (cached && now - cached.cachedAtMs < AVATAR_CACHE_MS) {
        result.set(id, cached.url);
    } else {
        missing.push(id);
    }
}

for (let index = 0; index < missing.length; index += 100) {
    const batch = missing.slice(index, index + 100);

    try {
        const endpoint =
            "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
            "?userIds=" +
            encodeURIComponent(batch.join(",")) +
            "&size=150x150&format=Png&isCircular=false";

        const response = await fetch(endpoint, {
            headers: {
                "User-Agent": "Nexu-Presence-Dashboard/3.0",
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Roblox thumbnail HTTP ${response.status}`);
        }

        const payload = await response.json();
        const rows = Array.isArray(payload.data) ? payload.data : [];

        for (const row of rows) {
            const id = cleanNumericId(row.targetId);
            const url = cleanText(row.imageUrl, 600);

            if (id && url.startsWith("https://")) {
                result.set(id, url);
                avatarCache.set(id, { url, cachedAtMs: now });
            }
        }
    } catch (error) {
        console.warn("[NEXU] Avatar-Lookup fehlgeschlagen:", error.message);
    }
}

for (const id of userIds) {
    if (!result.has(id)) {
        result.set(
            id,
            "https://www.roblox.com/headshot-thumbnail/image" +
                "?userId=" +
                encodeURIComponent(id) +
                "&width=150&height=150&format=png"
        );
    }
}

return result;

}

async function getPublicPresence() {prunePresence();

const latestActiveByUserId = new Map();
for (const row of presence.values()) {
    const current = latestActiveByUserId.get(row.userId);
    if (!current || row.lastSeenMs > current.lastSeenMs) {
        latestActiveByUserId.set(row.userId, row);
    }
}

const mergedByUserId = new Map();
for (const row of knownPlayers.values()) {
    if (!bans.has(row.userId)) {
        mergedByUserId.set(row.userId, {...row,online: false});
    }
}
for (const row of latestActiveByUserId.values()) {
    if (!bans.has(row.userId)) {
        const remembered = mergedByUserId.get(row.userId) || {};
        mergedByUserId.set(row.userId, {...remembered,...row,online: true});
    }
}

const playerRows = [...mergedByUserId.values()].sort((a, b) => {
    if ((a.online === true) !== (b.online === true)) {
        return a.online === true ? -1 : 1;
    }
    return (a.displayName || a.username || a.userId).localeCompare(
        b.displayName || b.username || b.userId,
        "de",
        { sensitivity: "base" }
    );
});

const bannedRows = [...bans.values()].sort((a, b) =>
    (a.displayName || a.username || a.userId).localeCompare(
        b.displayName || b.username || b.userId,
        "de",
        { sensitivity: "base" }
    )
);

const allIds = [
    ...new Set([
        ...playerRows.map((row) => row.userId),
        ...bannedRows.map((row) => row.userId),
    ]),
];

const avatarUrls = await fetchAvatarUrls(allIds);

const players = playerRows.map((row) => {
    const role = getNexuRoleInfo(row.userId);
    const lastSeenMs = cleanInteger(row.lastSeenMs) || Date.now();
    const joinedAtMs = cleanInteger(row.joinedAtMs) || cleanInteger(row.firstSeenMs) || lastSeenMs;
    return {
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: avatarUrls.get(row.userId) || "",
        gameName: row.gameName || `Place ${row.placeId || 0}`,
        placeId: row.placeId,
        jobId: row.jobId,
        executionSource: row.executionSource || "",
        executionVersion: row.executionVersion || "",
        clientPlatform: row.clientPlatform || "",
        scriptBuild: row.scriptBuild || "",
        joinedAt: new Date(joinedAtMs).toISOString(),
        firstSeen: new Date(cleanInteger(row.firstSeenMs) || joinedAtMs).toISOString(),
        lastSeen: new Date(lastSeenMs).toISOString(),
        online: row.online === true,
        roleTitle: role.title,
        roleKey: role.key,
        banned: false,
    };
});

const bannedPlayers = bannedRows.map((row) => {
    const role = getNexuRoleInfo(row.userId);
    return {
        userId: row.userId,
        username: row.username || `User${row.userId}`,
        displayName: row.displayName || row.username || `User ${row.userId}`,
        avatarUrl: avatarUrls.get(row.userId) || "",
        gameName: "",
        placeId: 0,
        jobId: "",
        roleTitle: role.title,
        roleKey: role.key,
        banned: true,
        reason: row.reason,
        bannedAt: row.bannedAt,
    };
});

return { players, bannedPlayers, activeCount: latestActiveByUserId.size };

}

function normalizeHeartbeatPlayers(body) {if (Array.isArray(body.players)) {return {batch: true,rows: body.players.slice(0, 200),};}

return {
    batch: false,
    rows: [
        {
            userId: body.userId,
            username: body.username,
            displayName: body.displayName,
            gameName: body.gameName,
            placeId: body.placeId,
            jobId: body.jobId,
            sessionId: body.sessionId,
            executionSource: body.executionSource,
            executionVersion: body.executionVersion,
            clientPlatform: body.clientPlatform,
            scriptBuild: body.scriptBuild,
            executorName: body.executorName,
            executorVersion: body.executorVersion,
            platform: body.platform,
            buildId: body.buildId,
            clientInfo: body.clientInfo,
        },
    ],
};

}

function pruneJoinCommands() {const now = Date.now();for (const [userId, command] of joinCommands) {if (!command || now >= command.expiresAtMs) {joinCommands.delete(userId);}}}

function queueJoinCommand(targetUserId, targetPresence) {pruneJoinCommands();

const now = Date.now();
const command = {
    id: String(nextJoinCommandId++),
    targetUserId: targetPresence.userId,
    targetUsername: targetPresence.username,
    targetDisplayName: targetPresence.displayName,
    gameName: targetPresence.gameName || `Place ${targetPresence.placeId || 0}`,
    placeId: targetPresence.placeId,
    jobId: targetPresence.jobId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + JOIN_COMMAND_TTL_MS).toISOString(),
    createdAtMs: now,
    expiresAtMs: now + JOIN_COMMAND_TTL_MS,
};

joinCommands.set(targetUserId, command);
return command;

}

function takeJoinCommand(userId, sessionId) {pruneJoinCommands();

const activeSession = findLatestPresenceForUser(userId);
if (!activeSession) {
    return { error: "Keine aktive Nexu-Sitzung gefunden" };
}

if (!sessionId || activeSession.sessionId !== sessionId) {
    return { error: "Nexu-Sitzung stimmt nicht überein" };
}

const command = joinCommands.get(userId) || null;
if (command) {
    joinCommands.delete(userId);
}

return { command };

}

function pruneBringCommands() {const now = Date.now();for (const [userId, command] of bringCommands) {if (!command || now >= command.expiresAtMs) {bringCommands.delete(userId);}}}

function queueBringCommand(targetUserId, targetPresence, ownerPresence) {pruneBringCommands();

const now = Date.now();
const command = {
    id: String(nextBringCommandId++),
    targetUserId: targetPresence.userId,
    targetUsername: targetPresence.username,
    targetDisplayName: targetPresence.displayName,
    ownerUserId: ownerPresence.userId,
    ownerUsername: ownerPresence.username,
    ownerDisplayName: ownerPresence.displayName,
    ownerGameName: ownerPresence.gameName || `Place ${ownerPresence.placeId || 0}`,
    ownerPlaceId: ownerPresence.placeId,
    ownerJobId: ownerPresence.jobId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + BRING_COMMAND_TTL_MS).toISOString(),
    createdAtMs: now,
    expiresAtMs: now + BRING_COMMAND_TTL_MS,
};

bringCommands.set(targetUserId, command);
return command;

}

function takeBringCommand(userId, sessionId) {pruneBringCommands();

const activeSession = findLatestPresenceForUser(userId);
if (!activeSession) {
    return { error: "Keine aktive Nexu-Sitzung gefunden" };
}

if (!sessionId || activeSession.sessionId !== sessionId) {
    return { error: "Nexu-Sitzung stimmt nicht überein" };
}

const command = bringCommands.get(userId) || null;
if (command) {
    bringCommands.delete(userId);
}

return { command };

}

function loginHtml(errorMessage = "", rememberedAccount = null, options = {}) {const errorBlock = errorMessage ? `<div class="login-error" role="alert">${escapeHtml(errorMessage)}</div>` : "";const noticeBlock = options.notice ? `<div class="login-notice" role="status">${escapeHtml(options.notice)}</div>` : "";const rememberedAccounts = Array.isArray(rememberedAccount) ? rememberedAccount : (rememberedAccount ? [rememberedAccount] : []);const rememberedBlock = rememberedAccounts.length ? `<section class="remembered-list" aria-label="Gespeicherte Accounts">
            <h2>Gespeicherte Accounts</h2>
            <p>Accounts, mit denen du auf diesem Browser angemeldet warst.</p>
            ${rememberedAccounts.map((remembered) => `<div class="remembered-account">
                <div>
                    <b>${escapeHtml(remembered.username || "Gespeicherter Account")}</b>
                    <small>${escapeHtml(remembered.email || "")}</small>
                </div>
                <form method="post" action="/quick-login">
                    <input type="hidden" name="rememberToken" value="${escapeHtml(remembered.rememberToken || "")}">
                    <button type="submit">Direkt anmelden</button>
                </form>
                <form method="post" action="/forget-account">
                    <input type="hidden" name="rememberToken" value="${escapeHtml(remembered.rememberToken || "")}">
                    <button class="ghost" type="submit">Vergessen</button>
                </form>
            </div>`).join("")}
        </section>
        <div class="login-divider"><span>oder anmelden</span></div>` : "";return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexu Dashboard Login</title>
<style>
* { box-sizing:border-box; }
html,body { margin:0; min-height:100%; font-family:Inter,Segoe UI,Arial,sans-serif; background:#02050a; color:#dceef8; }
body { display:flex; align-items:center; justify-content:center; padding:28px; overflow-x:hidden; }
body:before { content:""; position:fixed; inset:-20%; background:radial-gradient(circle at 20% 15%, rgba(0,200,255,.22), transparent 34%),radial-gradient(circle at 82% 72%, rgba(111,70,255,.16), transparent 38%),linear-gradient(135deg,#02050a,#06101d 55%,#02050a); z-index:-2; }
body:after { content:""; position:fixed; inset:0; background:linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px, transparent 1px); background-size:42px 42px; mask-image:radial-gradient(circle at center, black, transparent 75%); z-index:-1; }
.login-shell { width:min(920px,100%); display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:stretch; }
.brand-card,.auth-card { border:1px solid rgba(0,200,255,.26); border-radius:26px; background:rgba(3,10,18,.78); box-shadow:0 28px 90px rgba(0,0,0,.45), inset 0 0 28px rgba(0,200,255,.04); backdrop-filter: blur(14px); }
.brand-card { padding:34px; position:relative; overflow:hidden; }
.brand-card:before { content:""; position:absolute; inset:-80px auto auto -80px; width:240px; height:240px; border-radius:50%; background:rgba(0,200,255,.16); filter:blur(18px); }
.logo { width:78px; height:78px; border-radius:22px; display:grid; place-items:center; color:#fff; font-size:32px; font-weight:950; letter-spacing:-2px; background:linear-gradient(135deg,#00c8ff,#6f46ff); box-shadow:0 0 36px rgba(0,200,255,.35); margin-bottom:24px; }
h1 { margin:0; font-size:42px; letter-spacing:-1.8px; line-height:1; }
p { color:#8fa8ba; line-height:1.6; margin:14px 0 0; }
.statline { margin-top:30px; display:grid; gap:12px; }
.stat { padding:14px 16px; border:1px solid rgba(255,255,255,.08); border-radius:16px; background:rgba(255,255,255,.035); }
.stat b { display:block; color:#fff; font-size:13px; letter-spacing:.12em; text-transform:uppercase; }
.stat span { color:#6cdfff; font-size:12px; }
.auth-card { padding:24px; }
.auth-grid { display:grid; gap:16px; }
.auth-panel,.remembered-list { padding:18px; border:1px solid rgba(0,200,255,.22); border-radius:18px; background:rgba(3,10,18,.62); }.remembered-list { display:grid; gap:10px; }.remembered-list h2 { margin:0; font-size:19px; }.remembered-list p { margin:0 0 4px; font-size:12px; }
.auth-panel h2 { margin:0 0 12px; font-size:19px; }
.field { display:grid; gap:7px; margin-bottom:12px; }
label { color:#a7bed0; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; }
input { width:100%; border:1px solid rgba(0,200,255,.28); border-radius:12px; background:#07131f; color:#fff; padding:12px 13px; outline:none; }
input:focus { border-color:#00c8ff; box-shadow:0 0 0 3px rgba(0,200,255,.14); }
button,.button-link { width:100%; border:0; border-radius:13px; background:linear-gradient(135deg,#00c8ff,#2f75ff); color:#fff; font-weight:950; letter-spacing:.08em; text-transform:uppercase; padding:12px 14px; cursor:pointer; box-shadow:0 12px 24px rgba(0,123,255,.22); text-decoration:none; display:inline-flex; justify-content:center; }
button.ghost { background:rgba(255,255,255,.06); box-shadow:none; border:1px solid rgba(255,255,255,.1); color:#bed2df; }
.login-error,.login-notice { margin-bottom:16px; border-radius:14px; padding:12px 14px; font-weight:800; }
.login-error { background:rgba(255,48,72,.14); border:1px solid rgba(255,48,72,.3); color:#ff9aa8; }
.login-notice { background:rgba(45,255,165,.12); border:1px solid rgba(45,255,165,.25); color:#aaffdc; }
.login-divider { display:flex; align-items:center; gap:12px; color:#6f8496; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.14em; margin:2px 0; }
.login-divider:before,.login-divider:after { content:""; height:1px; background:rgba(255,255,255,.1); flex:1; }
.remembered-account { display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:center; padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:rgba(255,255,255,.035); }
.remembered-account small { display:block; color:#7894a8; margin-top:3px; }
.remembered-account button { width:auto; padding:10px 12px; font-size:11px; }
@media (max-width:820px) { .login-shell { grid-template-columns:1fr; } body { align-items:flex-start; } }
</style>
</head>
<body>
<main class="login-shell">
    <section class="brand-card">
        <div class="logo">N</div>
        <h1>Nexu</h1>
        <p>Privates Dashboard für Menu Server, gespeicherte Spieler, Rollen, Bring, DM und Server-Join.</p>
        <div class="statline">
            <div class="stat"><b>Account Login</b><span>Benutzername + Passwort</span></div>
            <div class="stat"><b>Menu Server</b><span>nur OwnerAccount</span></div>
            <div class="stat"><b>Accounts</b><span>Registrieren, Einstellungen und Löschen</span></div>
        </div>
    </section>
    <section class="auth-card">
        <p>Melde dich mit Benutzername und Passwort an. Neue Accounts können direkt registriert werden.</p>
        ${errorBlock}${noticeBlock}${rememberedBlock}
        <div class="auth-grid">
            <section class="auth-panel">
                <h2>Anmelden</h2>
                <form method="post" action="/login" autocomplete="on">
                    <div class="field"><label for="username">Benutzername</label><input id="username" name="username" type="text" maxlength="80" autocomplete="username" required autofocus></div>
                    <div class="field"><label for="password">Passwort</label><input id="password" name="password" type="password" maxlength="200" autocomplete="current-password" required></div>
                    <button type="submit">Anmelden</button>
                </form>
            </section>
            <section class="auth-panel">
                <h2>Registrieren</h2>
                <form method="post" action="/register/request" autocomplete="on">
                    <div class="field"><label for="registerUsername">Benutzername</label><input id="registerUsername" name="username" type="text" maxlength="80" autocomplete="username" required></div>
                    <div class="field"><label for="registerPassword">Passwort</label><input id="registerPassword" name="password" type="password" maxlength="200" autocomplete="new-password" required></div>
                    <div class="field"><label for="registerConfirmPassword">Passwort bestätigen</label><input id="registerConfirmPassword" name="confirmPassword" type="password" maxlength="200" autocomplete="new-password" required></div>
                    <button type="submit">Registrieren</button>
                </form>
            </section>
        </div>
    </section>
</main>
</body>
</html>`;}

function homeHtml(notice = "", error = "", account = null) {const loaderCommandJson = JSON.stringify(NEXU_LOADER_COMMAND);const accountData = account || getOwnerDashboardAccount() || getFirstDashboardAccount() || {username: OWNER_ACCOUNT_USERNAME, email: DASHBOARD_DEFAULT_EMAIL};const accountName = accountData.username || OWNER_ACCOUNT_USERNAME;const accountEmail = accountData.email || "";const isOwnerAccount = isOwnerDashboardAccount(accountData);const canOpenMenuServer = canAccessMenuServer(accountData);const canManageAccounts = canManageDashboardAccounts(accountData);const usernameReadonly = isOwnerAccount ? "readonly" : "";const deleteAccountBlock = isOwnerAccount
    ? '<section class="modal-card"><div class="danger-zone"><h3>OwnerAccount geschützt</h3><p>Der OwnerAccount kann hier nicht gelöscht werden, damit du den Hauptzugriff nicht verlierst.</p></div></section>'
    : '<form class="modal-card" method="post" action="/account/delete" autocomplete="off"><div class="danger-zone"><h3>Account löschen</h3><p>Dieser Account wird dauerhaft vom Dashboard entfernt. Danach wirst du abgemeldet.</p><div class="field"><label for="deletePassword">Passwort bestätigen</label><input id="deletePassword" name="currentPassword" type="password" maxlength="200" autocomplete="current-password" required></div><div class="modal-actions"><button type="submit">ACCOUNT LÖSCHEN</button></div></div></form>';const noticeBlock = notice ? '<div class="home-notice success">' + escapeHtml(notice) + '</div>' : "";const errorBlock = error ? '<div class="home-notice error">' + escapeHtml(error) + '</div>' : "";const menuServerButton = canOpenMenuServer
    ? '<a class="primary-tile menu-server" href="/menu-server"><span>MENU SERVER</span><strong>Spieler-Dashboard öffnen</strong><small>' + (isOwnerAccount ? 'OwnerAccount Zugriff' : 'Vom Owner freigegeben') + '</small></a>'
    : '<div class="primary-tile menu-server locked"><span>MENU SERVER</span><strong>Zugriff gesperrt</strong><small>Der OwnerAccount kann deinen Zugriff freigeben.</small></div>';const accountManagerButton = canManageAccounts
    ? '<a class="primary-tile account-admin" href="/accounts"><span>ACCOUNTS</span><strong>Account-Verwaltung</strong><small>Benutzer, Passwörter und Zugriffe einstellen</small></a>'
    : '';
return String.raw`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#03070e">
<title>Nexu Startseite</title>
<style>
:root { --bg:#03070e; --panel:rgba(7,13,23,.86); --panel2:rgba(10,18,31,.76); --text:#dceef8; --muted:#7894a8; --cyan:#00c8ff; --violet:#6f46ff; --green:#2dffa5; --red:#ff4d78; --border:rgba(74,178,230,.28); }
* { box-sizing:border-box; }
body,body *:not(input):not(textarea) { -webkit-user-select:none !important; user-select:none !important; -webkit-touch-callout:none; }
body *:not(input):not(textarea):not(button):not(a) { caret-color:transparent; cursor:default; }
input { -webkit-user-select:text !important; user-select:text !important; caret-color:auto; cursor:text; }
html,body { margin:0; min-height:100%; color:var(--text); background:radial-gradient(circle at 20% 5%,rgba(0,200,255,.16),transparent 32rem),radial-gradient(circle at 84% 18%,rgba(111,70,255,.15),transparent 33rem),var(--bg); font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif; }
body::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.22; background-image:linear-gradient(rgba(0,200,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,.06) 1px,transparent 1px); background-size:32px 32px; mask-image:linear-gradient(to bottom,black,transparent 85%); }
.scan { position:fixed; z-index:0; left:0; right:0; top:-2px; height:1px; pointer-events:none; background:linear-gradient(90deg,transparent,rgba(0,200,255,.8),transparent); box-shadow:0 0 20px rgba(0,200,255,.75); animation:scan 7s linear infinite; }
@keyframes scan { from { transform:translateY(0); opacity:0; } 8%,92% { opacity:.65; } to { transform:translateY(100vh); opacity:0; } }
.shell { position:relative; z-index:1; width:min(1180px,calc(100% - 32px)); margin:0 auto; padding:26px 0 54px; }
.header { position:relative; z-index:200; display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:34px; }
.brand { display:flex; align-items:center; gap:13px; }
.logo { width:48px; height:48px; display:grid; place-items:center; border-radius:50%; font-weight:900; font-size:21px; color:white; background:linear-gradient(135deg,var(--cyan),var(--violet)); box-shadow:0 0 0 1px rgba(255,255,255,.17) inset,0 0 30px rgba(0,200,255,.32); }
.brand strong { display:block; font-size:22px; letter-spacing:.02em; }
.brand span { color:var(--muted); font-size:12px; letter-spacing:.14em; text-transform:uppercase; }
.account { position:relative; z-index:10000; }
.account-button { display:flex; align-items:center; gap:11px; min-height:44px; padding:0 13px 0 8px; border:1px solid var(--border); border-radius:999px; color:var(--text); background:rgba(7,13,23,.78); font:inherit; cursor:pointer; }
.account-avatar { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; color:white; font-weight:900; background:linear-gradient(135deg,var(--cyan),var(--violet)); }
.account-name { max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:800; }
.account-menu { position:absolute; z-index:10001; right:0; top:54px; width:235px; padding:10px; border:1px solid rgba(74,178,230,.25); border-radius:18px; background:rgba(6,12,21,.98); box-shadow:0 22px 70px rgba(0,0,0,.62); display:none; }
.account.open .account-menu { display:block; }
.menu-item { width:100%; min-height:38px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 11px; border:1px solid rgba(74,178,230,.14); border-radius:12px; color:var(--text); background:rgba(10,18,31,.72); font:inherit; font-size:12px; font-weight:800; letter-spacing:.05em; text-decoration:none; cursor:pointer; }
.menu-item + .menu-item,.menu-item-form { margin-top:8px; }
.menu-item.danger { color:#ffb3c2; border-color:rgba(255,77,120,.3); background:rgba(45,7,18,.54); }
.hero { min-height:420px; display:grid; grid-template-columns:1.08fr .92fr; gap:22px; align-items:stretch; }
.panel { border:1px solid var(--border); border-radius:30px; background:linear-gradient(135deg,rgba(0,200,255,.06),rgba(111,70,255,.045)),var(--panel); box-shadow:0 26px 80px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.025) inset; backdrop-filter:blur(18px); }
.welcome { padding:34px; display:flex; flex-direction:column; justify-content:center; }
.eyebrow { color:var(--cyan); font-size:11px; letter-spacing:.2em; text-transform:uppercase; }
h1 { margin:12px 0 13px; font-size:clamp(38px,6vw,72px); line-height:.95; letter-spacing:-.055em; }
p { margin:0; color:var(--muted); line-height:1.65; }
.action-grid { padding:24px; display:grid; align-content:center; gap:14px; }
.primary-tile { min-height:150px; padding:22px; display:flex; flex-direction:column; justify-content:center; gap:8px; border:1px solid rgba(0,200,255,.32); border-radius:24px; background:linear-gradient(135deg,rgba(0,200,255,.13),rgba(111,70,255,.09)); text-decoration:none; color:var(--text); box-shadow:0 0 34px rgba(0,200,255,.08) inset; }
.primary-tile span { color:var(--cyan); font-size:11px; letter-spacing:.22em; text-transform:uppercase; font-weight:900; }
.primary-tile strong { font-size:24px; line-height:1.05; }
.primary-tile small { color:var(--muted); font-size:12px; }
.primary-tile.locked { opacity:.58; border-color:rgba(125,150,170,.22); background:rgba(7,13,23,.76); }
button.primary-tile { width:100%; text-align:left; font:inherit; cursor:pointer; }
.primary-tile.copy-script { border-color:rgba(45,255,165,.34); background:linear-gradient(135deg,rgba(45,255,165,.11),rgba(0,200,255,.08)); }
.primary-tile.copy-script span { color:var(--green); }
.copy-command { display:block; max-width:100%; overflow:hidden; color:#8fb3c8; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.copy-feedback { color:#9effd1 !important; }
.quick-info { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.info-card { min-height:100px; padding:15px; border:1px solid rgba(74,178,230,.17); border-radius:18px; background:var(--panel2); }
.info-label { color:var(--muted); font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
.info-value { margin-top:8px; font-size:18px; font-weight:850; }
.home-notice { margin-bottom:16px; padding:13px 14px; border-radius:14px; font-size:13px; font-weight:780; }
.home-notice.success { border:1px solid rgba(45,255,165,.32); background:rgba(7,45,30,.48); color:#b8ffdc; }
.home-notice.error { border:1px solid rgba(255,77,120,.38); background:rgba(55,7,20,.58); color:#ffb0c1; }
.modal-backdrop { position:fixed; z-index:20000; inset:0; display:grid; place-items:center; padding:18px; background:rgba(0,0,0,.54); backdrop-filter:blur(10px); }
.modal-backdrop.hidden { display:none; }
.modal-card { width:min(500px,100%); padding:24px; border:1px solid rgba(74,178,230,.28); border-radius:24px; background:rgba(7,13,23,.96); box-shadow:0 30px 90px rgba(0,0,0,.52); }
.modal-card h2 { margin:8px 0 8px; }
.field { margin-top:14px; }
.field label { display:block; margin-bottom:7px; color:#9bb8c9; font-size:11px; letter-spacing:.11em; text-transform:uppercase; }
.field input { width:100%; height:44px; border:1px solid rgba(74,178,230,.24); border-radius:13px; outline:none; padding:0 13px; color:var(--text); background:rgba(3,8,15,.78); font:inherit; }
.field input:focus { border-color:rgba(0,200,255,.68); box-shadow:0 0 0 3px rgba(0,200,255,.08); }
.modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; }
.modal-actions button { min-height:42px; padding:0 14px; border:1px solid rgba(74,178,230,.28); border-radius:13px; color:var(--text); background:rgba(10,18,31,.78); font:inherit; font-size:12px; font-weight:850; letter-spacing:.06em; cursor:pointer; }
.modal-actions .save { border-color:rgba(0,200,255,.5); background:linear-gradient(135deg,rgba(0,200,255,.2),rgba(111,70,255,.16)); }.danger-zone { margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,77,120,.22); }.danger-zone h3 { margin:0 0 8px; color:#ffb3c2; }.danger-zone button { border-color:rgba(255,77,120,.4); background:rgba(55,7,20,.62); color:#ffd6df; }
@media (max-width:820px) { .shell { width:min(100% - 20px,1180px); padding-top:16px; } .hero { grid-template-columns:1fr; } .header { align-items:flex-start; } .quick-info { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="scan"></div>
<main class="shell">
    <div class="header">
        <div class="brand"><div class="logo">N</div><div><strong>Nexu</strong><span>Control Home</span></div></div>
        <div id="account" class="account">
            <button id="accountButton" class="account-button" type="button" aria-haspopup="true" aria-expanded="false"><span class="account-avatar">N</span><span class="account-name">${escapeHtml(accountName)}</span></button>
            <div class="account-menu" role="menu">
                <button id="openSettings" class="menu-item" type="button">Settings <span>›</span></button>
                <form class="menu-item-form" method="post" action="/logout"><button class="menu-item danger" type="submit">Abmelden <span>×</span></button></form>
            </div>
        </div>
    </div>
    ${noticeBlock}${errorBlock}
    <section class="hero">
        <div class="panel welcome">
            <div class="eyebrow">NEXU // STARTSEITE</div>
            <h1>Nexu</h1>
            <p>Willkommen in der Startseite. Von hier aus öffnest du den geschützten Menu-Server-Bereich oder änderst oben rechts über dein Profil die Account-Daten.</p>
        </div>
        <div class="panel action-grid">
            ${menuServerButton}
            ${accountManagerButton}
            <button id="copyScriptButton" class="primary-tile copy-script" type="button"><span>START SCRIPT</span><strong id="copyScriptTitle">Script kopieren</strong><small id="copyScriptHint">Kopiert den aktuellen Nexu-Loader in die Zwischenablage.</small><code class="copy-command">loadstring(game:HttpGet(&quot;…/Nexu%20Main&quot;))()</code></button>
            <div class="quick-info">
                <article class="info-card"><div class="info-label">Account</div><div class="info-value">${escapeHtml(accountName)}</div><p>Benutzername-Login aktiv</p></article>
                <article class="info-card"><div class="info-label">Menu Server Zugriff</div><div class="info-value">${canOpenMenuServer ? "Erlaubt" : "Gesperrt"}</div></article>
            </div>
        </div>
    </section>
</main>
<div id="settingsModal" class="modal-backdrop hidden" aria-hidden="true">
    <form class="modal-card" method="post" action="/account/settings" autocomplete="on">
        <div class="eyebrow">ACCOUNT SETTINGS</div>
        <h2>Account bearbeiten</h2>
        <p>Benutzername und Passwort werden serverseitig gespeichert. Registrierung läuft ohne Bestätigungscode.${isOwnerAccount ? " Der OwnerAccount-Name ist geschützt." : ""}</p>
        <div class="field"><label for="newUsername">Benutzername</label><input id="newUsername" name="newUsername" type="text" maxlength="80" value="${escapeHtml(accountName)}" autocomplete="username" ${usernameReadonly} required></div>
        <div class="field"><label for="currentPassword">Aktuelles Passwort</label><input id="currentPassword" name="currentPassword" type="password" maxlength="200" autocomplete="current-password" required></div>
        <div class="field"><label for="newPassword">Neues Passwort</label><input id="newPassword" name="newPassword" type="password" maxlength="200" autocomplete="new-password" placeholder="Leer lassen, wenn gleich bleiben soll"></div>
        <div class="field"><label for="confirmPassword">Neues Passwort bestätigen</label><input id="confirmPassword" name="confirmPassword" type="password" maxlength="200" autocomplete="new-password"></div>
        <div class="modal-actions"><button id="closeSettings" type="button">ABBRECHEN</button><button class="save" type="submit">SPEICHERN</button></div>
    </form>
    ${deleteAccountBlock}
</div>
<script>
const account = document.getElementById("account");
const accountButton = document.getElementById("accountButton");
const settingsModal = document.getElementById("settingsModal");
const openSettings = document.getElementById("openSettings");
const closeSettings = document.getElementById("closeSettings");
const copyScriptButton = document.getElementById("copyScriptButton");
const copyScriptTitle = document.getElementById("copyScriptTitle");
const copyScriptHint = document.getElementById("copyScriptHint");
const NEXU_LOADER_COMMAND = ${loaderCommandJson};
async function copyNexuLoader() {
    let copied = false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(NEXU_LOADER_COMMAND);
            copied = true;
        }
    } catch {}
    if (!copied) {
        const helper = document.createElement("textarea");
        helper.value = NEXU_LOADER_COMMAND;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        copied = document.execCommand("copy");
        helper.remove();
    }
    copyScriptTitle.textContent = copied ? "Kopiert" : "Kopieren fehlgeschlagen";
    copyScriptHint.textContent = copied ? "Der Nexu-Loader ist jetzt in deiner Zwischenablage." : "Bitte Browser-Berechtigung für die Zwischenablage erlauben.";
    copyScriptHint.classList.toggle("copy-feedback", copied);
    setTimeout(function () {
        copyScriptTitle.textContent = "Script kopieren";
        copyScriptHint.textContent = "Kopiert den aktuellen Nexu-Loader in die Zwischenablage.";
        copyScriptHint.classList.remove("copy-feedback");
    }, 2200);
}
copyScriptButton.addEventListener("click", copyNexuLoader);
accountButton.addEventListener("click", function () { account.classList.toggle("open"); accountButton.setAttribute("aria-expanded", account.classList.contains("open") ? "true" : "false"); });
document.addEventListener("click", function (event) { if (!account.contains(event.target)) { account.classList.remove("open"); accountButton.setAttribute("aria-expanded", "false"); } });
openSettings.addEventListener("click", function () { account.classList.remove("open"); settingsModal.classList.remove("hidden"); settingsModal.setAttribute("aria-hidden", "false"); document.getElementById("currentPassword").focus(); });
closeSettings.addEventListener("click", function () { settingsModal.classList.add("hidden"); settingsModal.setAttribute("aria-hidden", "true"); });
settingsModal.addEventListener("click", function (event) { if (event.target === settingsModal) { closeSettings.click(); } });
document.addEventListener("keydown", function (event) { if (event.key === "Escape") { account.classList.remove("open"); closeSettings.click(); } });
document.addEventListener("copy", function (event) { if (!event.target.closest("input,textarea")) event.preventDefault(); });
document.addEventListener("contextmenu", function (event) { if (!event.target.closest("input,textarea")) event.preventDefault(); });
</script>
</body>
</html>`;}


function dashboardAccountsHtml(notice = "", error = "", account = null) {
    const accountData = account || getOwnerDashboardAccount() || getFirstDashboardAccount() || { username: OWNER_ACCOUNT_USERNAME };
    const noticeBlock = notice ? '<div class="notice success">' + escapeHtml(notice) + '</div>' : "";
    const errorBlock = error ? '<div class="notice error">' + escapeHtml(error) + '</div>' : "";
    const rows = [...dashboardAccounts.values()].sort((a, b) => String(a.username).localeCompare(String(b.username)));
    const cards = rows.map((entry) => {
        const owner = isOwnerDashboardAccount(entry);
        const permissionSnapshot = getDashboardPermissionSnapshot(entry);
        const created = cleanText(entry.createdAt, 32) || "unbekannt";
        const updated = cleanText(entry.updatedAt, 32) || "nie";
        const ownerBadge = owner ? '<span class="badge owner">OWNER LOCK</span>' : '';
        const dashboardEnabled = owner || permissionSnapshot.menuServer === true;
        const accessInput = '<div class="access-grid" data-dashboard-permissions="1">' + DASHBOARD_PERMISSION_DEFINITIONS.map((definition) => {
            const isDashboardRoot = definition.key === "menuServer";
            const checked = owner || permissionSnapshot[definition.key] === true;
            const lockedByDashboard = !owner && !isDashboardRoot && !dashboardEnabled;
            const disabled = (owner || lockedByDashboard) ? ' disabled' : '';
            const dataRole = isDashboardRoot ? ' data-dashboard-root="1"' : ' data-dashboard-child="1"';
            const hidden = owner && isDashboardRoot ? '<input type="hidden" name="menuServerAccess" value="1">' : '';
            const classes = ['check', isDashboardRoot ? 'dashboard-root' : 'dashboard-child'];
            if (owner) classes.push('disabled');
            if (lockedByDashboard) classes.push('locked-by-dashboard');
            return '<label class="' + classes.join(' ') + '"><input type="checkbox" name="' + escapeHtml(definition.formName) + '" value="1" ' + (checked ? 'checked' : '') + disabled + dataRole + '><span><b>' + escapeHtml(definition.title) + '</b><small>' + escapeHtml(definition.description) + '</small></span></label>' + hidden;
        }).join("") + '</div>';
        const usernameReadonly = owner ? 'readonly' : '';
        const deleteForm = owner
            ? '<div class="owner-note">OwnerAccount kann nicht gelöscht oder vom Hauptzugriff getrennt werden.</div>'
            : '<form method="post" action="/accounts/delete" onsubmit="return confirm(\'Diesen Account wirklich löschen?\');"><input type="hidden" name="accountEmail" value="' + escapeHtml(entry.email) + '"><button class="danger" type="submit">Account löschen</button></form>';
        return '<article class="account-card">'
            + '<div class="account-card-head"><div><strong>' + escapeHtml(entry.username) + '</strong><small>' + escapeHtml(entry.email) + '</small></div>' + ownerBadge + '</div>'
            + '<form method="post" action="/accounts/update" autocomplete="off">'
            + '<input type="hidden" name="accountEmail" value="' + escapeHtml(entry.email) + '">'
            + '<div class="grid">'
            + '<label>Benutzername<input name="username" maxlength="80" value="' + escapeHtml(entry.username) + '" ' + usernameReadonly + ' required></label>'
            + '<label>Neues Passwort<input name="newPassword" type="password" maxlength="200" placeholder="Leer lassen = bleibt gleich"></label>'
            + '<label>Passwort bestätigen<input name="confirmPassword" type="password" maxlength="200"></label>'
            + '</div>'
            + '<div class="access-box"><div><b>Dashboard-Rechte</b><p>Erst wenn <b>Dashboard öffnen</b> aktiviert ist, können die einzelnen Dashboard-Funktionen angeklickt und gespeichert werden. Startseite und eigene Settings bleiben immer erlaubt.</p></div>' + accessInput + '</div>'
            + '<div class="meta"><span>Erstellt: ' + escapeHtml(created) + '</span><span>Geändert: ' + escapeHtml(updated) + '</span></div>'
            + '<div class="actions"><button type="submit">Speichern</button></div>'
            + '</form>'
            + deleteForm
            + '</article>';
    }).join("") || '<div class="empty">Keine Accounts vorhanden.</div>';
    return String.raw`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#03070e">
<title>Nexu Account-Verwaltung</title>
<style>
:root { --bg:#03070e; --panel:rgba(7,13,23,.86); --text:#dceef8; --muted:#7894a8; --cyan:#00c8ff; --violet:#6f46ff; --green:#2dffa5; --red:#ff4d78; --border:rgba(74,178,230,.28); }
* { box-sizing:border-box; }
body,body *:not(input):not(textarea) { -webkit-user-select:none !important; user-select:none !important; -webkit-touch-callout:none; }
body *:not(input):not(textarea):not(button):not(a) { caret-color:transparent; cursor:default; }
input { -webkit-user-select:text !important; user-select:text !important; caret-color:auto; cursor:text; }
html,body { margin:0; min-height:100%; color:var(--text); background:radial-gradient(circle at 20% 5%,rgba(0,200,255,.16),transparent 32rem),radial-gradient(circle at 84% 18%,rgba(111,70,255,.15),transparent 33rem),var(--bg); font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif; }
body::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.18; background-image:linear-gradient(rgba(0,200,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,.06) 1px,transparent 1px); background-size:32px 32px; }
.shell { position:relative; z-index:1; width:min(1180px,calc(100% - 28px)); margin:0 auto; padding:26px 0 54px; }
.topbar { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:22px; }
.brand { display:flex; align-items:center; gap:12px; }
.logo { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; font-weight:900; background:linear-gradient(135deg,var(--cyan),var(--violet)); box-shadow:0 0 28px rgba(0,200,255,.28); }
h1 { margin:0; font-size:30px; letter-spacing:-.03em; }
p { margin:0; color:var(--muted); line-height:1.55; }
a.back { min-height:40px; display:inline-flex; align-items:center; padding:0 13px; border:1px solid var(--border); border-radius:13px; color:var(--text); text-decoration:none; background:rgba(7,13,23,.78); font-weight:850; font-size:12px; letter-spacing:.06em; }
.notice { margin:0 0 16px; padding:13px 14px; border-radius:14px; font-size:13px; font-weight:780; }
.notice.success { border:1px solid rgba(45,255,165,.32); background:rgba(7,45,30,.48); color:#b8ffdc; }
.notice.error { border:1px solid rgba(255,77,120,.38); background:rgba(55,7,20,.58); color:#ffb0c1; }
.intro { margin-bottom:18px; padding:18px; border:1px solid var(--border); border-radius:22px; background:var(--panel); }
.account-list { display:grid; gap:14px; }
.account-card { padding:18px; border:1px solid rgba(74,178,230,.24); border-radius:22px; background:linear-gradient(135deg,rgba(0,200,255,.055),rgba(111,70,255,.04)),rgba(7,13,23,.88); box-shadow:0 20px 60px rgba(0,0,0,.22); }
.account-card-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:14px; }
.account-card-head strong { display:block; font-size:18px; }
.account-card-head small { display:block; color:var(--muted); margin-top:3px; }
.badge { display:inline-flex; align-items:center; min-height:26px; padding:0 9px; border-radius:999px; font-size:10px; font-weight:950; letter-spacing:.08em; }
.badge.owner { color:#fff2a8; border:1px solid rgba(255,194,45,.42); background:rgba(47,27,3,.7); }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
label { display:block; color:#9bb8c9; font-size:10px; letter-spacing:.1em; text-transform:uppercase; font-weight:850; }
label input { width:100%; height:42px; margin-top:7px; border:1px solid rgba(74,178,230,.24); border-radius:12px; outline:none; padding:0 12px; color:var(--text); background:rgba(3,8,15,.78); font:inherit; font-size:13px; text-transform:none; letter-spacing:0; }
label input:focus { border-color:rgba(0,200,255,.68); box-shadow:0 0 0 3px rgba(0,200,255,.08); }
input[readonly] { opacity:.72; }
.access-box { margin-top:12px; padding:13px; display:grid; grid-template-columns:minmax(210px,.55fr) 1fr; gap:14px; align-items:start; border:1px solid rgba(74,178,230,.18); border-radius:16px; background:rgba(3,8,15,.45); }
.access-box b { display:block; margin-bottom:3px; }
.access-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
.check { display:flex; align-items:flex-start; gap:9px; min-width:0; color:var(--text); font-size:12px; letter-spacing:.04em; text-transform:none; padding:9px; border:1px solid rgba(74,178,230,.13); border-radius:13px; background:rgba(7,13,23,.55); }
.check input { width:18px; height:18px; margin:1px 0 0; flex:0 0 auto; accent-color:#00c8ff; }
.check b { display:block; color:#dceef8; font-size:12px; letter-spacing:.04em; }
.check small { display:block; margin-top:2px; color:#7894a8; font-size:10px; line-height:1.35; letter-spacing:0; text-transform:none; }
.check.disabled { opacity:.68; }
.check.locked-by-dashboard { opacity:.43; filter:saturate(.55); }
.check.locked-by-dashboard small::after { content:" Erst Dashboard öffnen aktivieren."; color:#d7bd72; }
.dashboard-root { border-color:rgba(0,200,255,.34); background:rgba(0,200,255,.08); }
.meta { margin-top:10px; display:flex; flex-wrap:wrap; gap:8px 14px; color:var(--muted); font-size:11px; }
.actions { margin-top:13px; }
button { min-height:40px; padding:0 13px; border:1px solid rgba(0,200,255,.4); border-radius:13px; color:var(--text); background:linear-gradient(135deg,rgba(0,200,255,.18),rgba(111,70,255,.14)); font:inherit; font-size:12px; font-weight:900; letter-spacing:.06em; cursor:pointer; }
button.danger { margin-top:10px; border-color:rgba(255,77,120,.4); background:rgba(55,7,20,.62); color:#ffd6df; }
.owner-note { margin-top:10px; color:#d7bd72; font-size:12px; }
.empty { padding:22px; border:1px dashed rgba(74,178,230,.28); border-radius:18px; color:var(--muted); }
@media (max-width:820px) { .grid { grid-template-columns:1fr; } .access-box { align-items:flex-start; flex-direction:column; } .topbar { align-items:flex-start; flex-direction:column; } }
</style>
</head>
<body>
<main class="shell">
    <div class="topbar">
        <div class="brand"><div class="logo">N</div><div><h1>Account-Verwaltung</h1><p>Eingeloggt als ${escapeHtml(accountData.username || OWNER_ACCOUNT_USERNAME)}</p></div></div>
        <a class="back" href="/">← STARTSEITE</a>
    </div>
    ${noticeBlock}${errorBlock}
    <section class="intro">
        <p>Nur der feste <b>OwnerAccount</b> kann diese Seite öffnen. Hier stellst du Benutzername, Passwort und die einzelnen Dashboard-Rechte ein. Die Account-Verwaltung selbst bleibt immer nur für OwnerAccount.</p>
    </section>
    <section class="account-list">
        ${cards}
    </section>
</main>
<script>
(function(){
    function syncPermissionGroup(grid) {
        var root = grid.querySelector('input[data-dashboard-root="1"]');
        if (!root) return;
        var children = Array.prototype.slice.call(grid.querySelectorAll('input[data-dashboard-child="1"]'));
        function sync() {
            var enabled = root.checked === true;
            children.forEach(function(input) {
                input.disabled = !enabled;
                if (!enabled) input.checked = false;
                var label = input.closest ? input.closest('.check') : null;
                if (label) label.classList.toggle('locked-by-dashboard', !enabled);
            });
        }
        root.addEventListener('change', sync);
        sync();
    }
    Array.prototype.slice.call(document.querySelectorAll('[data-dashboard-permissions="1"]')).forEach(syncPermissionGroup);
})();
</script>
</body>
</html>`;
}

function dashboardHtml(account = null, notice = "") {
const permissionSnapshot = getDashboardPermissionSnapshot(account || {});
const permissionJson = JSON.stringify(permissionSnapshot);
const initialMenuUpdate = getMenuUpdateStatus();
const initialMenuUpdateJson = JSON.stringify(initialMenuUpdate).replace(/</g, "\\u003c");
const initialUpdateHiddenClass = initialMenuUpdate.active ? "" : " hidden";
const initialUpdateCountdown = formatMenuUpdateDuration(initialMenuUpdate.remainingSeconds);
const initialUpdateEnd = initialMenuUpdate.endsAtMs ? new Date(initialMenuUpdate.endsAtMs).toLocaleString("de-DE") : "-";
const initialUpdateStarter = initialMenuUpdate.startedBy ? ` · gestartet von ${initialMenuUpdate.startedBy}` : "";
const initialUpdateText = initialMenuUpdate.active
    ? `Zugriff bis ungefähr ${initialUpdateEnd} gesperrt${initialUpdateStarter}.`
    : "Das Lua-Menü ist nicht gesperrt.";
const dashboardNoticeHtml = notice
    ? `<div class="dashboard-notice" role="status">${escapeHtml(notice)}</div>`
    : "";
const broadcastButtonHtml = permissionSnapshot.dm === true ? '<button id="broadcastDmButton" class="logout-button broadcast-button" type="button">NACHRICHT AN ALLE</button>' : "";
const updateButtonHtml = permissionSnapshot.updateScript === true ? '<button id="openUpdateButton" class="logout-button update-button" type="button">UPDATE SCRIPT</button>' : "";
const shutdownButtonHtml = permissionSnapshot.shutdownScript === true ? '<button id="shutdownAllButton" class="logout-button shutdown-button" type="button">ALLE SCRIPTS AUS</button>' : "";
const cancelUpdateButtonHtml = permissionSnapshot.updateScript === true
    ? '<form id="cancelUpdateForm" class="update-cancel-form" method="post" action="/menu-server/update/cancel"><button id="cancelUpdateButton" class="action-button update-cancel" type="submit">UPDATE ABBRECHEN</button></form>'
    : "";
return String.raw`<!doctype html>

<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#03070e">
<title>Nexu</title>
<style>
:root {
    --bg:#03070e;
    --panel:rgba(7,13,23,.86);
    --panel2:rgba(10,18,31,.76);
    --text:#dceef8;
    --muted:#7894a8;
    --cyan:#00c8ff;
    --violet:#6f46ff;
    --green:#2dffa5;
    --red:#ff4d78;
    --border:rgba(74,178,230,.28);
}
* { box-sizing:border-box; }
body,
body *:not(input):not(textarea) {
    -webkit-user-select:none !important;
    user-select:none !important;
    -webkit-touch-callout:none;
}
body *:not(input):not(textarea):not(button):not(a) {
    caret-color:transparent;
    cursor:default;
}
img,svg {
    -webkit-user-drag:none;
    user-drag:none;
}
input,textarea {
    -webkit-user-select:text !important;
    user-select:text !important;
    caret-color:auto;
    cursor:text;
}
button { -webkit-user-select:none !important; user-select:none !important; }
html,body {
    margin:0;
    min-height:100%;
    color:var(--text);
    background:
        radial-gradient(circle at 18% 5%,rgba(0,200,255,.14),transparent 34rem),
        radial-gradient(circle at 88% 20%,rgba(111,70,255,.14),transparent 32rem),
        var(--bg);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;
}
body::before {
    content:"";
    position:fixed;
    inset:0;
    pointer-events:none;
    opacity:.23;
    background-image:
        linear-gradient(rgba(0,200,255,.06) 1px,transparent 1px),
        linear-gradient(90deg,rgba(0,200,255,.06) 1px,transparent 1px);
    background-size:32px 32px;
    mask-image:linear-gradient(to bottom,black,transparent 85%);
}
.scan {
    position:fixed;
    z-index:0;
    left:0;
    right:0;
    top:-2px;
    height:1px;
    pointer-events:none;
    background:linear-gradient(90deg,transparent,rgba(0,200,255,.8),transparent);
    box-shadow:0 0 20px rgba(0,200,255,.75);
    animation:scan 7s linear infinite;
}
@keyframes scan {
    from { transform:translateY(0); opacity:0; }
    8%,92% { opacity:.65; }
    to { transform:translateY(100vh); opacity:0; }
}
.shell {
    position:relative;
    z-index:1;
    width:min(1180px,calc(100% - 32px));
    margin:0 auto;
    padding:26px 0 54px;
}
header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:20px;
    margin-bottom:28px;
}
.brand { display:flex; align-items:center; gap:13px; }
.header-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
.logout-form { margin:0; }
.logout-button { min-height:36px; padding:0 13px; border:1px solid rgba(255,77,120,.38); border-radius:999px; color:#ffafc0; background:rgba(45,7,18,.64); font:inherit; font-size:10px; font-weight:850; letter-spacing:.08em; cursor:pointer; }
.logout-button:hover { border-color:var(--red); }
.logo {
    width:44px;
    height:44px;
    display:grid;
    place-items:center;
    border-radius:50%;
    font-weight:850;
    font-size:19px;
    color:white;
    background:linear-gradient(135deg,var(--cyan),var(--violet));
    box-shadow:0 0 0 1px rgba(255,255,255,.17) inset,0 0 28px rgba(0,200,255,.28);
}
.brand-copy strong { display:block; font-size:20px; letter-spacing:.02em; }
.brand-copy span { color:var(--muted); font-size:12px; letter-spacing:.13em; text-transform:uppercase; }
.live-pill {
    display:flex;
    align-items:center;
    gap:9px;
    min-height:38px;
    padding:0 14px;
    border:1px solid var(--border);
    border-radius:999px;
    background:rgba(7,13,23,.72);
    color:var(--muted);
    font-size:13px;
    backdrop-filter:blur(14px);
}
.dot { width:9px; height:9px; border-radius:50%; background:var(--muted); box-shadow:0 0 14px currentColor; }
.dot.online { background:var(--green); color:var(--green); }
.dot.offline { background:var(--red); color:var(--red); }
.hero,.directory {
    border:1px solid var(--border);
    background:linear-gradient(135deg,rgba(0,200,255,.06),rgba(111,70,255,.045)),var(--panel);
    box-shadow:0 26px 80px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.025) inset;
    backdrop-filter:blur(18px);
}
.hero { padding:29px; border-radius:28px; }
.directory { margin-top:22px; padding:24px; border-radius:25px; }
.directory-tabs { display:flex; gap:9px; flex-wrap:wrap; margin-bottom:18px; padding:7px; border:1px solid rgba(74,178,230,.16); border-radius:16px; background:rgba(3,8,15,.52); }
.directory-tab { min-height:40px; display:inline-flex; align-items:center; gap:9px; border:1px solid rgba(74,178,230,.2); border-radius:12px; padding:0 14px; color:#8fa9ba; background:rgba(8,15,26,.72); font:inherit; font-size:11px; font-weight:850; letter-spacing:.09em; text-transform:uppercase; cursor:pointer; }
.directory-tab b { min-width:24px; border-radius:999px; padding:3px 7px; color:#b9d4e4; background:rgba(255,255,255,.06); text-align:center; }
.directory-tab.active { color:#e9f8ff; border-color:rgba(0,200,255,.55); background:linear-gradient(135deg,rgba(0,200,255,.16),rgba(111,70,255,.12)); box-shadow:0 0 20px rgba(0,200,255,.08) inset; }
.directory-tab[data-directory-tab="online"].active b { color:#91ffd2; }
.directory-tab[data-directory-tab="banned"].active { border-color:rgba(255,77,120,.48); background:rgba(50,8,20,.55); }
.directory-tab[data-directory-tab="banned"].active b { color:#ff9bb1; }
.directory-panel.hidden { display:none; }
.offline-directory { border-color:rgba(125,150,170,.24); background:linear-gradient(135deg,rgba(125,150,170,.045),rgba(111,70,255,.025)),var(--panel); }
.offline-directory .eyebrow { color:#8da8ba; }
.eyebrow { color:var(--cyan); font-size:11px; letter-spacing:.19em; text-transform:uppercase; }
h1 { margin:8px 0; max-width:760px; font-size:clamp(30px,5vw,52px); line-height:1.03; letter-spacing:-.04em; }
.hero p { margin:0; max-width:760px; color:var(--muted); line-height:1.65; }
.stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:24px; }
.stat { min-height:122px; padding:18px; border:1px solid rgba(74,178,230,.19); border-radius:19px; background:var(--panel2); }
.stat-label { color:var(--muted); font-size:11px; letter-spacing:.12em; text-transform:uppercase; }
.stat-value { margin-top:11px; font-size:27px; font-weight:780; }
.stat-note { margin-top:8px; color:#66849a; font-size:12px; }
.stat-split { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:11px; }
.stat-mini { padding:10px 11px; border:1px solid rgba(74,178,230,.16); border-radius:13px; background:rgba(3,8,15,.36); }
.stat-mini-label { color:#7895a9; font-size:10px; letter-spacing:.11em; text-transform:uppercase; }
.stat-mini-value { margin-top:5px; font-size:25px; font-weight:820; line-height:1; }
.stat-mini-value.online { color:var(--green); }
.stat-mini-value.offline { color:#8fa9ba; }
.directory-head { display:flex; align-items:end; justify-content:space-between; gap:18px; margin-bottom:18px; }
.directory h2 { margin:4px 0 0; font-size:21px; }
.search {
    width:min(380px,100%);
    height:44px;
    border:1px solid rgba(74,178,230,.25);
    border-radius:13px;
    outline:none;
    padding:0 15px;
    color:var(--text);
    background:rgba(3,8,15,.8);
    font:inherit;
}
.search:focus { border-color:rgba(0,200,255,.68); box-shadow:0 0 0 3px rgba(0,200,255,.08); }
.players { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.player {
    display:flex;
    align-items:flex-start;
    gap:14px;
    min-width:0;
    padding:13px;
    border:1px solid rgba(74,178,230,.16);
    border-radius:17px;
    background:rgba(8,15,26,.76);
    transition:transform .16s ease,border-color .16s ease;
}
.player:hover { transform:translateY(-2px); border-color:rgba(0,200,255,.37); }
.player.banned { border-color:rgba(255,77,120,.3); background:rgba(30,8,15,.66); }
.player.offline { border-color:rgba(125,150,170,.16); background:rgba(7,12,20,.66); opacity:.76; }
.avatar { width:58px; height:58px; flex:0 0 58px; object-fit:cover; border-radius:14px; background:#0b1422; border:1px solid rgba(0,200,255,.26); }
.identity { min-width:0; flex:1; }
.display-name { overflow:hidden; font-weight:760; text-overflow:ellipsis; white-space:nowrap; }
.username { overflow:hidden; margin-top:3px; color:var(--muted); font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.reason { margin-top:5px; color:#ff9bb1; font-size:11px; line-height:1.4; }
.presence-details { margin-top:9px; display:grid; gap:4px; }
.presence-line { display:grid; grid-template-columns:82px minmax(0,1fr); gap:7px; align-items:start; font-size:10px; line-height:1.35; }
.presence-key { color:#5f7e95; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.06em; }
.presence-value { min-width:0; color:#b8d0df; overflow-wrap:anywhere; word-break:break-word; }
.presence-value.server-id { color:#78b8d8; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:9px; word-break:break-all; }
.player-actions { flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.player-state { color:var(--green); font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
.player-state.offline { color:#7d96aa; }
.player-state.banned { color:var(--red); }
.role-badge { display:inline-flex; align-items:center; justify-content:center; margin-top:7px; width:max-content; max-width:100%; border:1px solid rgba(66,255,145,.42); border-radius:999px; padding:4px 9px; font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#42ff91; background:rgba(7,38,24,.72); box-shadow:0 0 14px rgba(66,255,145,.12); }
.role-badge.creator { border-color:rgba(255,194,45,.72); color:#fff6ae; background:linear-gradient(115deg,rgba(47,27,3,.9),rgba(255,194,45,.18),rgba(47,27,3,.9)); box-shadow:0 0 20px rgba(255,194,45,.28); }
.role-badge.supporter { border-color:rgba(245,250,255,.78); color:#ffffff; background:linear-gradient(115deg,rgba(23,28,38,.92),rgba(245,250,255,.24),rgba(23,28,38,.92)); box-shadow:0 0 22px rgba(245,250,255,.25); }
.role-controls { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px; }
.role-button { min-height:24px; border:1px solid rgba(74,178,230,.25); border-radius:999px; padding:0 9px; color:#b8d0df; background:rgba(5,12,22,.78); font:inherit; font-size:9px; font-weight:850; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; transition:transform .16s ease,border-color .16s ease,color .16s ease,background .16s ease; }
.role-button:hover { transform:translateY(-1px); border-color:rgba(0,200,255,.55); color:#8cecff; }
.role-button.active { cursor:default; color:#91ffd2; border-color:rgba(45,255,165,.45); background:rgba(4,35,24,.74); transform:none; }
.role-button.supporter.active { color:#ffffff; border-color:rgba(245,250,255,.7); background:rgba(245,250,255,.16); }
.role-button:disabled { opacity:.86; }
.action-button {
    min-height:34px;
    border:1px solid var(--border);
    border-radius:10px;
    padding:0 10px;
    color:var(--text);
    background:rgba(10,18,31,.92);
    font:inherit;
    font-size:11px;
    font-weight:760;
    cursor:pointer;
    transition:transform .16s ease,border-color .16s ease,background .16s ease;
}
.action-button:hover { transform:translateY(-1px); }
.action-button:disabled { cursor:not-allowed; opacity:.55; transform:none; }
.action-button.ban { border-color:rgba(255,77,120,.5); color:#ff9bb1; background:rgba(42,8,18,.78); }
.action-button.ban:hover { border-color:var(--red); }
.action-button.unban { border-color:rgba(45,255,165,.42); color:#91ffd2; background:rgba(4,35,24,.76); }
.action-button.unban:hover { border-color:var(--green); }
.action-button.dm { border-color:rgba(0,200,255,.48); color:#8cecff; background:rgba(3,28,42,.78); }
.action-button.dm:hover { border-color:var(--cyan); }
.action-button.join { border-color:rgba(45,255,165,.44); color:#91ffd2; background:rgba(4,35,24,.76); }
.action-button.join:hover { border-color:var(--green); }
.action-button.bring { border-color:rgba(0,200,255,.48); color:#8cecff; background:rgba(3,28,42,.78); }
.action-button.bring:hover { border-color:var(--cyan); }
.broadcast-button { border-color:rgba(0,200,255,.46) !important; color:#bcefff !important; background:rgba(2,38,55,.62) !important; }
.broadcast-button:hover { border-color:rgba(0,200,255,.8) !important; box-shadow:0 0 24px rgba(0,200,255,.16); }
.update-button { border-color:rgba(255,190,70,.42) !important; color:#ffe5a8 !important; background:rgba(55,35,4,.56) !important; }
.shutdown-button { border-color:rgba(255,77,120,.46) !important; color:#ffc0d0 !important; background:rgba(58,7,23,.62) !important; }
.shutdown-button:hover { border-color:rgba(255,77,120,.78) !important; box-shadow:0 0 24px rgba(255,77,120,.16); }
.update-status { margin-top:22px; padding:20px 22px; border:1px solid rgba(255,190,70,.35); border-radius:22px; background:linear-gradient(135deg,rgba(255,190,70,.09),rgba(0,200,255,.05)),var(--panel); }
.update-status.hidden { display:none; }
.update-status-row { display:flex; align-items:center; justify-content:space-between; gap:18px; }
.update-status h2 { margin:5px 0 5px; font-size:22px; }
.update-status p { margin:0; color:#9ab0bf; }
.update-countdown { color:#ffe29a; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:24px; font-weight:900; letter-spacing:.06em; white-space:nowrap; }
.action-button.update-cancel { border-color:rgba(255,190,70,.5); color:#ffe4a1; background:rgba(55,35,4,.72); }
.update-cancel-form { margin:10px 0 0; position:relative; z-index:4; }
.update-cancel-form .action-button { width:100%; min-width:190px; }
.dashboard-notice { margin:0 0 18px; padding:13px 16px; border:1px solid rgba(45,255,165,.3); border-radius:14px; color:#aaffdc; background:rgba(45,255,165,.1); font-weight:850; }
.modal-card.update-card { border-color:rgba(255,190,70,.42); background:linear-gradient(145deg,rgba(255,190,70,.07),rgba(0,200,255,.04)),rgba(7,13,23,.97); }
.update-duration-grid { display:grid; grid-template-columns:1fr 150px; gap:10px; }
.update-field { display:grid; gap:7px; margin-top:14px; }
.update-field label { color:#a7bed0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; }
.update-field input,.update-field select { width:100%; height:44px; border:1px solid rgba(255,190,70,.28); border-radius:13px; outline:none; padding:0 13px; color:var(--text); background:#07131f; font:inherit; }
.update-presets { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
.update-presets button { min-height:32px; border:1px solid rgba(255,190,70,.24); border-radius:10px; padding:0 10px; color:#d8c69b; background:rgba(40,28,7,.55); font:inherit; font-size:10px; font-weight:850; cursor:pointer; }
.button-row { display:flex; align-items:center; justify-content:flex-end; gap:7px; flex-wrap:wrap; }
.empty { grid-column:1/-1; padding:40px 20px; border:1px dashed rgba(74,178,230,.22); border-radius:17px; color:var(--muted); text-align:center; }
.footer-note { margin-top:14px; color:#557084; font-size:12px; text-align:right; }
.modal-backdrop {
    position:fixed;
    inset:0;
    z-index:1000;
    display:grid;
    place-items:center;
    padding:18px;
    background:rgba(0,3,8,.72);
    backdrop-filter:blur(10px);
    opacity:1;
    transition:opacity .2s ease;
}
.modal-backdrop.hidden { opacity:0; pointer-events:none; }
.modal-card {
    width:min(430px,100%);
    padding:22px;
    border:1px solid rgba(255,77,120,.42);
    border-radius:20px;
    background:linear-gradient(145deg,rgba(255,77,120,.07),rgba(111,70,255,.04)),rgba(7,13,23,.97);
    box-shadow:0 28px 90px rgba(0,0,0,.55),0 0 30px rgba(255,77,120,.08);
    transform:translateY(0) scale(1);
    transition:transform .2s ease;
}
.modal-backdrop.hidden .modal-card { transform:translateY(12px) scale(.98); }
.modal-card h3 { margin:7px 0 5px; font-size:22px; }
.modal-user { margin:0 0 15px; color:var(--muted); font-size:13px; }
.reason-input {
    width:100%;
    min-height:105px;
    resize:vertical;
    border:1px solid rgba(255,77,120,.35);
    border-radius:13px;
    outline:none;
    padding:12px 13px;
    color:var(--text);
    background:rgba(3,8,15,.86);
    font:inherit;
}
.reason-input:focus { border-color:var(--red); box-shadow:0 0 0 3px rgba(255,77,120,.08); }
.modal-card.dm-card { border-color:rgba(0,200,255,.42); background:linear-gradient(145deg,rgba(0,200,255,.075),rgba(111,70,255,.05)),rgba(7,13,23,.97); box-shadow:0 28px 90px rgba(0,0,0,.55),0 0 34px rgba(0,200,255,.10); }
.message-input { width:100%; min-height:120px; resize:vertical; border:1px solid rgba(0,200,255,.35); border-radius:13px; outline:none; padding:12px 13px; color:var(--text); background:rgba(3,8,15,.86); font:inherit; }
.message-input:focus { border-color:var(--cyan); box-shadow:0 0 0 3px rgba(0,200,255,.09); }
.modal-notice.ok { color:#91ffd2; }
.modal-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:13px; }
.modal-actions .action-button { min-height:42px; padding:0 14px; font-size:12px; }
.modal-notice { min-height:18px; margin-top:10px; color:#ff9bb1; font-size:12px; }
@media (max-width:760px) {
    .shell { width:min(100% - 20px,1180px); padding-top:16px; }
    header { align-items:flex-start; }
    .brand-copy span { display:none; }
    .hero { padding:22px; border-radius:22px; }
    .stats,.players { grid-template-columns:1fr; }
    .directory { padding:18px; }
    .directory-head { align-items:stretch; flex-direction:column; }
    .search { width:100%; }
    .update-status-row { align-items:flex-start; flex-direction:column; }
    .update-duration-grid { grid-template-columns:1fr; }
}
</style>
</head>
<body>
<div class="scan"></div>
<main class="shell">
<header>
    <div class="brand">
        <div class="logo">N</div>
        <div class="brand-copy"><strong>Nexu</strong><span>Presence Network</span></div>
    </div>
    <div class="header-actions">
        <a class="logout-button" href="/" style="display:inline-flex;align-items:center;text-decoration:none;border-color:rgba(74,178,230,.32);color:var(--text);background:rgba(7,13,23,.72);">Startseite</a>
        ${broadcastButtonHtml}
        ${updateButtonHtml}
        ${shutdownButtonHtml}
        <div class="live-pill"><span id="headerDot" class="dot"></span><span id="headerStatus">Verbindung wird geprüft</span></div>
        <form class="logout-form" method="post" action="/logout"><button class="logout-button" type="submit">Abmelden</button></form>
    </div>
</header>
${dashboardNoticeHtml}

<section class="hero">
    <div class="eyebrow">NEXU // LIVE SYSTEM</div>
    <h1>Aktive Nutzer auf einen Blick.</h1>
    <p>Das Dashboard speichert jeden Spieler nach dem ersten Nexu-Start und zeigt ihn danach weiter an. Aktive Spieler stehen oben im Online-Feld. Deaktivierte oder abgelaufene Sitzungen werden automatisch in das Offline-Feld darunter verschoben.</p>
    <div class="stats">
        <article class="stat"><div class="stat-label">Serverstatus</div><div id="serverStatus" class="stat-value">Prüfe …</div><div class="stat-note">Render-Web-Service</div></article>
        <article class="stat"><div class="stat-label">Gespeicherte Spieler</div><div id="playerCount" class="stat-value">0</div><div class="stat-note">Alle Spieler, die Nexu einmal gestartet haben</div></article>
        <article class="stat"><div class="stat-label">Spieler Online / Offline</div><div class="stat-split"><div class="stat-mini"><div class="stat-mini-label">Online</div><div id="onlinePlayerCount" class="stat-mini-value online">0</div></div><div class="stat-mini"><div class="stat-mini-label">Offline</div><div id="offlinePlayerCount" class="stat-mini-value offline">0</div></div></div><div class="stat-note">Wird automatisch verschoben</div></article>
        <article class="stat"><div class="stat-label">Gesperrte Spieler</div><div id="bannedCount" class="stat-value">0</div><div class="stat-note">Bleiben bis zum Entbannen gespeichert</div></article>
    </div>
</section>

<section id="updateStatusPanel" class="update-status${initialUpdateHiddenClass}" aria-live="polite">
    <div class="update-status-row">
        <div><div class="eyebrow">NEXU // SCRIPT UPDATE</div><h2>Wartungsmodus ist aktiv</h2><p id="updateStatusText">${escapeHtml(initialUpdateText)}</p></div>
        <div><div id="updateCountdown" class="update-countdown">${escapeHtml(initialUpdateCountdown)}</div>${cancelUpdateButtonHtml}</div>
    </div>
</section>

<section class="directory">
    <div class="directory-tabs" role="tablist" aria-label="Spielerlisten">
        <button class="directory-tab active" type="button" data-directory-tab="online" role="tab" aria-selected="true">Online <b id="onlineTabCount">0</b></button>
        <button class="directory-tab" type="button" data-directory-tab="offline" role="tab" aria-selected="false">Offline <b id="offlineTabCount">0</b></button>
        <button class="directory-tab" type="button" data-directory-tab="banned" role="tab" aria-selected="false">Gebannt <b id="bannedTabCount">0</b></button>
    </div>
    <div class="directory-panel" data-directory-panel="online" role="tabpanel">
        <div class="directory-head"><div><div class="eyebrow">MENU SPIELER</div><h2>Online Spieler</h2></div><input id="search" class="search" type="search" autocomplete="off" placeholder="Online-Spieler suchen …" aria-label="Online-Spieler suchen"></div>
        <div id="players" class="players"></div><div id="footerNote" class="footer-note"></div>
    </div>
    <div class="directory-panel hidden" data-directory-panel="offline" role="tabpanel">
        <div class="directory-head"><div><div class="eyebrow">OFFLINE ARCHIV</div><h2>Offline Spieler</h2></div><input id="offlineSearch" class="search" type="search" autocomplete="off" placeholder="Offline-Spieler suchen …" aria-label="Offline-Spieler suchen"></div>
        <div id="offlinePlayers" class="players"></div><div id="offlineFooter" class="footer-note"></div>
    </div>
    <div class="directory-panel hidden" data-directory-panel="banned" role="tabpanel">
        <div class="directory-head"><div><div class="eyebrow">MENÜ-SPERRLISTE</div><h2>Gebannte Nutzer</h2></div><input id="bannedSearch" class="search" type="search" autocomplete="off" placeholder="Gebannte Spieler suchen …" aria-label="Gebannte Spieler suchen"></div>
        <div id="bannedPlayers" class="players"></div><div id="bannedFooter" class="footer-note"></div>
    </div>
</section>
</main>

<div id="updateModal" class="modal-backdrop hidden" aria-hidden="true">
    <div class="modal-card update-card" role="dialog" aria-modal="true" aria-labelledby="updateModalTitle">
        <div class="eyebrow">NEXU // SCRIPT UPDATE</div>
        <h3 id="updateModalTitle">Wartungsmodus starten</h3>
        <p class="modal-user">Während dieser Zeit sehen alle Lua-Nutzer einen übersetzten Update-Bildschirm mit Countdown.</p>
        <div class="update-duration-grid">
            <div class="update-field"><label for="updateDuration">Dauer</label><input id="updateDuration" type="number" min="1" max="1440" step="1" value="30" inputmode="numeric"></div>
            <div class="update-field"><label for="updateUnit">Einheit</label><select id="updateUnit"><option value="minutes">Minuten</option><option value="hours">Stunden</option></select></div>
        </div>
        <div class="update-presets"><button type="button" data-update-minutes="5">5 MIN</button><button type="button" data-update-minutes="15">15 MIN</button><button type="button" data-update-minutes="30">30 MIN</button><button type="button" data-update-minutes="60">1 STD</button><button type="button" data-update-minutes="120">2 STD</button></div>
        <div class="modal-actions"><button id="closeUpdateButton" class="action-button" type="button">ABBRECHEN</button><button id="startUpdateButton" class="action-button update-cancel" type="button">UPDATE STARTEN</button></div>
        <div id="updateModalNotice" class="modal-notice"></div>
    </div>
</div>

<div id="banModal" class="modal-backdrop hidden" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="banModalTitle">
        <div class="eyebrow">MENÜ-SPERRE</div>
        <h3 id="banModalTitle">Spieler bannen</h3>
        <p id="banModalUser" class="modal-user"></p>
        <textarea id="banReasonInput" class="reason-input" maxlength="240" placeholder="Grund für den Ban eingeben …"></textarea>
        <div class="modal-actions">
            <button id="cancelBanButton" class="action-button">ABBRECHEN</button>
            <button id="confirmBanButton" class="action-button ban">BAN BESTÄTIGEN</button>
        </div>
        <div id="banModalNotice" class="modal-notice"></div>
    </div>
</div>

<div id="broadcastModal" class="modal-backdrop hidden" aria-hidden="true">
    <div class="modal-card dm-card" role="dialog" aria-modal="true" aria-labelledby="broadcastModalTitle">
        <div class="eyebrow">NEXU // RUNDSENDUNG</div>
        <h3 id="broadcastModalTitle">Nachricht an alle aktiven Spieler</h3>
        <p id="broadcastModalUser" class="modal-user">Die Nachricht wird an alle Spieler mit einer aktuell aktiven Nexu-Sitzung gesendet.</p>
        <textarea id="broadcastMessageInput" class="message-input" maxlength="240" placeholder="Nachricht an alle aktiven Spieler eingeben …"></textarea>
        <div class="modal-actions">
            <button id="cancelBroadcastButton" class="action-button">ABBRECHEN</button>
            <button id="confirmBroadcastButton" class="action-button dm">AN ALLE SENDEN</button>
        </div>
        <div id="broadcastModalNotice" class="modal-notice"></div>
    </div>
</div>

<div id="dmModal" class="modal-backdrop hidden" aria-hidden="true">
    <div class="modal-card dm-card" role="dialog" aria-modal="true" aria-labelledby="dmModalTitle">
        <div class="eyebrow">NEXU // DIREKTNACHRICHT</div>
        <h3 id="dmModalTitle">Nachricht senden</h3>
        <p id="dmModalUser" class="modal-user"></p>
        <textarea id="dmMessageInput" class="message-input" maxlength="240" placeholder="Nachricht an den Spieler eingeben …"></textarea>
        <div class="modal-actions">
            <button id="cancelDmButton" class="action-button">ABBRECHEN</button>
            <button id="confirmDmButton" class="action-button dm">DM SENDEN</button>
        </div>
        <div id="dmModalNotice" class="modal-notice"></div>
    </div>
</div>

<script>
const DASHBOARD_PERMISSIONS = ${permissionJson};
const state = {
    online:false,
    players:[],
    activePlayers:0,
    bannedPlayers:[],
    query:"",
    offlineQuery:"",
    bannedQuery:"",
    activeDirectory:"online",
    menuUpdate:${initialMenuUpdateJson},
    updateSyncedAt:Date.now(),
    pendingBan:null,
    pendingDm:null,
    broadcastTargetCount:0,
    permissions:DASHBOARD_PERMISSIONS || {},
    refreshFailures:0,
    lastSuccessfulRefreshAt:0,
    stale:false,
};
let presenceRefreshInFlight = false;

const allowTextEditingTargets = "input, textarea";
document.documentElement.setAttribute("spellcheck", "false");
document.body.setAttribute("contenteditable", "false");
document.addEventListener("beforeinput", function (event) {
    const target = event.target;
    if (!target || !target.matches || !target.matches(allowTextEditingTargets)) {
        event.preventDefault();
    }
}, { capture:true });

function isAllowedTextTarget(target) {
    return !!(target && target.closest && target.closest(allowTextEditingTargets));
}

document.addEventListener("selectstart", function (event) {
    if (!isAllowedTextTarget(event.target)) {
        event.preventDefault();
    }
}, { capture:true });

document.addEventListener("dragstart", function (event) {
    if (!isAllowedTextTarget(event.target)) {
        event.preventDefault();
    }
}, { capture:true });

document.addEventListener("copy", function (event) {
    if (!isAllowedTextTarget(event.target)) {
        event.preventDefault();
    }
}, { capture:true });

document.addEventListener("cut", function (event) {
    if (!isAllowedTextTarget(event.target)) {
        event.preventDefault();
    }
}, { capture:true });

document.addEventListener("contextmenu", function (event) {
    if (!isAllowedTextTarget(event.target)) {
        event.preventDefault();
    }
}, { capture:true });

const elements = {
    headerDot:document.getElementById("headerDot"),
    headerStatus:document.getElementById("headerStatus"),
    serverStatus:document.getElementById("serverStatus"),
    playerCount:document.getElementById("playerCount"),
    onlinePlayerCount:document.getElementById("onlinePlayerCount"),
    offlinePlayerCount:document.getElementById("offlinePlayerCount"),
    bannedCount:document.getElementById("bannedCount"),
    search:document.getElementById("search"),
    offlineSearch:document.getElementById("offlineSearch"),
    bannedSearch:document.getElementById("bannedSearch"),
    directoryTabs:Array.from(document.querySelectorAll("[data-directory-tab]")),
    directoryPanels:Array.from(document.querySelectorAll("[data-directory-panel]")),
    onlineTabCount:document.getElementById("onlineTabCount"),
    offlineTabCount:document.getElementById("offlineTabCount"),
    bannedTabCount:document.getElementById("bannedTabCount"),
    players:document.getElementById("players"),
    footerNote:document.getElementById("footerNote"),
    offlinePlayers:document.getElementById("offlinePlayers"),
    offlineFooter:document.getElementById("offlineFooter"),
    bannedPlayers:document.getElementById("bannedPlayers"),
    bannedFooter:document.getElementById("bannedFooter"),
    banModal:document.getElementById("banModal"),
    banModalUser:document.getElementById("banModalUser"),
    banReasonInput:document.getElementById("banReasonInput"),
    cancelBanButton:document.getElementById("cancelBanButton"),
    confirmBanButton:document.getElementById("confirmBanButton"),
    banModalNotice:document.getElementById("banModalNotice"),
    dmModal:document.getElementById("dmModal"),
    dmModalUser:document.getElementById("dmModalUser"),
    dmMessageInput:document.getElementById("dmMessageInput"),
    cancelDmButton:document.getElementById("cancelDmButton"),
    confirmDmButton:document.getElementById("confirmDmButton"),
    dmModalNotice:document.getElementById("dmModalNotice"),
    broadcastDmButton:document.getElementById("broadcastDmButton"),
    broadcastModal:document.getElementById("broadcastModal"),
    broadcastModalUser:document.getElementById("broadcastModalUser"),
    broadcastMessageInput:document.getElementById("broadcastMessageInput"),
    cancelBroadcastButton:document.getElementById("cancelBroadcastButton"),
    confirmBroadcastButton:document.getElementById("confirmBroadcastButton"),
    broadcastModalNotice:document.getElementById("broadcastModalNotice"),
    openUpdateButton:document.getElementById("openUpdateButton"),
    shutdownAllButton:document.getElementById("shutdownAllButton"),
    updateStatusPanel:document.getElementById("updateStatusPanel"),
    updateStatusText:document.getElementById("updateStatusText"),
    updateCountdown:document.getElementById("updateCountdown"),
    cancelUpdateButton:document.getElementById("cancelUpdateButton"),
    updateModal:document.getElementById("updateModal"),
    updateDuration:document.getElementById("updateDuration"),
    updateUnit:document.getElementById("updateUnit"),
    closeUpdateButton:document.getElementById("closeUpdateButton"),
    startUpdateButton:document.getElementById("startUpdateButton"),
    updateModalNotice:document.getElementById("updateModalNotice"),
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function formatDashboardDate(value) {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }
    return date.toLocaleString("de-DE", {
        day:"2-digit",
        month:"2-digit",
        year:"2-digit",
        hour:"2-digit",
        minute:"2-digit",
    });
}

function setDirectoryTab(name) {
    state.activeDirectory = ["online","offline","banned"].includes(name) ? name : "online";
    elements.directoryTabs.forEach(function (button) {
        const selected = button.dataset.directoryTab === state.activeDirectory;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    elements.directoryPanels.forEach(function (panel) {
        panel.classList.toggle("hidden", panel.dataset.directoryPanel !== state.activeDirectory);
    });
}

function formatUpdateDuration(totalSeconds) {
    const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    const pad = function (value) { return String(value).padStart(2,"0"); };
    return hours > 0 ? (pad(hours) + ":" + pad(minutes) + ":" + pad(seconds)) : (pad(minutes) + ":" + pad(seconds));
}

function getDisplayedUpdateSeconds() {
    if (!state.menuUpdate || state.menuUpdate.active !== true) return 0;
    const elapsed = Math.max(0, Math.floor((Date.now() - state.updateSyncedAt) / 1000));
    return Math.max(0, (Number(state.menuUpdate.remainingSeconds) || 0) - elapsed);
}

function renderUpdateStatus() {
    const active = state.menuUpdate && state.menuUpdate.active === true;
    elements.updateStatusPanel.classList.toggle("hidden", !active);
    if (!active) return;
    const remaining = getDisplayedUpdateSeconds();
    elements.updateCountdown.textContent = formatUpdateDuration(remaining);
    const endDate = state.menuUpdate.endsAt ? formatDashboardDate(state.menuUpdate.endsAt) : "-";
    const starter = state.menuUpdate.startedBy ? (" · gestartet von " + state.menuUpdate.startedBy) : "";
    elements.updateStatusText.textContent = "Zugriff bis ungefähr " + endDate + " gesperrt" + starter + ".";
}

async function updateScriptAction(action, durationMinutes) {
    const response = await fetch("/api/admin/update/" + action, {
        method:"POST",
        headers:{Accept:"application/json","Content-Type":"application/json"},
        body:JSON.stringify(action === "start" ? {durationMinutes:durationMinutes} : {}),
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) throw new Error(data.error || ("HTTP " + response.status));
    state.menuUpdate = data.menuUpdate || {active:false,remainingSeconds:0};
    state.updateSyncedAt = Date.now();
    renderUpdateStatus();
    return data;
}



async function shutdownAllActiveScripts() {
    const response = await fetch("/api/admin/shutdown/all", {
        method:"POST",
        headers:{Accept:"application/json","Content-Type":"application/json"},
        body:"{}",
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }
    return data;
}

function openUpdateModal() {
    if (!elements.updateModal) return;
    elements.updateModalNotice.textContent = "";
    elements.updateModal.classList.remove("hidden");
    elements.updateModal.setAttribute("aria-hidden","false");
    setTimeout(function () { elements.updateDuration.focus(); elements.updateDuration.select(); },30);
}

function closeUpdateModal() {
    if (!elements.updateModal) return;
    elements.updateModal.classList.add("hidden");
    elements.updateModal.setAttribute("aria-hidden","true");
    elements.updateModalNotice.textContent = "";
}

function renderPlayer(player,banned) {
    const online = !banned && player.online === true;
    const name = player.displayName || player.username || player.userId;
    const username = player.username || ("User" + player.userId);
    const gameName = player.gameName || (player.placeId ? ("Place " + player.placeId) : "Unbekannt");
    const placeId = String(player.placeId || "-");
    const jobId = String(player.jobId || "-");
    const executionSource = String(player.executionSource || (player.online ? "WIRD GEMELDET…" : "NICHT GEMELDET"));
    const executionVersion = String(player.executionVersion || "");
    const clientPlatform = String(player.clientPlatform || (player.online ? "WIRD GEMELDET…" : "NICHT GEMELDET"));
    const scriptBuild = String(player.scriptBuild || (player.online ? "WIRD GEMELDET…" : "CLIENT VOR V138"));
    const executionDisplay = executionVersion ? (executionSource + " " + executionVersion) : executionSource;
    const lastSeenText = formatDashboardDate(player.lastSeen);
    const joinable = online && /^\d+$/.test(placeId) && placeId !== "0" && jobId !== "-" && !jobId.startsWith("LOCAL-");
    const bringable = online && String(player.userId || "") !== "${MENU_CREATOR_USER_ID}";
    const roleKey = String(player.roleKey || "player").replace(/[^a-z0-9_-]/gi,"").toLowerCase() || "player";
    const roleTitle = player.roleTitle || "PLAYERS";
    const stateClass = banned ? "banned" : (online ? "online" : "offline");
    const stateText = banned ? "Gesperrt" : (online ? "Online" : "Offline");
    const roleBadge = '<div class="role-badge ' + escapeHtml(roleKey) + '">' + escapeHtml(roleTitle) + '</div>';
    const roleControls = (!banned && roleKey !== "creator" && state.permissions.managePlayerRoles === true)
        ? '<div class="role-controls" aria-label="Rang einstellen">' +
            '<button class="role-button player ' + (roleKey === "player" ? "active" : "") + '" data-action="set-role" data-role="player" data-user-id="' + escapeHtml(player.userId) + '" ' + (roleKey === "player" ? "disabled" : "") + '>PLAYERS</button>' +
            '<button class="role-button supporter ' + (roleKey === "supporter" ? "active" : "") + '" data-action="set-role" data-role="supporter" data-user-id="' + escapeHtml(player.userId) + '" ' + (roleKey === "supporter" ? "disabled" : "") + '>SUPPORTER</button>' +
        '</div>'
        : "";
    const reason = banned && player.reason
        ? '<div class="reason">Grund: ' + escapeHtml(player.reason) + '</div>'
        : "";
    const locationDetails = banned
        ? ""
        : '<div class="presence-details">' +
            '<div class="presence-line"><span class="presence-key">SPIEL</span><span class="presence-value">' + escapeHtml(gameName) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">PLACE</span><span class="presence-value">' + escapeHtml(placeId) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">SERVER</span><span class="presence-value server-id" title="' + escapeHtml(jobId) + '">' + escapeHtml(jobId) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">AUSFÜHRUNG</span><span class="presence-value" title="' + escapeHtml(executionDisplay) + '">' + escapeHtml(executionDisplay) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">PLATTFORM</span><span class="presence-value">' + escapeHtml(clientPlatform) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">BUILD</span><span class="presence-value server-id" title="' + escapeHtml(scriptBuild) + '">' + escapeHtml(scriptBuild) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">ZULETZT</span><span class="presence-value">' + escapeHtml(lastSeenText) + '</span></div>' +
        '</div>';
    const joinButton = joinable && state.permissions.serverJoin === true
        ? '<button class="action-button join" data-action="join" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">SERVER JOIN</button>'
        : "";
    const bringButton = bringable && state.permissions.bring === true
        ? '<button class="action-button bring" data-action="bring" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">BRING</button>'
        : "";
    const dmButton = online && state.permissions.dm === true
        ? '<button class="action-button dm" data-action="dm" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">DM</button>'
        : "";
    const actionButtons = banned
        ? (state.permissions.banPlayers === true ? '<button class="action-button unban" data-action="unban" data-user-id="' + escapeHtml(player.userId) + '">ENTBANNEN</button>' : '')
        : '<div class="button-row">' +
            joinButton +
            bringButton +
            dmButton +
            (state.permissions.banPlayers === true ? '<button class="action-button ban" data-action="ban" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">BANNEN</button>' : '') +
        '</div>';

    return '<article class="player ' + (banned ? 'banned' : (online ? 'online' : 'offline')) + '">' +
        '<img class="avatar" src="' + escapeHtml(player.avatarUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' +
        '<div class="identity">' +
            '<div class="display-name">' + escapeHtml(name) + '</div>' +
            '<div class="username">@' + escapeHtml(username) + ' · ' + escapeHtml(player.userId) + '</div>' +
            roleBadge +
            roleControls +
            locationDetails +
            reason +
        '</div>' +
        '<div class="player-actions">' +
            '<div class="player-state ' + stateClass + '">' + stateText + '</div>' +
            actionButtons +
        '</div>' +
    '</article>';
}

function render() {
    elements.headerDot.className = "dot " + (state.online ? "online" : "offline");
    elements.headerStatus.textContent = state.online
        ? "Server online"
        : (state.stale ? "Verbindung unterbrochen – letzte Daten bleiben sichtbar" : "Server nicht erreichbar");
    elements.serverStatus.textContent = state.online ? "ONLINE" : (state.stale ? "WIEDERVERBINDUNG" : "OFFLINE");
    elements.serverStatus.style.color = state.online ? "var(--green)" : "var(--red)";
    const totalOnlineCount = state.players.filter(function (player) { return player.online === true; }).length;
    const totalOfflineCount = state.players.length - totalOnlineCount;
    elements.playerCount.textContent = String(state.players.length);
    elements.onlinePlayerCount.textContent = String(totalOnlineCount);
    elements.offlinePlayerCount.textContent = String(totalOfflineCount);
    elements.bannedCount.textContent = String(state.bannedPlayers.length);

    const onlineQuery = state.query.trim().toLocaleLowerCase();
    const offlineQuery = state.offlineQuery.trim().toLocaleLowerCase();
    const bannedQuery = state.bannedQuery.trim().toLocaleLowerCase();
    function matchesPlayerSearch(player, query) {
        return !query ||
            String(player.displayName || "").toLocaleLowerCase().includes(query) ||
            String(player.username || "").toLocaleLowerCase().includes(query) ||
            String(player.roleTitle || "").toLocaleLowerCase().includes(query) ||
            String(player.roleKey || "").toLocaleLowerCase().includes(query) ||
            String(player.executionSource || "").toLocaleLowerCase().includes(query) ||
            String(player.clientPlatform || "").toLocaleLowerCase().includes(query) ||
            String(player.scriptBuild || "").toLocaleLowerCase().includes(query) ||
            String(player.userId || "").includes(query);
    }

    const onlinePlayers = state.players
        .filter(function (player) { return player.online === true; })
        .filter(function (player) { return matchesPlayerSearch(player, onlineQuery); });
    const offlinePlayers = state.players
        .filter(function (player) { return player.online !== true; })
        .filter(function (player) { return matchesPlayerSearch(player, offlineQuery); });
    const bannedPlayers = state.bannedPlayers.filter(function (player) { return matchesPlayerSearch(player, bannedQuery); });

    elements.onlineTabCount.textContent = String(totalOnlineCount);
    elements.offlineTabCount.textContent = String(totalOfflineCount);
    elements.bannedTabCount.textContent = String(state.bannedPlayers.length);
    setDirectoryTab(state.activeDirectory);
    renderUpdateStatus();

    elements.players.innerHTML = onlinePlayers.length
        ? onlinePlayers.map(function (player) { return renderPlayer(player,false); }).join("")
        : '<div class="empty">' + (state.players.length === 0
            ? 'Noch kein Spieler hat das Nexu-Menü ausgeführt.'
            : (onlineQuery ? 'Kein Online-Spieler passt zu deiner Suche.' : 'Aktuell ist kein Spieler online.')) + '</div>';

    elements.offlinePlayers.innerHTML = offlinePlayers.length
        ? offlinePlayers.map(function (player) { return renderPlayer(player,false); }).join("")
        : '<div class="empty">' + (state.players.length === 0
            ? 'Offline-Liste ist noch leer.'
            : (offlineQuery ? 'Kein Offline-Spieler passt zu deiner Suche.' : 'Keine gespeicherten Offline-Spieler.')) + '</div>';

    elements.bannedPlayers.innerHTML = state.permissions.banPlayers === true
        ? (bannedPlayers.length
            ? bannedPlayers.map(function (player) { return renderPlayer(player,true); }).join("")
            : '<div class="empty">' + (bannedQuery ? 'Kein gebannter Spieler passt zu deiner Suche.' : 'Die Sperrliste ist leer.') + '</div>')
        : '<div class="empty">Für diesen Account ist Bannen/Entbannen nicht freigegeben.</div>';

    const staleSuffix = state.stale
        ? " // Letzte erfolgreiche Aktualisierung wird weiter angezeigt"
        : "";
    elements.footerNote.textContent = onlinePlayers.length + " von " + totalOnlineCount + " Online-Spielern angezeigt" + staleSuffix;
    elements.offlineFooter.textContent = offlinePlayers.length + " von " + totalOfflineCount + " Offline-Spielern angezeigt" + staleSuffix;
    elements.bannedFooter.textContent = bannedPlayers.length + " von " + state.bannedPlayers.length + " gesperrten Nutzern angezeigt" + staleSuffix;
}

async function refresh() {
    if (presenceRefreshInFlight) {
        return;
    }
    presenceRefreshInFlight = true;
    const controller = new AbortController();
    const requestTimeout = setTimeout(function () { controller.abort(); }, 15000);

    try {
        const response = await fetch("/api/presence", {
            headers:{ Accept:"application/json" },
            cache:"no-store",
            signal:controller.signal,
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();
        const incomingPlayers = Array.isArray(data.players) ? data.players : [];
        const previousByUserId = new Map(state.players.map(function (player) {
            return [String(player.userId || ""), player];
        }));
        const preservePreviousOnline = data.presenceWarmup === true && state.lastSuccessfulRefreshAt > 0;
        state.players = incomingPlayers.map(function (player) {
            const previous = previousByUserId.get(String(player.userId || ""));
            if (preservePreviousOnline && previous && previous.online === true && player.online !== true) {
                return Object.assign({}, player, { online:true, reconnecting:true });
            }
            return player;
        });
        state.online = data.online === true;
        state.activePlayers = state.players.filter(function (player) { return player.online === true; }).length;
        state.bannedPlayers = Array.isArray(data.bannedPlayers) ? data.bannedPlayers : [];
        state.menuUpdate = data.menuUpdate && typeof data.menuUpdate === "object" ? data.menuUpdate : {active:false,remainingSeconds:0};
        state.updateSyncedAt = Date.now();
        state.lastSuccessfulRefreshAt = Date.now();
        state.refreshFailures = 0;
        state.stale = false;
    } catch (error) {
        console.error("Nexu refresh failed:",error);
        state.online = false;
        state.refreshFailures += 1;
        state.stale = state.players.length > 0 || state.bannedPlayers.length > 0;

        // Bei einem einzelnen fehlgeschlagenen Poll niemals alle Karten leeren.
        // Erst nach 90 Sekunden ohne erfolgreiche Antwort werden bisherige
        // Online-Spieler als offline markiert; gespeicherte Karten bleiben erhalten.
        const staleForMs = state.lastSuccessfulRefreshAt > 0
            ? Date.now() - state.lastSuccessfulRefreshAt
            : Number.POSITIVE_INFINITY;
        if (staleForMs > 90000) {
            state.players = state.players.map(function (player) {
                return player.online === true
                    ? Object.assign({}, player, { online:false, reconnecting:false })
                    : player;
            });
            state.activePlayers = 0;
        }
    } finally {
        clearTimeout(requestTimeout);
        presenceRefreshInFlight = false;
    }

    render();
}

function openBanModal(userId,displayName,username) {
    state.pendingBan = {
        userId:String(userId || ""),
        displayName:String(displayName || ""),
        username:String(username || ""),
    };

    elements.banModalUser.textContent =
        (state.pendingBan.displayName || state.pendingBan.username || state.pendingBan.userId) +
        (state.pendingBan.username ? " (@" + state.pendingBan.username + ")" : "");

    elements.banReasonInput.value = "";
    elements.banModalNotice.textContent = "";
    elements.banModal.classList.remove("hidden");
    elements.banModal.setAttribute("aria-hidden","false");

    setTimeout(function () {
        elements.banReasonInput.focus();
    },30);
}

function closeBanModal() {
    state.pendingBan = null;
    elements.banModal.classList.add("hidden");
    elements.banModal.setAttribute("aria-hidden","true");
    elements.banModalNotice.textContent = "";
}

function openDmModal(userId,displayName,username) {
    state.pendingDm = {
        userId:String(userId || ""),
        displayName:String(displayName || ""),
        username:String(username || ""),
    };

    elements.dmModalUser.textContent =
        (state.pendingDm.displayName || state.pendingDm.username || state.pendingDm.userId) +
        (state.pendingDm.username ? " (@" + state.pendingDm.username + ")" : "");

    elements.dmMessageInput.value = "";
    elements.dmModalNotice.textContent = "";
    elements.dmModalNotice.className = "modal-notice";
    elements.dmModal.classList.remove("hidden");
    elements.dmModal.setAttribute("aria-hidden","false");

    setTimeout(function () {
        elements.dmMessageInput.focus();
    },30);
}

function closeDmModal() {
    state.pendingDm = null;
    elements.dmModal.classList.add("hidden");
    elements.dmModal.setAttribute("aria-hidden","true");
    elements.dmModalNotice.textContent = "";
    elements.dmModalNotice.className = "modal-notice";
}

function openBroadcastModal() {
    const onlineCount = state.players.filter(function (player) { return player.online === true; }).length;
    state.broadcastTargetCount = onlineCount;
    elements.broadcastModalUser.textContent = onlineCount === 1
        ? "Die Nachricht wird an 1 aktuell aktiven Spieler gesendet."
        : "Die Nachricht wird an " + onlineCount + " aktuell aktive Spieler gesendet.";
    elements.broadcastMessageInput.value = "";
    elements.broadcastModalNotice.textContent = "";
    elements.broadcastModalNotice.className = "modal-notice";
    elements.broadcastModal.classList.remove("hidden");
    elements.broadcastModal.setAttribute("aria-hidden","false");
    setTimeout(function () { elements.broadcastMessageInput.focus(); },30);
}

function closeBroadcastModal() {
    state.broadcastTargetCount = 0;
    elements.broadcastModal.classList.add("hidden");
    elements.broadcastModal.setAttribute("aria-hidden","true");
    elements.broadcastModalNotice.textContent = "";
    elements.broadcastModalNotice.className = "modal-notice";
}

async function sendBroadcastMessage(message) {
    const response = await fetch("/api/dm/broadcast", {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({ message:String(message || "").trim() }),
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }
    return data;
}

async function sendDirectMessage(target,message) {
    const response = await fetch("/api/dm/send", {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({
            userId:target.userId,
            username:target.username,
            displayName:target.displayName,
            message:String(message || "").trim(),
        }),
    });

    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }
    return data;
}

async function queueServerJoin(targetUserId) {
    const response = await fetch("/api/join/send", {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({
            userId:String(targetUserId || "").trim(),
        }),
    });

    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }
    return data;
}

async function queueBring(targetUserId) {
    const response = await fetch("/api/bring/send", {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({
            userId:String(targetUserId || "").trim(),
        }),
    });

    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }
    return data;
}

async function setPlayerRole(targetUserId,roleKey) {
    const response = await fetch("/api/admin/role", {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({
            userId:String(targetUserId || "").trim(),
            role:String(roleKey || "").trim(),
        }),
    });

    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }
    return data;
}

async function moderate(action,userId,reason,identity) {
    const normalizedUserId = String(userId || "").trim();

    if (!/^\d{1,30}$/.test(normalizedUserId)) {
        throw new Error("Ungültige Roblox User-ID.");
    }

    const response = await fetch("/api/admin/" + action, {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({
            userId:normalizedUserId,
            username:identity && identity.username ? identity.username : "",
            displayName:identity && identity.displayName ? identity.displayName : "",
            reason:action === "ban" ? String(reason || "").trim() : "",
        }),
    });

    const data = await response.json().catch(function () { return {}; });

    if (!response.ok || data.success !== true) {
        throw new Error(data.error || ("HTTP " + response.status));
    }

    await refresh();
    return data;
}

elements.search.addEventListener("input",function (event) {
    state.query = event.target.value || "";
    render();
});

elements.offlineSearch.addEventListener("input",function (event) {
    state.offlineQuery = event.target.value || "";
    render();
});

elements.bannedSearch.addEventListener("input",function (event) {
    state.bannedQuery = event.target.value || "";
    render();
});

elements.directoryTabs.forEach(function (button) {
    button.addEventListener("click", function () { setDirectoryTab(button.dataset.directoryTab); });
});

if (elements.broadcastDmButton) elements.broadcastDmButton.addEventListener("click", openBroadcastModal);
if (elements.openUpdateButton) elements.openUpdateButton.addEventListener("click", openUpdateModal);
if (elements.shutdownAllButton) elements.shutdownAllButton.addEventListener("click", async function () {
    if (!window.confirm("Alle aktuell verbundenen Nexu-Scripts jetzt deaktivieren? Die Spieler können das Script danach sofort wieder neu starten.")) return;
    const originalText = elements.shutdownAllButton.textContent;
    elements.shutdownAllButton.disabled = true;
    elements.shutdownAllButton.textContent = "DEAKTIVIERE …";
    try {
        const result = await shutdownAllActiveScripts();
        alert((result.targetedPlayers || 0) + " Spieler / " + (result.targetedSessions || 0) + " aktive Sitzung(en) wurden zum Deaktivieren markiert.");
        await refresh();
    } catch (error) {
        alert(error.message || "Scripts konnten nicht deaktiviert werden.");
    } finally {
        elements.shutdownAllButton.disabled = false;
        elements.shutdownAllButton.textContent = originalText;
    }
});
if (elements.closeUpdateButton) elements.closeUpdateButton.addEventListener("click", closeUpdateModal);
if (elements.updateModal) elements.updateModal.addEventListener("click", function (event) { if (event.target === elements.updateModal) closeUpdateModal(); });
document.querySelectorAll("[data-update-minutes]").forEach(function (button) {
    button.addEventListener("click", function () {
        elements.updateDuration.value = button.dataset.updateMinutes || "30";
        elements.updateUnit.value = "minutes";
    });
});
if (elements.startUpdateButton) elements.startUpdateButton.addEventListener("click", async function () {
    const raw = Number(elements.updateDuration.value);
    const durationMinutes = elements.updateUnit.value === "hours" ? Math.round(raw * 60) : Math.round(raw);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
        elements.updateModalNotice.textContent = "Bitte eine Dauer zwischen 1 Minute und 24 Stunden eingeben.";
        return;
    }
    elements.startUpdateButton.disabled = true;
    elements.startUpdateButton.textContent = "STARTE …";
    elements.updateModalNotice.textContent = "";
    try {
        await updateScriptAction("start", durationMinutes);
        closeUpdateModal();
    } catch (error) {
        elements.updateModalNotice.textContent = error.message || "Update konnte nicht gestartet werden.";
    } finally {
        elements.startUpdateButton.disabled = false;
        elements.startUpdateButton.textContent = "UPDATE STARTEN";
    }
});
document.addEventListener("click",async function (event) {
    const button = event.target.closest("[data-action][data-user-id]");
    if (!button) {
        return;
    }

    if (button.dataset.action === "set-role") {
        const originalText = button.textContent;
        const roleKey = String(button.dataset.role || "").trim();
        button.disabled = true;
        button.textContent = "SETZE …";
        try {
            await setPlayerRole(button.dataset.userId,roleKey);
            await refresh();
        } catch (error) {
            alert(error.message || "Rang konnte nicht gespeichert werden.");
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
        return;
    }

    if (button.dataset.action === "join") {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "SENDE …";
        try {
            const result = await queueServerJoin(button.dataset.userId);
            button.textContent = result.ownerOnline ? "JOIN GESENDET" : "WARTET AUF SPIEL";
        } catch (error) {
            alert(error.message || "Server-Join konnte nicht gesendet werden.");
            button.textContent = "JOIN FEHLER";
        }
        setTimeout(function () {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = originalText;
            }
        },2200);
        return;
    }

    if (button.dataset.action === "bring") {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "SENDE …";
        try {
            await queueBring(button.dataset.userId);
            button.textContent = "BRING GESENDET";
        } catch (error) {
            alert(error.message || "Bring konnte nicht gesendet werden.");
            button.textContent = "BRING FEHLER";
        }
        setTimeout(function () {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = originalText;
            }
        },2200);
        return;
    }

    if (button.dataset.action === "dm") {
        openDmModal(
            button.dataset.userId,
            button.dataset.displayName,
            button.dataset.username
        );
        return;
    }

    if (button.dataset.action === "ban") {
        openBanModal(
            button.dataset.userId,
            button.dataset.displayName,
            button.dataset.username
        );
        return;
    }

    button.disabled = true;
    button.textContent = "ENTBANNE …";

    try {
        await moderate("unban",button.dataset.userId,"",null);
    } catch (error) {
        alert(error.message || "Entbannen fehlgeschlagen.");
        button.disabled = false;
        button.textContent = "ENTBANNEN";
    }
});

elements.cancelBanButton.addEventListener("click",closeBanModal);

elements.banModal.addEventListener("click",function (event) {
    if (event.target === elements.banModal) {
        closeBanModal();
    }
});

elements.confirmBanButton.addEventListener("click",async function () {
    if (!state.pendingBan) {
        return;
    }

    const reason = elements.banReasonInput.value.trim();
    if (!reason) {
        elements.banModalNotice.textContent = "Bitte einen Ban-Grund eingeben.";
        elements.banReasonInput.focus();
        return;
    }

    elements.confirmBanButton.disabled = true;
    elements.confirmBanButton.textContent = "BANNE …";
    elements.banModalNotice.textContent = "";

    try {
        await moderate(
            "ban",
            state.pendingBan.userId,
            reason,
            state.pendingBan
        );
        closeBanModal();
    } catch (error) {
        elements.banModalNotice.textContent = error.message || "Bannen fehlgeschlagen.";
    } finally {
        elements.confirmBanButton.disabled = false;
        elements.confirmBanButton.textContent = "BAN BESTÄTIGEN";
    }
});

if (elements.cancelBroadcastButton) elements.cancelBroadcastButton.addEventListener("click",closeBroadcastModal);
if (elements.broadcastModal) elements.broadcastModal.addEventListener("click",function (event) {
    if (event.target === elements.broadcastModal) {
        closeBroadcastModal();
    }
});
if (elements.confirmBroadcastButton) elements.confirmBroadcastButton.addEventListener("click",async function () {
    const message = elements.broadcastMessageInput.value.trim();
    if (!message) {
        elements.broadcastModalNotice.textContent = "Bitte eine Nachricht eingeben.";
        elements.broadcastModalNotice.className = "modal-notice";
        elements.broadcastMessageInput.focus();
        return;
    }
    elements.confirmBroadcastButton.disabled = true;
    elements.confirmBroadcastButton.textContent = "SENDE …";
    elements.broadcastModalNotice.textContent = "";
    elements.broadcastModalNotice.className = "modal-notice";
    try {
        const result = await sendBroadcastMessage(message);
        const count = Number(result.targetedPlayers) || 0;
        elements.broadcastModalNotice.textContent = count === 1
            ? "Nachricht wurde an 1 aktiven Spieler gesendet."
            : "Nachricht wurde an " + count + " aktive Spieler gesendet.";
        elements.broadcastModalNotice.className = "modal-notice ok";
        setTimeout(closeBroadcastModal,900);
    } catch (error) {
        elements.broadcastModalNotice.textContent = error.message || "Nachricht konnte nicht an alle gesendet werden.";
        elements.broadcastModalNotice.className = "modal-notice";
    } finally {
        elements.confirmBroadcastButton.disabled = false;
        elements.confirmBroadcastButton.textContent = "AN ALLE SENDEN";
    }
});

elements.cancelDmButton.addEventListener("click",closeDmModal);

elements.dmModal.addEventListener("click",function (event) {
    if (event.target === elements.dmModal) {
        closeDmModal();
    }
});

elements.confirmDmButton.addEventListener("click",async function () {
    if (!state.pendingDm) {
        return;
    }

    const message = elements.dmMessageInput.value.trim();
    if (!message) {
        elements.dmModalNotice.textContent = "Bitte eine Nachricht eingeben.";
        elements.dmModalNotice.className = "modal-notice";
        elements.dmMessageInput.focus();
        return;
    }

    elements.confirmDmButton.disabled = true;
    elements.confirmDmButton.textContent = "SENDE …";
    elements.dmModalNotice.textContent = "";
    elements.dmModalNotice.className = "modal-notice";

    try {
        await sendDirectMessage(state.pendingDm,message);
        elements.dmModalNotice.textContent = "Nachricht wurde an den Spieler gesendet.";
        elements.dmModalNotice.className = "modal-notice ok";
        setTimeout(closeDmModal,650);
    } catch (error) {
        elements.dmModalNotice.textContent = error.message || "Nachricht konnte nicht gesendet werden.";
        elements.dmModalNotice.className = "modal-notice";
    } finally {
        elements.confirmDmButton.disabled = false;
        elements.confirmDmButton.textContent = "DM SENDEN";
    }
});

document.addEventListener("keydown",function (event) {
    if (event.key !== "Escape") {
        return;
    }
    if (!elements.banModal.classList.contains("hidden")) {
        closeBanModal();
    }
    if (!elements.dmModal.classList.contains("hidden")) {
        closeDmModal();
    }
    if (elements.broadcastModal && !elements.broadcastModal.classList.contains("hidden")) {
        closeBroadcastModal();
    }
    if (elements.updateModal && !elements.updateModal.classList.contains("hidden")) {
        closeUpdateModal();
    }
});

refresh();
setInterval(refresh,5000);
setInterval(renderUpdateStatus,250);
</script>

</body>
</html>`;
}

loadBans();loadKnownPlayers();loadDashboardAccount();loadRememberedDashboardDevices();loadMenuUpdateState();
const githubStorageStartupPromise = loadGitHubStorage().then(() => { restoreRecentPresenceFromKnownPlayers(); }).catch((error) => { console.warn("[NEXU] GitHub-Startspeicher fehlgeschlagen:", error.message); restoreRecentPresenceFromKnownPlayers(); });

const server = http.createServer(async (req, res) => {const requestUrl = new URL(req.url, "http://localhost");const pathname = requestUrl.pathname;

if (req.method === "GET" && pathname === "/") {
    if (isDashboardAuthenticated(req)) {
        const message = requestUrl.searchParams.get("settings") === "updated"
            ? "Account-Einstellungen wurden gespeichert."
            : requestUrl.searchParams.get("account") === "deleted"
                ? "Account wurde gelöscht."
                : "";
        const session = getDashboardSession(req);
        sendHtml(res, 200, homeHtml(message, "", session && session.account));
    } else {
        sendHtml(res, 200, loginHtml(requestUrl.searchParams.get("account") === "deleted" ? "" : "", getRememberedDashboardAccounts(req), {notice: requestUrl.searchParams.get("account") === "deleted" ? "Account wurde gelöscht." : ""}));
    }
    return;
}

if (req.method === "GET" && pathname === "/login") {
    if (isDashboardAuthenticated(req)) {
        redirect(res, "/");
    } else {
        sendHtml(res, 200, loginHtml(requestUrl.searchParams.get("account") === "deleted" ? "" : "", getRememberedDashboardAccounts(req), {notice: requestUrl.searchParams.get("account") === "deleted" ? "Account wurde gelöscht." : ""}));
    }
    return;
}

if (req.method === "GET" && pathname === "/menu-server") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    if (!canAccessMenuServer(session.account)) {
        sendHtml(res, 403, homeHtml("", "Menu Server Zugriff ist für diesen Account nicht freigegeben.", session.account));
        return;
    }
    console.log("[NEXU] Menu Server Dashboard aufgerufen");
    const updateNotice = requestUrl.searchParams.get("update") === "cancelled"
        ? "Das Script-Update wurde beendet. Alle Spieler können das Menü wieder starten."
        : requestUrl.searchParams.get("update") === "already-inactive"
            ? "Der Update-Modus war bereits beendet."
            : "";
    sendHtml(res, 200, dashboardHtml(session.account, updateNotice));
    return;
}

if (req.method === "POST" && pathname === "/menu-server/update/cancel") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    if (!hasDashboardPermission(session.account, "updateScript")) {
        sendHtml(res, 403, homeHtml("", dashboardPermissionError("updateScript"), session.account));
        return;
    }
    const result = cancelMenuUpdate();
    console.log(`[NEXU] Script-Update ${result.wasActive ? "über Dashboard-Formular beendet" : "war bereits inaktiv"}: ${session.username}`);
    redirect(res, result.wasActive ? "/menu-server?update=cancelled" : "/menu-server?update=already-inactive");
    return;
}

if (req.method === "GET" && pathname === "/accounts") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    if (!canManageDashboardAccounts(session.account)) {
        sendHtml(res, 403, homeHtml("", "Account-Verwaltung ist nur für OwnerAccount freigegeben.", session.account));
        return;
    }
    const notice = requestUrl.searchParams.get("updated") === "1"
        ? "Account wurde gespeichert."
        : requestUrl.searchParams.get("deleted") === "1"
            ? "Account wurde gelöscht."
            : "";
    sendHtml(res, 200, dashboardAccountsHtml(notice, "", session.account));
    return;
}

if (req.method === "POST" && pathname === "/accounts/update") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    if (!canManageDashboardAccounts(session.account)) {
        sendHtml(res, 403, homeHtml("", "Account-Verwaltung ist nur für OwnerAccount freigegeben.", session.account));
        return;
    }
    try {
        const form = await readFormBody(req);
        const accountEmail = cleanDashboardEmail(form.accountEmail);
        const target = getDashboardAccountByEmail(accountEmail);
        if (!target) {
            sendHtml(res, 404, dashboardAccountsHtml("", "Account wurde nicht gefunden.", session.account));
            return;
        }
        const targetIsOwner = isOwnerDashboardAccount(target);
        const nextUsername = targetIsOwner ? OWNER_ACCOUNT_USERNAME : cleanDashboardUsername(form.username);
        const newPassword = String(form.newPassword || "");
        const confirmPassword = String(form.confirmPassword || "");
        if (!nextUsername) {
            sendHtml(res, 400, dashboardAccountsHtml("", "Benutzername ungültig.", session.account));
            return;
        }
        if (dashboardUsernameExists(nextUsername, target.email)) {
            sendHtml(res, 409, dashboardAccountsHtml("", "Dieser Benutzername ist bereits vergeben.", session.account));
            return;
        }
        let nextPasswordHash = target.passwordHash;
        if (newPassword !== "" || confirmPassword !== "") {
            if (newPassword.length < 8) {
                sendHtml(res, 400, dashboardAccountsHtml("", "Das neue Passwort muss mindestens 8 Zeichen haben.", session.account));
                return;
            }
            if (newPassword !== confirmPassword) {
                sendHtml(res, 400, dashboardAccountsHtml("", "Neue Passwörter stimmen nicht überein.", session.account));
                return;
            }
            nextPasswordHash = sha256Hex(newPassword);
        }
        const dashboardAccessEnabled = form.menuServerAccess === "1" || form.menuServerAccess === "on";
        const updated = normalizeDashboardAccount({
            ...target,
            username: nextUsername,
            passwordHash: nextPasswordHash,
            access: targetIsOwner
                ? normalizeDashboardAccess({}, OWNER_ACCOUNT_USERNAME, DASHBOARD_DEFAULT_EMAIL)
                : normalizeDashboardAccess({
                    menuServer: dashboardAccessEnabled,
                    dm: dashboardAccessEnabled && (form.dashboardDm === "1" || form.dashboardDm === "on"),
                    bring: dashboardAccessEnabled && (form.dashboardBring === "1" || form.dashboardBring === "on"),
                    serverJoin: dashboardAccessEnabled && (form.dashboardJoin === "1" || form.dashboardJoin === "on"),
                    managePlayerRoles: dashboardAccessEnabled && (form.dashboardRole === "1" || form.dashboardRole === "on"),
                    banPlayers: dashboardAccessEnabled && (form.dashboardBan === "1" || form.dashboardBan === "on"),
                    updateScript: dashboardAccessEnabled && (form.dashboardUpdateScript === "1" || form.dashboardUpdateScript === "on"),
                }, nextUsername),
            updatedAt: new Date().toISOString(),
        });
        if (!updated) {
            sendHtml(res, 500, dashboardAccountsHtml("", "Account konnte nicht normalisiert werden.", session.account));
            return;
        }
        dashboardAccounts.set(updated.email, updated);
        if (!saveDashboardAccount()) {
            sendHtml(res, 500, dashboardAccountsHtml("", "Account konnte nicht gespeichert werden.", session.account));
            return;
        }
        for (const [token, raw] of dashboardSessions) {
            if (raw && raw.email === updated.email) {
                dashboardSessions.set(token, { ...raw, username: updated.username, email: updated.email });
            }
        }
        for (const [tokenHash, entry] of rememberedDashboardDevices) {
            if (entry && entry.email === updated.email) {
                rememberedDashboardDevices.set(tokenHash, { ...entry, username: updated.username, email: updated.email });
            }
        }
        saveRememberedDashboardDevices();
        redirect(res, "/accounts?updated=1");
    } catch (error) {
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, dashboardAccountsHtml("", "Account konnte nicht verarbeitet werden.", session.account));
    }
    return;
}

if (req.method === "POST" && pathname === "/accounts/delete") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    if (!canManageDashboardAccounts(session.account)) {
        sendHtml(res, 403, homeHtml("", "Account-Verwaltung ist nur für OwnerAccount freigegeben.", session.account));
        return;
    }
    try {
        const form = await readFormBody(req);
        const accountEmail = cleanDashboardEmail(form.accountEmail);
        const target = getDashboardAccountByEmail(accountEmail);
        if (!target) {
            sendHtml(res, 404, dashboardAccountsHtml("", "Account wurde nicht gefunden.", session.account));
            return;
        }
        if (isOwnerDashboardAccount(target)) {
            sendHtml(res, 409, dashboardAccountsHtml("", "OwnerAccount kann nicht gelöscht werden.", session.account));
            return;
        }
        deleteDashboardAccount(target.email);
        for (const [token, raw] of dashboardSessions) {
            if (raw && raw.email === target.email) dashboardSessions.delete(token);
        }
        for (const [tokenHash, entry] of rememberedDashboardDevices) {
            if (entry && entry.email === target.email) rememberedDashboardDevices.delete(tokenHash);
        }
        saveRememberedDashboardDevices();
        redirect(res, "/accounts?deleted=1");
    } catch (error) {
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, dashboardAccountsHtml("", "Account konnte nicht gelöscht werden.", session.account));
    }
    return;
}

if (req.method === "POST" && pathname === "/login") {
    try {
        if (!allowLoginAttempt(req)) {
            sendHtml(
                res,
                429,
                loginHtml("Zu viele Anmeldeversuche. Bitte später erneut versuchen.", getRememberedDashboardAccounts(req))
            );
            return;
        }

        const form = await readFormBody(req);
        const username = cleanDashboardUsername(form.username || form.email);
        const password = String(form.password || "");
        const account = getDashboardAccountByUsername(username);
        const validLogin = Boolean(account && validDashboardAccountPassword(account, password));

        if (!validLogin) {
            console.warn("[NEXU] Fehlgeschlagene Dashboard-Anmeldung von", getClientIp(req));
            sendHtml(
                res,
                401,
                loginHtml("Benutzername oder Passwort ist falsch.", getRememberedDashboardAccounts(req))
            );
            return;
        }

        clearLoginAttempts(req);
        const token = createDashboardSession(account);
        const rememberToken = createRememberedDashboardDevice(account);
        console.log("[NEXU] Owner-Dashboard erfolgreich angemeldet");
        redirect(res, "/", {
            "Set-Cookie": [
                dashboardCookie(
                    req,
                    token,
                    DASHBOARD_SESSION_TTL_MS / 1000
                ),
                dashboardRememberCookie(
                    req,
                    rememberCookieValueWithNewToken(req, rememberToken),
                    DASHBOARD_REMEMBER_TTL_MS / 1000
                ),
            ],
        });
    } catch (error) {
        sendHtml(
            res,
            error.message === "BODY_TOO_LARGE" ? 413 : 400,
            loginHtml(
                error.message === "BODY_TOO_LARGE"
                    ? "Anmeldedaten sind zu groß."
                    : "Anmeldung konnte nicht verarbeitet werden.",
                getRememberedDashboardAccounts(req)
            )
        );
    }
    return;
}

if (req.method === "POST" && pathname === "/quick-login") {
    if (!allowLoginAttempt(req)) {
        sendHtml(
            res,
            429,
            loginHtml(
                "Zu viele Schnell-Anmeldungen. Bitte später erneut versuchen.",
                getRememberedDashboardAccounts(req)
            )
        );
        return;
    }

    const form = await readFormBody(req).catch(() => ({}));
    const requestedRememberToken = String(form.rememberToken || "").trim();
    const rememberedAccounts = getRememberedDashboardAccounts(req);
    const rememberedAccount = rememberedAccounts.find((entry) => entry.rememberToken === requestedRememberToken) || rememberedAccounts[0] || null;
    const rememberedLoginAccount = rememberedAccount && (getDashboardAccountByEmail(rememberedAccount.email) || getDashboardAccountByUsername(rememberedAccount.username));
    if (!rememberedAccount || !rememberedLoginAccount) {
        const nextRememberValue = rememberCookieValueWithoutToken(req, requestedRememberToken);
        if (requestedRememberToken) removeRememberedDashboardDevice(req, requestedRememberToken);
        redirect(res, "/login", {
            "Set-Cookie": dashboardRememberCookie(req, nextRememberValue, nextRememberValue ? DASHBOARD_REMEMBER_TTL_MS / 1000 : 0),
        });
        return;
    }

    clearLoginAttempts(req);
    const token = createDashboardSession(rememberedLoginAccount);
    console.log("[NEXU] Owner-Dashboard per gespeichertem Account angemeldet");
    redirect(res, "/", {
        "Set-Cookie": dashboardCookie(
            req,
            token,
            DASHBOARD_SESSION_TTL_MS / 1000
        ),
    });
    return;
}

if (req.method === "POST" && pathname === "/forget-account") {
    const form = await readFormBody(req).catch(() => ({}));
    const requestedRememberToken = String(form.rememberToken || "").trim();
    const nextRememberValue = rememberCookieValueWithoutToken(req, requestedRememberToken);
    if (requestedRememberToken) {
        removeRememberedDashboardDevice(req, requestedRememberToken);
    }
    removeDashboardSession(req);
    redirect(res, "/login", {
        "Set-Cookie": [
            dashboardCookie(req, "", 0),
            dashboardRememberCookie(req, nextRememberValue, nextRememberValue ? DASHBOARD_REMEMBER_TTL_MS / 1000 : 0),
        ],
    });
    return;
}

if (req.method === "POST" && pathname === "/logout") {
    removeDashboardSession(req);
    redirect(res, "/", {
        // Der Remember-Cookie bleibt absichtlich bestehen, damit der Account
        // nach dem Abmelden als Schnell-Login-Karte angezeigt wird.
        "Set-Cookie": dashboardCookie(req, "", 0),
    });
    return;
}


if (req.method === "POST" && pathname === "/account/settings") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    try {
        const form = await readFormBody(req);
        const requestedUsername = cleanDashboardUsername(form.newUsername);
        const nextUsername = isOwnerDashboardAccount(session.account) ? OWNER_ACCOUNT_USERNAME : requestedUsername;
        const currentPassword = String(form.currentPassword || "");
        const nextPassword = String(form.newPassword || "");
        const confirmPassword = String(form.confirmPassword || "");

        if (!nextUsername) {
            sendHtml(res, 400, homeHtml("", "Benutzername ungültig. Erlaubt sind 3-80 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich, @ und -.", session.account));
            return;
        }
        if (dashboardUsernameExists(nextUsername, session.account.email)) {
            sendHtml(res, 409, homeHtml("", "Dieser Benutzername ist bereits vergeben.", session.account));
            return;
        }
        if (!validDashboardAccountPassword(session.account, currentPassword)) {
            sendHtml(res, 403, homeHtml("", "Aktuelles Passwort ist falsch.", session.account));
            return;
        }
        let nextPasswordHash = session.account.passwordHash;
        if (nextPassword !== "" || confirmPassword !== "") {
            if (nextPassword.length < 8) {
                sendHtml(res, 400, homeHtml("", "Das neue Passwort muss mindestens 8 Zeichen haben.", session.account));
                return;
            }
            if (nextPassword !== confirmPassword) {
                sendHtml(res, 400, homeHtml("", "Neue Passwörter stimmen nicht überein.", session.account));
                return;
            }
            nextPasswordHash = sha256Hex(nextPassword);
        }
        const updated = normalizeDashboardAccount({...session.account, username: nextUsername, passwordHash: nextPasswordHash, updatedAt: new Date().toISOString()});
        if (!updated) {
            sendHtml(res, 500, homeHtml("", "Account konnte nicht gespeichert werden.", session.account));
            return;
        }
        dashboardAccounts.set(updated.email, updated);
        if (!saveDashboardAccount()) {
            sendHtml(res, 500, homeHtml("", "Account konnte nicht gespeichert werden.", session.account));
            return;
        }
        if (session && session.token) {
            dashboardSessions.set(session.token, {
                username: updated.username,
                email: updated.email,
                expiresAtMs: session.expiresAtMs,
            });
        }
        for (const [tokenHash, entry] of rememberedDashboardDevices) {
            if (entry && entry.email === updated.email) {
                rememberedDashboardDevices.set(tokenHash, {
                    ...entry,
                    username: updated.username,
                    email: updated.email,
                });
            }
        }
        saveRememberedDashboardDevices();
        redirect(res, "/?settings=updated");
    } catch (error) {
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, homeHtml("", "Account-Einstellungen konnten nicht verarbeitet werden.", session.account));
    }
    return;
}

if (req.method === "POST" && pathname === "/account/delete") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/login");
        return;
    }
    try {
        const form = await readFormBody(req);
        const currentPassword = String(form.currentPassword || "");
        if (isOwnerDashboardAccount(session.account)) {
            sendHtml(res, 409, homeHtml("", "OwnerAccount kann nicht gelöscht werden.", session.account));
            return;
        }
        if (!validDashboardAccountPassword(session.account, currentPassword)) {
            sendHtml(res, 403, homeHtml("", "Passwort für Account-Löschung ist falsch.", session.account));
            return;
        }
        const deletedEmail = session.account.email;
        deleteDashboardAccount(deletedEmail);
        for (const [token, raw] of dashboardSessions) {
            if (raw && raw.email === deletedEmail) dashboardSessions.delete(token);
        }
        for (const [tokenHash, entry] of rememberedDashboardDevices) {
            if (entry && entry.email === deletedEmail) rememberedDashboardDevices.delete(tokenHash);
        }
        saveRememberedDashboardDevices();
        redirect(res, "/login?account=deleted", {
            "Set-Cookie": [dashboardCookie(req, "", 0), dashboardRememberCookie(req, "", 0)],
        });
    } catch (error) {
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, homeHtml("", "Account konnte nicht gelöscht werden.", session.account));
    }
    return;
}

if (req.method === "POST" && pathname === "/register/request") {
    try {
        if (!allowLoginAttempt(req)) {
            sendHtml(res, 429, loginHtml("Zu viele Registrierungsversuche. Bitte später erneut versuchen.", getRememberedDashboardAccounts(req)));
            return;
        }
        const form = await readFormBody(req);
        const username = cleanDashboardUsername(form.username);
        const password = String(form.password || "");
        const confirmPassword = String(form.confirmPassword || "");
        if (!username) {
            sendHtml(res, 400, loginHtml("Benutzername ungültig. Erlaubt sind 3-80 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich, @ und -.", getRememberedDashboardAccounts(req)));
            return;
        }
        if (dashboardUsernameExists(username)) {
            sendHtml(res, 409, loginHtml("Dieser Benutzername ist bereits vergeben.", getRememberedDashboardAccounts(req)));
            return;
        }
        if (password.length < 8) {
            sendHtml(res, 400, loginHtml("Das Passwort muss mindestens 8 Zeichen haben.", getRememberedDashboardAccounts(req)));
            return;
        }
        if (password !== confirmPassword) {
            sendHtml(res, 400, loginHtml("Passwörter stimmen nicht überein.", getRememberedDashboardAccounts(req)));
            return;
        }
        const account = putDashboardAccount({
            username,
            email: internalDashboardEmailForUsername(username),
            passwordHash: sha256Hex(password),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        if (!account || !saveDashboardAccount()) {
            sendHtml(res, 500, loginHtml("Account konnte nicht gespeichert werden.", getRememberedDashboardAccounts(req)));
            return;
        }
        clearLoginAttempts(req);
        const token = createDashboardSession(account);
        const rememberToken = createRememberedDashboardDevice(account);
        redirect(res, "/", {"Set-Cookie": [dashboardCookie(req, token, DASHBOARD_SESSION_TTL_MS / 1000), dashboardRememberCookie(req, rememberCookieValueWithNewToken(req, rememberToken), DASHBOARD_REMEMBER_TTL_MS / 1000)]});
    } catch (error) {
        const message = error.message === "BODY_TOO_LARGE"
            ? "Registrierungsdaten sind zu groß."
            : "Registrierung konnte nicht verarbeitet werden.";
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, loginHtml(message, getRememberedDashboardAccounts(req)));
    }
    return;
}

if (req.method === "POST" && pathname === "/register/verify") {
    redirect(res, "/login");
    return;
}


if (
    req.method === "GET" &&
    (pathname === "/status" || pathname === "/api/status")
) {
    prunePresence();
    sendJson(res, 200, {
        success: true,
        online: true,
        service: "Nexu Presence & Moderation",
        activePlayers: countActivePresenceUsers(),
        activeSessions: presence.size,
        bannedPlayers: bans.size,
        menuUpdate: getMenuUpdateStatus(),
        pendingShutdownSessions: shutdownCommandsBySession.size,
        serverStartedAtMs: SERVER_STARTED_AT_MS,
        presenceWarmup: Date.now() - SERVER_STARTED_AT_MS < PRESENCE_RESTART_GRACE_MS,
        timestamp: new Date().toISOString(),
    });
    return;
}

if (req.method === "GET" && pathname === "/api/menu/access") {
    const userId = cleanNumericId(requestUrl.searchParams.get("userId"));
    const sessionId = cleanText(requestUrl.searchParams.get("sessionId"), 100);

    if (!userId) {
        sendJson(res, 400, {
            success: false,
            error: "Ungültige User-ID",
        });
        return;
    }

    const ban = bans.get(userId);
    const role = getNexuRoleInfo(userId);
    const menuUpdate = getMenuUpdateStatus();
    const shutdown = getShutdownCommandForClient(userId, sessionId);
    sendJson(res, 200, {
        success: true,
        allowed: !ban && !menuUpdate.active && shutdown.active !== true,
        banned: Boolean(ban),
        updating: menuUpdate.active,
        maintenance: menuUpdate,
        shutdown,
        userId,
        roleKey: role.key,
        roleTitle: role.title,
        permissions: {
            bring: canUseNexuBringRole(userId),
            menuCreator: role.key === "creator",
        },
        reason: ban ? ban.reason : "",
        bannedAt: ban ? ban.bannedAt : "",
        timestamp: new Date().toISOString(),
    });
    return;
}



if (req.method === "POST" && pathname === "/api/admin/shutdown/all") {
    const session = getDashboardSession(req);
    if (!session || !hasDashboardPermission(session.account, "shutdownScript")) {
        sendJson(res, 403, {success:false,error:dashboardPermissionError("shutdownScript")});
        return;
    }
    const result = queueGlobalScriptShutdown(session.username);
    console.log(`[NEXU] Globales Script-Deaktivieren: ${result.targetedPlayers} Spieler / ${result.targetedSessions} Sitzungen von ${session.username}`);
    sendJson(res, 200, {success:true,...result});
    return;
}

if (req.method === "POST" && pathname === "/api/admin/update/start") {
    const session = getDashboardSession(req);
    if (!session || !hasDashboardPermission(session.account, "updateScript")) {
        sendJson(res, 403, {success:false,error:dashboardPermissionError("updateScript")});
        return;
    }
    try {
        const requestRevision = menuUpdateMutationRevision;
        const body = await readJsonBody(req);
        if (requestRevision !== menuUpdateMutationRevision) {
            sendJson(res, 409, {success:false,error:"Der Update-Start wurde verworfen, weil der Update-Modus inzwischen beendet oder geändert wurde."});
            return;
        }
        const result = startMenuUpdate(body.durationMinutes, session.username);
        if (result.error) {
            sendJson(res, 400, {success:false,error:result.error});
            return;
        }
        console.log(`[NEXU] Script-Update gestartet: ${result.status.durationMinutes} Minuten von ${session.username}`);
        sendJson(res, 200, {success:true,menuUpdate:result.status});
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {success:false,error:"Update konnte nicht gestartet werden"});
    }
    return;
}

if (req.method === "POST" && pathname === "/api/admin/update/cancel") {
    const session = getDashboardSession(req);
    if (!session || !hasDashboardPermission(session.account, "updateScript")) {
        sendJson(res, 403, {success:false,error:dashboardPermissionError("updateScript")});
        return;
    }
    const result = cancelMenuUpdate();
    console.log(`[NEXU] Script-Update ${result.wasActive ? "vorzeitig beendet" : "war bereits inaktiv"}: ${session.username}`);
    sendJson(res, 200, {success:true,persisted:result.persisted !== false,menuUpdate:result.status});
    return;
}

if (req.method === "POST" && pathname === "/api/join/send") {
    if (!isDashboardPermissionSession(req, "serverJoin")) {
        sendJson(res, 403, {
            success: false,
            error: dashboardPermissionError("serverJoin"),
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const targetPlayerId = cleanNumericId(body.userId);
        if (!targetPlayerId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige Spieler-ID",
            });
            return;
        }

        prunePresence();
        const targetPresence = findLatestPresenceForUser(targetPlayerId);
        if (!targetPresence) {
            sendJson(res, 404, {
                success: false,
                error: "Spieler ist nicht mehr online",
            });
            return;
        }

        if (
            !targetPresence.placeId ||
            !targetPresence.jobId ||
            String(targetPresence.jobId).startsWith("LOCAL-")
        ) {
            sendJson(res, 409, {
                success: false,
                error: "Dieser Server kann nicht betreten werden",
            });
            return;
        }

        const command = queueJoinCommand(
            MENU_CREATOR_USER_ID,
            targetPresence
        );
        const ownerOnline = Boolean(
            findLatestPresenceForUser(MENU_CREATOR_USER_ID)
        );

        console.log(
            `[NEXU] Website-Join: ${MENU_CREATOR_USER_ID} -> ` +
                `${targetPresence.displayName} // ${targetPresence.placeId} // ${targetPresence.jobId}`
        );

        sendJson(res, 200, {
            success: true,
            queued: true,
            ownerOnline,
            commandId: command.id,
            target: {
                userId: targetPresence.userId,
                username: targetPresence.username,
                displayName: targetPresence.displayName,
                gameName: targetPresence.gameName,
                placeId: targetPresence.placeId,
                jobId: targetPresence.jobId,
            },
            expiresAt: command.expiresAt,
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: error.message === "INVALID_JSON"
                ? "Ungültige JSON-Daten"
                : "Join-Auftrag konnte nicht erstellt werden",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/join/poll") {
    if (!isHeartbeatAuthorized(req)) {
        sendJson(res, 401, {
            success: false,
            error: "Ungültiger Heartbeat-Token",
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const sessionId = cleanText(body.sessionId, 100);

        if (!userId || userId !== MENU_CREATOR_USER_ID) {
            sendJson(res, 200, {
                success: true,
                command: null,
            });
            return;
        }

        const result = takeJoinCommand(userId, sessionId);
        if (result.error) {
            sendJson(res, 403, {
                success: false,
                error: result.error,
            });
            return;
        }

        const command = result.command;
        sendJson(res, 200, {
            success: true,
            command: command ? {
                id: command.id,
                targetUserId: command.targetUserId,
                targetUsername: command.targetUsername,
                targetDisplayName: command.targetDisplayName,
                gameName: command.gameName,
                placeId: command.placeId,
                jobId: command.jobId,
                createdAt: command.createdAt,
                expiresAt: command.expiresAt,
            } : null,
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: "Join-Poll konnte nicht verarbeitet werden",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/bring/send") {
    try {
        const body = await readJsonBody(req);
        const targetPlayerId = cleanNumericId(body.userId);
        const dashboardAuthenticated = isDashboardPermissionSession(req, "bring");
        const requesterUserId = cleanNumericId(body.requesterUserId);
        const requesterSessionId = cleanText(body.requesterSessionId, 100);

        if (!targetPlayerId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige Ziel-Spieler-ID",
            });
            return;
        }

        if (bans.has(targetPlayerId)) {
            sendJson(res, 409, {
                success: false,
                error: "Der Spieler ist vom Menü gebannt.",
            });
            return;
        }

        prunePresence();
        const targetPresence = findLatestPresenceForUser(targetPlayerId);
        let ownerPresence = null;
        let requestSource = "Website-Bring";

        if (dashboardAuthenticated) {
            if (targetPlayerId === MENU_CREATOR_USER_ID) {
                sendJson(res, 400, {
                    success: false,
                    error: "Du kannst dich nicht selbst bringen.",
                });
                return;
            }
            ownerPresence = findLatestPresenceForUser(MENU_CREATOR_USER_ID);
        } else {
            if (!isHeartbeatAuthorized(req)) {
                sendJson(res, 401, {
                    success: false,
                    error: "Ungültiger Heartbeat-Token",
                });
                return;
            }

            const requesterAllowed = canUseNexuBringRole(requesterUserId);
            const requesterPresence = requesterUserId
                ? findLatestPresenceForUser(requesterUserId)
                : null;

            if (
                !requesterAllowed ||
                !requesterPresence ||
                !requesterSessionId ||
                requesterPresence.sessionId !== requesterSessionId
            ) {
                sendJson(res, 403, {
                    success: false,
                    error: "Keine Bring-Berechtigung",
                });
                return;
            }

            if (targetPlayerId === requesterUserId) {
                sendJson(res, 400, {
                    success: false,
                    error: "Du kannst dich nicht selbst bringen.",
                });
                return;
            }

            ownerPresence = requesterPresence;
            requestSource = "Menu-Bring";
        }

        if (!targetPresence) {
            sendJson(res, 404, {
                success: false,
                error: "Zielspieler ist nicht mehr online",
            });
            return;
        }

        if (!ownerPresence) {
            sendJson(res, 409, {
                success: false,
                error: "Bring-Auslöser ist nicht online",
            });
            return;
        }

        if (
            !ownerPresence.placeId ||
            !ownerPresence.jobId ||
            String(ownerPresence.jobId).startsWith("LOCAL-")
        ) {
            sendJson(res, 409, {
                success: false,
                error: "Bring-Server kann nicht betreten werden",
            });
            return;
        }

        const command = queueBringCommand(
            targetPlayerId,
            targetPresence,
            ownerPresence
        );

        console.log(
            `[NEXU] ${requestSource}: ${targetPresence.displayName} -> ` +
                `${ownerPresence.displayName} // ${ownerPresence.placeId} // ${ownerPresence.jobId}`
        );

        sendJson(res, 200, {
            success: true,
            queued: true,
            commandId: command.id,
            target: {
                userId: targetPresence.userId,
                username: targetPresence.username,
                displayName: targetPresence.displayName,
            },
            owner: {
                userId: ownerPresence.userId,
                username: ownerPresence.username,
                displayName: ownerPresence.displayName,
                gameName: ownerPresence.gameName,
                placeId: ownerPresence.placeId,
                jobId: ownerPresence.jobId,
            },
            expiresAt: command.expiresAt,
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: error.message === "INVALID_JSON"
                ? "Ungültige JSON-Daten"
                : "Bring-Auftrag konnte nicht erstellt werden",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/bring/poll") {
    if (!isHeartbeatAuthorized(req)) {
        sendJson(res, 401, {
            success: false,
            error: "Ungültiger Heartbeat-Token",
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const sessionId = cleanText(body.sessionId, 100);

        if (!userId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige User-ID",
            });
            return;
        }

        const result = takeBringCommand(userId, sessionId);
        if (result.error) {
            sendJson(res, 403, {
                success: false,
                error: result.error,
            });
            return;
        }

        const command = result.command;
        sendJson(res, 200, {
            success: true,
            command: command ? {
                id: command.id,
                targetUserId: command.targetUserId,
                targetUsername: command.targetUsername,
                targetDisplayName: command.targetDisplayName,
                ownerUserId: command.ownerUserId,
                ownerUsername: command.ownerUsername,
                ownerDisplayName: command.ownerDisplayName,
                ownerGameName: command.ownerGameName,
                ownerPlaceId: command.ownerPlaceId,
                ownerJobId: command.ownerJobId,
                createdAt: command.createdAt,
                expiresAt: command.expiresAt,
            } : null,
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: "Bring-Poll konnte nicht verarbeitet werden",
        });
    }
    return;
}

if (req.method === "GET" && pathname === "/api/presence") {
    const data = await getPublicPresence();
    sendJson(res, 200, {
        success: true,
        online: true,
        activePlayers: data.activeCount,
        bannedCount: data.bannedPlayers.length,
        timeoutSeconds: ONLINE_TIMEOUT_MS / 1000,
        heartbeatMode: "per-script-session",
        players: data.players,
        bannedPlayers: data.bannedPlayers,
        menuUpdate: getMenuUpdateStatus(),
        pendingShutdownSessions: shutdownCommandsBySession.size,
        serverStartedAtMs: SERVER_STARTED_AT_MS,
        presenceWarmup: Date.now() - SERVER_STARTED_AT_MS < PRESENCE_RESTART_GRACE_MS,
        timestamp: new Date().toISOString(),
    });
    return;
}

if (req.method === "POST" && pathname === "/api/presence/heartbeat") {
    if (!isHeartbeatAuthorized(req)) {
        console.warn("[NEXU] Heartbeat abgelehnt: ungültiger Token");
        sendJson(res, 401, {
            success: false,
            error: "Ungültiger Heartbeat-Token",
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const jobId = cleanText(body.jobId, 100);
        const placeId = cleanInteger(body.placeId);
        const gameName = cleanText(body.gameName, 120) || `Place ${placeId || 0}`;
        const sessionId = cleanText(body.sessionId, 100);

        // Presence ist absichtlich pro ausgeführter Script-Instanz. Batch-Listen
        // dürfen niemals andere Spieler als online eintragen oder entfernen.
        if (Array.isArray(body.players)) {
            sendJson(res, 400, {
                success: false,
                error: "Batch-Heartbeats werden nicht unterstützt",
            });
            return;
        }

        const normalized = normalizeHeartbeatPlayers(body);

        if (!jobId) {
            sendJson(res, 400, {
                success: false,
                error: "jobId fehlt",
            });
            return;
        }

        const now = Date.now();
        const currentKeys = new Set();
        const blockedUserIds = [];
        let knownPlayersChanged = false;

        for (const rawPlayer of normalized.rows) {
            if (!rawPlayer || typeof rawPlayer !== "object") {
                continue;
            }

            const userId = cleanNumericId(rawPlayer.userId);
            const username = cleanText(rawPlayer.username, 40);
            const displayName = cleanText(rawPlayer.displayName, 80);

            if (!userId || !username || !displayName) {
                continue;
            }

            if (bans.has(userId)) {
                blockedUserIds.push(userId);
                removePresenceForUser(userId);
                continue;
            }

            const incomingSessionId = cleanText(rawPlayer.sessionId, 100) || sessionId;
            if (!incomingSessionId) {
                continue;
            }

            // Eine Session-ID entspricht genau einer laufenden Script-Ausführung.
            // Dadurch kann eine alte oder parallele Instanz keine neue Instanz
            // desselben Spielers überschreiben oder versehentlich abmelden.
            const key = `${userId}:${incomingSessionId}`;
            currentKeys.add(key);

            const existing = presence.get(key);
            const sameSession = Boolean(existing && existing.sessionId === incomingSessionId);
            const entry = {
                userId,
                username,
                displayName,
                gameName: cleanText(rawPlayer.gameName, 120) || gameName || (existing && existing.gameName) || `Place ${placeId || 0}`,
                placeId,
                jobId,
                sessionId: incomingSessionId,
                executionSource: cleanText(
                    rawPlayer.executionSource || rawPlayer.executorName ||
                    (rawPlayer.clientInfo && (rawPlayer.clientInfo.source || rawPlayer.clientInfo.executionSource)),
                    80
                ) || (existing && existing.executionSource) || "",
                executionVersion: cleanText(
                    rawPlayer.executionVersion || rawPlayer.executorVersion ||
                    (rawPlayer.clientInfo && (rawPlayer.clientInfo.version || rawPlayer.clientInfo.executionVersion)),
                    80
                ) || (existing && existing.executionVersion) || "",
                clientPlatform: cleanText(
                    rawPlayer.clientPlatform || rawPlayer.platform ||
                    (rawPlayer.clientInfo && (rawPlayer.clientInfo.platform || rawPlayer.clientInfo.clientPlatform)),
                    40
                ) || (existing && existing.clientPlatform) || "",
                scriptBuild: cleanText(
                    rawPlayer.scriptBuild || rawPlayer.buildId ||
                    (rawPlayer.clientInfo && (rawPlayer.clientInfo.build || rawPlayer.clientInfo.scriptBuild)),
                    120
                ) || (existing && existing.scriptBuild) || "",
                joinedAtMs: sameSession ? existing.joinedAtMs : now,
                lastSeenMs: now,
            };
            presence.set(key, entry);
            const playerChange = rememberKnownPlayer(entry, now);
            if (playerChange) {
                knownPlayersChanged = true;
                if (playerChange === "important") {
                    scheduleGitHubStorageSave("player-metadata", 5_000);
                } else if (playerChange === "timestamp") {
                    scheduleGitHubStorageSave("player-last-seen", 10 * 60_000);
                }
            }
        }

        if (knownPlayersChanged) {
            saveKnownPlayers();
        }

        prunePresence();

        if (!normalized.batch && blockedUserIds.length > 0) {
            const userId = blockedUserIds[0];
            const ban = bans.get(userId);

            sendJson(res, 403, {
                success: false,
                banned: true,
                userId,
                reason:
                    (ban && ban.reason) ||
                    "Vom Nexu-Menü ausgeschlossen",
            });
            return;
        }

        const selfUserId = cleanNumericId(body.userId);
        const selfRole = selfUserId ? getNexuRoleInfo(selfUserId) : null;
        const selfSessionId = cleanText(body.sessionId, 100);
        const activePlayerCount = countActivePresenceUsers();
        console.log(
            `[NEXU] Heartbeat: ${selfUserId || "unbekannt"}, ` +
                `Session ${selfSessionId || "ohne-id"}, ` +
                `${activePlayerCount} Spieler / ${presence.size} Sessions aktiv`
        );
        const shutdown = selfUserId
            ? getShutdownCommandForClient(selfUserId, selfSessionId)
            : { active: false };
        sendJson(res, 200, {
            success: true,
            activePlayers: activePlayerCount,
            activeSessions: presence.size,
            receivedPlayers: currentKeys.size,
            blockedUserIds,
            roleKey: selfRole ? selfRole.key : "",
            roleTitle: selfRole ? selfRole.title : "",
            permissions: selfUserId ? {
                bring: canUseNexuBringRole(selfUserId),
                menuCreator: selfRole && selfRole.key === "creator",
            } : {},
            shutdown,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const status = error.message === "BODY_TOO_LARGE" ? 413 : 400;
        sendJson(res, status, {
            success: false,
            error:
                error.message === "BODY_TOO_LARGE"
                    ? "Anfrage zu groß"
                    : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/presence/offline") {
    if (!isHeartbeatAuthorized(req)) {
        sendJson(res, 401, {
            success: false,
            error: "Ungültiger Heartbeat-Token",
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const sessionId = cleanText(body.sessionId, 100);
        const username = cleanText(body.username, 40);
        const displayName = cleanText(body.displayName, 80);
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of presence) {
            if (
                entry.userId === userId &&
                (!sessionId || !entry.sessionId || entry.sessionId === sessionId)
            ) {
                presence.delete(key);
                removed += 1;
            }
        }

        if (markKnownPlayerOffline(userId, sessionId, now, { username, displayName })) {
            saveKnownPlayers(false);
            scheduleGitHubStorageSave("player-offline", 20_000);
        }

        sendJson(res, 200, { success: true, removed });
    } catch {
        sendJson(res, 400, {
            success: false,
            error: "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/dm/broadcast") {
    const broadcastSession = getDashboardSession(req);
    if (
        !broadcastSession ||
        (broadcastSession.isOwner !== true &&
            !hasDashboardPermission(broadcastSession.account, "dm"))
    ) {
        sendJson(res, 403, {
            success:false,
            error:dashboardPermissionError("dm"),
            sessionActive:Boolean(broadcastSession),
            ownerSession:Boolean(broadcastSession && broadcastSession.isOwner === true),
        });
        return;
    }
    if (!allowDirectMessageSend(req)) {
        sendJson(res, 429, {success:false, error:"Zu viele Nachrichten. Bitte kurz warten."});
        return;
    }
    try {
        const body = await readJsonBody(req);
        const message = cleanText(body.message, DM_MAX_LENGTH);
        if (!message) {
            sendJson(res, 400, {success:false, error:"Nachricht fehlt"});
            return;
        }

        prunePresence();
        const latestActiveByUserId = new Map();
        for (const entry of presence.values()) {
            const userId = cleanNumericId(entry && entry.userId);
            if (!userId || bans.has(userId)) continue;
            const current = latestActiveByUserId.get(userId);
            if (!current || Number(entry.lastSeenMs || 0) > Number(current.lastSeenMs || 0)) {
                latestActiveByUserId.set(userId, entry);
            }
        }

        if (latestActiveByUserId.size === 0) {
            sendJson(res, 409, {success:false, error:"Aktuell ist kein Spieler mit Nexu verbunden."});
            return;
        }

        const queued = [];
        for (const userId of latestActiveByUserId.keys()) {
            const directMessage = queueDirectMessage(userId, message, "NEXU");
            queued.push({userId, id:directMessage.id});
        }
        console.log(`[NEXU] RUNDSENDUNG an ${queued.length} aktive Spieler: ${message.slice(0, 60)}`);
        sendJson(res, 200, {
            success:true,
            queued:true,
            targetedPlayers:queued.length,
            message,
            sentAt:new Date().toISOString(),
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success:false,
            error:error.message === "BODY_TOO_LARGE" ? "Anfrage zu groß" : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/dm/send") {
    if (!isDashboardPermissionSession(req, "dm")) {
        sendJson(res, 403, {success: false, error: dashboardPermissionError("dm")});
        return;
    }
    if (!allowDirectMessageSend(req)) {
        sendJson(res, 429, {
            success: false,
            error: "Zu viele Nachrichten. Bitte kurz warten.",
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const message = cleanText(body.message, DM_MAX_LENGTH);

        if (!userId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige User-ID",
            });
            return;
        }

        if (!message) {
            sendJson(res, 400, {
                success: false,
                error: "Nachricht fehlt",
            });
            return;
        }

        if (bans.has(userId)) {
            sendJson(res, 409, {
                success: false,
                error: "Der Spieler ist vom Menü gebannt.",
            });
            return;
        }

        const live = findLatestPresenceForUser(userId);
        if (!live) {
            sendJson(res, 409, {
                success: false,
                error: "Der Spieler ist nicht mehr mit Nexu verbunden.",
            });
            return;
        }

        const directMessage = queueDirectMessage(userId, message, "NEXU");
        console.log(`[NEXU] DM an ${userId}: ${message.slice(0, 60)}`);

        sendJson(res, 200, {
            success: true,
            queued: true,
            directMessage: {
                id: directMessage.id,
                userId: directMessage.userId,
                message: directMessage.message,
                sentAt: directMessage.sentAt,
            },
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error:
                error.message === "BODY_TOO_LARGE"
                    ? "Anfrage zu groß"
                    : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/dm/poll") {
    if (!isHeartbeatAuthorized(req)) {
        sendJson(res, 401, {
            success: false,
            error: "Ungültiger Heartbeat-Token",
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);

        if (!userId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige User-ID",
            });
            return;
        }

        sendJson(res, 200, {
            success: true,
            messages: takeDirectMessages(userId),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error:
                error.message === "BODY_TOO_LARGE"
                    ? "Anfrage zu groß"
                    : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/admin/role") {
    if (!isDashboardPermissionSession(req, "managePlayerRoles")) {
        sendJson(res, 403, {
            success: false,
            error: dashboardPermissionError("managePlayerRoles"),
        });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const roleKey = cleanPlayerRoleAssignment(body.role || body.roleKey);

        if (!userId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige User-ID",
            });
            return;
        }

        if (!roleKey) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültiger Rang. Erlaubt: players oder supporter",
            });
            return;
        }

        if (userId === MENU_CREATOR_USER_ID) {
            sendJson(res, 409, {
                success: false,
                error: "Der Menu Creator Rang ist fest und kann hier nicht geändert werden.",
            });
            return;
        }

        const existing = knownPlayers.get(userId);
        if (!existing) {
            sendJson(res, 404, {
                success: false,
                error: "Spieler ist noch nicht gespeichert.",
            });
            return;
        }

        const next = {
            ...existing,
            roleKey,
        };
        knownPlayers.set(userId, next);
        const persisted = saveKnownPlayers(false);
        scheduleGitHubStorageSave("player-role", 2_500);
        const role = getNexuRoleInfo(userId);

        console.log(`[NEXU] RANG ${userId} -> ${role.key}`);

        sendJson(res, 200, {
            success: true,
            persisted,
            userId,
            roleKey: role.key,
            roleTitle: role.title,
            permissions: {
                bring: canUseNexuBringRole(userId),
                menuCreator: role.key === "creator",
            },
        });
    } catch (error) {
        sendJson(
            res,
            error.message === "BODY_TOO_LARGE" ? 413 : 400,
            {
                success: false,
                error:
                    error.message === "BODY_TOO_LARGE"
                        ? "Anfrage zu groß"
                        : "Rang konnte nicht gespeichert werden",
            }
        );
    }
    return;
}

if (req.method === "GET" && pathname === "/api/admin/bans") {
    if (!isDashboardPermissionSession(req, "banPlayers")) {
        sendJson(res, 403, {success: false, error: dashboardPermissionError("banPlayers")});
        return;
    }
    sendJson(res, 200, {
        success: true,
        bans: [...bans.values()],
    });
    return;
}

if (req.method === "POST" && pathname === "/api/admin/ban") {
    if (!isDashboardPermissionSession(req, "banPlayers")) {
        sendJson(res, 403, {success: false, error: dashboardPermissionError("banPlayers")});
        return;
    }
    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);

        if (!userId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige User-ID",
            });
            return;
        }

        if (userId === MENU_CREATOR_USER_ID) {
            sendJson(res, 403, {
                success: false,
                error: "Der Menu Creator kann nicht gebannt werden",
            });
            return;
        }

        const live = findLatestPresenceForUser(userId);
        const existing = bans.get(userId);
        const record = {
            userId,
            username:
                cleanText(body.username, 40) ||
                (live && live.username) ||
                (existing && existing.username) ||
                `User${userId}`,
            displayName:
                cleanText(body.displayName, 80) ||
                (live && live.displayName) ||
                (existing && existing.displayName) ||
                `User ${userId}`,
            reason:
                cleanText(body.reason, 240) ||
                "Vom Nexu-Menü ausgeschlossen",
            bannedAt: new Date().toISOString(),
            bannedBy: "dashboard",
        };

        bans.set(userId, record);
        const removedPresence = removePresenceForUser(userId);
        directMessages.delete(userId);
        const persisted = saveBans();

        console.log(
            `[NEXU] BAN ${userId}; Presence entfernt: ${removedPresence}`
        );

        sendJson(res, 200, {
            success: true,
            banned: true,
            record,
            removedPresence,
            persisted,
        });
    } catch (error) {
        sendJson(
            res,
            error.message === "BODY_TOO_LARGE" ? 413 : 400,
            {
                success: false,
                error:
                    error.message === "BODY_TOO_LARGE"
                        ? "Anfrage zu groß"
                        : "Ungültiges JSON",
            }
        );
    }
    return;
}

if (req.method === "POST" && pathname === "/api/admin/unban") {
    if (!isDashboardPermissionSession(req, "banPlayers")) {
        sendJson(res, 403, {success: false, error: dashboardPermissionError("banPlayers")});
        return;
    }
    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);

        if (!userId) {
            sendJson(res, 400, {
                success: false,
                error: "Ungültige User-ID",
            });
            return;
        }

        const existed = bans.delete(userId);
        const persisted = saveBans();

        console.log(`[NEXU] UNBAN ${userId}; vorhanden: ${existed}`);

        sendJson(res, 200, {
            success: true,
            banned: false,
            existed,
            persisted,
        });
    } catch (error) {
        sendJson(
            res,
            error.message === "BODY_TOO_LARGE" ? 413 : 400,
            {
                success: false,
                error:
                    error.message === "BODY_TOO_LARGE"
                        ? "Anfrage zu groß"
                        : "Ungültiges JSON",
            }
        );
    }
    return;
}

sendJson(res, 404, {
    success: false,
    error: "Route nicht gefunden",
});

});

setInterval(() => {prunePresence();pruneDirectMessages();pruneDashboardAuth();pruneShutdownCommands();}, 20_000).unref();

async function flushGitHubStorageBeforeExit() {
    if (!githubStorageReady || !githubStorageDirty || !isGitHubStorageConfigured()) return;
    if (githubStorageTimer) {
        clearTimeout(githubStorageTimer);
        githubStorageTimer = null;
        githubStorageDueAtMs = 0;
    }
    await writeGitHubStorageNow();
}

async function startNexuServer() {
    await githubStorageStartupPromise;

    server.listen(PORT, "0.0.0.0", () => {
        console.log("========================================");
        console.log("NEXU PRESENCE & MODERATION V147 GESTARTET");
        console.log("Port:", PORT);
        console.log("Heartbeat-Schutz:", HEARTBEAT_TOKEN ? "AKTIV" : "AUS (Kompatibilitätsmodus)");
        console.log("Ban-Datei:", BAN_FILE_PATH);
        console.log("Spieler-Speicher:", KNOWN_PLAYERS_FILE_PATH);
        console.log("GitHub-Speicher:", isGitHubStorageConfigured() ? "AKTIV" : "NICHT KONFIGURIERT");
        console.log("GitHub-Datendatei:", `${GITHUB_DATA_OWNER}/${GITHUB_DATA_REPO}/${GITHUB_DATA_PATH}`);
        console.log("Dashboard-Anmeldung: /");
        console.log("Dashboard-Accounts:", dashboardAccounts.size);
        console.log("Owner-Account vorhanden:", getOwnerDashboardAccount() ? "JA" : "NEIN");console.log("Owner-Rundsendung:", getOwnerDashboardAccount() && hasDashboardPermission(getOwnerDashboardAccount(), "dm") ? "FREIGEGEBEN" : "NICHT FREIGEGEBEN");console.log("Owner-Session-Fix:", "V147 AKTIV");
        console.log("Presence: /api/presence");
        console.log("Aktive-Script-Timeout:", Math.round(ONLINE_TIMEOUT_MS / 1000), "Sekunden");
        console.log("Presence-Neustart-Schutz:", Math.round(PRESENCE_RESTART_GRACE_MS / 1000), "Sekunden");
        console.log("Direct Messages: /api/dm/send + /api/dm/broadcast + /api/dm/poll");
        console.log("Website Join: /api/join/send + /api/join/poll");
        console.log("Access: /api/menu/access?userId=...");
        console.log("Script-Update-Datei:", MENU_UPDATE_FILE_PATH);
        console.log("Script-Update:", getMenuUpdateStatus().active ? "AKTIV" : "INAKTIV");
        console.log("Globales Deaktivieren: /api/admin/shutdown/all");console.log("Owner-Session-Fix: V148 SIGNIERT UND NEUSTARTFEST");
        console.log("========================================");
    });
}

startNexuServer().catch((error) => {
    console.error("[NEXU] Serverstart fehlgeschlagen:", error);
    process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
        Promise.race([
            flushGitHubStorageBeforeExit(),
            new Promise((resolve) => setTimeout(resolve, 4_000)),
        ]).finally(() => process.exit(0));
    });
}
