const http = require("node:http");const fs = require("node:fs");const path = require("node:path");const crypto = require("node:crypto");
// V148: Neustartfeste, signierte Dashboard-Sitzungen und stabiler Owner-Rundsendungszugriff.
// V150: Website und Lua-Menü verwenden dieselbe autoritative Active-Presence-Liste.
// V152: Stabile Online-Anzeige mit Heartbeat-Toleranz und ohne falschen Nullstand bei einzelnen Dashboard-Fehlern.
// V168: Rollenänderungen invalidieren Presence-Snapshots sofort, damit Ingame-Banner Rangfarben live übernehmen.
// V172: Ingame-Ban/Unban über eine aktive Menu-Creator-Sitzung oder optionalen Admin-Key.
// V153: Autoritative Lease-Presence, revisionsbasierte Aktualisierung und keine nutzlosen Player-Speichercommits.
// V154: Live-Presence vollständig vom persistenten Speicher getrennt; GitHub-Schreibschutz und Inhalts-Deduplizierung.
// V162: Persistenter globaler Menüstatus ONLINE/OFFLINE mit sofortiger Sperre aller Lua-Clients.
// V163: Eigene Nexu-Bestätigungsdialoge und Toast-Benachrichtigungen statt Browser-Popups.
// V164: Separate, verschlüsselte GitHub-Accountdatei mit vollständigen Berechtigungen und Change-only-Speicherung.

const PORT = Number(process.env.PORT || 3000);const HEARTBEAT_TOKEN = String(process.env.HEARTBEAT_TOKEN || "");const NEXU_INGAME_ADMIN_KEY = String(process.env.NEXU_INGAME_ADMIN_KEY || process.env.NEXU_ADMIN_KEY || "");const ONLINE_TIMEOUT_MS = (() => {const configured = Number(process.env.PRESENCE_TIMEOUT_MS || 2 * 60_000);return Number.isFinite(configured) ? Math.min(10 * 60_000, Math.max(60_000, Math.floor(configured))) : 2 * 60_000;})();const ACTIVE_PRESENCE_WINDOW_MS = (() => {const configured = Number(process.env.ACTIVE_PRESENCE_WINDOW_MS || 120_000);return Number.isFinite(configured) ? Math.min(5 * 60_000, Math.max(120_000, Math.floor(configured))) : 120_000;})();const PRESENCE_ENTRY_RETENTION_MS = Math.max(ONLINE_TIMEOUT_MS, ACTIVE_PRESENCE_WINDOW_MS + 30_000);const SERVER_STARTED_AT_MS = Date.now();const SERVER_INSTANCE_ID = crypto.randomUUID();const PRESENCE_RESTART_GRACE_MS = 25_000;const PRESENCE_RESTORE_WINDOW_MS = Math.max(PRESENCE_ENTRY_RETENTION_MS, 5 * 60_000);const MAX_BODY_BYTES = 100_000;const AVATAR_CACHE_MS = 10 * 60_000;const GLOBAL_SHUTDOWN_COMMAND_TTL_MS = 5 * 60_000;const NEXU_LOADER_COMMAND = 'loadstring(game:HttpGet("https://raw.githubusercontent.com/niklasrl720-bit/Nexu-Menu/refs/heads/main/Nexu%20Main"))()';const MAX_MENU_UPDATE_MINUTES = 24 * 60;const MENU_CREATOR_USER_ID = "10199760908";const MENU_CREATOR_RANK_ENABLED = true;const DEFAULT_SUPPORTER_USER_IDS = new Set(["11203703629"]);const PLAYER_ROLE_KEYS = new Set(["player", "supporter"]);const PLAYER_ROLE_TITLES = {player: "PLAYERS", supporter: "SUPPORTER"};const BRING_COMMAND_TTL_MS = 2 * 60_000;const DM_MAX_LENGTH = 240;const DM_TTL_MS = 10 * 60_000;const DM_QUEUE_LIMIT = 12;const DM_RATE_WINDOW_MS = 30_000;const DM_RATE_LIMIT = 10;const OWNER_ACCOUNT_USERNAME = "OwnerAccount";const DASHBOARD_DEFAULT_USERNAME = String(process.env.DASHBOARD_USERNAME || OWNER_ACCOUNT_USERNAME);const DASHBOARD_DEFAULT_EMAIL = String(process.env.DASHBOARD_EMAIL || "owner@nexu.local");const DASHBOARD_DEFAULT_PASSWORD_HASH = String(process.env.DASHBOARD_PASSWORD_HASH ||"df3b0f6227afa43d620dc1c5c639dab7036878674a3c7e699c9583be6425f2d8").toLowerCase();const DASHBOARD_SESSION_COOKIE = "nexu_dashboard_session";const DASHBOARD_REMEMBER_COOKIE = "nexu_dashboard_remember";const DASHBOARD_SESSION_TTL_MS = 12 * 60 * 60_000;const DASHBOARD_REMEMBER_TTL_MS = 30 * 24 * 60 * 60_000;const LOGIN_RATE_WINDOW_MS = 10 * 60_000;const LOGIN_RATE_LIMIT = 8;const JOIN_COMMAND_TTL_MS = 2 * 60_000;const BAN_FILE_PATH = String(process.env.BAN_FILE_PATH || path.join(process.cwd(), "data", "nexu-bans.json"));const REMEMBER_FILE_PATH = String(process.env.REMEMBER_FILE_PATH ||path.join(path.dirname(BAN_FILE_PATH), "nexu-remembered-accounts.json"));const KNOWN_PLAYERS_FILE_PATH = String(process.env.KNOWN_PLAYERS_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-known-players.json"));const DASHBOARD_ACCOUNT_FILE_PATH = String(process.env.DASHBOARD_ACCOUNT_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-dashboard-account.json"));const MENU_UPDATE_FILE_PATH = String(process.env.MENU_UPDATE_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-menu-update.json"));const MENU_STATUS_FILE_PATH = String(process.env.MENU_STATUS_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-menu-status.json"));

const GITHUB_DATA_TOKEN = String(process.env.GITHUB_DATA_TOKEN || "").trim();
const GITHUB_DATA_OWNER = String(process.env.GITHUB_DATA_OWNER || "").trim();
const GITHUB_DATA_REPO = String(process.env.GITHUB_DATA_REPO || "").trim();
const GITHUB_DATA_BRANCH = String(process.env.GITHUB_DATA_BRANCH || "main").trim() || "main";
const GITHUB_DATA_PATH = String(process.env.GITHUB_DATA_PATH || "data/nexu-storage.json").trim() || "data/nexu-storage.json";
const GITHUB_ACCOUNTS_PATH = String(process.env.GITHUB_ACCOUNTS_PATH || "data/nexu-accounts.json").trim() || "data/nexu-accounts.json";
const GITHUB_STORAGE_API_VERSION = "2022-11-28";
const GITHUB_STORAGE_USER_AGENT = "Nexu-Presence-Storage/1.0";
const GITHUB_STORAGE_DEFAULT_DELAY_MS = 12_000;
const GITHUB_DATA_IS_DEPLOY_BRANCH = /^(main|master)$/i.test(GITHUB_DATA_BRANCH);
const GITHUB_STORAGE_WRITES_ALLOWED = !GITHUB_DATA_IS_DEPLOY_BRANCH;
const GITHUB_ACCOUNT_WRITES_ON_DEPLOY_BRANCH = String(process.env.GITHUB_ACCOUNT_WRITES_ON_DEPLOY_BRANCH || "true").trim().toLowerCase() !== "false";
const GITHUB_ACCOUNTS_WRITES_ALLOWED = !GITHUB_DATA_IS_DEPLOY_BRANCH || GITHUB_ACCOUNT_WRITES_ON_DEPLOY_BRANCH;
const GITHUB_PLAYER_AUTOSAVE_ENABLED = GITHUB_STORAGE_WRITES_ALLOWED;
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
const DASHBOARD_ACCOUNT_STORAGE_SECRET = String(process.env.DASHBOARD_ACCOUNT_STORAGE_SECRET || "").trim() || DASHBOARD_SESSION_SIGNING_SECRET;

const presence = new Map();const knownPlayers = new Map();const dashboardAccounts = new Map();const bans = new Map();const avatarCache = new Map();const directMessages = new Map();const dmRateLimits = new Map();const dashboardSessions = new Map();const rememberedDashboardDevices = new Map();const loginRateLimits = new Map();const joinCommands = new Map();const bringCommands = new Map();const shutdownCommandsBySession = new Map();const shutdownCommandsByUser = new Map();let nextDirectMessageId = 1;let nextJoinCommandId = 1;let nextBringCommandId = 1;let nextShutdownCommandId = 1;let menuUpdateMutationRevision = 0;let menuUpdateState = {active:false,startedAtMs:0,endsAtMs:0,durationMinutes:0,startedBy:"",startedAt:"",endsAt:""};let menuAvailabilityState = {online:true,changedAtMs:0,changedAt:"",changedBy:""};let githubStorageSha = "";let githubStorageReady = false;let githubStorageDirty = false;let githubStorageTimer = null;let githubStorageDueAtMs = 0;let githubStorageWriteChain = Promise.resolve();const githubStorageReasons = new Set();
let latestGlobalShutdownCommand = null;
let presenceRevision = 1;
let presenceSnapshotSignature = "";
let githubStorageContentFingerprint = "";
let githubDeployBranchWarningShown = false;
let knownPlayersDiskFingerprint = "";
let dashboardAccountsDiskFingerprint = "";
let githubAccountsSha = "";
let githubAccountsReady = false;
let githubAccountsDirty = false;
let githubAccountsTimer = null;
let githubAccountsDueAtMs = 0;
let githubAccountsWriteChain = Promise.resolve();
let githubAccountsContentFingerprint = "";
let githubAccountsBranchWarningShown = false;
const githubAccountsReasons = new Set();

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

function isGitHubAccountsConfigured() {
    return Boolean(
        GITHUB_DATA_TOKEN &&
        GITHUB_DATA_OWNER &&
        GITHUB_DATA_REPO &&
        GITHUB_DATA_BRANCH &&
        GITHUB_ACCOUNTS_PATH
    );
}

function githubFileEndpoint(storagePath) {
    const encodedPath = String(storagePath || "")
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
    return `https://api.github.com/repos/${encodeURIComponent(GITHUB_DATA_OWNER)}/${encodeURIComponent(GITHUB_DATA_REPO)}/contents/${encodedPath}`;
}

function githubAccountsEndpoint() {
    return githubFileEndpoint(GITHUB_ACCOUNTS_PATH);
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

function serializePersistentKnownPlayer(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const userId = cleanNumericId(source.userId);
    if (!userId) return null;
    const firstSeenMs = cleanInteger(source.firstSeenMs) || Date.now();
    return {
        userId,
        username: cleanText(source.username, 40) || `User${userId}`,
        displayName: cleanText(source.displayName, 80) || cleanText(source.username, 40) || `User ${userId}`,
        roleKey: cleanPlayerRoleAssignment(source.roleKey || source.role || source.assignedRole),
        firstSeen: cleanText(source.firstSeen, 64) || new Date(firstSeenMs).toISOString(),
        firstSeenMs,
    };
}

function buildPersistentMenuUpdateState(raw = menuUpdateState) {
    const normalized = normalizeMenuUpdateState(raw || {});
    return {
        active: normalized.active === true,
        startedAtMs: cleanInteger(normalized.startedAtMs),
        endsAtMs: cleanInteger(normalized.endsAtMs),
        durationMinutes: cleanInteger(normalized.durationMinutes),
        startedBy: cleanText(normalized.startedBy, 80),
        startedAt: cleanText(normalized.startedAt, 64),
        endsAt: cleanText(normalized.endsAt, 64),
    };
}

function normalizeMenuAvailabilityState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const online = source.online !== false;
    const changedAtMs = cleanInteger(source.changedAtMs);
    return {
        online,
        changedAtMs,
        changedAt: cleanText(source.changedAt, 64) || (changedAtMs ? new Date(changedAtMs).toISOString() : ""),
        changedBy: cleanText(source.changedBy, 80),
    };
}

function buildPersistentMenuAvailabilityState(raw = menuAvailabilityState) {
    const normalized = normalizeMenuAvailabilityState(raw || {});
    return {
        online: normalized.online === true,
        changedAtMs: cleanInteger(normalized.changedAtMs),
        changedAt: cleanText(normalized.changedAt, 64),
        changedBy: cleanText(normalized.changedBy, 80),
    };
}

function normalizeGitHubStorageCore(payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const players = [];
    for (const raw of Array.isArray(source.players) ? source.players : []) {
        const entry = serializePersistentKnownPlayer(raw);
        if (entry) players.push(entry);
    }
    players.sort((a, b) => String(a.userId).localeCompare(String(b.userId)));

    const normalizedBans = [];
    for (const raw of Array.isArray(source.bans) ? source.bans : []) {
        const entry = normalizeStoredBan(raw);
        if (entry) normalizedBans.push(entry);
    }
    normalizedBans.sort((a, b) => String(a.userId).localeCompare(String(b.userId)));

    return {
        version: 3,
        players,
        bans: normalizedBans,
        updateState: buildPersistentMenuUpdateState(source.updateState || source.update || {}),
        menuStatus: buildPersistentMenuAvailabilityState(source.menuStatus || source.menuAvailability || {}),
    };
}

function buildGitHubStorageCore() {
    return normalizeGitHubStorageCore({
        players: [...knownPlayers.values()],
        bans: [...bans.values()],
        updateState: menuUpdateState,
        menuStatus: menuAvailabilityState,
    });
}

function storageFingerprint(core) {
    return crypto.createHash("sha256").update(JSON.stringify(core), "utf8").digest("hex");
}

function buildGitHubStorageSnapshot(core = buildGitHubStorageCore()) {
    return {
        ...core,
        updatedAt: new Date().toISOString(),
    };
}

function applyGitHubStorageSnapshot(payload) {
    const core = normalizeGitHubStorageCore(payload);

    // Gespeicherte Spieler werden nur zusammengeführt. Eine fehlende oder leere
    // Remote-Datei darf niemals bereits bekannte Spieler löschen.
    for (const raw of core.players) {
        const playerEntry = normalizeKnownPlayer(raw);
        if (!playerEntry) continue;
        const existing = knownPlayers.get(playerEntry.userId);
        knownPlayers.set(playerEntry.userId, existing ? {
            ...existing,
            username: playerEntry.username || existing.username,
            displayName: playerEntry.displayName || existing.displayName,
            roleKey: playerEntry.roleKey || existing.roleKey || "",
            firstSeen: existing.firstSeen || playerEntry.firstSeen,
            firstSeenMs: existing.firstSeenMs || playerEntry.firstSeenMs,
        } : playerEntry);
    }

    if (Array.isArray(payload && payload.bans)) {
        bans.clear();
        for (const raw of core.bans) bans.set(raw.userId, raw);
    }

    if (payload && typeof (payload.updateState || payload.update) === "object") {
        menuUpdateState = normalizeMenuUpdateState(payload.updateState || payload.update || {});
    }

    if (payload && typeof (payload.menuStatus || payload.menuAvailability) === "object") {
        menuAvailabilityState = normalizeMenuAvailabilityState(payload.menuStatus || payload.menuAvailability || {});
    }

    return core;
}

async function fetchGitHubStorageFile() {
    const endpoint = `${githubStorageEndpoint()}?ref=${encodeURIComponent(GITHUB_DATA_BRANCH)}`;
    const response = await fetch(endpoint, {
        method: "GET",
        headers: githubStorageHeaders(),
    });

    if (response.status === 404) {
        return { exists: false, sha: "", payload: null };
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
        githubStorageContentFingerprint = storageFingerprint(buildGitHubStorageCore());
        return false;
    }

    try {
        const remote = await fetchGitHubStorageFile();
        githubStorageSha = remote.sha || "";
        let remoteCore = null;

        if (remote.exists && remote.payload && typeof remote.payload === "object") {
            remoteCore = applyGitHubStorageSnapshot(remote.payload);
        }

        githubStorageReady = true;
        saveKnownPlayers(false);
        saveBans(false);
        saveMenuUpdateState(false);
        saveMenuAvailabilityState(false);

        const currentCore = buildGitHubStorageCore();
        const currentFingerprint = storageFingerprint(currentCore);
        githubStorageContentFingerprint = remoteCore ? storageFingerprint(remoteCore) : "";

        console.log(
            `[NEXU] GitHub-Speicher geladen: ${knownPlayers.size} Spieler, ` +
            `${bans.size} Bans, Update ${menuUpdateState.active ? "AKTIV" : "INAKTIV"}, Menü ${menuAvailabilityState.online ? "ONLINE" : "OFFLINE"}`
        );

        if (!remote.exists) {
            if (GITHUB_STORAGE_WRITES_ALLOWED) scheduleGitHubStorageSave("initial-create", 1_000);
        } else if (
            GITHUB_STORAGE_WRITES_ALLOWED &&
            githubStorageContentFingerprint !== currentFingerprint
        ) {
            scheduleGitHubStorageSave("startup-merge", 5_000);
        }

        if (!GITHUB_STORAGE_WRITES_ALLOWED) {
            console.warn(
                `[NEXU] GitHub-Schreibzugriff ist auf Branch "${GITHUB_DATA_BRANCH}" vollständig gesperrt. ` +
                `Nutze GITHUB_DATA_BRANCH=nexu-data, damit Datenänderungen keine Render-Deploys auslösen.`
            );
        }
        return true;
    } catch (error) {
        githubStorageReady = true;
        githubStorageContentFingerprint = storageFingerprint(buildGitHubStorageCore());
        console.warn("[NEXU] GitHub-Speicher konnte nicht geladen werden:", error.message);
        return false;
    }
}

async function writeGitHubStorageNow() {
    if (
        !githubStorageReady ||
        !isGitHubStorageConfigured() ||
        !GITHUB_STORAGE_WRITES_ALLOWED ||
        !githubStorageDirty
    ) {
        return false;
    }

    const core = buildGitHubStorageCore();
    const nextFingerprint = storageFingerprint(core);
    if (nextFingerprint === githubStorageContentFingerprint) {
        githubStorageReasons.clear();
        githubStorageDirty = false;
        return false;
    }

    const snapshot = buildGitHubStorageSnapshot(core);
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

        githubStorageSha = cleanText(payload && payload.content && payload.content.sha, 100) || githubStorageSha;
        githubStorageContentFingerprint = nextFingerprint;
        console.log(`[NEXU] GitHub-Speicher geändert (${knownPlayers.size} Spieler, ${bans.size} Bans).`);
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
    if (!GITHUB_STORAGE_WRITES_ALLOWED) {
        if (!githubDeployBranchWarningShown) {
            githubDeployBranchWarningShown = true;
            console.warn(
                `[NEXU] Kein GitHub-Schreiben auf Deploy-Branch "${GITHUB_DATA_BRANCH}". ` +
                `Setze GITHUB_DATA_BRANCH=nexu-data.`
            );
        }
        return false;
    }

    githubStorageDirty = true;
    githubStorageReasons.add(cleanText(reason, 80) || "change");

    const safeDelay = Math.max(500, Math.min(10 * 60_000, Number(delayMs) || GITHUB_STORAGE_DEFAULT_DELAY_MS));
    const desiredDueAt = Date.now() + safeDelay;

    if (githubStorageTimer && githubStorageDueAtMs <= desiredDueAt) return true;
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

function isPresenceEntryActive(entry, now = Date.now()) {return Boolean(entry && entry.userId && !bans.has(entry.userId) && Number.isFinite(Number(entry.lastSeenMs)) && now - Number(entry.lastSeenMs) <= ACTIVE_PRESENCE_WINDOW_MS);}

function getLatestActivePresenceByUser(now = Date.now()) {
    const latestByUserId = new Map();
    for (const row of presence.values()) {
        if (!isPresenceEntryActive(row, now)) continue;
        const current = latestByUserId.get(row.userId);
        const rowStarted = Number(row.joinedAtMs) || 0;
        const currentStarted = Number(current && current.joinedAtMs) || 0;
        if (
            !current ||
            rowStarted > currentStarted ||
            (rowStarted === currentStarted && String(row.sessionId).localeCompare(String(current.sessionId)) > 0)
        ) {
            latestByUserId.set(row.userId, row);
        }
    }
    return latestByUserId;
}

function buildPresenceSnapshotSignature(now = Date.now()) {
    const rows = [...getLatestActivePresenceByUser(now).values()]
        .sort((a, b) => String(a.userId).localeCompare(String(b.userId)))
        .map((row) => [
            row.userId,
            row.username,
            row.displayName,
            row.placeId,
            row.jobId,
            row.gameName,
            row.scriptBuild,
            getNexuRoleInfo(row.userId).key,
        ].map((value) => String(value ?? "")).join("|"))
        .join("\n");
    return crypto.createHash("sha1").update(rows, "utf8").digest("hex");
}

function syncPresenceRevision(now = Date.now()) {
    const nextSignature = buildPresenceSnapshotSignature(now);
    if (nextSignature !== presenceSnapshotSignature) {
        presenceSnapshotSignature = nextSignature;
        presenceRevision += 1;
        return true;
    }
    return false;
}

function getPresenceSnapshotToken() {
    return `${SERVER_INSTANCE_ID}:${presenceRevision}`;
}

function prunePresence() {const now = Date.now();

for (const [key, entry] of presence) {
    const expired = now - entry.lastSeenMs > PRESENCE_ENTRY_RETENTION_MS;
    const banned = bans.has(entry.userId);

    if (expired || banned) {
        presence.delete(key);
    }
}

syncPresenceRevision(now);

}

function removePresenceForUser(userId) {let removed = 0;

for (const [key, entry] of presence) {
    if (entry.userId === userId) {
        presence.delete(key);
        removed += 1;
    }
}

if (removed > 0) syncPresenceRevision();
return removed;

}

function findLatestPresenceForUser(userId) {return getLatestActivePresenceByUser(Date.now()).get(userId) || null;}

function restoreRecentPresenceFromKnownPlayers() {
    // Gespeicherte Spieler sind Historie und werden niemals als live rekonstruiert.
    return 0;
}

function countActivePresenceUsers() {
    prunePresence();
    return getLatestActivePresenceByUser(Date.now()).size;
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

function saveMenuAvailabilityState(syncGitHub = true) {
    try {
        fs.mkdirSync(path.dirname(MENU_STATUS_FILE_PATH), { recursive: true });
        const normalized = buildPersistentMenuAvailabilityState(menuAvailabilityState);
        const tempPath = `${MENU_STATUS_FILE_PATH}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify({ menuStatus: normalized }, null, 2), "utf8");
        fs.renameSync(tempPath, MENU_STATUS_FILE_PATH);
        if (syncGitHub) scheduleGitHubStorageSave("menu-status", 1_000);
        return true;
    } catch (error) {
        console.warn("[NEXU] Menüstatus konnte nicht gespeichert werden:", error.message);
        return false;
    }
}

function loadMenuAvailabilityState() {
    try {
        if (!fs.existsSync(MENU_STATUS_FILE_PATH)) {
            menuAvailabilityState = normalizeMenuAvailabilityState({ online: true });
            saveMenuAvailabilityState(false);
            return;
        }
        const parsed = JSON.parse(fs.readFileSync(MENU_STATUS_FILE_PATH, "utf8"));
        menuAvailabilityState = normalizeMenuAvailabilityState(parsed && (parsed.menuStatus || parsed));
        console.log(`[NEXU] Menüstatus: ${menuAvailabilityState.online ? "ONLINE" : "OFFLINE"}`);
    } catch (error) {
        console.warn("[NEXU] Menüstatus konnte nicht geladen werden:", error.message);
        menuAvailabilityState = normalizeMenuAvailabilityState({ online: true });
    }
}

function getMenuAvailabilityStatus() {
    const normalized = normalizeMenuAvailabilityState(menuAvailabilityState);
    return {
        online: normalized.online === true,
        changedAtMs: normalized.changedAtMs || 0,
        changedAt: normalized.changedAt || "",
        changedBy: normalized.changedBy || "",
    };
}

function getMenuOfflineShutdownStatus() {
    const status = getMenuAvailabilityStatus();
    if (status.online) return { active: false };
    return {
        active: true,
        id: `menu-offline-${status.changedAtMs || 0}`,
        mode: "menu_offline",
        global: true,
        issuedAtMs: status.changedAtMs || Date.now(),
        issuedAt: status.changedAt || new Date().toISOString(),
        issuedBy: status.changedBy || "dashboard",
        reason: "menu_offline",
    };
}

function setMenuAvailability(online, changedBy) {
    const nextOnline = online === true;
    const current = getMenuAvailabilityStatus();
    if (current.online === nextOnline) {
        return {
            changed: false,
            persisted: true,
            menuStatus: current,
            targetedPlayers: 0,
            targetedSessions: 0,
        };
    }

    const now = Date.now();
    menuAvailabilityState = {
        online: nextOnline,
        changedAtMs: now,
        changedAt: new Date(now).toISOString(),
        changedBy: cleanText(changedBy, 80) || "dashboard",
    };

    let shutdownResult = { targetedPlayers: 0, targetedSessions: 0 };
    if (!nextOnline) {
        shutdownResult = queueGlobalScriptShutdown(menuAvailabilityState.changedBy);
        if (presence.size > 0) {
            presence.clear();
            syncPresenceRevision(now);
        }
    }

    const persisted = saveMenuAvailabilityState();
    return {
        changed: true,
        persisted,
        menuStatus: getMenuAvailabilityStatus(),
        targetedPlayers: Number(shutdownResult.targetedPlayers) || 0,
        targetedSessions: Number(shutdownResult.targetedSessions) || 0,
    };
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

    if (
        latestGlobalShutdownCommand &&
        latestGlobalShutdownCommand.expiresAtMs <= now
    ) {
        latestGlobalShutdownCommand = null;
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
        if (!isPresenceEntryActive(entry, now)) continue;
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

    // Auch noch nicht vollständig registrierte V149-Clients können anhand ihrer
    // Script-Startzeit erkennen, dass sie bereits vor dem Klick liefen. Eine neu
    // gestartete Ausführung besitzt eine spätere Startzeit und bleibt erlaubt.
    latestGlobalShutdownCommand = {
        ...baseCommand,
        targetedSessions: sessions.size,
        targetedPlayers: users.size,
    };

    // Auf der Website gehen alle aktuell erkannten Script-Sitzungen sofort offline.
    // Die Befehle bleiben separat erhalten und werden den alten Session-IDs beim
    // nächsten Heartbeat bzw. Access-Poll weiterhin zugestellt.
    const forcedOfflineSessions = presence.size;
    presence.clear();

    return {
        id: commandId,
        targetedSessions: sessions.size,
        targetedPlayers: users.size,
        forcedOfflineSessions,
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

function getShutdownCommandForClient(userId, sessionId, sessionStartedAtMs = 0) {
    pruneShutdownCommands();

    const cleanUserId = cleanNumericId(userId);
    const cleanSessionId = cleanText(sessionId, 100);
    const cleanStartedAtMs = cleanInteger(sessionStartedAtMs);

    if (cleanSessionId) {
        const exact = shutdownCommandsBySession.get(cleanSessionId);
        if (exact) return serializeShutdownCommand(exact);
    }

    if (cleanUserId) {
        const userCommand = shutdownCommandsByUser.get(cleanUserId);
        if (userCommand) {
            if (
                cleanSessionId &&
                Array.isArray(userCommand.sessionIds) &&
                userCommand.sessionIds.includes(cleanSessionId)
            ) {
                return serializeShutdownCommand(userCommand);
            }

            // Kompatibilitäts-Fallback für ältere Clients, deren Session-ID erst
            // mit einem verspäteten Heartbeat sichtbar wurde.
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
        }
    }

    // V149-Fallback: Erfasst auch eine Script-Ausführung, die beim Klick gerade
    // noch im Ladeaufbau war und deshalb noch nicht in presence stand. Eine danach
    // manuell neu gestartete Ausführung hat eine spätere Startzeit und wird nicht
    // erneut abgeschaltet.
    if (
        latestGlobalShutdownCommand &&
        cleanStartedAtMs > 0 &&
        cleanStartedAtMs <= latestGlobalShutdownCommand.issuedAtMs
    ) {
        return serializeShutdownCommand(latestGlobalShutdownCommand);
    }

    return { active: false };
}

function normalizeKnownPlayer(raw, now = Date.now()) {const userId = cleanNumericId(raw && raw.userId);if (!userId) {return null;}const firstSeenMs = cleanInteger(raw && raw.firstSeenMs) || now;const lastSeenMs = cleanInteger(raw && raw.lastSeenMs) || firstSeenMs;const roleKey = cleanPlayerRoleAssignment(raw && (raw.roleKey || raw.role || raw.assignedRole));return {userId,username: cleanText(raw && raw.username, 40) || `User${userId}`,displayName: cleanText(raw && raw.displayName, 80) || cleanText(raw && raw.username, 40) || `User ${userId}`,gameName: cleanText(raw && raw.gameName, 120),placeId: cleanInteger(raw && raw.placeId),jobId: cleanText(raw && raw.jobId, 100),sessionId: cleanText(raw && raw.sessionId, 100),executionSource: cleanText(raw && raw.executionSource, 80),executionVersion: cleanText(raw && raw.executionVersion, 80),clientPlatform: cleanText(raw && raw.clientPlatform, 40),scriptBuild: cleanText(raw && raw.scriptBuild, 120),roleKey,firstSeen: cleanText(raw && raw.firstSeen, 64) || new Date(firstSeenMs).toISOString(),lastSeen: cleanText(raw && raw.lastSeen, 64) || new Date(lastSeenMs).toISOString(),firstSeenMs,lastSeenMs,};}

function buildKnownPlayersDiskPayload() {
    const players = [...knownPlayers.values()]
        .map(serializePersistentKnownPlayer)
        .filter(Boolean)
        .sort((a, b) => String(a.userId).localeCompare(String(b.userId)));
    return { version: 2, players };
}

function loadKnownPlayers() {
    try {
        if (!fs.existsSync(KNOWN_PLAYERS_FILE_PATH)) return;
        const parsed = JSON.parse(fs.readFileSync(KNOWN_PLAYERS_FILE_PATH, "utf8"));
        const rows = Array.isArray(parsed) ? parsed : parsed.players;
        if (!Array.isArray(rows)) return;
        for (const raw of rows) {
            const entry = normalizeKnownPlayer(raw);
            if (entry) knownPlayers.set(entry.userId, entry);
        }
        knownPlayersDiskFingerprint = storageFingerprint(buildKnownPlayersDiskPayload());
        console.log(`[NEXU] ${knownPlayers.size} gespeicherte Spieler geladen`);
    } catch (error) {
        console.warn("[NEXU] Gespeicherte Spieler konnten nicht geladen werden:", error.message);
    }
}

function saveKnownPlayers(syncGitHub = false) {
    try {
        const payload = buildKnownPlayersDiskPayload();
        const nextFingerprint = storageFingerprint(payload);
        if (nextFingerprint === knownPlayersDiskFingerprint) {
            if (syncGitHub) scheduleGitHubStorageSave("players", 5_000);
            return true;
        }
        fs.mkdirSync(path.dirname(KNOWN_PLAYERS_FILE_PATH), { recursive: true });
        const tempPath = `${KNOWN_PLAYERS_FILE_PATH}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
        fs.renameSync(tempPath, KNOWN_PLAYERS_FILE_PATH);
        knownPlayersDiskFingerprint = nextFingerprint;
        if (syncGitHub) scheduleGitHubStorageSave("players", 5_000);
        return true;
    } catch (error) {
        console.warn("[NEXU] Gespeicherte Spieler konnten nicht gespeichert werden:", error.message);
        return false;
    }
}


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
    { key: "menuStatus", formName: "dashboardMenuStatus", title: "Menüstatus umschalten", description: "Darf das Lua-Menü global ONLINE oder OFFLINE schalten." },
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
        menuStatus: isOwner || (dashboardAccess && (enabled(merged.menuStatus) || enabled(merged.dashboardMenuStatus) || enabled(merged.toggleMenuStatus))),
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

function safeSecretEquals(left, right) {
    const a = Buffer.from(String(left || ""));
    const b = Buffer.from(String(right || ""));
    return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isIngameAdminKeyAuthorized(req) {
    if (!NEXU_INGAME_ADMIN_KEY) return false;
    return safeSecretEquals(req.headers["x-nexu-admin-key"], NEXU_INGAME_ADMIN_KEY);
}

function isActiveMenuCreatorModerationSession(req, body) {
    if (!body || typeof body !== "object" || !isHeartbeatAuthorized(req)) return false;

    const actorUserId = cleanNumericId(
        body.actorUserId || body.requesterUserId || body.adminUserId
    );
    const actorSessionId = cleanText(
        body.actorSessionId || body.requesterSessionId || body.adminSessionId,
        100
    );
    const actorJobId = cleanText(body.actorJobId || body.requesterJobId, 100);

    if (actorUserId !== MENU_CREATOR_USER_ID || !actorSessionId) return false;
    if (bans.has(actorUserId)) return false;

    const entry = presence.get(`${actorUserId}:${actorSessionId}`);
    if (!entry) return false;
    if (Date.now() - Number(entry.lastSeenMs || 0) > ACTIVE_PRESENCE_WINDOW_MS) return false;
    if (actorJobId && entry.jobId && actorJobId !== entry.jobId) return false;

    return true;
}

function getBanMutationAuthorization(req, body) {
    if (isDashboardPermissionSession(req, "banPlayers")) {
        return { authorized: true, source: "dashboard" };
    }
    if (isIngameAdminKeyAuthorized(req)) {
        return { authorized: true, source: "ingame-admin-key" };
    }
    if (isActiveMenuCreatorModerationSession(req, body)) {
        return { authorized: true, source: "menu-creator" };
    }
    return { authorized: false, source: "" };
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

    // Migration für ältere Account-Dateien: Owner-Rechte bleiben garantiert erhalten.
    if (ensureDashboardOwnerInMemory()) {
        saveDashboardAccount(false);
    }
    dashboardAccountsDiskFingerprint = storageFingerprint(buildDashboardAccountsCore());
    console.log(`[NEXU] ${dashboardAccounts.size} Dashboard-Account(s) geladen`);
}

function serializeDashboardAccountForStorage(raw) {
    const account = normalizeDashboardAccount(raw || {});
    if (!account) return null;
    const access = {};
    for (const definition of DASHBOARD_PERMISSION_DEFINITIONS) {
        access[definition.key] = account.isOwner === true || account.access[definition.key] === true;
    }
    access.accountManager = account.isOwner === true;
    return {
        username: account.username,
        email: account.email,
        passwordHash: account.passwordHash,
        isOwner: account.isOwner === true,
        access,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
    };
}

function buildDashboardAccountsCore() {
    const accounts = [];
    for (const raw of dashboardAccounts.values()) {
        const account = serializeDashboardAccountForStorage(raw);
        if (account) accounts.push(account);
    }
    accounts.sort((left, right) => {
        const ownerOrder = Number(right.isOwner === true) - Number(left.isOwner === true);
        if (ownerOrder !== 0) return ownerOrder;
        return String(left.username).localeCompare(String(right.username));
    });
    return { version: 1, accounts };
}

function saveDashboardAccount(syncGitHub = true) {
    try {
        const core = buildDashboardAccountsCore();
        const nextFingerprint = storageFingerprint(core);
        if (nextFingerprint !== dashboardAccountsDiskFingerprint) {
            fs.mkdirSync(path.dirname(DASHBOARD_ACCOUNT_FILE_PATH), { recursive: true });
            const tempPath = `${DASHBOARD_ACCOUNT_FILE_PATH}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(core, null, 2), "utf8");
            fs.renameSync(tempPath, DASHBOARD_ACCOUNT_FILE_PATH);
            dashboardAccountsDiskFingerprint = nextFingerprint;
        }
        if (syncGitHub) scheduleGitHubAccountsSave("account-change", 1_500);
        return true;
    } catch (error) {
        console.warn("[NEXU] Dashboard-Accounts konnten nicht gespeichert werden:", error.message);
        return false;
    }
}

function getDashboardAccountsEncryptionKey() {
    return crypto.createHash("sha256").update(DASHBOARD_ACCOUNT_STORAGE_SECRET, "utf8").digest();
}

function encryptDashboardAccountsCore(core) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getDashboardAccountsEncryptionKey(), iv);
    const plaintext = Buffer.from(JSON.stringify(core), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        version: 1,
        encrypted: true,
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: ciphertext.toString("base64"),
        accountCount: Array.isArray(core && core.accounts) ? core.accounts.length : 0,
        updatedAt: new Date().toISOString(),
    };
}

function decodeDashboardAccountsPayload(payload) {
    if (Array.isArray(payload)) return { version: 1, accounts: payload };
    if (!payload || typeof payload !== "object") return null;
    if (payload.encrypted === true) {
        if (payload.algorithm !== "aes-256-gcm") {
            throw new Error("Unbekannter Account-Speicher-Algorithmus");
        }
        const iv = Buffer.from(String(payload.iv || ""), "base64");
        const tag = Buffer.from(String(payload.tag || ""), "base64");
        const ciphertext = Buffer.from(String(payload.data || ""), "base64");
        if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
            throw new Error("Verschlüsselte Account-Datei ist unvollständig");
        }
        const decipher = crypto.createDecipheriv("aes-256-gcm", getDashboardAccountsEncryptionKey(), iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
        return JSON.parse(plaintext);
    }
    if (Array.isArray(payload.accounts)) return { version: 1, accounts: payload.accounts };
    return null;
}

function normalizeDashboardAccountsCore(payload) {
    const decoded = decodeDashboardAccountsPayload(payload);
    if (!decoded || !Array.isArray(decoded.accounts)) return null;
    const accounts = [];
    const seenEmails = new Set();
    const seenUsernames = new Set();
    for (const raw of decoded.accounts) {
        const account = serializeDashboardAccountForStorage(raw);
        if (!account) continue;
        const emailKey = account.email.toLowerCase();
        const usernameKey = account.username.toLowerCase();
        if (seenEmails.has(emailKey) || seenUsernames.has(usernameKey)) continue;
        seenEmails.add(emailKey);
        seenUsernames.add(usernameKey);
        accounts.push(account);
    }
    if (accounts.length === 0) return null;
    accounts.sort((left, right) => String(left.username).localeCompare(String(right.username)));
    return { version: 1, accounts };
}

function ensureDashboardOwnerInMemory() {
    if (getOwnerDashboardAccount() || dashboardAccounts.size === 0) return false;
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
    if (!ownerCandidate) return false;
    const promotedOwner = normalizeDashboardAccount({
        ...ownerCandidate,
        isOwner: true,
        access: normalizeDashboardAccess({ ...ownerCandidate, isOwner: true }, ownerCandidate.username, ownerCandidate.email),
        updatedAt: new Date().toISOString(),
    });
    if (!promotedOwner) return false;
    dashboardAccounts.set(promotedOwner.email, promotedOwner);
    console.warn(`[NEXU] Owner-Rechte für ${promotedOwner.username} automatisch wiederhergestellt`);
    return true;
}

function applyDashboardAccountsCore(payload) {
    const core = normalizeDashboardAccountsCore(payload);
    if (!core) return null;
    dashboardAccounts.clear();
    for (const account of core.accounts) {
        dashboardAccounts.set(account.email, account);
    }
    ensureDashboardOwnerInMemory();
    return buildDashboardAccountsCore();
}

async function fetchGitHubAccountsFile() {
    const endpoint = `${githubAccountsEndpoint()}?ref=${encodeURIComponent(GITHUB_DATA_BRANCH)}`;
    const response = await fetch(endpoint, { method: "GET", headers: githubStorageHeaders() });
    if (response.status === 404) return { exists: false, sha: "", payload: null };
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            `GitHub-Accountdatei konnte nicht gelesen werden: HTTP ${response.status}` +
            (body && body.message ? ` // ${body.message}` : "")
        );
    }
    const rawText = decodeGitHubBase64(body.content || "");
    return {
        exists: true,
        sha: cleanText(body.sha, 100),
        payload: rawText ? JSON.parse(rawText) : {},
    };
}

async function loadGitHubAccounts() {
    if (!isGitHubAccountsConfigured()) {
        githubAccountsReady = true;
        githubAccountsContentFingerprint = storageFingerprint(buildDashboardAccountsCore());
        console.warn("[NEXU] Separate GitHub-Accountdatei ist nicht vollständig konfiguriert; lokale Accountdatei bleibt aktiv.");
        return false;
    }
    try {
        const remote = await fetchGitHubAccountsFile();
        githubAccountsSha = remote.sha || "";
        let remoteCore = null;
        if (remote.exists && remote.payload) {
            remoteCore = applyDashboardAccountsCore(remote.payload);
            if (!remoteCore) throw new Error("GitHub-Accountdatei enthält keine gültigen Accounts");
        }
        githubAccountsReady = true;
        saveDashboardAccount(false);
        const currentCore = buildDashboardAccountsCore();
        const currentFingerprint = storageFingerprint(currentCore);
        githubAccountsContentFingerprint = remoteCore ? storageFingerprint(remoteCore) : "";
        console.log(`[NEXU] GitHub-Accountdatei geladen: ${dashboardAccounts.size} Account(s), verschlüsselt.`);
        if (!remote.exists) {
            if (GITHUB_ACCOUNTS_WRITES_ALLOWED) scheduleGitHubAccountsSave("initial-create", 1_000);
        } else if (GITHUB_ACCOUNTS_WRITES_ALLOWED && githubAccountsContentFingerprint !== currentFingerprint) {
            scheduleGitHubAccountsSave("startup-merge", 2_500);
        }
        return true;
    } catch (error) {
        githubAccountsReady = true;
        githubAccountsContentFingerprint = storageFingerprint(buildDashboardAccountsCore());
        console.warn("[NEXU] GitHub-Accountdatei konnte nicht geladen werden; lokale Accounts bleiben erhalten:", error.message);
        return false;
    }
}

async function writeGitHubAccountsNow() {
    if (!githubAccountsReady || !isGitHubAccountsConfigured() || !GITHUB_ACCOUNTS_WRITES_ALLOWED || !githubAccountsDirty) {
        return false;
    }
    const core = buildDashboardAccountsCore();
    const nextFingerprint = storageFingerprint(core);
    if (nextFingerprint === githubAccountsContentFingerprint) {
        githubAccountsReasons.clear();
        githubAccountsDirty = false;
        return false;
    }
    const encryptedSnapshot = encryptDashboardAccountsCore(core);
    const content = encodeGitHubBase64(JSON.stringify(encryptedSnapshot, null, 2));
    const reasons = [...githubAccountsReasons];
    githubAccountsReasons.clear();
    githubAccountsDirty = false;

    const writeAttempt = async (refreshSha) => {
        if (refreshSha || !githubAccountsSha) {
            const remote = await fetchGitHubAccountsFile();
            githubAccountsSha = remote.sha || "";
        }
        const body = {
            message: `Nexu accounts update${reasons.length ? `: ${reasons.slice(0, 4).join(", ")}` : ""}`,
            content,
            branch: GITHUB_DATA_BRANCH,
        };
        if (githubAccountsSha) body.sha = githubAccountsSha;
        const response = await fetch(githubAccountsEndpoint(), {
            method: "PUT",
            headers: githubStorageHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(
                `GitHub-Accountdatei konnte nicht geschrieben werden: HTTP ${response.status}` +
                (payload && payload.message ? ` // ${payload.message}` : "")
            );
            error.statusCode = response.status;
            throw error;
        }
        githubAccountsSha = cleanText(payload && payload.content && payload.content.sha, 100) || githubAccountsSha;
        githubAccountsContentFingerprint = nextFingerprint;
        console.log(`[NEXU] GitHub-Accountdatei geändert (${dashboardAccounts.size} Account(s)).`);
        return true;
    };

    try {
        return await writeAttempt(false);
    } catch (error) {
        if (error && (error.statusCode === 409 || error.statusCode === 422)) {
            try {
                return await writeAttempt(true);
            } catch (retryError) {
                githubAccountsDirty = true;
                for (const reason of reasons) githubAccountsReasons.add(reason);
                console.warn("[NEXU] GitHub-Accountdatei Retry fehlgeschlagen:", retryError.message);
                return false;
            }
        }
        githubAccountsDirty = true;
        for (const reason of reasons) githubAccountsReasons.add(reason);
        console.warn("[NEXU] GitHub-Accountdatei fehlgeschlagen:", error.message);
        return false;
    }
}

function scheduleGitHubAccountsSave(reason = "account-change", delayMs = 1_500) {
    if (!githubAccountsReady || !isGitHubAccountsConfigured()) return false;
    if (!GITHUB_ACCOUNTS_WRITES_ALLOWED) {
        if (!githubAccountsBranchWarningShown) {
            githubAccountsBranchWarningShown = true;
            console.warn(`[NEXU] GitHub-Accountdatei darf auf Branch "${GITHUB_DATA_BRANCH}" nicht geschrieben werden.`);
        }
        return false;
    }
    githubAccountsDirty = true;
    githubAccountsReasons.add(cleanText(reason, 80) || "account-change");
    const safeDelay = Math.max(500, Math.min(60_000, Number(delayMs) || 1_500));
    const desiredDueAt = Date.now() + safeDelay;
    if (githubAccountsTimer && githubAccountsDueAtMs <= desiredDueAt) return true;
    if (githubAccountsTimer) clearTimeout(githubAccountsTimer);
    githubAccountsDueAtMs = desiredDueAt;
    githubAccountsTimer = setTimeout(() => {
        githubAccountsTimer = null;
        githubAccountsDueAtMs = 0;
        githubAccountsWriteChain = githubAccountsWriteChain
            .then(() => writeGitHubAccountsNow())
            .catch((error) => {
                githubAccountsDirty = true;
                console.warn("[NEXU] GitHub-Accountwarteschlange:", error.message);
            });
    }, safeDelay);
    if (typeof githubAccountsTimer.unref === "function") githubAccountsTimer.unref();
    return true;
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
    const entry = serializePersistentKnownPlayer(row);
    return entry ? JSON.stringify(entry) : "";
}

function rememberKnownPlayer(raw, now = Date.now()) {
    const source = raw && typeof raw === "object" ? raw : {};
    const userId = cleanNumericId(source.userId);
    if (!userId) return false;

    const existing = knownPlayers.get(userId);
    const firstSeenMs = cleanInteger(existing && existing.firstSeenMs) || now;
    const next = normalizeKnownPlayer({
        userId,
        username: cleanText(source.username, 40) || (existing && existing.username) || `User${userId}`,
        displayName: cleanText(source.displayName, 80) || (existing && existing.displayName) || cleanText(source.username, 40) || `User ${userId}`,
        roleKey: (existing && cleanPlayerRoleAssignment(existing.roleKey || existing.role || existing.assignedRole)) || cleanPlayerRoleAssignment(source.roleKey || source.role || source.assignedRole),
        firstSeen: (existing && existing.firstSeen) || new Date(firstSeenMs).toISOString(),
        firstSeenMs,
        // Historische Felder werden nur zur Abwärtskompatibilität übernommen,
        // aber niemals durch einen normalen Heartbeat fortgeschrieben.
        gameName: existing && existing.gameName,
        placeId: existing && existing.placeId,
        jobId: existing && existing.jobId,
        sessionId: existing && existing.sessionId,
        executionSource: existing && existing.executionSource,
        executionVersion: existing && existing.executionVersion,
        clientPlatform: existing && existing.clientPlatform,
        scriptBuild: existing && existing.scriptBuild,
        lastSeen: existing && existing.lastSeen,
        lastSeenMs: existing && existing.lastSeenMs,
    }, firstSeenMs);
    if (!next) return false;

    const changed = !existing || persistentPlayerSignature(existing) !== persistentPlayerSignature(next);
    if (!changed) return false;
    knownPlayers.set(userId, next);
    return "important";
}

function markKnownPlayerOffline(userId, sessionId, now = Date.now(), identity = {}) {
    // Offline/Online ist ausschließlich flüchtige Presence und wird nicht in der
    // gespeicherten Spielerliste aktualisiert. Nur echte Namensänderungen dürfen
    // den persistenten Datensatz verändern.
    return rememberKnownPlayer({
        userId,
        username: identity.username,
        displayName: identity.displayName,
    }, now) === "important";
}

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

const snapshotGeneratedAtMs = Date.now();
syncPresenceRevision(snapshotGeneratedAtMs);
const latestActiveByUserId = getLatestActivePresenceByUser(snapshotGeneratedAtMs);

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

const activeUserIds = [...latestActiveByUserId.keys()].sort((a, b) => String(a).localeCompare(String(b)));
return {
    players,
    bannedPlayers,
    activeCount: activeUserIds.length,
    activeUserIds,
    snapshotGeneratedAtMs,
    activeWindowMs: ACTIVE_PRESENCE_WINDOW_MS,
    revision: presenceRevision,
    snapshotToken: getPresenceSnapshotToken(),
    serverInstanceId: SERVER_INSTANCE_ID,
};

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

/* V165 DESIGN REFRESH */

body::after{content:"";position:fixed;inset:auto -18% -32% auto;width:540px;height:540px;border-radius:50%;background:radial-gradient(circle,rgba(45,255,165,.12),transparent 58%);filter:blur(26px);pointer-events:none;z-index:-1;}
.login-shell{position:relative;isolation:isolate;}
.login-shell::before{content:"";position:absolute;inset:-14px;border-radius:34px;background:linear-gradient(135deg,rgba(0,200,255,.08),rgba(111,70,255,.08),rgba(45,255,165,.05));filter:blur(18px);z-index:-1;opacity:.9;}
.brand-card,.auth-card{border-color:rgba(108,223,255,.22);box-shadow:0 30px 100px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.03) inset,0 0 44px rgba(0,200,255,.06) inset;}
.brand-card{background:linear-gradient(160deg,rgba(4,12,22,.9),rgba(6,15,27,.84));}
.auth-card{background:linear-gradient(160deg,rgba(5,11,19,.86),rgba(8,16,29,.8));}
.logo{position:relative;overflow:hidden;}
.logo::after{content:"";position:absolute;inset:1px;border-radius:inherit;background:linear-gradient(145deg,rgba(255,255,255,.2),transparent 45%,transparent 55%,rgba(255,255,255,.08));mix-blend-mode:screen;}
h1{background:linear-gradient(135deg,#ffffff,#9befff 45%,#b9b3ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}
.auth-panel,.remembered-list{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border-color:rgba(95,208,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
input{background:linear-gradient(180deg,#07101b,#081521);border-color:rgba(108,223,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.02);transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;}
input:focus{transform:translateY(-1px);}
button,.button-link{position:relative;overflow:hidden;background:linear-gradient(135deg,#00c8ff,#2f75ff 54%,#6f46ff);box-shadow:0 16px 36px rgba(0,123,255,.22),0 0 0 1px rgba(255,255,255,.06) inset;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;}
button:hover,.button-link:hover{transform:translateY(-1px);box-shadow:0 20px 40px rgba(0,123,255,.28),0 0 0 1px rgba(255,255,255,.08) inset;filter:saturate(1.08);}
button.ghost{background:rgba(255,255,255,.05);}
button:active,.button-link:active{transform:translateY(0);}
.remembered-account{border-color:rgba(108,223,255,.12);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));}


/* V166 ULTRA DESIGN REFRESH */

html,body{background:
 radial-gradient(circle at 14% 10%,rgba(0,200,255,.18),transparent 26%),
 radial-gradient(circle at 86% 18%,rgba(111,70,255,.16),transparent 30%),
 radial-gradient(circle at 50% 120%,rgba(45,255,165,.08),transparent 32%),
 #02050a;}
.login-shell{gap:26px;}
.brand-card,.auth-card{border-radius:30px;backdrop-filter:blur(18px);}
.brand-card{padding:38px;background:linear-gradient(160deg,rgba(6,14,25,.92),rgba(4,10,19,.86));}
.auth-card{padding:28px;background:linear-gradient(160deg,rgba(6,12,21,.9),rgba(8,15,27,.84));}
.logo{width:84px;height:84px;border-radius:26px;font-size:34px;box-shadow:0 20px 50px rgba(0,200,255,.22),0 0 0 1px rgba(255,255,255,.08) inset;}
.stat{border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025));}
.auth-panel,.remembered-list{border-radius:20px;padding:20px;}
button,.button-link{border-radius:15px;}

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

/* V165 DESIGN REFRESH */

body::after{content:"";position:fixed;inset:auto auto -14% -10%;width:540px;height:540px;border-radius:50%;background:radial-gradient(circle,rgba(45,255,165,.11),transparent 58%);filter:blur(34px);pointer-events:none;}
.shell{width:min(1240px,calc(100% - 34px));}
.header{padding:10px 0 4px;}
.panel,.primary-tile,.info-card,.modal-card,.account-menu{box-shadow:0 26px 80px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.03) inset;}
.panel{position:relative;overflow:hidden;border-color:rgba(108,223,255,.2);background:linear-gradient(180deg,rgba(10,18,30,.92),rgba(6,12,22,.86));}
.panel::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(0,200,255,.1),transparent 34%),radial-gradient(circle at bottom left,rgba(111,70,255,.08),transparent 35%);pointer-events:none;}
.welcome,.action-grid{position:relative;z-index:1;}
h1{background:linear-gradient(135deg,#fff,#98ebff 42%,#bbb6ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.primary-tile{position:relative;overflow:hidden;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;}
.primary-tile::after{content:"";position:absolute;inset:-35% auto auto -20%;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 62%);pointer-events:none;opacity:.55;}
.primary-tile:hover{transform:translateY(-3px);border-color:rgba(108,223,255,.46);box-shadow:0 20px 46px rgba(0,0,0,.26),0 0 0 1px rgba(255,255,255,.04) inset,0 0 40px rgba(0,200,255,.08) inset;}
.info-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border-color:rgba(108,223,255,.12);}
.account-button,.menu-item,.modal-actions button,.back{transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease;}
.account-button:hover,.menu-item:hover,.modal-actions button:hover,.back:hover{transform:translateY(-1px);border-color:rgba(108,223,255,.4);box-shadow:0 12px 24px rgba(0,0,0,.18);}
.modal-card{background:linear-gradient(180deg,rgba(8,14,25,.98),rgba(6,12,22,.96));}


/* V166 ULTRA DESIGN REFRESH */

html,body{background:
 radial-gradient(circle at 10% 10%,rgba(0,200,255,.18),transparent 24%),
 radial-gradient(circle at 90% 14%,rgba(111,70,255,.15),transparent 28%),
 radial-gradient(circle at 50% 110%,rgba(45,255,165,.06),transparent 30%),
 var(--bg);}
.header{margin-bottom:26px;padding:16px 18px;border:1px solid rgba(108,223,255,.14);border-radius:26px;background:linear-gradient(180deg,rgba(7,13,23,.9),rgba(6,12,21,.78));box-shadow:0 18px 48px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.03) inset;backdrop-filter:blur(16px);}
.logo{width:54px;height:54px;font-size:22px;box-shadow:0 18px 44px rgba(0,200,255,.22),0 0 0 1px rgba(255,255,255,.08) inset;}
.brand strong{font-size:26px;background:linear-gradient(135deg,#fff,#a5efff 42%,#c0bbff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.hero{gap:24px;}
.welcome,.action-grid{padding:30px;}
.primary-tile{min-height:164px;border-radius:26px;}
.quick-info{gap:14px;}
.info-card{min-height:108px;border-radius:20px;}

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
            : '<form class="delete-account-form" method="post" action="/accounts/delete"><input type="hidden" name="accountEmail" value="' + escapeHtml(entry.email) + '"><button class="danger" type="submit">Account löschen</button></form>';
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
.account-confirm-backdrop { position:fixed; z-index:25000; inset:0; display:grid; place-items:center; padding:18px; background:rgba(0,3,8,.74); backdrop-filter:blur(10px); opacity:1; transition:opacity .18s ease; }
.account-confirm-backdrop.hidden { opacity:0; pointer-events:none; }
.account-confirm-card { width:min(450px,100%); padding:23px; border:1px solid rgba(255,77,120,.48); border-radius:22px; background:linear-gradient(145deg,rgba(255,77,120,.09),rgba(111,70,255,.045)),rgba(7,13,23,.98); box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 36px rgba(255,77,120,.11); transform:none; transition:transform .18s ease; }
.account-confirm-backdrop.hidden .account-confirm-card { transform:translateY(10px) scale(.985); }
.account-confirm-card h2 { margin:8px 0 8px; }
.account-confirm-card p { color:#9ab0bf; }
.account-confirm-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:18px; }
.account-confirm-actions button { min-width:120px; }
.account-confirm-actions .confirm-delete { border-color:rgba(255,77,120,.52); background:rgba(58,7,23,.72); color:#ffd0da; }
@media (max-width:820px) { .grid { grid-template-columns:1fr; } .access-box { align-items:flex-start; flex-direction:column; } .topbar { align-items:flex-start; flex-direction:column; } }

/* V165 DESIGN REFRESH */

body::after{content:"";position:fixed;inset:auto -12% -18% auto;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(45,255,165,.1),transparent 60%);filter:blur(30px);pointer-events:none;}
.shell{width:min(1240px,calc(100% - 32px));}
.topbar,.intro,.account-card,.account-confirm-card{box-shadow:0 24px 72px rgba(0,0,0,.32),0 0 0 1px rgba(255,255,255,.03) inset;}
.intro,.account-card{position:relative;overflow:hidden;}
.intro::before,.account-card::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(0,200,255,.08),transparent 30%),radial-gradient(circle at bottom left,rgba(111,70,255,.06),transparent 34%);pointer-events:none;}
.brand h1{background:linear-gradient(135deg,#fff,#95ebff 50%,#b9b3ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.account-card-head,.grid,.access-box,.meta,.actions,.owner-note,.delete-account-form{position:relative;z-index:1;}
.account-card{border-color:rgba(108,223,255,.18);background:linear-gradient(180deg,rgba(9,16,28,.92),rgba(6,12,22,.88));}
.access-box{border-color:rgba(108,223,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));}
.check{transition:transform .18s ease,border-color .18s ease,background .18s ease;}
.check:hover{transform:translateY(-1px);border-color:rgba(108,223,255,.35);background:rgba(9,17,29,.78);}
button,a.back{transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;}
button:hover,a.back:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(0,0,0,.18);}
label input{background:linear-gradient(180deg,#07101b,#081521);}
.account-confirm-card{background:linear-gradient(180deg,rgba(10,16,27,.98),rgba(8,13,23,.96));}


/* V166 ULTRA DESIGN REFRESH */

.topbar{padding:16px 18px;border:1px solid rgba(108,223,255,.14);border-radius:26px;background:linear-gradient(180deg,rgba(7,13,23,.9),rgba(6,12,21,.78));box-shadow:0 18px 48px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.03) inset;backdrop-filter:blur(16px);}
.logo{width:50px;height:50px;font-size:20px;}
.brand h1{font-size:34px;}
.intro{border-radius:24px;padding:22px;}
.account-card{border-radius:24px;padding:20px;}
button,a.back{border-radius:14px;}

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
<div id="accountDeleteConfirm" class="account-confirm-backdrop hidden" aria-hidden="true">
    <div class="account-confirm-card" role="dialog" aria-modal="true" aria-labelledby="accountDeleteTitle" aria-describedby="accountDeleteMessage">
        <div class="eyebrow">NEXU // ACCOUNT SICHERHEIT</div>
        <h2 id="accountDeleteTitle">Account wirklich löschen?</h2>
        <p id="accountDeleteMessage">Der Dashboard-Account und seine Berechtigungen werden dauerhaft entfernt. Diese Aktion lässt sich nicht rückgängig machen.</p>
        <div class="account-confirm-actions"><button id="accountDeleteCancel" type="button">ABBRECHEN</button><button id="accountDeleteSubmit" class="confirm-delete" type="button">ACCOUNT LÖSCHEN</button></div>
    </div>
</div>
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

    var deleteModal = document.getElementById('accountDeleteConfirm');
    var deleteCancel = document.getElementById('accountDeleteCancel');
    var deleteSubmit = document.getElementById('accountDeleteSubmit');
    var pendingDeleteForm = null;
    function closeDeleteConfirm() {
        if (deleteModal) {
            deleteModal.classList.add('hidden');
            deleteModal.setAttribute('aria-hidden','true');
        }
        pendingDeleteForm = null;
    }
    Array.prototype.slice.call(document.querySelectorAll('.delete-account-form')).forEach(function(form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            pendingDeleteForm = form;
            if (deleteModal) {
                deleteModal.classList.remove('hidden');
                deleteModal.setAttribute('aria-hidden','false');
                if (deleteSubmit) deleteSubmit.focus();
            }
        });
    });
    if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteConfirm);
    if (deleteModal) deleteModal.addEventListener('click', function(event) { if (event.target === deleteModal) closeDeleteConfirm(); });
    if (deleteSubmit) deleteSubmit.addEventListener('click', function() {
        var form = pendingDeleteForm;
        closeDeleteConfirm();
        if (form) HTMLFormElement.prototype.submit.call(form);
    });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && deleteModal && !deleteModal.classList.contains('hidden')) {
            event.preventDefault();
            closeDeleteConfirm();
        }
    });
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
const initialMenuStatus = getMenuAvailabilityStatus();
const initialMenuStatusJson = JSON.stringify(initialMenuStatus).replace(/</g, "\\u003c");
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
const shutdownButtonAllowed = permissionSnapshot.shutdownScript === true || isOwnerDashboardAccount(account);
const shutdownButtonHtml = shutdownButtonAllowed ? '<button id="shutdownAllButton" class="logout-button shutdown-button" type="button">ALLE SCRIPTS AUS</button>' : "";
const menuStatusButtonAllowed = permissionSnapshot.menuStatus === true || isOwnerDashboardAccount(account);
const menuStatusButtonHtml = menuStatusButtonAllowed ? '<button id="menuStatusToggleButton" class="menu-status-toggle" type="button"></button>' : "";
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
.menu-status-panel { margin-top:22px; padding:20px 22px; border:1px solid rgba(45,255,165,.34); border-radius:22px; background:linear-gradient(135deg,rgba(45,255,165,.08),rgba(0,200,255,.04)),var(--panel); transition:border-color .18s ease,background .18s ease; }
.menu-status-panel.offline { border-color:rgba(255,77,120,.48); background:linear-gradient(135deg,rgba(255,77,120,.11),rgba(111,70,255,.045)),var(--panel); }
.menu-status-row { display:flex; align-items:center; justify-content:space-between; gap:18px; }
.menu-status-copy { min-width:0; }
.menu-status-copy h2 { margin:5px 0 5px; font-size:22px; }
.menu-status-copy p { margin:0; color:#9ab0bf; line-height:1.55; }
.menu-status-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:flex-end; }
.menu-status-badge { min-width:112px; min-height:42px; display:inline-flex; align-items:center; justify-content:center; gap:9px; padding:0 15px; border:1px solid rgba(45,255,165,.4); border-radius:999px; color:#91ffd2; background:rgba(5,38,26,.6); font-size:12px; font-weight:900; letter-spacing:.12em; }
.menu-status-badge.offline { border-color:rgba(255,77,120,.5); color:#ffafc0; background:rgba(45,7,18,.68); }
.menu-status-badge-dot { width:9px; height:9px; border-radius:50%; background:currentColor; box-shadow:0 0 14px currentColor; }
.menu-status-toggle { min-height:42px; padding:0 16px; border:1px solid rgba(255,77,120,.48); border-radius:13px; color:#ffafc0; background:rgba(45,7,18,.68); font:inherit; font-size:11px; font-weight:900; letter-spacing:.08em; cursor:pointer; }
.menu-status-toggle.enable { border-color:rgba(45,255,165,.46); color:#91ffd2; background:rgba(5,38,26,.62); }
.menu-status-toggle:disabled { opacity:.55; cursor:wait; }
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
/* V163: Eigene Nexu-Aktionsdialoge und Statusmeldungen. */
.action-confirm-card {
    width:min(470px,100%);
    border-color:rgba(0,200,255,.42);
    background:linear-gradient(145deg,rgba(0,200,255,.075),rgba(111,70,255,.05)),rgba(7,13,23,.98);
    box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 38px rgba(0,200,255,.11);
}
.action-confirm-card.danger { border-color:rgba(255,77,120,.5); background:linear-gradient(145deg,rgba(255,77,120,.09),rgba(111,70,255,.045)),rgba(7,13,23,.98); box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 38px rgba(255,77,120,.12); }
.action-confirm-card.warning { border-color:rgba(255,190,70,.5); background:linear-gradient(145deg,rgba(255,190,70,.09),rgba(111,70,255,.04)),rgba(7,13,23,.98); box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 38px rgba(255,190,70,.11); }
.action-confirm-card.success { border-color:rgba(45,255,165,.45); background:linear-gradient(145deg,rgba(45,255,165,.075),rgba(0,200,255,.04)),rgba(7,13,23,.98); box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 38px rgba(45,255,165,.1); }
.action-confirm-heading { display:flex; align-items:center; gap:13px; margin-top:8px; }
.action-confirm-heading h3 { margin:0; }
.action-confirm-icon { width:42px; height:42px; flex:0 0 42px; display:grid; place-items:center; border:1px solid rgba(0,200,255,.42); border-radius:14px; color:#bcefff; background:rgba(0,200,255,.1); font-size:20px; font-weight:950; box-shadow:0 0 22px rgba(0,200,255,.09) inset; }
.action-confirm-card.danger .action-confirm-icon { border-color:rgba(255,77,120,.52); color:#ffc0d0; background:rgba(255,77,120,.11); }
.action-confirm-card.warning .action-confirm-icon { border-color:rgba(255,190,70,.52); color:#ffe5a8; background:rgba(255,190,70,.1); }
.action-confirm-card.success .action-confirm-icon { border-color:rgba(45,255,165,.48); color:#aaffdc; background:rgba(45,255,165,.09); }
.action-confirm-message { margin:15px 0 0; color:#9ab0bf; line-height:1.62; white-space:pre-line; }
.action-confirm-submit { min-width:145px; }
.action-confirm-card.danger .action-confirm-submit { border-color:rgba(255,77,120,.55); color:#ffd0da; background:rgba(58,7,23,.74); }
.action-confirm-card.warning .action-confirm-submit { border-color:rgba(255,190,70,.52); color:#ffe6ad; background:rgba(55,35,4,.72); }
.action-confirm-card.success .action-confirm-submit { border-color:rgba(45,255,165,.48); color:#aaffdc; background:rgba(5,38,26,.68); }
.toast-stack { position:fixed; z-index:1400; top:18px; right:18px; width:min(390px,calc(100% - 36px)); display:grid; gap:10px; pointer-events:none; }
.nexu-toast { --toast-duration:4200ms; position:relative; overflow:hidden; display:grid; grid-template-columns:38px minmax(0,1fr) 30px; align-items:center; gap:11px; min-height:68px; padding:12px 11px 12px 12px; border:1px solid rgba(0,200,255,.36); border-radius:17px; color:#dff7ff; background:linear-gradient(135deg,rgba(0,200,255,.095),rgba(111,70,255,.055)),rgba(5,12,21,.96); box-shadow:0 18px 55px rgba(0,0,0,.48),0 0 28px rgba(0,200,255,.08); backdrop-filter:blur(16px); pointer-events:auto; animation:nexuToastIn .22s ease both; }
.nexu-toast.success { border-color:rgba(45,255,165,.42); background:linear-gradient(135deg,rgba(45,255,165,.095),rgba(0,200,255,.045)),rgba(5,15,18,.96); }
.nexu-toast.error { border-color:rgba(255,77,120,.46); background:linear-gradient(135deg,rgba(255,77,120,.11),rgba(111,70,255,.04)),rgba(18,6,13,.97); }
.nexu-toast.warning { border-color:rgba(255,190,70,.44); background:linear-gradient(135deg,rgba(255,190,70,.1),rgba(111,70,255,.04)),rgba(17,13,5,.97); }
.nexu-toast-icon { width:38px; height:38px; display:grid; place-items:center; border:1px solid currentColor; border-radius:12px; color:#8cecff; background:rgba(0,200,255,.08); font-weight:950; }
.nexu-toast.success .nexu-toast-icon { color:#91ffd2; background:rgba(45,255,165,.075); }
.nexu-toast.error .nexu-toast-icon { color:#ffafc0; background:rgba(255,77,120,.085); }
.nexu-toast.warning .nexu-toast-icon { color:#ffe29a; background:rgba(255,190,70,.075); }
.nexu-toast-copy { min-width:0; }
.nexu-toast-title { display:block; margin-bottom:3px; color:#f3fbff; font-size:11px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; }
.nexu-toast-message { color:#a8bfce; font-size:12px; line-height:1.45; overflow-wrap:anywhere; }
.nexu-toast-close { width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:9px; color:#88a2b4; background:rgba(255,255,255,.04); font:inherit; font-size:17px; cursor:pointer; }
.nexu-toast-close:hover { color:#fff; background:rgba(255,255,255,.08); }
.nexu-toast-progress { position:absolute; left:0; right:0; bottom:0; height:2px; transform-origin:left center; background:currentColor; color:#00c8ff; opacity:.72; animation:nexuToastProgress var(--toast-duration) linear both; }
.nexu-toast.success .nexu-toast-progress { color:#2dffa5; }
.nexu-toast.error .nexu-toast-progress { color:#ff4d78; }
.nexu-toast.warning .nexu-toast-progress { color:#ffbe46; }
.nexu-toast.leaving { animation:nexuToastOut .18s ease both; }
@keyframes nexuToastIn { from { opacity:0; transform:translateX(18px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes nexuToastOut { to { opacity:0; transform:translateX(18px) scale(.98); } }
@keyframes nexuToastProgress { from { transform:scaleX(1); } to { transform:scaleX(0); } }
@media (prefers-reduced-motion:reduce) { .nexu-toast,.nexu-toast.leaving,.nexu-toast-progress { animation:none; } }
@media (max-width:760px) {
    .shell { width:min(100% - 20px,1180px); padding-top:16px; }
    header { align-items:flex-start; }
    .brand-copy span { display:none; }
    .hero { padding:22px; border-radius:22px; }
    .stats,.players { grid-template-columns:1fr; }
    .directory { padding:18px; }
    .directory-head { align-items:stretch; flex-direction:column; }
    .search { width:100%; }
    .menu-status-row,.update-status-row { align-items:flex-start; flex-direction:column; }
    .menu-status-actions { justify-content:flex-start; }
    .update-duration-grid { grid-template-columns:1fr; }
}

/* V165 DESIGN REFRESH */

body::after{content:"";position:fixed;inset:auto auto -10% -12%;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(45,255,165,.08),transparent 60%);filter:blur(40px);pointer-events:none;}
.shell{width:min(1280px,calc(100% - 34px));}
header{position:sticky;top:0;z-index:40;padding:12px 0 16px;margin-bottom:18px;background:linear-gradient(to bottom,rgba(3,7,14,.9),rgba(3,7,14,.74),transparent);backdrop-filter:blur(10px);}
.hero,.directory,.player,.stat,.stat-mini,.menu-status-panel,.menu-update-panel,.dialog-card,.toast,.directory-tabs,.update-cancel-form,.dashboard-notice{box-shadow:0 24px 72px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.03) inset;}
.hero,.directory,.menu-status-panel,.menu-update-panel{position:relative;overflow:hidden;border-color:rgba(108,223,255,.2);background:linear-gradient(180deg,rgba(10,17,29,.94),rgba(6,12,22,.88));}
.hero::before,.directory::before,.menu-status-panel::before,.menu-update-panel::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(0,200,255,.1),transparent 30%),radial-gradient(circle at bottom left,rgba(111,70,255,.08),transparent 34%);pointer-events:none;}
.hero > *, .directory > *, .menu-status-panel > *, .menu-update-panel > *{position:relative;z-index:1;}
h1{background:linear-gradient(135deg,#ffffff,#9feeff 40%,#b9b3ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.live-pill{border-color:rgba(108,223,255,.18);background:linear-gradient(180deg,rgba(12,20,34,.88),rgba(8,14,26,.8));box-shadow:0 10px 26px rgba(0,0,0,.18);}
.header-actions{gap:12px;}
.logout-button,.action-button,.role-button,.menu-status-toggle,.directory-tab,.small-button,.player-action,.dialog-actions button,.update-preset,.update-submit-button,.update-cancel,.broadcast-button,.shutdown-button{transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,filter .18s ease,background .18s ease,color .18s ease;}
.logout-button:hover,.action-button:hover,.role-button:hover,.menu-status-toggle:hover,.directory-tab:hover,.small-button:hover,.player-action:hover,.dialog-actions button:hover,.update-preset:hover,.update-submit-button:hover,.update-cancel:hover,.broadcast-button:hover,.shutdown-button:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.2);filter:saturate(1.06);}
.directory-tabs{padding:8px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.02));border-color:rgba(108,223,255,.12);}
.directory-tab{background:linear-gradient(180deg,rgba(10,17,29,.86),rgba(7,13,23,.78));border-color:rgba(108,223,255,.14);}
.directory-tab.active{box-shadow:0 0 28px rgba(0,200,255,.08) inset,0 10px 22px rgba(0,0,0,.14);}
.stats{gap:16px;}
.stat{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border-color:rgba(108,223,255,.12);}
.stat-mini{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.02));border-color:rgba(108,223,255,.1);}
.search{background:linear-gradient(180deg,#07101b,#081521);border-color:rgba(108,223,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.02);}
.players{gap:14px;}
.player{position:relative;overflow:hidden;border-color:rgba(108,223,255,.13);background:linear-gradient(180deg,rgba(10,17,29,.86),rgba(8,14,24,.8));box-shadow:0 18px 38px rgba(0,0,0,.18),0 0 0 1px rgba(255,255,255,.02) inset;}
.player::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,200,255,.06),transparent 30%,transparent 70%,rgba(111,70,255,.05));pointer-events:none;opacity:.9;}
.player > *{position:relative;z-index:1;}
.player:hover{box-shadow:0 22px 48px rgba(0,0,0,.24),0 0 0 1px rgba(255,255,255,.03) inset;}
.avatar{border-color:rgba(108,223,255,.22);box-shadow:0 8px 20px rgba(0,0,0,.22);}
.display-name{font-size:15px;}
.presence-details{padding:8px 10px;border:1px solid rgba(108,223,255,.1);border-radius:12px;background:rgba(4,10,18,.34);}
.role-badge{box-shadow:0 0 18px rgba(66,255,145,.11),0 0 0 1px rgba(255,255,255,.02) inset;}
.action-grid,.player-actions,.role-controls{gap:8px;}
.dashboard-notice{border-color:rgba(108,223,255,.16);background:linear-gradient(180deg,rgba(6,15,26,.9),rgba(5,12,22,.84));}
.toast{backdrop-filter:blur(12px);}
.dialog-card{background:linear-gradient(180deg,rgba(10,17,29,.98),rgba(7,13,23,.96));}
.menu-status-toggle{min-height:48px;border-radius:16px;border-color:rgba(108,223,255,.26);background:linear-gradient(135deg,rgba(0,200,255,.14),rgba(111,70,255,.12));}
.menu-status-toggle[data-status="offline"],.menu-status-toggle.offline{border-color:rgba(255,77,120,.34);background:linear-gradient(135deg,rgba(255,77,120,.18),rgba(111,70,255,.12));}
::-webkit-scrollbar{width:12px;height:12px;}
::-webkit-scrollbar-track{background:rgba(5,10,18,.72);}
::-webkit-scrollbar-thumb{border:2px solid rgba(5,10,18,.72);border-radius:999px;background:linear-gradient(180deg,rgba(0,200,255,.55),rgba(111,70,255,.5));}


/* V166 ULTRA DESIGN REFRESH */

:root{--glass:rgba(8,14,24,.82);--glass-strong:rgba(6,12,22,.92);--line:rgba(255,255,255,.055);--shadow:0 30px 80px rgba(0,0,0,.34);} 
html,body{background:
 radial-gradient(circle at 8% 8%,rgba(0,200,255,.18),transparent 22%),
 radial-gradient(circle at 92% 10%,rgba(111,70,255,.16),transparent 26%),
 radial-gradient(circle at 50% 115%,rgba(45,255,165,.06),transparent 28%),
 linear-gradient(180deg,#02050a 0%,#03070e 42%,#02050a 100%);} 
body::before{opacity:.18;background-size:36px 36px;mask-image:radial-gradient(circle at top,black 10%,rgba(0,0,0,.75) 35%,transparent 88%);} 
.scan{opacity:.7;filter:blur(.2px);} 
.shell{width:min(1380px,calc(100% - 34px));padding:20px 0 56px;} 
header{position:sticky;top:12px;z-index:50;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:18px;padding:18px 20px;border:1px solid rgba(108,223,255,.14);border-radius:30px;background:linear-gradient(180deg,rgba(7,13,23,.92),rgba(6,12,21,.82));box-shadow:0 22px 60px rgba(0,0,0,.30),0 0 0 1px rgba(255,255,255,.03) inset;backdrop-filter:blur(18px);margin-bottom:24px;} 
header::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,rgba(0,200,255,.08),transparent 28%,transparent 72%,rgba(111,70,255,.08));pointer-events:none;} 
.brand,.header-actions,.live-pill{position:relative;z-index:1;} 
.brand{gap:16px;min-width:0;} 
.logo{width:56px;height:56px;border-radius:18px;font-size:24px;box-shadow:0 18px 44px rgba(0,200,255,.22),0 0 0 1px rgba(255,255,255,.08) inset;} 
.brand-copy strong{font-size:32px;line-height:1;background:linear-gradient(135deg,#fff,#a5efff 44%,#c3bfff);-webkit-background-clip:text;background-clip:text;color:transparent;} 
.brand-copy span{font-size:13px;letter-spacing:.18em;color:#88a7bd;} 
.header-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;} 
.logout-button,.action-button,.menu-status-toggle,.directory-tab,.role-button,.small-button,.player-action,.update-preset,.update-submit-button,.update-cancel,.broadcast-button,.shutdown-button{min-height:42px;padding:0 16px;border-radius:15px;border:1px solid rgba(108,223,255,.16);background:linear-gradient(180deg,rgba(14,22,36,.9),rgba(8,14,25,.78));box-shadow:0 8px 24px rgba(0,0,0,.18),0 0 0 1px rgba(255,255,255,.02) inset;color:#dceef8;font-size:11px;font-weight:900;letter-spacing:.08em;} 
.logout-button,.shutdown-button{border-color:rgba(255,77,120,.22);color:#ffb4c4;background:linear-gradient(180deg,rgba(55,10,23,.82),rgba(35,8,16,.72));} 
.update-button,.update-submit-button{border-color:rgba(255,194,45,.24);color:#ffe7a0;background:linear-gradient(180deg,rgba(60,42,8,.85),rgba(37,26,7,.72));} 
.broadcast-button{border-color:rgba(0,200,255,.24);color:#a9eeff;background:linear-gradient(180deg,rgba(6,52,72,.84),rgba(7,25,37,.76));} 
.live-pill{justify-self:end;min-height:44px;padding:0 18px;border-radius:16px;border:1px solid rgba(108,223,255,.14);background:linear-gradient(180deg,rgba(11,18,31,.88),rgba(8,14,24,.76));box-shadow:0 10px 28px rgba(0,0,0,.18),0 0 0 1px rgba(255,255,255,.03) inset;} 
.dot{width:10px;height:10px;} 
.hero,.directory,.menu-status-panel,.menu-update-panel{border-radius:30px;border:1px solid rgba(108,223,255,.14);background:linear-gradient(180deg,rgba(8,15,26,.94),rgba(6,12,22,.88));box-shadow:var(--shadow),0 0 0 1px rgba(255,255,255,.03) inset;} 
.hero{padding:34px;} 
.directory{padding:28px;} 
.directory-head{margin-bottom:20px;} 
.directory h2{font-size:24px;} 
.stats{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:26px;} 
.stat{min-height:132px;padding:20px;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025));border:1px solid rgba(108,223,255,.1);} 
.stat-value{font-size:30px;} 
.stat-mini{border-radius:16px;padding:12px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));}
.directory-tabs{gap:10px;padding:8px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.02));border:1px solid rgba(108,223,255,.1);} 
.directory-tab{min-height:44px;border-radius:14px;padding:0 16px;} 
.search{height:48px;border-radius:15px;padding:0 16px;background:linear-gradient(180deg,#08111d,#091521);} 
.players{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;} 
.player{padding:15px;border-radius:20px;border:1px solid rgba(108,223,255,.1);background:linear-gradient(180deg,rgba(12,19,33,.88),rgba(8,14,24,.8));box-shadow:0 16px 38px rgba(0,0,0,.18),0 0 0 1px rgba(255,255,255,.02) inset;} 
.player:hover{transform:translateY(-3px);border-color:rgba(108,223,255,.26);} 
.avatar{width:64px;height:64px;flex-basis:64px;border-radius:18px;} 
.display-name{font-size:16px;font-weight:820;} 
.username{font-size:13px;} 
.presence-details{margin-top:10px;padding:9px 11px;border-radius:14px;background:linear-gradient(180deg,rgba(2,8,14,.46),rgba(4,10,18,.26));border:1px solid rgba(108,223,255,.08);} 
.player-actions{gap:10px;} 
.role-controls{gap:7px;} 
.dashboard-notice,.toast,.dialog-card,.account-menu,.update-card,.dm-card{border-radius:22px;} 
@media (max-width:1180px){header{grid-template-columns:1fr;align-items:start;} .live-pill{justify-self:start;} .stats{grid-template-columns:repeat(2,minmax(0,1fr));} .players{grid-template-columns:1fr;}} 
@media (max-width:760px){.shell{width:min(100% - 18px,1380px);} header{padding:16px;border-radius:24px;top:8px;} .brand-copy strong{font-size:26px;} .hero,.directory{padding:22px;} .stats{grid-template-columns:1fr;} .directory-head{flex-direction:column;align-items:stretch;} .search{width:100%;} .header-actions{justify-content:flex-start;}} 



/* V167 SEARCHABLE ROLE PICKER */
.player{overflow:visible;}
.player::before{border-radius:inherit;}
.player.role-menu-open{z-index:30;border-color:rgba(0,200,255,.34);box-shadow:0 26px 70px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.04) inset,0 0 36px rgba(0,200,255,.08);}
.role-picker{position:relative;display:inline-flex;margin-top:8px;z-index:8;}
.role-trigger.role-badge{appearance:none;margin:0;min-height:30px;display:inline-flex;align-items:center;gap:8px;padding:0 11px;border-radius:999px;font:inherit;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease;}
.role-trigger.role-badge:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(0,0,0,.22),0 0 18px rgba(66,255,145,.11);}
.role-trigger.role-badge:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(0,200,255,.15),0 10px 24px rgba(0,0,0,.22);}
.role-trigger-chevron{font-size:13px;line-height:1;opacity:.75;transition:transform .18s ease;}
.role-picker.open .role-trigger-chevron{transform:rotate(180deg);}
.role-trigger-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.22);border-top-color:#fff;border-radius:50%;animation:role-spin .7s linear infinite;}
@keyframes role-spin{to{transform:rotate(360deg);}}
.role-dropdown{position:absolute;left:0;top:calc(100% + 10px);width:min(310px,calc(100vw - 44px));display:none;padding:12px;border:1px solid rgba(108,223,255,.2);border-radius:20px;background:linear-gradient(180deg,rgba(10,18,31,.985),rgba(6,12,22,.98));box-shadow:0 28px 80px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.035) inset,0 0 42px rgba(0,200,255,.07);backdrop-filter:blur(20px);transform-origin:top left;animation:role-menu-in .16s ease both;}
.role-picker.open .role-dropdown{display:block;}
@keyframes role-menu-in{from{opacity:0;transform:translateY(-5px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}
.role-dropdown-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:3px 4px 11px;}
.role-dropdown-head div{min-width:0;}
.role-dropdown-head span{display:block;color:#68dfff;font-size:9px;font-weight:900;letter-spacing:.16em;}
.role-dropdown-head strong{display:block;margin-top:3px;overflow:hidden;color:#ecf9ff;font-size:14px;text-overflow:ellipsis;white-space:nowrap;}
.role-dropdown-head .role-dropdown-badge{flex:0 0 auto;padding:5px 7px;border:1px solid rgba(108,223,255,.12);border-radius:999px;color:#7899ad;background:rgba(255,255,255,.025);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:8px;letter-spacing:.04em;}
.role-search-wrap{position:relative;display:block;margin-bottom:10px;}
.role-search-icon{position:absolute;left:12px;top:50%;z-index:1;transform:translateY(-50%);color:#6f91a7;font-size:16px;pointer-events:none;}
.role-search{width:100%;height:42px;padding:0 12px 0 36px;border:1px solid rgba(108,223,255,.16);border-radius:13px;outline:none;color:#eaf8ff;background:linear-gradient(180deg,#07111d,#081521);font:inherit;font-size:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);}
.role-search:focus{border-color:rgba(0,200,255,.55);box-shadow:0 0 0 3px rgba(0,200,255,.09),inset 0 1px 0 rgba(255,255,255,.025);}
.role-search::placeholder{color:#5f7d91;}
.role-option-list{display:grid;gap:7px;}
.role-option{width:100%;min-height:58px;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(108,223,255,.1);border-radius:14px;color:#dceef8;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));font:inherit;text-align:left;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease;}
.role-option:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(0,200,255,.36);background:linear-gradient(180deg,rgba(0,200,255,.10),rgba(111,70,255,.055));box-shadow:0 12px 24px rgba(0,0,0,.16);}
.role-option:disabled{cursor:default;opacity:1;}
.role-option.current{border-color:rgba(45,255,165,.30);background:linear-gradient(180deg,rgba(45,255,165,.09),rgba(5,35,24,.26));}
.role-option.supporter.current{border-color:rgba(245,250,255,.34);background:linear-gradient(180deg,rgba(245,250,255,.11),rgba(23,28,38,.34));}
.role-option-icon{width:26px;height:26px;display:grid;place-items:center;border:1px solid rgba(108,223,255,.13);border-radius:9px;color:#7f9eb2;background:rgba(3,8,15,.42);font-size:12px;font-weight:900;}
.role-option.current .role-option-icon{border-color:rgba(45,255,165,.36);color:#7dffc0;background:rgba(5,42,28,.52);}
.role-option-copy{min-width:0;}
.role-option-copy strong{display:block;color:#effaff;font-size:11px;letter-spacing:.1em;}
.role-option-copy small{display:block;margin-top:3px;color:#718fa3;font-size:10px;line-height:1.3;}
.role-empty{padding:16px 10px 8px;color:#718fa3;font-size:11px;text-align:center;}
.role-empty.hidden{display:none;}
.role-option[hidden]{display:none !important;}
@media (max-width:760px){.role-dropdown{position:fixed;left:12px;right:12px;top:auto;bottom:12px;width:auto;transform-origin:bottom center;}.role-picker.open .role-dropdown{animation:role-menu-mobile-in .18s ease both;}@keyframes role-menu-mobile-in{from{opacity:0;transform:translateY(12px) scale(.985);}to{opacity:1;transform:translateY(0) scale(1);}}}

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

<section id="menuStatusPanel" class="menu-status-panel${initialMenuStatus.online ? "" : " offline"}" aria-live="polite">
    <div class="menu-status-row">
        <div class="menu-status-copy"><div class="eyebrow">NEXU // MENU STATUS</div><h2 id="menuStatusTitle">Lua-Menü ist ${initialMenuStatus.online ? "online" : "offline"}</h2><p id="menuStatusText">${initialMenuStatus.online ? "Jeder kann das Lua-Script normal starten und verwenden." : "Alle Lua-Starts sind blockiert. Bereits laufende Scripts werden vollständig beendet."}</p></div>
        <div class="menu-status-actions"><div id="menuStatusBadge" class="menu-status-badge${initialMenuStatus.online ? "" : " offline"}"><span class="menu-status-badge-dot"></span><span id="menuStatusBadgeText">${initialMenuStatus.online ? "ONLINE" : "OFFLINE"}</span></div>${menuStatusButtonHtml}</div>
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

<div id="actionConfirmModal" class="modal-backdrop hidden" aria-hidden="true">
    <div id="actionConfirmCard" class="modal-card action-confirm-card" role="dialog" aria-modal="true" aria-labelledby="actionConfirmTitle" aria-describedby="actionConfirmMessage">
        <div id="actionConfirmEyebrow" class="eyebrow">NEXU // BESTÄTIGUNG</div>
        <div class="action-confirm-heading"><span id="actionConfirmIcon" class="action-confirm-icon">!</span><h3 id="actionConfirmTitle">Aktion bestätigen</h3></div>
        <p id="actionConfirmMessage" class="action-confirm-message"></p>
        <div class="modal-actions"><button id="actionConfirmCancel" class="action-button" type="button">ABBRECHEN</button><button id="actionConfirmSubmit" class="action-button action-confirm-submit" type="button">BESTÄTIGEN</button></div>
    </div>
</div>
<div id="toastStack" class="toast-stack" aria-live="polite" aria-atomic="false"></div>

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
    menuStatus:${initialMenuStatusJson},
    updateSyncedAt:Date.now(),
    pendingBan:null,
    pendingDm:null,
    broadcastTargetCount:0,
    permissions:DASHBOARD_PERMISSIONS || {},
    refreshFailures:0,
    lastSuccessfulRefreshAt:0,
    stale:false,
    snapshotToken:"",
    serverInstanceId:"",
    warmupHoldUntil:0,
    openRoleUserId:"",
    roleSearchQuery:"",
};
const PLAYER_ROLE_OPTIONS = [
    { key:"player", title:"PLAYERS", description:"Standardrang für normale Nutzer" },
    { key:"supporter", title:"SUPPORTER", description:"Erweiterter Rang mit Bring-Zugriff" },
];
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
    menuStatusPanel:document.getElementById("menuStatusPanel"),
    menuStatusTitle:document.getElementById("menuStatusTitle"),
    menuStatusText:document.getElementById("menuStatusText"),
    menuStatusBadge:document.getElementById("menuStatusBadge"),
    menuStatusBadgeText:document.getElementById("menuStatusBadgeText"),
    menuStatusToggleButton:document.getElementById("menuStatusToggleButton"),
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
    actionConfirmModal:document.getElementById("actionConfirmModal"),
    actionConfirmCard:document.getElementById("actionConfirmCard"),
    actionConfirmEyebrow:document.getElementById("actionConfirmEyebrow"),
    actionConfirmIcon:document.getElementById("actionConfirmIcon"),
    actionConfirmTitle:document.getElementById("actionConfirmTitle"),
    actionConfirmMessage:document.getElementById("actionConfirmMessage"),
    actionConfirmCancel:document.getElementById("actionConfirmCancel"),
    actionConfirmSubmit:document.getElementById("actionConfirmSubmit"),
    toastStack:document.getElementById("toastStack"),
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

let actionConfirmResolver = null;
let actionConfirmReturnFocus = null;

function getActionToneMeta(tone) {
    const normalized = ["danger","warning","success","info"].includes(tone) ? tone : "info";
    if (normalized === "danger") return { tone:normalized, icon:"!", eyebrow:"NEXU // SICHERHEIT", title:"Sicherheitsabfrage" };
    if (normalized === "warning") return { tone:normalized, icon:"!", eyebrow:"NEXU // HINWEIS", title:"Aktion bestätigen" };
    if (normalized === "success") return { tone:normalized, icon:"✓", eyebrow:"NEXU // STATUS", title:"Aktion bestätigen" };
    return { tone:normalized, icon:"i", eyebrow:"NEXU // BESTÄTIGUNG", title:"Aktion bestätigen" };
}

function openActionConfirm(options) {
    const settings = options && typeof options === "object" ? options : {};
    if (!elements.actionConfirmModal || !elements.actionConfirmCard) return Promise.resolve(false);
    if (typeof actionConfirmResolver === "function") actionConfirmResolver(false);
    const meta = getActionToneMeta(String(settings.tone || "info"));
    actionConfirmReturnFocus = document.activeElement;
    elements.actionConfirmCard.classList.remove("danger","warning","success","info");
    elements.actionConfirmCard.classList.add(meta.tone);
    elements.actionConfirmEyebrow.textContent = String(settings.eyebrow || meta.eyebrow);
    elements.actionConfirmIcon.textContent = String(settings.icon || meta.icon);
    elements.actionConfirmTitle.textContent = String(settings.title || meta.title);
    elements.actionConfirmMessage.textContent = String(settings.message || "Diese Aktion wirklich ausführen?");
    elements.actionConfirmCancel.textContent = String(settings.cancelText || "ABBRECHEN");
    elements.actionConfirmSubmit.textContent = String(settings.confirmText || "BESTÄTIGEN");
    elements.actionConfirmModal.classList.remove("hidden");
    elements.actionConfirmModal.setAttribute("aria-hidden","false");
    requestAnimationFrame(function () { elements.actionConfirmSubmit.focus(); });
    return new Promise(function (resolve) { actionConfirmResolver = resolve; });
}

function closeActionConfirm(approved) {
    if (!elements.actionConfirmModal) return;
    elements.actionConfirmModal.classList.add("hidden");
    elements.actionConfirmModal.setAttribute("aria-hidden","true");
    const resolver = actionConfirmResolver;
    actionConfirmResolver = null;
    if (actionConfirmReturnFocus && typeof actionConfirmReturnFocus.focus === "function" && actionConfirmReturnFocus.isConnected) actionConfirmReturnFocus.focus();
    actionConfirmReturnFocus = null;
    if (typeof resolver === "function") resolver(approved === true);
}

function showToast(message, type, duration) {
    if (!elements.toastStack) return null;
    const normalizedType = ["success","error","warning","info"].includes(type) ? type : "info";
    const displayDuration = Math.max(1800, Math.min(12000, Number(duration) || (normalizedType === "error" ? 6200 : 4400)));
    const titles = { success:"ERFOLGREICH", error:"FEHLER", warning:"HINWEIS", info:"NEXU STATUS" };
    const icons = { success:"✓", error:"!", warning:"!", info:"i" };
    const toast = document.createElement("div");
    toast.className = "nexu-toast " + normalizedType;
    toast.setAttribute("role", normalizedType === "error" ? "alert" : "status");
    toast.style.setProperty("--toast-duration", displayDuration + "ms");
    const icon = document.createElement("div");
    icon.className = "nexu-toast-icon";
    icon.textContent = icons[normalizedType];
    const copy = document.createElement("div");
    copy.className = "nexu-toast-copy";
    const title = document.createElement("strong");
    title.className = "nexu-toast-title";
    title.textContent = titles[normalizedType];
    const text = document.createElement("div");
    text.className = "nexu-toast-message";
    text.textContent = String(message || "Aktion abgeschlossen.");
    copy.append(title,text);
    const close = document.createElement("button");
    close.className = "nexu-toast-close";
    close.type = "button";
    close.setAttribute("aria-label","Benachrichtigung schließen");
    close.textContent = "×";
    const progress = document.createElement("div");
    progress.className = "nexu-toast-progress";
    toast.append(icon,copy,close,progress);
    elements.toastStack.prepend(toast);
    let removed = false;
    let timer = null;
    function removeToast() {
        if (removed) return;
        removed = true;
        if (timer) clearTimeout(timer);
        toast.classList.add("leaving");
        setTimeout(function () { toast.remove(); }, 190);
    }
    close.addEventListener("click", removeToast);
    timer = setTimeout(removeToast, displayDuration);
    return toast;
}

if (elements.actionConfirmCancel) elements.actionConfirmCancel.addEventListener("click", function () { closeActionConfirm(false); });
if (elements.actionConfirmSubmit) elements.actionConfirmSubmit.addEventListener("click", function () { closeActionConfirm(true); });
if (elements.actionConfirmModal) elements.actionConfirmModal.addEventListener("click", function (event) { if (event.target === elements.actionConfirmModal) closeActionConfirm(false); });
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && elements.actionConfirmModal && !elements.actionConfirmModal.classList.contains("hidden")) {
        event.preventDefault();
        closeActionConfirm(false);
    }
});

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

function renderMenuStatus() {
    const online = !state.menuStatus || state.menuStatus.online !== false;
    elements.menuStatusPanel.classList.toggle("offline", !online);
    elements.menuStatusTitle.textContent = online ? "Lua-Menü ist online" : "Lua-Menü ist offline";
    elements.menuStatusText.textContent = online
        ? "Jeder kann das Lua-Script normal starten und verwenden."
        : "Alle Lua-Starts sind blockiert. Bereits laufende Scripts werden vollständig beendet.";
    elements.menuStatusBadge.classList.toggle("offline", !online);
    elements.menuStatusBadgeText.textContent = online ? "ONLINE" : "OFFLINE";
    if (elements.menuStatusToggleButton) {
        elements.menuStatusToggleButton.classList.toggle("enable", !online);
        elements.menuStatusToggleButton.textContent = online ? "MENÜ OFFLINE SCHALTEN" : "MENÜ ONLINE SCHALTEN";
        elements.menuStatusToggleButton.title = online
            ? "Blockiert alle neuen Lua-Starts und beendet aktive Scripts"
            : "Erlaubt neue Lua-Starts wieder";
    }
}

async function updateMenuStatus(online) {
    const response = await fetch("/api/admin/menu/status", {
        method:"POST",
        headers:{Accept:"application/json","Content-Type":"application/json"},
        body:JSON.stringify({online:online === true}),
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success !== true) throw new Error(data.error || ("HTTP " + response.status));
    state.menuStatus = data.menuStatus || {online:online === true};
    renderMenuStatus();
    return data;
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
    const reconnecting = online && player.reconnecting === true;
    const menuOperational = !state.menuStatus || state.menuStatus.online !== false;
    const actionableOnline = online && !reconnecting && menuOperational;
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
    const joinable = actionableOnline && /^\d+$/.test(placeId) && placeId !== "0" && jobId !== "-" && !jobId.startsWith("LOCAL-");
    const bringable = actionableOnline && String(player.userId || "") !== "${MENU_CREATOR_USER_ID}";
    const roleKey = String(player.roleKey || "player").replace(/[^a-z0-9_-]/gi,"").toLowerCase() || "player";
    const roleTitle = player.roleTitle || "PLAYERS";
    const stateClass = banned ? "banned" : (online ? "online" : "offline");
    const stateText = banned ? "Gesperrt" : (reconnecting ? "Letzter Stand" : (online ? "Online" : "Offline"));
    const canManageRole = !banned && roleKey !== "creator" && state.permissions.managePlayerRoles === true;
    const roleMenuOpen = canManageRole && state.openRoleUserId === String(player.userId || "");
    const normalizedRoleQuery = roleMenuOpen ? String(state.roleSearchQuery || "").trim().toLocaleLowerCase() : "";
    const roleOptionHtml = PLAYER_ROLE_OPTIONS.map(function (option) {
        const searchText = (option.title + " " + option.key + " " + option.description).toLocaleLowerCase();
        const visible = !normalizedRoleQuery || searchText.includes(normalizedRoleQuery);
        const current = option.key === roleKey;
        return '<button class="role-option ' + escapeHtml(option.key) + (current ? ' current' : '') + '" type="button" data-action="choose-role" data-user-id="' + escapeHtml(player.userId) + '" data-role="' + escapeHtml(option.key) + '" data-role-search-text="' + escapeHtml(searchText) + '" ' + (visible ? '' : 'hidden ') + (current ? 'disabled aria-current="true"' : '') + '>' +
            '<span class="role-option-icon">' + (current ? '✓' : '') + '</span>' +
            '<span class="role-option-copy"><strong>' + escapeHtml(option.title) + '</strong><small>' + escapeHtml(option.description) + '</small></span>' +
        '</button>';
    }).join("");
    const visibleRoleOptionCount = PLAYER_ROLE_OPTIONS.filter(function (option) {
        const searchText = (option.title + " " + option.key + " " + option.description).toLocaleLowerCase();
        return !normalizedRoleQuery || searchText.includes(normalizedRoleQuery);
    }).length;
    const roleBadge = canManageRole
        ? '<div class="role-picker ' + (roleMenuOpen ? 'open' : '') + '">' +
            '<button class="role-badge role-trigger ' + escapeHtml(roleKey) + '" type="button" data-action="toggle-role-menu" data-user-id="' + escapeHtml(player.userId) + '" aria-haspopup="listbox" aria-expanded="' + (roleMenuOpen ? 'true' : 'false') + '">' +
                '<span>' + escapeHtml(roleTitle) + '</span><span class="role-trigger-chevron">⌄</span>' +
            '</button>' +
            '<div class="role-dropdown" role="dialog" aria-label="Rang für ' + escapeHtml(name) + ' auswählen">' +
                '<div class="role-dropdown-head"><div><span>RANG ÄNDERN</span><strong>' + escapeHtml(name) + '</strong></div><span class="role-dropdown-badge">' + escapeHtml(player.userId) + '</span></div>' +
                '<label class="role-search-wrap"><span class="role-search-icon">⌕</span><input class="role-search" type="search" autocomplete="off" spellcheck="false" placeholder="Rang suchen …" value="' + escapeHtml(roleMenuOpen ? state.roleSearchQuery : '') + '" data-role-search data-user-id="' + escapeHtml(player.userId) + '"></label>' +
                '<div class="role-option-list" role="listbox">' + roleOptionHtml + '</div>' +
                '<div class="role-empty ' + (visibleRoleOptionCount > 0 ? 'hidden' : '') + '">Kein Rang gefunden.</div>' +
            '</div>' +
        '</div>'
        : '<div class="role-badge ' + escapeHtml(roleKey) + '">' + escapeHtml(roleTitle) + '</div>';
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
    const dmButton = actionableOnline && state.permissions.dm === true
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

    return '<article class="player ' + (banned ? 'banned' : (online ? 'online' : 'offline')) + (roleMenuOpen ? ' role-menu-open' : '') + '">' +
        '<img class="avatar" src="' + escapeHtml(player.avatarUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' +
        '<div class="identity">' +
            '<div class="display-name">' + escapeHtml(name) + '</div>' +
            '<div class="username">@' + escapeHtml(username) + ' · ' + escapeHtml(player.userId) + '</div>' +
            roleBadge +
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
    renderMenuStatus();
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
    let shouldRender = false;
    const controller = new AbortController();
    const requestTimeout = setTimeout(function () { controller.abort(); }, 15000);

    try {
        const tokenQuery = state.snapshotToken
            ? ("?snapshotToken=" + encodeURIComponent(state.snapshotToken))
            : "";
        const response = await fetch("/api/presence" + tokenQuery, {
            headers:{ Accept:"application/json" },
            cache:"no-store",
            signal:controller.signal,
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();
        state.online = data.online === true;
        state.lastSuccessfulRefreshAt = Date.now();
        state.refreshFailures = 0;
        const wasStale = state.stale;
        state.stale = false;

        if (data.unchanged === true) {
            state.snapshotToken = String(data.snapshotToken || state.snapshotToken || "");
            state.serverInstanceId = String(data.serverInstanceId || state.serverInstanceId || "");
            state.activePlayers = Number(data.activePlayers) || state.activePlayers;
            let menuStatusChanged = false;
            if (data.menuStatus && typeof data.menuStatus === "object") {
                const previousMenuOnline = !state.menuStatus || state.menuStatus.online !== false;
                const nextMenuOnline = data.menuStatus.online !== false;
                const previousMenuChangedAt = Number(state.menuStatus && state.menuStatus.changedAtMs) || 0;
                const nextMenuChangedAt = Number(data.menuStatus.changedAtMs) || 0;
                menuStatusChanged = previousMenuOnline !== nextMenuOnline || previousMenuChangedAt !== nextMenuChangedAt;
                state.menuStatus = data.menuStatus;
            }
            shouldRender = wasStale || menuStatusChanged;
        } else {
            const incomingPlayers = Array.isArray(data.players) ? data.players : [];
            const authoritativeActiveIds = new Set(
                (Array.isArray(data.activeUserIds) ? data.activeUserIds : [])
                    .map(function (userId) { return String(userId || ""); })
                    .filter(Boolean)
            );
            const hasAuthoritativeActiveList = Array.isArray(data.activeUserIds);
            const incomingServerInstanceId = String(data.serverInstanceId || "");
            const serverRestarted = Boolean(
                state.serverInstanceId &&
                incomingServerInstanceId &&
                state.serverInstanceId !== incomingServerInstanceId
            );
            const warmupActive = data.presenceWarmup === true;
            if (serverRestarted || warmupActive) {
                const holdMs = Math.max(12_000, Math.min(90_000, Number(data.presenceWarmupRemainingMs) || 20_000));
                state.warmupHoldUntil = Math.max(state.warmupHoldUntil, Date.now() + holdMs);
            }

            const incomingMapped = incomingPlayers.map(function (player) {
                const userId = String(player.userId || "");
                const isActive = hasAuthoritativeActiveList
                    ? authoritativeActiveIds.has(userId)
                    : player.online === true;
                return Object.assign({}, player, { online:isActive, reconnecting:false });
            });
            const incomingActiveCount = hasAuthoritativeActiveList
                ? authoritativeActiveIds.size
                : incomingMapped.filter(function (player) { return player.online === true; }).length;
            const previousActiveCount = state.players.filter(function (player) { return player.online === true; }).length;
            const holdPreviousSnapshot = Date.now() < state.warmupHoldUntil && incomingActiveCount < previousActiveCount;

            if (holdPreviousSnapshot) {
                const incomingById = new Map(incomingMapped.map(function (player) { return [String(player.userId || ""), player]; }));
                state.players = state.players.map(function (player) {
                    const incoming = incomingById.get(String(player.userId || ""));
                    if (incoming) {
                        incomingById.delete(String(player.userId || ""));
                        return incoming;
                    }
                    return player.online === true
                        ? Object.assign({}, player, { reconnecting:true })
                        : player;
                }).concat(Array.from(incomingById.values()));
                state.activePlayers = previousActiveCount;
            } else {
                state.players = incomingMapped;
                state.activePlayers = incomingActiveCount;
                if (!warmupActive) state.warmupHoldUntil = 0;
            }

            state.bannedPlayers = Array.isArray(data.bannedPlayers) ? data.bannedPlayers : [];
            state.menuUpdate = data.menuUpdate && typeof data.menuUpdate === "object" ? data.menuUpdate : {active:false,remainingSeconds:0};
            state.menuStatus = data.menuStatus && typeof data.menuStatus === "object" ? data.menuStatus : (state.menuStatus || {online:true});
            state.updateSyncedAt = Date.now();
            state.snapshotToken = String(data.snapshotToken || "");
            state.serverInstanceId = incomingServerInstanceId;
            shouldRender = true;
        }
    } catch (error) {
        console.error("Nexu refresh failed:",error);
        state.online = false;
        state.refreshFailures += 1;
        state.stale = state.players.length > 0 || state.bannedPlayers.length > 0;
        state.players = state.players.map(function (player) {
            return player.online === true
                ? Object.assign({}, player, { reconnecting:true })
                : player;
        });
        shouldRender = true;
    } finally {
        clearTimeout(requestTimeout);
        presenceRefreshInFlight = false;
    }

    if (shouldRender) {
        render();
    }
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
if (elements.menuStatusToggleButton) elements.menuStatusToggleButton.addEventListener("click", async function () {
    const currentlyOnline = !state.menuStatus || state.menuStatus.online !== false;
    if (currentlyOnline) {
        const approved = await openActionConfirm({
            tone:"danger",
            eyebrow:"NEXU // MENU STATUS",
            title:"Lua-Menü global offline schalten?",
            message:"Alle aktuell laufenden Scripts werden vollständig beendet. Neue Starts bleiben für jeden blockiert, bis du den Menüstatus wieder auf ONLINE stellst.",
            confirmText:"GLOBAL OFFLINE",
        });
        if (!approved) return;
    }
    const originalText = elements.menuStatusToggleButton.textContent;
    elements.menuStatusToggleButton.disabled = true;
    elements.menuStatusToggleButton.textContent = currentlyOnline ? "SCHALTE OFFLINE …" : "SCHALTE ONLINE …";
    try {
        const result = await updateMenuStatus(!currentlyOnline);
        if (currentlyOnline) {
            showToast("Menü ist jetzt OFFLINE. " + (result.targetedPlayers || 0) + " Spieler / " + (result.targetedSessions || 0) + " Sitzung(en) wurden beendet.", "warning", 6200);
        } else {
            showToast("Menü ist wieder ONLINE. Neue Lua-Starts sind ab sofort erlaubt.", "success");
        }
        await refresh();
    } catch (error) {
        showToast(error.message || "Menüstatus konnte nicht geändert werden.", "error");
    } finally {
        elements.menuStatusToggleButton.disabled = false;
        if (elements.menuStatusToggleButton.textContent.includes("…")) elements.menuStatusToggleButton.textContent = originalText;
        renderMenuStatus();
    }
});
if (elements.shutdownAllButton) elements.shutdownAllButton.addEventListener("click", async function () {
    const approved = await openActionConfirm({
        tone:"danger",
        eyebrow:"NEXU // GLOBAL SHUTDOWN",
        title:"Alle aktiven Scripts deaktivieren?",
        message:"Alle aktuell verbundenen Nexu-Sitzungen erhalten sofort den Abschaltbefehl. Der Menüstatus bleibt ONLINE und die Spieler können das Script danach erneut starten.",
        confirmText:"ALLE DEAKTIVIEREN",
    });
    if (!approved) return;
    const originalText = elements.shutdownAllButton.textContent;
    elements.shutdownAllButton.disabled = true;
    elements.shutdownAllButton.textContent = "DEAKTIVIERE …";
    try {
        const result = await shutdownAllActiveScripts();
        showToast((result.targetedPlayers || 0) + " Spieler / " + (result.targetedSessions || 0) + " aktive Sitzung(en) wurden zum Deaktivieren markiert.", "success", 5600);
        await refresh();
    } catch (error) {
        showToast(error.message || "Scripts konnten nicht deaktiviert werden.", "error");
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
function closeRoleMenus(exceptPicker) {
    document.querySelectorAll(".role-picker.open").forEach(function (picker) {
        if (picker !== exceptPicker) {
            picker.classList.remove("open");
            const trigger = picker.querySelector("[data-action=\"toggle-role-menu\"]");
            if (trigger) trigger.setAttribute("aria-expanded","false");
            const card = picker.closest(".player");
            if (card) card.classList.remove("role-menu-open");
        }
    });
    if (!exceptPicker) {
        state.openRoleUserId = "";
        state.roleSearchQuery = "";
    }
}

function applyRoleSearch(input) {
    const picker = input && input.closest ? input.closest(".role-picker") : null;
    if (!picker) return;
    const query = String(input.value || "").trim().toLocaleLowerCase();
    const userId = String(input.dataset.userId || "");
    state.openRoleUserId = userId;
    state.roleSearchQuery = input.value || "";
    let visibleCount = 0;
    picker.querySelectorAll(".role-option").forEach(function (option) {
        const searchText = String(option.dataset.roleSearchText || "").toLocaleLowerCase();
        const visible = !query || searchText.includes(query);
        option.hidden = !visible;
        if (visible) visibleCount += 1;
    });
    const empty = picker.querySelector(".role-empty");
    if (empty) empty.classList.toggle("hidden", visibleCount > 0);
}

document.addEventListener("input", function (event) {
    const input = event.target.closest && event.target.closest("[data-role-search]");
    if (input) applyRoleSearch(input);
});

document.addEventListener("keydown", function (event) {
    const input = event.target.closest && event.target.closest("[data-role-search]");
    if (!input) {
        if (event.key === "Escape" && state.openRoleUserId) closeRoleMenus();
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        const picker = input.closest(".role-picker");
        const trigger = picker && picker.querySelector("[data-action=\"toggle-role-menu\"]");
        closeRoleMenus();
        if (trigger) trigger.focus();
    } else if (event.key === "Enter") {
        const firstVisible = Array.from(input.closest(".role-picker").querySelectorAll(".role-option:not([hidden]):not(:disabled)"))[0];
        if (firstVisible) {
            event.preventDefault();
            firstVisible.click();
        }
    }
});

document.addEventListener("click",async function (event) {
    const button = event.target.closest("[data-action][data-user-id]");
    const clickedPicker = event.target.closest(".role-picker");
    if (!button) {
        if (!clickedPicker) closeRoleMenus();
        return;
    }

    if (button.dataset.action === "toggle-role-menu") {
        event.preventDefault();
        const picker = button.closest(".role-picker");
        if (!picker) return;
        const opening = !picker.classList.contains("open");
        closeRoleMenus(opening ? picker : null);
        picker.classList.toggle("open", opening);
        button.setAttribute("aria-expanded", opening ? "true" : "false");
        const card = picker.closest(".player");
        if (card) card.classList.toggle("role-menu-open", opening);
        state.openRoleUserId = opening ? String(button.dataset.userId || "") : "";
        state.roleSearchQuery = "";
        const search = picker.querySelector("[data-role-search]");
        if (search) {
            search.value = "";
            applyRoleSearch(search);
            if (opening) setTimeout(function () { if (search.isConnected) search.focus(); }, 20);
        }
        return;
    }

    if (button.dataset.action === "choose-role") {
        event.preventDefault();
        const roleKey = String(button.dataset.role || "").trim();
        const picker = button.closest(".role-picker");
        const trigger = picker && picker.querySelector(".role-trigger");
        const originalTriggerHtml = trigger ? trigger.innerHTML : "";
        if (trigger) {
            trigger.disabled = true;
            trigger.innerHTML = '<span>WIRD GEÄNDERT …</span><span class="role-trigger-spinner"></span>';
        }
        picker && picker.querySelectorAll(".role-option").forEach(function (option) { option.disabled = true; });
        try {
            const result = await setPlayerRole(button.dataset.userId,roleKey);
            state.openRoleUserId = "";
            state.roleSearchQuery = "";
            showToast("Rang wurde auf " + String(result.roleTitle || roleKey).toUpperCase() + " geändert.", "success");
            await refresh();
        } catch (error) {
            showToast(error.message || "Rang konnte nicht gespeichert werden.", "error");
            if (trigger && trigger.isConnected) {
                trigger.disabled = false;
                trigger.innerHTML = originalTriggerHtml;
            }
            if (picker && picker.isConnected) {
                picker.querySelectorAll(".role-option").forEach(function (option) {
                    option.disabled = option.classList.contains("current");
                });
            }
        }
        return;
    }

    closeRoleMenus();

    if (button.dataset.action === "join") {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "SENDE …";
        try {
            const result = await queueServerJoin(button.dataset.userId);
            button.textContent = result.ownerOnline ? "JOIN GESENDET" : "WARTET AUF SPIEL";
            showToast(result.ownerOnline ? "Server-Join wurde gesendet." : "Join-Befehl wartet, bis dein Script aktiv ist.", "success");
        } catch (error) {
            showToast(error.message || "Server-Join konnte nicht gesendet werden.", "error");
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
            showToast("Bring-Befehl wurde an den Spieler gesendet.", "success");
        } catch (error) {
            showToast(error.message || "Bring konnte nicht gesendet werden.", "error");
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
        showToast("Spieler wurde entbannt.", "success");
    } catch (error) {
        showToast(error.message || "Entbannen fehlgeschlagen.", "error");
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
setInterval(refresh,2000);
setInterval(renderUpdateStatus,250);
</script>

</body>
</html>`;
}

loadBans();loadKnownPlayers();loadDashboardAccount();loadRememberedDashboardDevices();loadMenuUpdateState();loadMenuAvailabilityState();
const githubStorageStartupPromise = Promise.all([loadGitHubStorage(), loadGitHubAccounts()]).then(() => { syncPresenceRevision(); console.log("[NEXU] Gespeicherte Spieler und Accounts geladen; Online-Status wartet auf echte Heartbeats"); }).catch((error) => { syncPresenceRevision(); console.warn("[NEXU] GitHub-Startspeicher fehlgeschlagen:", error.message); });

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
        menuStatus: getMenuAvailabilityStatus(),
        pendingShutdownSessions: shutdownCommandsBySession.size,
        serverStartedAtMs: SERVER_STARTED_AT_MS,
        presenceWarmup: Date.now() - SERVER_STARTED_AT_MS < PRESENCE_RESTART_GRACE_MS,
        presenceWarmupRemainingMs: Math.max(0, PRESENCE_RESTART_GRACE_MS - (Date.now() - SERVER_STARTED_AT_MS)),
        timestamp: new Date().toISOString(),
    });
    return;
}

if (req.method === "GET" && pathname === "/api/menu/access") {
    const userId = cleanNumericId(requestUrl.searchParams.get("userId"));
    const sessionId = cleanText(requestUrl.searchParams.get("sessionId"), 100);
    const sessionStartedAtMs = cleanInteger(
        requestUrl.searchParams.get("sessionStartedAtMs") ||
        requestUrl.searchParams.get("startedAtMs")
    );

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
    const menuStatus = getMenuAvailabilityStatus();
    const shutdown = menuStatus.online
        ? getShutdownCommandForClient(userId, sessionId, sessionStartedAtMs)
        : getMenuOfflineShutdownStatus();
    sendJson(res, 200, {
        success: true,
        allowed: menuStatus.online && !ban && !menuUpdate.active && shutdown.active !== true,
        menuOnline: menuStatus.online,
        menuOffline: menuStatus.online !== true,
        menuStatus,
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
        reason: ban ? ban.reason : (menuStatus.online ? "" : "Das Nexu-Menü ist derzeit offline."),
        bannedAt: ban ? ban.bannedAt : "",
        timestamp: new Date().toISOString(),
    });
    return;
}



if (req.method === "POST" && pathname === "/api/admin/menu/status") {
    const session = getDashboardSession(req);
    if (!session || !(session.isOwner === true || hasDashboardPermission(session.account, "menuStatus"))) {
        sendJson(res, 403, {success:false,error:dashboardPermissionError("menuStatus")});
        return;
    }
    try {
        const body = await readJsonBody(req);
        if (typeof body.online !== "boolean") {
            sendJson(res, 400, {success:false,error:"online muss true oder false sein"});
            return;
        }
        const result = setMenuAvailability(body.online, session.username);
        console.log(`[NEXU] Menüstatus ${result.menuStatus.online ? "ONLINE" : "OFFLINE"} durch ${session.username}`);
        sendJson(res, 200, {success:true,...result});
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {success:false,error:"Menüstatus konnte nicht geändert werden"});
    }
    return;
}

if (req.method === "POST" && pathname === "/api/admin/shutdown/all") {
    const session = getDashboardSession(req);
    if (!session || !(session.isOwner === true || hasDashboardPermission(session.account, "shutdownScript"))) {
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
    prunePresence();
    // V168: Vor dem Unchanged-Vergleich immer die sichtbaren Presence-Metadaten
    // (insbesondere Rang/Rangfarbe) in die Revision einbeziehen. Ohne diesen Schritt
    // konnten Clients denselben Snapshot-Token behalten und Rangänderungen nie laden.
    syncPresenceRevision();
    const requestedToken = cleanText(requestUrl.searchParams.get("snapshotToken"), 200);
    const currentToken = getPresenceSnapshotToken();
    if (requestedToken && requestedToken === currentToken) {
        sendJson(res, 200, {
            success: true,
            online: true,
            unchanged: true,
            activePlayers: countActivePresenceUsers(),
            menuStatus: getMenuAvailabilityStatus(),
            revision: presenceRevision,
            snapshotToken: currentToken,
            serverInstanceId: SERVER_INSTANCE_ID,
            snapshotGeneratedAtMs: Date.now(),
            presenceWarmup: Date.now() - SERVER_STARTED_AT_MS < PRESENCE_RESTART_GRACE_MS,
            presenceWarmupRemainingMs: Math.max(0, PRESENCE_RESTART_GRACE_MS - (Date.now() - SERVER_STARTED_AT_MS)),
            timestamp: new Date().toISOString(),
        });
        return;
    }

    const data = await getPublicPresence();
    sendJson(res, 200, {
        success: true,
        online: true,
        unchanged: false,
        activePlayers: data.activeCount,
        activeUserIds: data.activeUserIds,
        revision: data.revision,
        snapshotToken: data.snapshotToken,
        serverInstanceId: data.serverInstanceId,
        snapshotGeneratedAtMs: data.snapshotGeneratedAtMs,
        activeWindowSeconds: ACTIVE_PRESENCE_WINDOW_MS / 1000,
        bannedCount: data.bannedPlayers.length,
        timeoutSeconds: PRESENCE_ENTRY_RETENTION_MS / 1000,
        heartbeatMode: "per-script-session-lease",
        players: data.players,
        bannedPlayers: data.bannedPlayers,
        menuUpdate: getMenuUpdateStatus(),
        menuStatus: getMenuAvailabilityStatus(),
        pendingShutdownSessions: shutdownCommandsBySession.size,
        serverStartedAtMs: SERVER_STARTED_AT_MS,
        presenceWarmup: Date.now() - SERVER_STARTED_AT_MS < PRESENCE_RESTART_GRACE_MS,
        presenceWarmupRemainingMs: Math.max(0, PRESENCE_RESTART_GRACE_MS - (Date.now() - SERVER_STARTED_AT_MS)),
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
        const selfUserId = cleanNumericId(body.userId);
        const selfSessionId = sessionId;
        const selfSessionStartedAtMs = cleanInteger(
            body.sessionStartedAtMs || body.startedAtMs
        );

        // Der Abschaltbefehl wird VOR dem erneuten Eintragen in presence geprüft.
        // So bleibt die Website nach „ALLE SCRIPTS AUS“ sofort offline und ein
        // alter Client kann sich nicht für einen einzelnen Heartbeat zurückmelden.
        const menuStatus = getMenuAvailabilityStatus();
        const pendingShutdown = menuStatus.online
            ? (selfUserId
                ? getShutdownCommandForClient(
                    selfUserId,
                    selfSessionId,
                    selfSessionStartedAtMs
                )
                : { active: false })
            : getMenuOfflineShutdownStatus();
        if (pendingShutdown.active === true) {
            sendJson(res, 200, {
                success: true,
                activePlayers: countActivePresenceUsers(),
                activeSessions: presence.size,
                receivedPlayers: 0,
                blockedUserIds: [],
                menuOnline: menuStatus.online,
                menuOffline: menuStatus.online !== true,
                menuStatus,
                shutdown: pendingShutdown,
                timestamp: new Date().toISOString(),
            });
            return;
        }

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
                if (playerChange === "important" && GITHUB_PLAYER_AUTOSAVE_ENABLED) {
                    scheduleGitHubStorageSave("player-identity", 30_000);
                }
            }
        }

        if (knownPlayersChanged) {
            saveKnownPlayers();
        }

        prunePresence();
        syncPresenceRevision(now);

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

        const selfRole = selfUserId ? getNexuRoleInfo(selfUserId) : null;
        const activePlayerCount = countActivePresenceUsers();
        console.log(
            `[NEXU] Heartbeat: ${selfUserId || "unbekannt"}, ` +
                `Session ${selfSessionId || "ohne-id"}, ` +
                `${activePlayerCount} Spieler / ${presence.size} Sessions aktiv`
        );
        const finalMenuStatus = getMenuAvailabilityStatus();
        const shutdown = finalMenuStatus.online
            ? (selfUserId
                ? getShutdownCommandForClient(
                    selfUserId,
                    selfSessionId,
                    selfSessionStartedAtMs
                )
                : { active: false })
            : getMenuOfflineShutdownStatus();
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
            menuOnline: finalMenuStatus.online,
            menuOffline: finalMenuStatus.online !== true,
            menuStatus: finalMenuStatus,
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
        }
        syncPresenceRevision(now);

        sendJson(res, 200, { success: true, removed, snapshotToken: getPresenceSnapshotToken() });
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
        // V168: Aktive Lua-Clients müssen sofort einen neuen Snapshot-Token sehen.
        // Die Rangfarbe des Ingame-Banners wird dadurch ohne Script-Neustart aktualisiert.
        syncPresenceRevision();
        const role = getNexuRoleInfo(userId);

        console.log(`[NEXU] RANG ${userId} -> ${role.key}`);

        sendJson(res, 200, {
            success: true,
            persisted,
            userId,
            roleKey: role.key,
            roleTitle: role.title,
            revision: presenceRevision,
            snapshotToken: getPresenceSnapshotToken(),
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
    try {
        const body = await readJsonBody(req);
        const authorization = getBanMutationAuthorization(req, body);
        if (!authorization.authorized) {
            sendJson(res, 403, {
                success: false,
                error: "Aktive Menu-Creator-Sitzung oder Ban-Berechtigung erforderlich",
            });
            return;
        }

        const userId = cleanNumericId(body.userId);
        if (!userId) {
            sendJson(res, 400, { success: false, error: "Ungültige User-ID" });
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
            bannedBy: authorization.source,
        };

        bans.set(userId, record);
        const removedPresence = removePresenceForUser(userId);
        directMessages.delete(userId);
        const persisted = saveBans();

        console.log(
            `[NEXU] BAN ${userId} durch ${authorization.source}; Presence entfernt: ${removedPresence}`
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
    try {
        const body = await readJsonBody(req);
        const authorization = getBanMutationAuthorization(req, body);
        if (!authorization.authorized) {
            sendJson(res, 403, {
                success: false,
                error: "Aktive Menu-Creator-Sitzung oder Ban-Berechtigung erforderlich",
            });
            return;
        }

        const userId = cleanNumericId(body.userId);
        if (!userId) {
            sendJson(res, 400, { success: false, error: "Ungültige User-ID" });
            return;
        }

        const existed = bans.delete(userId);
        const persisted = saveBans();

        console.log(`[NEXU] UNBAN ${userId} durch ${authorization.source}; vorhanden: ${existed}`);

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
    const pending = [];
    if (githubStorageReady && githubStorageDirty && isGitHubStorageConfigured() && GITHUB_STORAGE_WRITES_ALLOWED) {
        if (githubStorageTimer) {
            clearTimeout(githubStorageTimer);
            githubStorageTimer = null;
            githubStorageDueAtMs = 0;
        }
        pending.push(writeGitHubStorageNow());
    }
    if (githubAccountsReady && githubAccountsDirty && isGitHubAccountsConfigured() && GITHUB_ACCOUNTS_WRITES_ALLOWED) {
        if (githubAccountsTimer) {
            clearTimeout(githubAccountsTimer);
            githubAccountsTimer = null;
            githubAccountsDueAtMs = 0;
        }
        pending.push(writeGitHubAccountsNow());
    }
    if (pending.length > 0) await Promise.allSettled(pending);
}

async function startNexuServer() {
    await githubStorageStartupPromise;

    server.listen(PORT, "0.0.0.0", () => {
        console.log("========================================");
        console.log("NEXU PRESENCE & MODERATION V164 GESTARTET");
        console.log("Port:", PORT);
        console.log("Heartbeat-Schutz:", HEARTBEAT_TOKEN ? "AKTIV" : "AUS (Kompatibilitätsmodus)");
        console.log("Ban-Datei:", BAN_FILE_PATH);
        console.log("Spieler-Speicher:", KNOWN_PLAYERS_FILE_PATH);
        console.log("GitHub-Speicher:", isGitHubStorageConfigured() ? "AKTIV" : "NICHT KONFIGURIERT");
        console.log("GitHub-Datendatei:", `${GITHUB_DATA_OWNER}/${GITHUB_DATA_REPO}/${GITHUB_DATA_PATH}`);
        console.log("GitHub-Accountdatei:", `${GITHUB_DATA_OWNER}/${GITHUB_DATA_REPO}/${GITHUB_ACCOUNTS_PATH}`);
        console.log("Accountdatei-Verschlüsselung:", "AES-256-GCM");
        console.log("Dashboard-Anmeldung: /");
        console.log("Dashboard-Accounts:", dashboardAccounts.size);
        console.log("Owner-Account vorhanden:", getOwnerDashboardAccount() ? "JA" : "NEIN");console.log("Owner-Rundsendung:", getOwnerDashboardAccount() && hasDashboardPermission(getOwnerDashboardAccount(), "dm") ? "FREIGEGEBEN" : "NICHT FREIGEGEBEN");console.log("Owner-Session-Fix:", "V148 SIGNIERT UND NEUSTARTFEST");
        console.log("Presence: /api/presence");
        console.log("Presence-Aufbewahrung:", Math.round(PRESENCE_ENTRY_RETENTION_MS / 1000), "Sekunden");
        console.log("Presence-Neustart-Schutz:", Math.round(PRESENCE_RESTART_GRACE_MS / 1000), "Sekunden");
        console.log("Direct Messages: /api/dm/send + /api/dm/broadcast + /api/dm/poll");
        console.log("Website Join: /api/join/send + /api/join/poll");
        console.log("Access: /api/menu/access?userId=...");
        console.log("Script-Update-Datei:", MENU_UPDATE_FILE_PATH);
        console.log("Menüstatus-Datei:", MENU_STATUS_FILE_PATH);
        console.log("Script-Update:", getMenuUpdateStatus().active ? "AKTIV" : "INAKTIV");
        console.log("Globales Deaktivieren: /api/admin/shutdown/all");console.log("Dashboard-Button-Fix: V156 ALLE SCRIPTS AUS SICHTBAR");console.log("Menüstatus: V162 PERSISTENT ONLINE/OFFLINE + STARTSPERRE");console.log("Dashboard-Aktionsfeedback: V163 EIGENE DIALOGE + TOASTS // KEINE BROWSER-POPUPS");console.log("Account-Persistenz: V164 SEPARATE VERSCHLÜSSELTE GITHUB-DATEI // CHANGE-ONLY");console.log("Design-Refresh: V165 MODERNE GLASS UI + VISUELLE AUFWERTUNG");console.log("Design-Refresh: V166 ULTRA MODERN HEADER + PREMIUM DASHBOARD VISUALS");console.log("Ingame-Moderation: V172 AKTIVE CREATOR-SESSION + BAN/UNBAN");console.log("Rang-Banner-Sync: V168 LIVE SNAPSHOT INVALIDATION + INGAME COLOR REFRESH");console.log("Rang-Auswahl: V167 SUCHBARES DROPDOWN AM AKTUELLEN RANG");console.log("Owner-Session-Fix: V148 SIGNIERT UND NEUSTARTFEST");console.log("Global-Shutdown-Fix: V149 SESSION-SNAPSHOT + SOFORT-OFFLINE");console.log("Presence-Abgleich: V154 STABILE USER-LEASE + RESTART-WARMUP");console.log("Persistenz: NUR NEUE/GEÄNDERTE IDENTITÄTEN // KEINE HEARTBEAT-SPEICHERUNG");console.log("GitHub-Deduplizierung: INHALTSHASH // KEIN COMMIT OHNE DATENÄNDERUNG");console.log("Dashboard-Ausfallschutz: LETZTEN SNAPSHOT BEHALTEN");console.log("Aktiv-Fenster:", Math.round(ACTIVE_PRESENCE_WINDOW_MS / 1000), "Sekunden");console.log("Server-Instanz:", SERVER_INSTANCE_ID);console.log("GitHub-Schreiben:", GITHUB_STORAGE_WRITES_ALLOWED ? "AKTIV AUF DATEN-BRANCH" : "GESPERRT AUF DEPLOY-BRANCH");
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
