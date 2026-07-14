// V216: Kontextabhängige mehrsprachige Chatmoderation für Website und Lua; erkannte Beleidigungen, Hassrede, Drohungen und sexuelle Inhalte werden vollständig mit # ersetzt.
// SHARED GHOST: Sichtbare Geist-Klone für Nexu-Nutzer derselben Roblox-Serverinstanz.
// V215: Globaler Chat wird täglich um 00:00 Europe/Berlin geleert; Reset synchronisiert Website und Lua, Nachrichten liefern Rangdaten.
// V214: Alle Website-Konten benötigen eine eindeutige Roblox-User-ID; Owner kann Verknüpfungen verwalten und der Chat nutzt die jeweilige Roblox-Identität.
// V213: Globaler Chat als vierter Reiter der Übersicht; OwnerAccount ist mit Roblox-ID 10199760908 verbunden.
// V212: Globaler Nexu-Chat für alle aktiven Script-Nutzer mit Sitzungsschutz, Verlauf und Rate-Limit.
// V211: Owner-Aktion zum sicheren Leeren aller gespeicherten Spieler mit lokaler und GitHub-Persistenz.
// V210: Experimentelle Endpunkte für geteilte Geistdarstellung entfernt. Alle V207-Funktionen bleiben erhalten.
// V207: Rundsendungen unterstützen frei wählbare Anzeigedauer in Sekunden oder Minuten.
// V206: Öffentliche Startseite ohne Login-Zwang, direkte Aufbauanimation, persistente Anmeldung und Owner-Verwaltung außerhalb der Startkacheln.
// V205: Einheitliches Button- und Bedienelement-System mit festen Höhen, konsistenten Schriftgrößen und sauberem Aktionsraster.
// V204: Vollständiger professioneller Neuaufbau aller Seiten mit klarer Informationsarchitektur, ruhigerem Design und unveränderten Funktionen.
// V203: Spielerinformationen als ein gemeinsamer, kompakter Informationsblock statt einzelner voneinander getrennter Felder.
// V202: Kompakte Spielerkarten, kleinere Aktionsschaltflächen, lesbare Serverinformationen und zuverlässige Rang-Auswahl.
// V201: Vollständig deutsche Oberfläche, "Dashboard" wird zu "Übersicht", neue linke Serverzentrale mit Live-Metriken, Navigation und Laufzeitprüfung.
const http = require("node:http");const fs = require("node:fs");const path = require("node:path");const crypto = require("node:crypto");
// V200: NEXU AURORA-ERLEBNIS — professionelles, responsives Designsystem für Login, Startseite, Accounts und Menu-Server.
// V200: Cinematic Startsequenz, echte Landingpage-Sektionen, konsistente Oberflächen, Micro-Interactions und Reduced-Motion-Fallback.
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

const PORT = Number(process.env.PORT || 3000);const HEARTBEAT_TOKEN = String(process.env.HEARTBEAT_TOKEN || "");const NEXU_INGAME_ADMIN_KEY = String(process.env.NEXU_INGAME_ADMIN_KEY || process.env.NEXU_ADMIN_KEY || "");const ONLINE_TIMEOUT_MS = (() => {const configured = Number(process.env.PRESENCE_TIMEOUT_MS || 2 * 60_000);return Number.isFinite(configured) ? Math.min(10 * 60_000, Math.max(60_000, Math.floor(configured))) : 2 * 60_000;})();const ACTIVE_PRESENCE_WINDOW_MS = (() => {const configured = Number(process.env.ACTIVE_PRESENCE_WINDOW_MS || 120_000);return Number.isFinite(configured) ? Math.min(5 * 60_000, Math.max(120_000, Math.floor(configured))) : 120_000;})();const PRESENCE_ENTRY_RETENTION_MS = Math.max(ONLINE_TIMEOUT_MS, ACTIVE_PRESENCE_WINDOW_MS + 30_000);const SERVER_STARTED_AT_MS = Date.now();const SERVER_INSTANCE_ID = crypto.randomUUID();const PRESENCE_RESTART_GRACE_MS = 25_000;const PRESENCE_RESTORE_WINDOW_MS = Math.max(PRESENCE_ENTRY_RETENTION_MS, 5 * 60_000);const MAX_BODY_BYTES = 100_000;const AVATAR_CACHE_MS = 10 * 60_000;const GLOBAL_SHUTDOWN_COMMAND_TTL_MS = 5 * 60_000;const NEXU_LOADER_COMMAND = 'loadstring(game:HttpGet("https://raw.githubusercontent.com/niklasrl720-bit/Nexu-Menu/refs/heads/main/Nexu%20Main"))()';const MAX_MENU_UPDATE_MINUTES = 24 * 60;const MENU_CREATOR_USER_ID = "10199760908";const MENU_CREATOR_RANK_ENABLED = true;const DEFAULT_SUPPORTER_USER_IDS = new Set(["11203703629"]);const PLAYER_ROLE_KEYS = new Set(["player", "supporter"]);const PLAYER_ROLE_TITLES = {player: "PLAYERS", supporter: "SUPPORTER"};const BRING_COMMAND_TTL_MS = 2 * 60_000;const DM_MAX_LENGTH = 240;const DM_TTL_MS = 10 * 60_000;const DM_QUEUE_LIMIT = 12;const DM_RATE_WINDOW_MS = 30_000;const DM_RATE_LIMIT = 10;const CHAT_MAX_LENGTH = 300;const CHAT_TIME_ZONE = String(process.env.CHAT_TIME_ZONE || "Europe/Berlin").trim() || "Europe/Berlin";const CHAT_HISTORY_LIMIT = 240;const CHAT_POLL_LIMIT = 100;const CHAT_RATE_WINDOW_MS = 12_000;const CHAT_RATE_LIMIT = 5;const GHOST_STATE_TTL_MS = 3_200;const GHOST_SYNC_MIN_INTERVAL_MS = 80;const GHOST_MAX_VISIBLE_STATES = 24;const GHOST_HISTORY_LIMIT = 10;const GHOST_HISTORY_WINDOW_MS = 1_900;const OWNER_ACCOUNT_ROBLOX_USER_ID = "10199760908";const OWNER_ACCOUNT_USERNAME = "OwnerAccount";const DASHBOARD_DEFAULT_USERNAME = String(process.env.DASHBOARD_USERNAME || OWNER_ACCOUNT_USERNAME);const DASHBOARD_DEFAULT_EMAIL = String(process.env.DASHBOARD_EMAIL || "owner@nexu.local");const DASHBOARD_DEFAULT_PASSWORD_HASH = String(process.env.DASHBOARD_PASSWORD_HASH ||"df3b0f6227afa43d620dc1c5c639dab7036878674a3c7e699c9583be6425f2d8").toLowerCase();const DASHBOARD_SESSION_COOKIE = "nexu_dashboard_session";const DASHBOARD_REMEMBER_COOKIE = "nexu_dashboard_remember";const DASHBOARD_SESSION_TTL_MS = 12 * 60 * 60_000;const DASHBOARD_REMEMBER_TTL_MS = 30 * 24 * 60 * 60_000;const LOGIN_RATE_WINDOW_MS = 10 * 60_000;const LOGIN_RATE_LIMIT = 8;const JOIN_COMMAND_TTL_MS = 2 * 60_000;const BAN_FILE_PATH = String(process.env.BAN_FILE_PATH || path.join(process.cwd(), "data", "nexu-bans.json"));const REMEMBER_FILE_PATH = String(process.env.REMEMBER_FILE_PATH ||path.join(path.dirname(BAN_FILE_PATH), "nexu-remembered-accounts.json"));const KNOWN_PLAYERS_FILE_PATH = String(process.env.KNOWN_PLAYERS_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-known-players.json"));const DASHBOARD_ACCOUNT_FILE_PATH = String(process.env.DASHBOARD_ACCOUNT_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-dashboard-account.json"));const MENU_UPDATE_FILE_PATH = String(process.env.MENU_UPDATE_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-menu-update.json"));const MENU_STATUS_FILE_PATH = String(process.env.MENU_STATUS_FILE_PATH || path.join(path.dirname(BAN_FILE_PATH), "nexu-menu-status.json"));

const DM_DISPLAY_MIN_SECONDS = 1;
const DM_DISPLAY_MAX_SECONDS = 10 * 60;
const DM_DISPLAY_DEFAULT_SECONDS = 8;

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

const presence = new Map();const knownPlayers = new Map();const dashboardAccounts = new Map();const bans = new Map();const avatarCache = new Map();const robloxIdentityCache = new Map();const directMessages = new Map();const dmRateLimits = new Map();const globalChatMessages = [];const chatRateLimits = new Map();const sharedGhostStates = new Map();const ghostSyncRateLimits = new Map();const ghostLastSequences = new Map();const dashboardSessions = new Map();const rememberedDashboardDevices = new Map();const loginRateLimits = new Map();const joinCommands = new Map();const bringCommands = new Map();const shutdownCommandsBySession = new Map();const shutdownCommandsByUser = new Map();let nextDirectMessageId = 1;let nextChatMessageId = 1;let nextJoinCommandId = 1;let nextBringCommandId = 1;let nextShutdownCommandId = 1;let menuUpdateMutationRevision = 0;let menuUpdateState = {active:false,startedAtMs:0,endsAtMs:0,durationMinutes:0,startedBy:"",startedAt:"",endsAt:""};let menuAvailabilityState = {online:true,changedAtMs:0,changedAt:"",changedBy:""};let githubStorageSha = "";let githubStorageReady = false;let githubStorageDirty = false;let githubStorageTimer = null;let githubStorageDueAtMs = 0;let githubStorageWriteChain = Promise.resolve();const githubStorageReasons = new Set();
let globalChatDayKey = "";
let globalChatResetRevision = 0;
let globalChatResetAtMs = 0;
let globalChatMidnightTimer = null;
let latestGlobalShutdownCommand = null;
let presenceRevision = 1;
let presenceSnapshotSignature = "";
let githubStorageContentFingerprint = "";
let githubDeployBranchWarningShown = false;
let knownPlayersDiskFingerprint = "";
let knownPlayersClearInProgress = false;
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

async function writeGitHubStorageNow(options = {}) {
    const allowDeployBranch = Boolean(options && options.allowDeployBranch === true);
    if (
        !githubStorageReady ||
        !isGitHubStorageConfigured() ||
        (!GITHUB_STORAGE_WRITES_ALLOWED && !allowDeployBranch) ||
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
removeSharedGhostState(userId);
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
        console.log(`[NEXU] Skript-Aktualisierung: ${menuUpdateState.active ? "AKTIV" : "INAKTIV"}`);
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
            sharedGhostStates.clear();
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
    sharedGhostStates.clear();

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

async function clearStoredKnownPlayers() {
    const previousEntries = [...knownPlayers.entries()];
    const removedCount = previousEntries.length;

    if (removedCount === 0) {
        return {
            success: true,
            removedCount: 0,
            remainingCount: 0,
            localPersisted: true,
            githubPersisted: !isGitHubStorageConfigured() || githubStorageReady,
        };
    }

    knownPlayersClearInProgress = true;
    try {
        knownPlayers.clear();
        for (const [userId] of previousEntries) avatarCache.delete(userId);

        const localPersisted = saveKnownPlayers(false);
        if (!localPersisted) {
            for (const [userId, player] of previousEntries) knownPlayers.set(userId, player);
            saveKnownPlayers(false);
            return {
                success: false,
                removedCount: 0,
                remainingCount: knownPlayers.size,
                localPersisted: false,
                githubPersisted: false,
                error: "Die lokale Spielerliste konnte nicht geleert werden.",
            };
        }

        // Die öffentliche Presence-Antwort enthält auch gespeicherte Offline-Spieler.
        // Deshalb muss sich der Snapshot-Token selbst dann ändern, wenn die Live-Sitzungen gleich bleiben.
        presenceRevision += 1;

        let githubPersisted = true;
        if (isGitHubStorageConfigured()) {
            githubStorageDirty = true;
            githubStorageReasons.add("players-cleared");

            try {
                githubStorageWriteChain = githubStorageWriteChain.then(() =>
                    writeGitHubStorageNow({ allowDeployBranch: true })
                );
                const wroteRemote = await githubStorageWriteChain;
                githubPersisted = wroteRemote === true || githubStorageDirty === false;
            } catch (error) {
                githubPersisted = false;
                console.warn("[NEXU] Gespeicherte Spieler konnten nicht aus GitHub entfernt werden:", error.message);
            }
        }

        if (!githubPersisted) {
            // Bei einem fehlgeschlagenen Remote-Commit den vorherigen Zustand wiederherstellen,
            // damit ein Neustart nicht erneut die alte GitHub-Liste mit einem leeren lokalen Stand vermischt.
            for (const [userId, player] of previousEntries) {
                if (!knownPlayers.has(userId)) knownPlayers.set(userId, player);
            }
            saveKnownPlayers(false);
            presenceRevision += 1;
            return {
                success: false,
                removedCount: 0,
                remainingCount: knownPlayers.size,
                localPersisted: true,
                githubPersisted: false,
                error: "Der GitHub-Speicher konnte nicht aktualisiert werden. Die Spielerliste wurde wiederhergestellt.",
            };
        }

        console.log(`[NEXU] ${removedCount} gespeicherte Spieler wurden vollständig entfernt.`);
        return {
            success: true,
            removedCount,
            remainingCount: knownPlayers.size,
            localPersisted: true,
            githubPersisted,
            revision: presenceRevision,
            snapshotToken: getPresenceSnapshotToken(),
        };
    } finally {
        knownPlayersClearInProgress = false;
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
    { key: "menuServer", formName: "menuServerAccess", title: "Übersicht öffnen", description: "Darf die Serverübersicht ansehen." },
    { key: "dm", formName: "dashboardDm", title: "Nachrichten senden", description: "Darf Direktnachrichten und Rundsendungen an aktive Nexu-Spieler senden." },
    { key: "bring", formName: "dashboardBring", title: "Herbeiholen verwenden", description: "Darf Spieler über die Website zum Ersteller holen." },
    { key: "serverJoin", formName: "dashboardJoin", title: "Serverbeitritt", description: "Darf den Ersteller zu einem Spieler-Server schicken." },
    { key: "managePlayerRoles", formName: "dashboardRole", title: "Ränge einstellen", description: "Darf SPIELER/UNTERSTÜTZER für gespeicherte Spieler ändern." },
    { key: "banPlayers", formName: "dashboardBan", title: "Sperren/Entsperren", description: "Darf Spieler sperren, entsperren und die Sperrliste sehen." },
    { key: "updateScript", formName: "dashboardUpdateScript", title: "Skript-Aktualisierung", description: "Darf den zeitgesteuerten Wartungsmodus starten und vorzeitig beenden." },
    { key: "shutdownScript", formName: "dashboardShutdownScript", title: "Skripte deaktivieren", description: "Darf alle aktuell verbundenen Lua-Sitzungen einmalig deaktivieren." },
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
    if (permissionKey === "accountManager") return isOwnerDashboardAccount(account);
    // Jede Website-Identität muss mit einem Roblox-Konto verbunden sein, bevor
    // Übersichtsfunktionen oder der globale Website-Chat freigeschaltet werden.
    if (!cleanNumericId(account.robloxUserId)) return false;
    if (isOwnerDashboardAccount(account)) return true;
    const access = account.access || {};
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
    return definition ? `${definition.title}: Zugriff erforderlich` : "Übersichts-Zugriff erforderlich";
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
    const requestedRobloxUserId = cleanNumericId(raw && (raw.robloxUserId || raw.robloxId || raw.linkedRobloxUserId));
    const robloxUserId = requestedRobloxUserId || (isOwner ? OWNER_ACCOUNT_ROBLOX_USER_ID : "");
    const access = normalizeDashboardAccess(raw || {}, username, email);
    return {
        username,
        email,
        passwordHash,
        isOwner,
        robloxUserId,
        robloxUsername: cleanText(raw && (raw.robloxUsername || raw.linkedRobloxUsername), 40),
        robloxDisplayName: cleanText(raw && (raw.robloxDisplayName || raw.linkedRobloxDisplayName), 80),
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
                    robloxUserId: parsed.robloxUserId || OWNER_ACCOUNT_ROBLOX_USER_ID,
                    createdAt: parsed.createdAt || new Date().toISOString(),
                    updatedAt: parsed.updatedAt || "",
                });
            }
        }
    } catch (error) {
        console.warn("[NEXU] Übersichts-Konten konnten nicht geladen werden:", error.message);
    }

    if (dashboardAccounts.size === 0) {
        putDashboardAccount({
            username: cleanDashboardUsername(DASHBOARD_DEFAULT_USERNAME) || OWNER_ACCOUNT_USERNAME,
            email: cleanDashboardEmail(DASHBOARD_DEFAULT_EMAIL) || "owner@nexu.local",
            passwordHash: normalizePasswordHash(DASHBOARD_DEFAULT_PASSWORD_HASH),
            isOwner: true,
            robloxUserId: OWNER_ACCOUNT_ROBLOX_USER_ID,
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
    console.log(`[NEXU] ${dashboardAccounts.size} Übersichts-Konto/Konten geladen`);
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
        robloxUserId: account.robloxUserId,
        robloxUsername: account.robloxUsername,
        robloxDisplayName: account.robloxDisplayName,
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
    return { version: 2, accounts };
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
        console.warn("[NEXU] Übersichts-Konten konnten nicht gespeichert werden:", error.message);
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
    const seenRobloxUserIds = new Set();
    for (const raw of decoded.accounts) {
        const account = serializeDashboardAccountForStorage(raw);
        if (!account) continue;
        const emailKey = account.email.toLowerCase();
        const usernameKey = account.username.toLowerCase();
        if (seenEmails.has(emailKey) || seenUsernames.has(usernameKey)) continue;
        const robloxKey = cleanNumericId(account.robloxUserId);
        if (robloxKey && seenRobloxUserIds.has(robloxKey)) {
            account.robloxUserId = "";
            account.robloxUsername = "";
            account.robloxDisplayName = "";
        } else if (robloxKey) {
            seenRobloxUserIds.add(robloxKey);
        }
        seenEmails.add(emailKey);
        seenUsernames.add(usernameKey);
        accounts.push(account);
    }
    if (accounts.length === 0) return null;
    accounts.sort((left, right) => String(left.username).localeCompare(String(right.username)));
    return { version: 2, accounts };
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
        robloxUserId: cleanNumericId(ownerCandidate.robloxUserId) || OWNER_ACCOUNT_ROBLOX_USER_ID,
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

function dashboardRobloxUserIdExists(userId, exceptEmail = "") {
    const wanted = cleanNumericId(userId);
    const except = cleanDashboardEmail(exceptEmail);
    if (!wanted) return false;
    for (const account of dashboardAccounts.values()) {
        if (account.email !== except && cleanNumericId(account.robloxUserId) === wanted) {
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
    if (!userId || knownPlayersClearInProgress) return false;

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
        "[NEXU] Gespeicherte Übersichts-Konten konnten nicht geladen werden:",
        error.message
    );
}

}

function saveRememberedDashboardDevices() {try {fs.mkdirSync(path.dirname(REMEMBER_FILE_PATH), { recursive: true });const tempPath = `${REMEMBER_FILE_PATH}.tmp`;fs.writeFileSync(tempPath,JSON.stringify({devices: [...rememberedDashboardDevices.entries()].map(([tokenHash, entry]) => ({tokenHash,username: entry.username,email: entry.email,expiresAtMs: entry.expiresAtMs,createdAt: entry.createdAt,})),},null,2),"utf8");fs.renameSync(tempPath, REMEMBER_FILE_PATH);return true;} catch (error) {console.warn("[NEXU] Gespeicherte Übersichts-Konten konnten nicht gespeichert werden:",error.message);return false;}}

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

function normalizeDirectMessageDisplaySeconds(value, fallback = DM_DISPLAY_DEFAULT_SECONDS) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    const seconds = Math.round(Number(value));
    if (!Number.isFinite(seconds)) return null;
    if (seconds < DM_DISPLAY_MIN_SECONDS || seconds > DM_DISPLAY_MAX_SECONDS) return null;
    return seconds;
}

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

function queueDirectMessage(userId, message, sender = "NEXU", displaySeconds = DM_DISPLAY_DEFAULT_SECONDS) {pruneDirectMessages();

const now = Date.now();
const normalizedDisplaySeconds =
    normalizeDirectMessageDisplaySeconds(displaySeconds, DM_DISPLAY_DEFAULT_SECONDS) ||
    DM_DISPLAY_DEFAULT_SECONDS;
const entry = {
    id: `${now}-${nextDirectMessageId++}`,
    userId,
    sender: cleanText(sender, 40) || "NEXU",
    message: cleanText(message, DM_MAX_LENGTH),
    displaySeconds: normalizedDisplaySeconds,
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
    displaySeconds:
        normalizeDirectMessageDisplaySeconds(entry.displaySeconds, DM_DISPLAY_DEFAULT_SECONDS) ||
        DM_DISPLAY_DEFAULT_SECONDS,
    sentAt: entry.sentAt,
}));

}


function getGlobalChatDayKey(nowMs = Date.now()) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: CHAT_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = Object.create(null);
    for (const part of formatter.formatToParts(new Date(nowMs))) {
        if (part.type !== "literal") parts[part.type] = part.value;
    }
    return `${parts.year || "0000"}-${parts.month || "00"}-${parts.day || "00"}`;
}

function getGlobalChatResetToken() {
    return `${SERVER_INSTANCE_ID}:${globalChatDayKey || getGlobalChatDayKey()}:${globalChatResetRevision}`;
}

function clearGlobalChat(reason = "manual", nowMs = Date.now()) {
    const removed = globalChatMessages.length;
    globalChatMessages.length = 0;
    chatRateLimits.clear();
    globalChatDayKey = getGlobalChatDayKey(nowMs);
    globalChatResetRevision += 1;
    globalChatResetAtMs = nowMs;
    console.log(`[NEXU] Globaler Chat geleert (${reason}, ${removed} Nachrichten, Zeitzone ${CHAT_TIME_ZONE}).`);
    return removed;
}

function ensureGlobalChatDay(nowMs = Date.now()) {
    const currentDayKey = getGlobalChatDayKey(nowMs);
    if (!globalChatDayKey) {
        globalChatDayKey = currentDayKey;
        globalChatResetAtMs = nowMs;
        return false;
    }
    if (currentDayKey !== globalChatDayKey) {
        clearGlobalChat("daily-midnight", nowMs);
        return true;
    }
    return false;
}

function findNextGlobalChatMidnightMs(nowMs = Date.now()) {
    const currentDayKey = getGlobalChatDayKey(nowMs);
    let low = nowMs;
    let high = nowMs + (30 * 60 * 60_000);
    while (getGlobalChatDayKey(high) === currentDayKey) {
        high += 6 * 60 * 60_000;
    }
    while (high - low > 250) {
        const middle = Math.floor((low + high) / 2);
        if (getGlobalChatDayKey(middle) === currentDayKey) low = middle;
        else high = middle;
    }
    return high;
}

function scheduleGlobalChatMidnightReset() {
    if (globalChatMidnightTimer) clearTimeout(globalChatMidnightTimer);
    const targetMs = findNextGlobalChatMidnightMs();
    const delayMs = Math.max(250, targetMs - Date.now() + 75);
    globalChatMidnightTimer = setTimeout(() => {
        ensureGlobalChatDay(Date.now());
        scheduleGlobalChatMidnightReset();
    }, delayMs);
    if (typeof globalChatMidnightTimer.unref === "function") globalChatMidnightTimer.unref();
}

function pruneGlobalChat() {
    ensureGlobalChatDay();
    const now = Date.now();
    while (globalChatMessages.length > CHAT_HISTORY_LIMIT) {
        globalChatMessages.shift();
    }
    for (const [key, state] of chatRateLimits) {
        if (now - Number(state.windowStartedAtMs || 0) > CHAT_RATE_WINDOW_MS) {
            chatRateLimits.delete(key);
        }
    }
}

function findActivePresenceSession(userId, sessionId = "") {
    prunePresence();
    const cleanUserId = cleanNumericId(userId);
    const cleanSessionId = cleanText(sessionId, 120);
    if (!cleanUserId) return null;

    let best = null;
    for (const entry of presence.values()) {
        if (!entry || String(entry.userId || "") !== cleanUserId) continue;
        if (
            cleanSessionId &&
            entry.sessionId &&
            String(entry.sessionId) !== cleanSessionId
        ) {
            continue;
        }
        if (!isPresenceEntryActive(entry)) continue;
        if (!best || Number(entry.lastSeenMs || 0) > Number(best.lastSeenMs || 0)) {
            best = entry;
        }
    }
    return best;
}

function allowGlobalChatSend(userId) {
    pruneGlobalChat();
    const key = cleanNumericId(userId);
    if (!key) return false;

    const now = Date.now();
    let state = chatRateLimits.get(key);
    if (!state || now - Number(state.windowStartedAtMs || 0) > CHAT_RATE_WINDOW_MS) {
        state = { windowStartedAtMs: now, count: 0 };
        chatRateLimits.set(key, state);
    }
    state.count += 1;
    return state.count <= CHAT_RATE_LIMIT;
}


// -----------------------------------------------------------------------------
// NEXU CHAT-MODERATION V1
// Serverseitig autoritativ: Website und Lua erhalten ausschließlich die bereits
// geprüfte Nachricht. Der Filter kombiniert Normalisierung, Umgehungserkennung,
// mehrsprachige Wortlisten und Kontextbewertung, damit einzelne harmlose Wörter
// nicht ohne Ziel-/Satzkontext pauschal blockiert werden.
// -----------------------------------------------------------------------------
const NEXU_CHAT_MODERATION_V1 = (() => {
    const directTargets = new Set([
        "du", "dich", "dir", "dein", "deine", "ihr", "euch",
        "you", "your", "u", "ur", "he", "she", "they",
        "tu", "te", "toi", "ton", "ta", "vous", "votre",
        "tú", "usted", "ustedes", "vos", "eres", "sois",
        "voce", "você", "teu", "tua", "voi", "sei",
        "sen", "siz", "jij", "jouw", "ty", "ciebie", "twoj", "twój",
        "ты", "тебя", "тебе", "вы", "انت", "انتي", "أنت"
    ]);
    const hostileCopulas = new Set([
        "bist", "seid", "wärst", "waerst", "bleibst",
        "are", "is", "be", "being", "look", "looks",
        "es", "eres", "sois", "êtes", "etre", "sei", "siete",
        "e", "é", "est", "sind", "jesteś", "jestes", "ben", "siniz",
        "ты", "являешься", "انت"
    ]);
    const solicitationWords = new Set([
        "will", "willst", "möchte", "moechte", "zeig", "schick", "sende", "komm",
        "want", "wanna", "send", "show", "trade", "meet", "touch",
        "quiero", "manda", "envia", "muestra", "quieres",
        "veux", "envoie", "montre", "vuoi", "manda", "mostra",
        "quero", "envie", "mostre", "iste", "gönder", "gonder"
    ]);
    const reportingPatterns = [
        "das wort", "dieses wort", "bedeutet", "übersetzung", "uebersetzung", "zitat", "zitiert", "genannt", "beleidigung melden", "nicht beleidigen",
        "the word", "means", "translation", "quoted", "called me", "reporting", "do not insult", "dont insult",
        "la palabra", "significa", "traducción", "traduccion", "mot signifie", "le mot", "parola significa", "a palavra", "significa",
        "słowo", "slowo", "означает", "слово", "kelime", "anlamı", "anlami"
    ];

    const severeTerms = [
        "nigger", "nigga", "n1gger", "n1gga", "neger", "negroide", "kanake", "kike", "chink", "gook", "spic", "wetback", "coon",
        "faggot", "fagot", "fag", "tranny", "shemale", "schwuchtel", "judensau", "heil hitler", "white power",
        "sale juif", "bougnoule", "bamboula", "negro de mierda", "maricon de mierda", "maricón de mierda",
        "czarnuch", "pedal", "пидор", "пидорас", "черножопый", "хач", "زنجي", "يهودي قذر"
    ];
    const threatPhrases = [
        "bring dich um", "töte dich", "toete dich", "ich töte dich", "ich toete dich", "du sollst sterben", "geh sterben", "stirb endlich",
        "kill yourself", "kys", "i will kill you", "im going to kill you", "go die", "you should die", "drop dead",
        "mátate", "matate", "te voy a matar", "muérete", "muerete",
        "tue toi", "tuez vous", "je vais te tuer", "crève", "creve",
        "ammazzati", "ti ammazzo", "muori", "mate se", "vou te matar", "morra",
        "kendini öldür", "kendini oldur", "seni öldüreceğim", "seni oldurecegim",
        "zabij się", "zabij sie", "zabiję cię", "zabije cie",
        "убей себя", "я тебя убью", "сдохни", "اقتل نفسك", "سأقتلك"
    ];
    const explicitSexualTerms = [
        "fick dich", "fick mich", "ficken wir", "sex mit dir", "nacktbilder", "nacktfoto", "nudes", "send nudes", "onlyfans",
        "blowjob", "handjob", "rimjob", "deepthroat", "gangbang", "porn", "porno", "pornhub", "hentai", "sexchat", "sexting",
        "cum", "cumming", "suck my dick", "suck dick", "eat my pussy", "fuck me", "fuck you", "rape", "vergewaltigen",
        "chúpame", "chupame", "fóllame", "follame", "sexo contigo", "manda nudes", "violación", "violacion",
        "suce moi", "baise moi", "sexe avec toi", "envoie des nudes", "viol",
        "scopami", "sesso con te", "manda nudes", "stupro",
        "me fode", "sexo com você", "sexo com voce", "mande nudes", "estupro",
        "sakso", "sikiş", "sikis", "tecavüz", "tecavuz",
        "ебать", "трахни меня", "секс со мной", "изнасилование", "نيك", "اغتصاب", "ارسل صور عارية"
    ];
    const strongInsults = [
        "idiot", "idiotin", "vollidiot", "trottel", "depp", "dummkopf", "hurensohn", "huso", "missgeburt", "miststück", "miststueck", "wichser", "spast", "behindert", "bastard", "arschloch",
        "moron", "imbecile", "dumbass", "asshole", "bitch", "son of a bitch", "motherfucker", "loser", "scumbag", "piece of shit", "retard",
        "imbécil", "imbecil", "idiota", "estúpido", "estupido", "gilipollas", "pendejo", "cabron", "cabrón", "hijo de puta", "puta",
        "connard", "connasse", "salaud", "salope", "abruti", "imbécile", "imbecile", "fils de pute", "pute",
        "stronzo", "coglione", "bastardo", "figlio di puttana", "puttana", "idiota",
        "filho da puta", "otário", "otario", "babaca", "vagabunda", "puta", "idiota",
        "klootzak", "mongool", "sukkel", "hoer", "piç", "pic", "orospu çocuğu", "orospu cocugu", "salak", "gerizekalı", "gerizekali",
        "kurwa", "skurwysyn", "debil", "idiota", "suka", "сука", "мудак", "дебил", "идиот", "ублюдок", "шлюха",
        "غبي", "احمق", "ابن العاهرة", "شرموط", "كلب"
    ];
    const weakProfanity = [
        "arsch", "scheiße", "scheisse", "kacke", "fuck", "shit", "damn", "crap", "mierda", "merde", "putain", "cazzo", "porra", "caralho", "bok", "lanet"
    ];
    const neutralSexualWords = [
        "sex", "sexy", "nackt", "nackte", "nackter", "nude", "penis", "vagina", "pussy", "dick", "cock", "boobs", "brüste", "brueste", "titten",
        "sexual", "sexuell", "erotic", "erotisch", "orgasmus", "orgasm", "masturbation", "masturbieren"
    ];

    const confusables = {
        "а":"a", "е":"e", "ё":"e", "о":"o", "р":"p", "с":"c", "у":"y", "х":"x", "к":"k", "м":"m", "т":"t", "в":"b", "н":"h",
        "Α":"a", "Β":"b", "Ε":"e", "Ζ":"z", "Η":"h", "Ι":"i", "Κ":"k", "Μ":"m", "Ν":"n", "Ο":"o", "Ρ":"p", "Τ":"t", "Υ":"y", "Χ":"x"
    };
    const leet = {"0":"o", "1":"i", "2":"z", "3":"e", "4":"a", "5":"s", "6":"g", "7":"t", "8":"b", "9":"g", "@":"a", "$":"s", "!":"i", "+":"t", "|":"i"};

    function normalize(value) {
        const original = cleanText(value, CHAT_MAX_LENGTH);
        let text = original.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        text = Array.from(text).map((character) => confusables[character] || leet[character] || character).join("");
        text = text.replace(/(.)\1{2,}/g, "$1$1");
        text = text.replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
        const rawTokens = text ? text.split(" ") : [];
        const tokens = [];
        for (let index = 0; index < rawTokens.length; index += 1) {
            if (rawTokens[index].length === 1) {
                let end = index;
                let joined = "";
                while (end < rawTokens.length && rawTokens[end].length === 1 && joined.length < 32) {
                    joined += rawTokens[end];
                    end += 1;
                }
                if (end - index >= 3) {
                    tokens.push(joined);
                    index = end - 1;
                    continue;
                }
            }
            tokens.push(rawTokens[index]);
        }
        const variants = new Set(tokens);
        for (const token of tokens) variants.add(token.replace(/(.)\1+/g, "$1"));
        const spaced = tokens.join(" ");
        return { original, spaced, padded: ` ${spaced} `, tokens, variants };
    }

    function normalizeTerm(value) {
        return normalize(value).spaced;
    }

    function containsTerm(data, value) {
        const term = normalizeTerm(value);
        if (!term) return false;
        if (term.includes(" ")) {
            const compactTerm = term.replace(/\s+/g, "");
            return data.padded.includes(` ${term} `) || data.variants.has(compactTerm);
        }
        return data.variants.has(term) || data.variants.has(term.replace(/(.)\1+/g, "$1"));
    }

    function countTerms(data, terms, stopAt = 3) {
        let count = 0;
        let first = "";
        for (const term of terms) {
            if (!containsTerm(data, term)) continue;
            count += 1;
            if (!first) first = term;
            if (count >= stopAt) break;
        }
        return { count, first };
    }

    function hasAnyToken(data, set) {
        for (const token of data.variants) if (set.has(token)) return true;
        return false;
    }

    function hasReportingContext(data) {
        return reportingPatterns.some((pattern) => containsTerm(data, pattern));
    }

    function censorWithHashes(value) {
        const text = cleanText(value, CHAT_MAX_LENGTH);
        return Array.from(text).map((character) => /\s/.test(character) ? character : "#").join("");
    }

    function analyze(value) {
        const data = normalize(value);
        if (!data.original) return { moderated: false, message: "", category: "", score: 0 };

        const severe = countTerms(data, severeTerms, 1);
        if (severe.count > 0) {
            return { moderated: true, message: censorWithHashes(data.original), category: "HASSREDE", score: 100 };
        }
        const threat = countTerms(data, threatPhrases, 1);
        if (threat.count > 0) {
            return { moderated: true, message: censorWithHashes(data.original), category: "DROHUNG", score: 100 };
        }
        const explicit = countTerms(data, explicitSexualTerms, 1);
        if (explicit.count > 0) {
            return { moderated: true, message: censorWithHashes(data.original), category: "SEXUELL", score: 100 };
        }

        const strong = countTerms(data, strongInsults, 3);
        const weak = countTerms(data, weakProfanity, 3);
        const sexual = countTerms(data, neutralSexualWords, 3);
        const targeted = hasAnyToken(data, directTargets);
        const hostileSentence = hasAnyToken(data, hostileCopulas);
        const solicitation = hasAnyToken(data, solicitationWords);
        const reporting = hasReportingContext(data);

        let insultScore = (strong.count * 4.5) + (weak.count * 2.2);
        if ((strong.count > 0 || weak.count > 0) && targeted) insultScore += 2.2;
        if ((strong.count > 0 || weak.count > 0) && hostileSentence) insultScore += 1.3;
        if ((strong.count > 0 || weak.count > 0) && data.tokens.length <= 3) insultScore += 1.5;
        if (reporting) insultScore = Math.max(0, insultScore - 3.6);

        let sexualScore = sexual.count * 3.0;
        if (sexual.count > 0 && solicitation) sexualScore += 4.0;
        if (sexual.count > 0 && targeted) sexualScore += 1.5;
        if (sexual.count >= 2) sexualScore += 2.5;
        if (reporting && !solicitation) sexualScore = Math.max(0, sexualScore - 3.0);

        const score = Math.max(insultScore, sexualScore);
        const category = sexualScore > insultScore ? "SEXUELL" : "BELEIDIGUNG";
        const moderated = score >= 5.5;
        return {
            moderated,
            message: moderated ? censorWithHashes(data.original) : data.original,
            category: moderated ? category : "",
            score: Math.round(score * 10) / 10,
        };
    }

    return { analyze };
})();

function moderateNexuChatMessage(value) {
    return NEXU_CHAT_MODERATION_V1.analyze(value);
}

function queueGlobalChatMessage(liveEntry, message) {
    pruneGlobalChat();
    const now = Date.now();
    const userId = cleanNumericId(liveEntry && liveEntry.userId);
    if (!userId) return null;

    const moderation = moderateNexuChatMessage(message);
    if (!moderation.message) return null;
    const role = getNexuRoleInfo(userId);
    const entry = {
        id: (now * 1000) + ((nextChatMessageId++) % 1000),
        userId,
        roleKey: role.key,
        roleTitle: role.title,
        username: cleanText(liveEntry && (liveEntry.username || liveEntry.name), 40) || `User${userId}`,
        displayName:
            cleanText(liveEntry && liveEntry.displayName, 80) ||
            cleanText(liveEntry && (liveEntry.username || liveEntry.name), 40) ||
            `User ${userId}`,
        message: moderation.message,
        moderated: moderation.moderated === true,
        moderationCategory: moderation.category || "",
        moderationScore: Number(moderation.score) || 0,
        sentAt: new Date(now).toISOString(),
        sentAtMs: now,
    };
    if (!entry.message) return null;

    globalChatMessages.push(entry);
    pruneGlobalChat();
    return entry;
}

function getGlobalChatMessages(afterId) {
    pruneGlobalChat();
    const numericAfterId = Math.max(0, Number(afterId) || 0);
    return globalChatMessages
        .filter((entry) => Number(entry.id || 0) > numericAfterId)
        .slice(-CHAT_POLL_LIMIT)
        .map((entry) => {
            const role = getNexuRoleInfo(entry.userId);
            const moderation = entry.moderated === true
                ? { moderated: true, message: cleanText(entry.message, CHAT_MAX_LENGTH), category: cleanText(entry.moderationCategory, 40), score: Number(entry.moderationScore) || 0 }
                : moderateNexuChatMessage(entry.message);
            return {
            id: entry.id,
            userId: entry.userId,
            roleKey: role.key,
            roleTitle: role.title,
            username: entry.username,
            displayName: entry.displayName,
            avatarUrl: (avatarCache.get(String(entry.userId || "")) || {}).url || "",
            message: moderation.message,
            moderated: moderation.moderated === true,
            moderationCategory: moderation.category || "",
            sentAt: entry.sentAt,
            sentAtMs: entry.sentAtMs,
            };
        });
}


function cleanFiniteNumber(value, fallback = 0, minimum = -1_000_000, maximum = 1_000_000) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
}

function normalizeSharedGhostCFrame(value) {
    if (!Array.isArray(value) || value.length !== 12) return null;
    const result = value.map((entry, index) => cleanFiniteNumber(
        entry,
        index === 3 || index === 7 || index === 11 ? 1 : 0,
        index < 3 ? -10_000_000 : -2,
        index < 3 ? 10_000_000 : 2
    ));
    const positionMagnitude = Math.hypot(result[0], result[1], result[2]);
    if (!Number.isFinite(positionMagnitude) || positionMagnitude > 17_000_000) return null;
    return result;
}

function normalizeSharedGhostVector(value, maximum = 1_500) {
    if (!Array.isArray(value) || value.length !== 3) return [0, 0, 0];
    const limit = Math.max(1, Number(maximum) || 1_500);
    const vector = value.map((entry) => cleanFiniteNumber(entry, 0, -limit, limit));
    const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
    if (magnitude > limit && magnitude > 0) {
        const scale = limit / magnitude;
        return vector.map((entry) => entry * scale);
    }
    return vector;
}

function sharedGhostStateKey(userId, sessionId) {
    return `${cleanNumericId(userId)}:${cleanText(sessionId, 120)}`;
}

function acceptSharedGhostSequence(userId, sessionId, rawSequence, now = Date.now()) {
    const key = sharedGhostStateKey(userId, sessionId);
    if (!key || key === ":") return 0;
    const current = ghostLastSequences.get(key) || { sequence: 0, touchedAtMs: 0 };
    const requested = cleanInteger(rawSequence);
    if (requested > 0 && requested <= Number(current.sequence || 0)) return 0;
    const sequence = requested > 0 ? requested : Number(current.sequence || 0) + 1;
    ghostLastSequences.set(key, { sequence, touchedAtMs: now });
    return sequence;
}

function removeSharedGhostState(userId, sessionId = "") {
    const cleanUserId = cleanNumericId(userId);
    const cleanSessionId = cleanText(sessionId, 120);
    if (!cleanUserId) return 0;
    let removed = 0;
    for (const [key, state] of sharedGhostStates) {
        if (!state || state.userId !== cleanUserId) continue;
        if (cleanSessionId && state.sessionId !== cleanSessionId) continue;
        sharedGhostStates.delete(key);
        removed += 1;
    }
    return removed;
}

function pruneSharedGhostStates(now = Date.now()) {
    prunePresence();
    const activeSessionKeys = new Set();
    for (const entry of presence.values()) {
        if (!isPresenceEntryActive(entry, now)) continue;
        activeSessionKeys.add(sharedGhostStateKey(entry.userId, entry.sessionId));
    }
    for (const [key, state] of sharedGhostStates) {
        const expired = !state || now - Number(state.updatedAtMs || 0) > GHOST_STATE_TTL_MS;
        const banned = state && bans.has(String(state.userId || ""));
        const active = state && activeSessionKeys.has(sharedGhostStateKey(state.userId, state.sessionId));
        if (expired || banned || !active) sharedGhostStates.delete(key);
    }
    for (const [key, lastAtMs] of ghostSyncRateLimits) {
        if (now - Number(lastAtMs || 0) > 60_000) ghostSyncRateLimits.delete(key);
    }
    for (const [key, state] of ghostLastSequences) {
        if (!state || now - Number(state.touchedAtMs || 0) > 90_000) ghostLastSequences.delete(key);
    }
}

function allowSharedGhostSync(userId, sessionId, now = Date.now()) {
    const key = sharedGhostStateKey(userId, sessionId);
    if (!key || key === ":") return false;
    const previous = Number(ghostSyncRateLimits.get(key) || 0);
    if (now - previous < GHOST_SYNC_MIN_INTERVAL_MS) return false;
    ghostSyncRateLimits.set(key, now);
    return true;
}

function normalizeSharedGhostSnapshot(rawState, now, sequence) {
    if (!rawState || typeof rawState !== "object") return null;
    const cframe = normalizeSharedGhostCFrame(rawState.cframe);
    if (!cframe) return null;
    const animationNameCandidate = cleanText(rawState.animationName, 20);
    const allowedAnimationNames = new Set(["Idle", "Walk", "Run", "Jump", "Fall", "Climb", "Swim"]);
    const animationName = allowedAnimationNames.has(animationNameCandidate)
        ? animationNameCandidate
        : "Idle";
    const animationDigits = String(rawState.animationId || "").match(/\d{3,20}/);
    const humanoidState = cleanText(rawState.humanoidState, 28) || "Unknown";
    return {
        sequence,
        sampleTimeMs: cleanInteger(rawState.sampleTimeMs),
        cframe,
        velocity: normalizeSharedGhostVector(rawState.velocity, 700),
        moveDirection: normalizeSharedGhostVector(rawState.moveDirection, 1),
        angularVelocity: normalizeSharedGhostVector(rawState.angularVelocity, 20),
        humanoidState,
        grounded: rawState.grounded === true,
        animationName,
        animationId: animationDigits ? animationDigits[0] : "",
        animationSpeed: cleanFiniteNumber(rawState.animationSpeed, 1, 0, 6),
        animationTime: cleanFiniteNumber(rawState.animationTime, 0, 0, 86_400),
        updatedAtMs: now,
    };
}

function upsertSharedGhostState(live, rawState, now = Date.now()) {
    if (!live || !rawState || typeof rawState !== "object") return null;
    const userId = cleanNumericId(live.userId);
    const sessionId = cleanText(live.sessionId, 120);
    if (!userId || !sessionId) return null;
    const sequence = acceptSharedGhostSequence(userId, sessionId, rawState.sequence, now);
    if (!sequence) return sharedGhostStates.get(sharedGhostStateKey(userId, sessionId)) || null;
    const snapshot = normalizeSharedGhostSnapshot(rawState, now, sequence);
    if (!snapshot) return null;

    const key = sharedGhostStateKey(userId, sessionId);
    const previous = sharedGhostStates.get(key);
    const history = Array.isArray(previous && previous.snapshots)
        ? previous.snapshots.filter((entry) => entry && now - Number(entry.updatedAtMs || 0) <= GHOST_HISTORY_WINDOW_MS)
        : [];
    history.push(snapshot);
    history.sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    const snapshots = history.slice(-GHOST_HISTORY_LIMIT);
    const role = getNexuRoleInfo(userId);
    const entry = {
        userId,
        sessionId,
        username: cleanText(live.username, 40) || `User${userId}`,
        displayName: cleanText(live.displayName, 80) || cleanText(live.username, 40) || `User ${userId}`,
        roleKey: role.key,
        roleTitle: role.title,
        placeId: cleanInteger(live.placeId),
        jobId: cleanText(live.jobId, 100),
        ...snapshot,
        snapshots,
    };
    sharedGhostStates.set(key, entry);
    return entry;
}

function serializeSharedGhostSnapshot(snapshot) {
    return {
        sequence: snapshot.sequence,
        sampleTimeMs: snapshot.sampleTimeMs,
        cframe: snapshot.cframe,
        velocity: snapshot.velocity,
        moveDirection: snapshot.moveDirection,
        angularVelocity: snapshot.angularVelocity,
        humanoidState: snapshot.humanoidState,
        grounded: snapshot.grounded,
        animationName: snapshot.animationName,
        animationId: snapshot.animationId,
        animationSpeed: snapshot.animationSpeed,
        animationTime: snapshot.animationTime,
        updatedAtMs: snapshot.updatedAtMs,
    };
}

function getSharedGhostStatesForViewer(live, now = Date.now()) {
    pruneSharedGhostStates(now);
    if (!live) return [];
    const viewerUserId = cleanNumericId(live.userId);
    const viewerPlaceId = cleanInteger(live.placeId);
    const viewerJobId = cleanText(live.jobId, 100);
    return [...sharedGhostStates.values()]
        .filter((state) =>
            state &&
            state.userId !== viewerUserId &&
            state.placeId === viewerPlaceId &&
            state.jobId === viewerJobId &&
            now - Number(state.updatedAtMs || 0) <= GHOST_STATE_TTL_MS
        )
        .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0))
        .slice(0, GHOST_MAX_VISIBLE_STATES)
        .map((state) => ({
            userId: state.userId,
            username: state.username,
            displayName: state.displayName,
            roleKey: state.roleKey,
            roleTitle: state.roleTitle,
            ...serializeSharedGhostSnapshot(state),
            snapshots: (Array.isArray(state.snapshots) ? state.snapshots : [])
                .map(serializeSharedGhostSnapshot),
        }));
}

async function resolveRobloxUserIdentity(userId) {
    const id = cleanNumericId(userId);
    if (!id) return null;

    const now = Date.now();
    const cached = robloxIdentityCache.get(id);
    if (cached && now - Number(cached.cachedAtMs || 0) < AVATAR_CACHE_MS) {
        return { userId:id, username:cached.username, displayName:cached.displayName };
    }

    const live = findLatestPresenceForUser(id);
    const known = knownPlayers.get(id);
    let username = cleanText(live && live.username, 40) || cleanText(known && known.username, 40);
    let displayName = cleanText(live && live.displayName, 80) || cleanText(known && known.displayName, 80);

    try {
        const response = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(id)}`, {
            headers: {
                "User-Agent": "Nexu-Presence-Dashboard/3.0",
                Accept: "application/json",
            },
            signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8_000) : undefined,
        });
        if (response.ok) {
            const payload = await response.json().catch(() => ({}));
            username = cleanText(payload && payload.name, 40) || username;
            displayName = cleanText(payload && payload.displayName, 80) || displayName;
        }
    } catch (error) {
        console.warn(`[NEXU] Roblox-Identität ${id} konnte nicht geladen werden:`, error.message);
    }

    username = username || `User${id}`;
    displayName = displayName || username || `User ${id}`;
    robloxIdentityCache.set(id, { username, displayName, cachedAtMs:now });
    rememberKnownPlayer({ userId:id, username, displayName }, now);
    return { userId:id, username, displayName };
}

async function verifyDashboardRobloxIdentity(userId) {
    const id = cleanNumericId(userId);
    if (!id) return null;

    try {
        const response = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(id)}`, {
            headers: {
                "User-Agent": "Nexu-Presence-Dashboard/4.0",
                Accept: "application/json",
            },
            signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8_000) : undefined,
        });
        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error(`Roblox Benutzerabfrage HTTP ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const username = cleanText(payload && payload.name, 40);
        const displayName = cleanText(payload && payload.displayName, 80) || username;
        if (!username) return null;
        const now = Date.now();
        robloxIdentityCache.set(id, { username, displayName, cachedAtMs:now });
        rememberKnownPlayer({ userId:id, username, displayName }, now);
        fetchAvatarUrls([id]).catch(() => {});
        return { userId:id, username, displayName };
    } catch (error) {
        const live = findLatestPresenceForUser(id);
        const known = knownPlayers.get(id);
        const username = cleanText(live && live.username, 40) || cleanText(known && known.username, 40);
        const displayName = cleanText(live && live.displayName, 80) || cleanText(known && known.displayName, 80) || username;
        if (username) return { userId:id, username, displayName };
        throw error;
    }
}

async function getWebsiteChatIdentity(session) {
    if (!session || !session.account || !canAccessMenuServer(session.account)) return null;
    const userId = cleanNumericId(session.account.robloxUserId);
    if (!userId) return null;
    const storedUsername = cleanText(session.account.robloxUsername, 40);
    const storedDisplayName = cleanText(session.account.robloxDisplayName, 80) || storedUsername;
    if (storedUsername) {
        return { userId, username:storedUsername, displayName:storedDisplayName };
    }
    const resolved = await resolveRobloxUserIdentity(userId);
    if (!resolved) return null;
    return { userId, username:resolved.username, displayName:resolved.displayName };
}

async function refreshDashboardAccountRobloxIdentities() {
    let changed = false;
    for (const [email, account] of dashboardAccounts) {
        const userId = cleanNumericId(account && account.robloxUserId);
        if (!userId) continue;
        try {
            const identity = await verifyDashboardRobloxIdentity(userId);
            if (!identity) continue;
            if (
                account.robloxUsername !== identity.username ||
                account.robloxDisplayName !== identity.displayName
            ) {
                dashboardAccounts.set(email, normalizeDashboardAccount({
                    ...account,
                    robloxUserId: identity.userId,
                    robloxUsername: identity.username,
                    robloxDisplayName: identity.displayName,
                    updatedAt: account.updatedAt || new Date().toISOString(),
                }));
                changed = true;
            }
        } catch (error) {
            console.warn(`[NEXU] Roblox-Verknüpfung für ${account.username} konnte nicht aktualisiert werden:`, error.message);
        }
    }
    if (changed) saveDashboardAccount();
    return changed;
}

async function attachAvatarUrlsToChatMessages(messages) {
    const rows = Array.isArray(messages) ? messages : [];
    const ids = [...new Set(rows.map((entry) => cleanNumericId(entry && entry.userId)).filter(Boolean))];
    if (ids.length === 0) return rows;
    const urls = await fetchAvatarUrls(ids);
    for (const entry of rows) {
        const id = cleanNumericId(entry && entry.userId);
        if (id) entry.avatarUrl = urls.get(id) || entry.avatarUrl || "";
    }
    return rows;
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

function loginHtml(errorMessage = "", rememberedAccount = null, options = {}) {const errorBlock = errorMessage ? `<div class="login-error" role="alert">${escapeHtml(errorMessage)}</div>` : "";const noticeBlock = options.notice ? `<div class="login-notice" role="status">${escapeHtml(options.notice)}</div>` : "";const rememberedAccounts = Array.isArray(rememberedAccount) ? rememberedAccount : (rememberedAccount ? [rememberedAccount] : []);const rememberedBlock = rememberedAccounts.length ? `<section class="remembered-list" aria-label="Gespeicherte Konten">
            <h2>Gespeicherte Konten</h2>
            <p>Konten, mit denen du auf diesem Browser angemeldet warst.</p>
            ${rememberedAccounts.map((remembered) => `<div class="remembered-account">
                <div>
                    <b>${escapeHtml(remembered.username || "Gespeichertes Konto")}</b>
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
<title>Nexu Anmeldung</title>
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
        <p>Private Serverübersicht für Menüserver, gespeicherte Spieler, Rollen, Herbeiholen, Direktnachrichten und Serverbeitritt.</p>
        <div class="statline">
            <div class="stat"><b>Kontoanmeldung</b><span>Benutzername und Passwort</span></div>
            <div class="stat"><b>Serverübersicht</b><span>nur OwnerAccount</span></div>
            <div class="stat"><b>Konten</b><span>Registrieren, verwalten und löschen</span></div>
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
                    <div class="field"><label for="registerRobloxUserId">Roblox User-ID</label><input id="registerRobloxUserId" name="robloxUserId" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="30" placeholder="z. B. 10199760908" required></div>
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

function homeHtml(notice = "", error = "", account = null) {const loaderCommandJson = JSON.stringify(NEXU_LOADER_COMMAND);const accountData = account || getOwnerDashboardAccount() || getFirstDashboardAccount() || {username: OWNER_ACCOUNT_USERNAME, email: DASHBOARD_DEFAULT_EMAIL};const accountName = accountData.username || OWNER_ACCOUNT_USERNAME;const accountEmail = accountData.email || "";const isOwnerAccount = isOwnerDashboardAccount(accountData);const hasRobloxLink = Boolean(cleanNumericId(accountData.robloxUserId));const canOpenMenuServer = canAccessMenuServer(accountData);const canManageAccounts = canManageDashboardAccounts(accountData);const usernameReadonly = isOwnerAccount ? "readonly" : "";const deleteAccountBlock = isOwnerAccount
    ? '<section class="modal-card"><div class="danger-zone"><h3>OwnerAccount geschützt</h3><p>Der OwnerAccount kann hier nicht gelöscht werden, damit du den Hauptzugriff nicht verlierst.</p></div></section>'
    : '<form class="modal-card" method="post" action="/account/delete" autocomplete="off"><div class="danger-zone"><h3>Konto löschen</h3><p>Dieses Konto wird dauerhaft aus der Übersicht entfernt. Danach wirst du abgemeldet.</p><div class="field"><label for="deletePassword">Passwort bestätigen</label><input id="deletePassword" name="currentPassword" type="password" maxlength="200" autocomplete="current-password" required></div><div class="modal-actions"><button type="submit">KONTO LÖSCHEN</button></div></div></form>';const noticeBlock = notice ? '<div class="home-notice success">' + escapeHtml(notice) + '</div>' : "";const errorBlock = error ? '<div class="home-notice error">' + escapeHtml(error) + '</div>' : "";const menuServerButton = canOpenMenuServer
    ? '<a class="primary-tile menu-server" href="/uebersicht"><span>ÜBERSICHT</span><strong>Serverübersicht öffnen</strong><small>' + (isOwnerAccount ? 'OwnerAccount Zugriff' : 'Vom Owner freigegeben') + '</small></a>'
    : '<div class="primary-tile menu-server locked"><span>ÜBERSICHT</span><strong>Zugriff gesperrt</strong><small>' + (hasRobloxLink ? 'Der OwnerAccount kann deinen Zugriff freigeben.' : 'Dieses Konto muss zuerst mit einer Roblox User-ID verbunden werden.') + '</small></div>';const accountManagerButton = '';
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
        <div class="brand"><div class="logo">N</div><div><strong>Nexu</strong><span>Steuerzentrale</span></div></div>
        <div id="account" class="account">
            <button id="accountButton" class="account-button" type="button" aria-haspopup="true" aria-expanded="false"><span class="account-avatar">N</span><span class="account-name">${escapeHtml(accountName)}</span></button>
            <div class="account-menu" role="menu">
                <button id="openSettings" class="menu-item" type="button">Einstellungen <span>›</span></button>
                <form class="menu-item-form" method="post" action="/logout"><button class="menu-item danger" type="submit">Abmelden <span>×</span></button></form>
            </div>
        </div>
    </div>
    ${noticeBlock}${errorBlock}
    <section class="hero">
        <div class="panel welcome">
            <div class="eyebrow">NEXU // STARTSEITE</div>
            <h1>Nexu</h1>
            <p>Willkommen auf der Startseite. Von hier aus öffnest du die geschützte Serverübersicht oder änderst oben rechts über dein Profil deine Kontodaten.</p>
        </div>
        <div class="panel action-grid">
            ${menuServerButton}
            ${accountManagerButton}
            <button id="copyScriptButton" class="primary-tile copy-script" type="button"><span>SKRIPT STARTEN</span><strong id="copyScriptTitle">Skript kopieren</strong><small id="copyScriptHint">Kopiert den aktuellen Nexu-Ladebefehl in die Zwischenablage.</small><code class="copy-command">loadstring(game:HttpGet(&quot;…/Nexu%20Main&quot;))()</code></button>
            <div class="quick-info">
                <article class="info-card"><div class="info-label">Konto</div><div class="info-value">${escapeHtml(accountName)}</div><p>Benutzername-Login aktiv</p></article>
                <article class="info-card"><div class="info-label">Menu Server Zugriff</div><div class="info-value">${canOpenMenuServer ? "Erlaubt" : "Gesperrt"}</div></article>
            </div>
        </div>
    </section>
</main>
<div id="settingsModal" class="modal-backdrop hidden" aria-hidden="true">
    <form class="modal-card" method="post" action="/account/settings" autocomplete="on">
        <div class="eyebrow">KONTOEINSTELLUNGEN</div>
        <h2>Konto bearbeiten</h2>
        <p>Benutzername und Passwort werden serverseitig gespeichert. Die Registrierung funktioniert ohne Bestätigungscode.${isOwnerAccount ? " Der OwnerAccount-Name ist geschützt." : ""}</p>
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
        copyScriptTitle.textContent = "Skript kopieren";
        copyScriptHint.textContent = "Kopiert den aktuellen Nexu-Ladebefehl in die Zwischenablage.";
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
        const permissionSnapshot = owner ? getDashboardPermissionSnapshot(entry) : (entry.access || {});
        const created = cleanText(entry.createdAt, 32) || "unbekannt";
        const updated = cleanText(entry.updatedAt, 32) || "nie";
        const ownerBadge = owner ? '<span class="badge owner">OWNER-SCHUTZ</span>' : '';
        const robloxUserId = cleanNumericId(entry.robloxUserId);
        const robloxUsername = cleanText(entry.robloxUsername, 40);
        const robloxDisplayName = cleanText(entry.robloxDisplayName, 80) || robloxUsername;
        const robloxAvatar = robloxUserId ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(robloxUserId)}&width=150&height=150&format=png` : "";
        const robloxStatus = robloxUserId
            ? `${robloxDisplayName || `Roblox ${robloxUserId}`}${robloxUsername ? ` @${robloxUsername}` : ""} · ID ${robloxUserId}`
            : "Noch nicht mit Roblox verbunden";
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
            : '<form class="delete-account-form" method="post" action="/accounts/delete"><input type="hidden" name="accountEmail" value="' + escapeHtml(entry.email) + '"><button class="danger" type="submit">Konto löschen</button></form>';
        return '<article class="account-card">'
            + '<div class="account-card-head"><div class="account-identity">' + (robloxAvatar ? '<img class="account-avatar" src="' + escapeHtml(robloxAvatar) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="account-avatar account-avatar-empty">?</div>') + '<div><strong>' + escapeHtml(entry.username) + '</strong><small>' + escapeHtml(entry.email) + '</small><em class="account-roblox">' + escapeHtml(robloxStatus) + '</em></div></div>' + ownerBadge + '</div>'
            + '<form method="post" action="/accounts/update" autocomplete="off">'
            + '<input type="hidden" name="accountEmail" value="' + escapeHtml(entry.email) + '">'
            + '<div class="grid">'
            + '<label>Benutzername<input name="username" maxlength="80" value="' + escapeHtml(entry.username) + '" ' + usernameReadonly + ' required></label>'
            + '<label>Roblox User-ID<input name="robloxUserId" inputmode="numeric" pattern="[0-9]+" maxlength="30" value="' + escapeHtml(robloxUserId) + '" placeholder="Roblox User-ID" required></label>'
            + '<label>Neues Passwort<input name="newPassword" type="password" maxlength="200" placeholder="Leer lassen = bleibt gleich"></label>'
            + '<label>Passwort bestätigen<input name="confirmPassword" type="password" maxlength="200"></label>'
            + '</div>'
            + '<div class="access-box"><div><b>Übersichtsrechte</b><p>Erst wenn <b>Übersicht öffnen</b> aktiviert ist, können die einzelnen Funktionen der Übersicht angeklickt und gespeichert werden. Startseite und eigene Einstellungen bleiben immer erlaubt.</p></div>' + accessInput + '</div>'
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
<title>Nexu Kontoverwaltung</title>
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
.account-identity { display:flex; align-items:center; gap:12px; min-width:0; }
.account-avatar { width:52px; height:52px; flex:0 0 auto; border-radius:50%; object-fit:cover; border:1px solid rgba(0,200,255,.34); background:#07111d; box-shadow:0 8px 24px rgba(0,0,0,.28); }
.account-avatar-empty { display:grid; place-items:center; color:#7894a8; font-weight:900; }
.account-roblox { display:block; max-width:420px; margin-top:5px; color:#78cfee; font-size:10px; font-style:normal; line-height:1.35; overflow-wrap:anywhere; }
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
.check.locked-by-dashboard small::after { content:" Erst Übersicht öffnen aktivieren."; color:#d7bd72; }
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
        <div class="brand"><div class="logo">N</div><div><h1>Kontoverwaltung</h1><p>Eingeloggt als ${escapeHtml(accountData.username || OWNER_ACCOUNT_USERNAME)}</p></div></div>
        <a class="back" href="/">← STARTSEITE</a>
    </div>
    ${noticeBlock}${errorBlock}
    <section class="intro">
        <p>Nur der feste <b>OwnerAccount</b> kann diese Seite öffnen. Hier verbindest du jedes Website-Konto eindeutig mit einer Roblox-User-ID und stellst Benutzername, Passwort sowie die einzelnen Übersichtsrechte ein. Die Kontoverwaltung selbst bleibt immer nur für OwnerAccount.</p>
    </section>
    <section class="account-list">
        ${cards}
    </section>
</main>
<div id="accountDeleteConfirm" class="account-confirm-backdrop hidden" aria-hidden="true">
    <div class="account-confirm-card" role="dialog" aria-modal="true" aria-labelledby="accountDeleteTitle" aria-describedby="accountDeleteMessage">
        <div class="eyebrow">NEXU // KONTOSICHERHEIT</div>
        <h2 id="accountDeleteTitle">Konto wirklich löschen?</h2>
        <p id="accountDeleteMessage">Das Übersichtskonto und seine Berechtigungen werden dauerhaft entfernt. Diese Aktion lässt sich nicht rückgängig machen.</p>
        <div class="account-confirm-actions"><button id="accountDeleteCancel" type="button">ABBRECHEN</button><button id="accountDeleteSubmit" class="confirm-delete" type="button">KONTO LÖSCHEN</button></div>
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
const shutdownButtonHtml = shutdownButtonAllowed ? '<button id="shutdownAllButton" class="logout-button shutdown-button" type="button">ALLE SKRIPTE AUS</button>' : "";
const clearPlayersButtonAllowed = isOwnerDashboardAccount(account);
const clearPlayersButtonHtml = clearPlayersButtonAllowed ? '<button id="clearStoredPlayersButton" class="logout-button clear-players-button" type="button">GESPEICHERTE SPIELER LEEREN</button>' : "";
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
<title>Nexu Übersicht</title>
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
.clear-players-button { border-color:rgba(255,190,70,.44) !important; color:#ffe1a0 !important; background:rgba(55,35,4,.62) !important; }
.clear-players-button:hover { border-color:rgba(255,190,70,.76) !important; box-shadow:0 0 24px rgba(255,190,70,.14); }
.clear-players-button:disabled { opacity:.58; cursor:wait; }
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
        <div class="brand-copy"><strong>Nexu</strong><span>Präsenznetzwerk</span></div>
    </div>
    <div class="header-actions">
        <a class="logout-button" href="/" style="display:inline-flex;align-items:center;text-decoration:none;border-color:rgba(74,178,230,.32);color:var(--text);background:rgba(7,13,23,.72);">Startseite</a>
        ${broadcastButtonHtml}
        ${updateButtonHtml}
        ${shutdownButtonHtml}
        ${clearPlayersButtonHtml}
        <div class="live-pill"><span id="headerDot" class="dot"></span><span id="headerStatus">Verbindung wird geprüft</span></div>
        <form class="logout-form" method="post" action="/logout"><button class="logout-button" type="submit">Abmelden</button></form>
    </div>
</header>
${dashboardNoticeHtml}

<section class="hero">
    <div class="eyebrow">NEXU // SERVERÜBERSICHT</div>
    <h1>Dein gesamtes System. Live. Klar. Unter Kontrolle.</h1>
    <p>Die Übersicht bündelt Serverzustand, aktive Sitzungen, bekannte Spieler, Rollen, Sperren und Laufzeitbefehle in einer zentralen Steueroberfläche. Alle Werte werden live aktualisiert und bleiben auch bei vielen Spielern klar lesbar.</p>
    <div class="stats">
        <article class="stat"><div class="stat-label">Serverstatus</div><div id="serverStatus" class="stat-value">Prüfe …</div><div class="stat-note">Render-Web-Service</div></article>
        <article class="stat"><div class="stat-label">Gespeicherte Spieler</div><div id="playerCount" class="stat-value">0</div><div class="stat-note">Alle Spieler, die Nexu einmal gestartet haben</div></article>
        <article class="stat"><div class="stat-label">Spieler Online / Offline</div><div class="stat-split"><div class="stat-mini"><div class="stat-mini-label">Online</div><div id="onlinePlayerCount" class="stat-mini-value online">0</div></div><div class="stat-mini"><div class="stat-mini-label">Offline</div><div id="offlinePlayerCount" class="stat-mini-value offline">0</div></div></div><div class="stat-note">Wird automatisch verschoben</div></article>
        <article class="stat"><div class="stat-label">Gesperrte Spieler</div><div id="bannedCount" class="stat-value">0</div><div class="stat-note">Bleiben bis zum Entsperren gespeichert</div></article>
    </div>
</section>

<section id="menuStatusPanel" class="menu-status-panel${initialMenuStatus.online ? "" : " offline"}" aria-live="polite">
    <div class="menu-status-row">
        <div class="menu-status-copy"><div class="eyebrow">NEXU // MENÜSTATUS</div><h2 id="menuStatusTitle">Lua-Menü ist ${initialMenuStatus.online ? "online" : "offline"}</h2><p id="menuStatusText">${initialMenuStatus.online ? "Jeder kann das Lua-Skript normal starten und verwenden." : "Alle Lua-Starts sind blockiert. Bereits laufende Scripts werden vollständig beendet."}</p></div>
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
        <button class="directory-tab" type="button" data-directory-tab="banned" role="tab" aria-selected="false">Gesperrt <b id="bannedTabCount">0</b></button>
    </div>
    <div class="directory-panel" data-directory-panel="online" role="tabpanel">
        <div class="directory-head"><div><div class="eyebrow">MENÜ-SPIELER</div><h2>Online Spieler</h2></div><input id="search" class="search" type="search" autocomplete="off" placeholder="Online-Spieler suchen …" aria-label="Online-Spieler suchen"></div>
        <div id="players" class="players"></div><div id="footerNote" class="footer-note"></div>
    </div>
    <div class="directory-panel hidden" data-directory-panel="offline" role="tabpanel">
        <div class="directory-head"><div><div class="eyebrow">OFFLINE-ARCHIV</div><h2>Offline Spieler</h2></div><input id="offlineSearch" class="search" type="search" autocomplete="off" placeholder="Offline-Spieler suchen …" aria-label="Offline-Spieler suchen"></div>
        <div id="offlinePlayers" class="players"></div><div id="offlineFooter" class="footer-note"></div>
    </div>
    <div class="directory-panel hidden" data-directory-panel="banned" role="tabpanel">
        <div class="directory-head"><div><div class="eyebrow">MENÜ-SPERRLISTE</div><h2>Gesperrte Nutzer</h2></div><input id="bannedSearch" class="search" type="search" autocomplete="off" placeholder="Gesperrte Spieler suchen …" aria-label="Gesperrte Spieler suchen"></div>
        <div id="bannedPlayers" class="players"></div><div id="bannedFooter" class="footer-note"></div>
    </div>
</section>
</main>

<div id="updateModal" class="modal-backdrop hidden" aria-hidden="true">
    <div class="modal-card update-card" role="dialog" aria-modal="true" aria-labelledby="updateModalTitle">
        <div class="eyebrow">NEXU // SCRIPT UPDATE</div>
        <h3 id="updateModalTitle">Wartungsmodus starten</h3>
        <p class="modal-user">Während dieser Zeit sehen alle Lua-Nutzer einen übersetzten Aktualisierungsbildschirm mit Zeitablauf.</p>
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
        <h3 id="banModalTitle">Spieler sperren</h3>
        <p id="banModalUser" class="modal-user"></p>
        <textarea id="banReasonInput" class="reason-input" maxlength="240" placeholder="Grund für die Sperre eingeben …"></textarea>
        <div class="modal-actions">
            <button id="cancelBanButton" class="action-button">ABBRECHEN</button>
            <button id="confirmBanButton" class="action-button ban">SPERRE BESTÄTIGEN</button>
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
        <section class="broadcast-duration-panel" aria-labelledby="broadcastDurationTitle">
            <div class="broadcast-duration-head">
                <div><span>ANZEIGEDAUER</span><strong id="broadcastDurationTitle">Wie lange soll die Nachricht sichtbar bleiben?</strong></div>
                <b id="broadcastDurationPreview">8 Sekunden</b>
            </div>
            <div class="broadcast-duration-grid">
                <div class="update-field"><label for="broadcastDuration">Dauer</label><input id="broadcastDuration" type="number" min="1" max="600" step="1" value="8" inputmode="numeric"></div>
                <div class="update-field"><label for="broadcastDurationUnit">Einheit</label><select id="broadcastDurationUnit"><option value="seconds">Sekunden</option><option value="minutes">Minuten</option></select></div>
            </div>
            <div class="broadcast-duration-presets" aria-label="Schnellauswahl">
                <button type="button" data-broadcast-seconds="5">5 SEK</button>
                <button type="button" data-broadcast-seconds="10">10 SEK</button>
                <button type="button" data-broadcast-seconds="20">20 SEK</button>
                <button type="button" data-broadcast-seconds="30">30 SEK</button>
                <button type="button" data-broadcast-seconds="60">1 MIN</button>
                <button type="button" data-broadcast-seconds="120">2 MIN</button>
            </div>
        </section>
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
            <button id="confirmDmButton" class="action-button dm">DIREKTNACHRICHT SENDEN</button>
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
    { key:"player", title:"SPIELER", description:"Standardrang für normale Nutzer" },
    { key:"supporter", title:"UNTERSTÜTZER", description:"Erweiterter Rang mit Berechtigung zum Herbeiholen" },
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
    broadcastDuration:document.getElementById("broadcastDuration"),
    broadcastDurationUnit:document.getElementById("broadcastDurationUnit"),
    broadcastDurationPreview:document.getElementById("broadcastDurationPreview"),
    broadcastDurationPresets:Array.from(document.querySelectorAll("[data-broadcast-seconds]")),
    cancelBroadcastButton:document.getElementById("cancelBroadcastButton"),
    confirmBroadcastButton:document.getElementById("confirmBroadcastButton"),
    broadcastModalNotice:document.getElementById("broadcastModalNotice"),
    openUpdateButton:document.getElementById("openUpdateButton"),
    shutdownAllButton:document.getElementById("shutdownAllButton"),
    clearStoredPlayersButton:document.getElementById("clearStoredPlayersButton"),
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
        ? "Jeder kann das Lua-Skript normal starten und verwenden."
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

async function clearAllStoredPlayers() {
    const response = await fetch("/api/admin/players/clear", {
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
    const roleTitle = player.roleTitle === "PLAYERS" ? "SPIELER" : player.roleTitle === "SUPPORTER" ? "UNTERSTÜTZER" : player.roleTitle === "MENU CREATOR" ? "MENÜ-ERSTELLER" : (player.roleTitle || "SPIELER");
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
        ? '<button class="action-button join" data-action="join" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">SERVER</button>'
        : "";
    const bringButton = bringable && state.permissions.bring === true
        ? '<button class="action-button bring" data-action="bring" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">HOLEN</button>'
        : "";
    const dmButton = actionableOnline && state.permissions.dm === true
        ? '<button class="action-button dm" data-action="dm" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">NACHRICHT</button>'
        : "";
    const actionButtons = banned
        ? (state.permissions.banPlayers === true ? '<button class="action-button unban" data-action="unban" data-user-id="' + escapeHtml(player.userId) + '">ENTSPERREN</button>' : '')
        : '<div class="button-row">' +
            joinButton +
            bringButton +
            dmButton +
            (state.permissions.banPlayers === true ? '<button class="action-button ban" data-action="ban" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">SPERREN</button>' : '') +
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
            : '<div class="empty">' + (bannedQuery ? 'Kein gesperrter Spieler passt zu deiner Suche.' : 'Die Sperrliste ist leer.') + '</div>')
        : '<div class="empty">Für dieses Konto ist Sperren und Entsperren nicht freigegeben.</div>';

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

function getBroadcastDisplaySeconds() {
    const raw = Number(elements.broadcastDuration && elements.broadcastDuration.value);
    const unit = elements.broadcastDurationUnit && elements.broadcastDurationUnit.value === "minutes"
        ? "minutes"
        : "seconds";
    if (!Number.isFinite(raw)) return NaN;
    return Math.round(unit === "minutes" ? raw * 60 : raw);
}

function formatBroadcastDuration(seconds) {
    const safe = Math.max(1, Math.round(Number(seconds) || 1));
    if (safe >= 60 && safe % 60 === 0) {
        const minutes = safe / 60;
        return minutes === 1 ? "1 Minute" : minutes + " Minuten";
    }
    if (safe >= 60) {
        const minutes = Math.floor(safe / 60);
        const rest = safe % 60;
        return minutes + " Min " + rest + " Sek";
    }
    return safe === 1 ? "1 Sekunde" : safe + " Sekunden";
}

function updateBroadcastDurationUi() {
    if (!elements.broadcastDuration || !elements.broadcastDurationUnit) return;
    const minutes = elements.broadcastDurationUnit.value === "minutes";
    elements.broadcastDuration.min = "1";
    elements.broadcastDuration.max = minutes ? "10" : "600";
    const seconds = getBroadcastDisplaySeconds();
    if (elements.broadcastDurationPreview) {
        elements.broadcastDurationPreview.textContent =
            Number.isFinite(seconds) && seconds >= 1 && seconds <= 600
                ? formatBroadcastDuration(seconds)
                : "Ungültige Dauer";
    }
    if (Array.isArray(elements.broadcastDurationPresets)) {
        elements.broadcastDurationPresets.forEach(function (button) {
            button.classList.toggle("active", Number(button.dataset.broadcastSeconds) === seconds);
        });
    }
}

function openBroadcastModal() {
    const onlineCount = state.players.filter(function (player) { return player.online === true; }).length;
    state.broadcastTargetCount = onlineCount;
    elements.broadcastModalUser.textContent = onlineCount === 1
        ? "Die Nachricht wird an 1 aktuell aktiven Spieler gesendet."
        : "Die Nachricht wird an " + onlineCount + " aktuell aktive Spieler gesendet.";
    elements.broadcastMessageInput.value = "";
    if (elements.broadcastDuration) elements.broadcastDuration.value = "8";
    if (elements.broadcastDurationUnit) elements.broadcastDurationUnit.value = "seconds";
    updateBroadcastDurationUi();
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

async function sendBroadcastMessage(message, displaySeconds) {
    const response = await fetch("/api/dm/broadcast", {
        method:"POST",
        headers:{
            Accept:"application/json",
            "Content-Type":"application/json",
        },
        body:JSON.stringify({
            message:String(message || "").trim(),
            displaySeconds:Number(displaySeconds),
        }),
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
            eyebrow:"NEXU // MENÜSTATUS",
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
        title:"Alle aktiven Skripte deaktivieren?",
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
if (elements.clearStoredPlayersButton) elements.clearStoredPlayersButton.addEventListener("click", async function () {
    const approved = await openActionConfirm({
        tone:"danger",
        eyebrow:"NEXU // SPIELERSPEICHER",
        title:"Alle gespeicherten Spieler entfernen?",
        message:"Die komplette gespeicherte Spielerliste wird lokal und in nexu-storage.json geleert. Accounts und Sperren bleiben erhalten. Aktive Spieler können durch ihren nächsten Heartbeat wieder gespeichert werden.",
        confirmText:"SPIELER ENTFERNEN",
    });
    if (!approved) return;

    const originalText = elements.clearStoredPlayersButton.textContent;
    elements.clearStoredPlayersButton.disabled = true;
    elements.clearStoredPlayersButton.textContent = "ENTFERNE …";

    try {
        const result = await clearAllStoredPlayers();
        const removedCount = Math.max(0, Number(result.removedCount) || 0);
        window.location.replace("/uebersicht?players=cleared&count=" + encodeURIComponent(String(removedCount)));
    } catch (error) {
        showToast(error.message || "Gespeicherte Spieler konnten nicht entfernt werden.", "error", 7000);
        elements.clearStoredPlayersButton.disabled = false;
        elements.clearStoredPlayersButton.textContent = originalText;
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
            button.textContent = "GESENDET";
            showToast("Der Befehl zum Herbeiholen wurde an den Spieler gesendet.", "success");
        } catch (error) {
            showToast(error.message || "Der Befehl zum Herbeiholen konnte nicht gesendet werden.", "error");
            button.textContent = "FEHLER";
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
        showToast("Spieler wurde entsperrt.", "success");
    } catch (error) {
        showToast(error.message || "Entsperren fehlgeschlagen.", "error");
        button.disabled = false;
        button.textContent = "ENTSPERREN";
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
        elements.banModalNotice.textContent = "Bitte einen Sperrgrund eingeben.";
        elements.banReasonInput.focus();
        return;
    }

    elements.confirmBanButton.disabled = true;
    elements.confirmBanButton.textContent = "SPERRE …";
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
        elements.banModalNotice.textContent = error.message || "Sperren fehlgeschlagen.";
    } finally {
        elements.confirmBanButton.disabled = false;
        elements.confirmBanButton.textContent = "SPERRE BESTÄTIGEN";
    }
});

if (elements.broadcastDuration) {
    elements.broadcastDuration.addEventListener("input", updateBroadcastDurationUi);
    elements.broadcastDuration.addEventListener("change", updateBroadcastDurationUi);
}
if (elements.broadcastDurationUnit) {
    elements.broadcastDurationUnit.addEventListener("change", function () {
        const currentSeconds = getBroadcastDisplaySeconds();
        const nextUnit = elements.broadcastDurationUnit.value === "minutes" ? "minutes" : "seconds";
        if (Number.isFinite(currentSeconds)) {
            elements.broadcastDuration.value = nextUnit === "minutes"
                ? String(Math.max(1, Math.min(10, Math.round(currentSeconds / 60))))
                : String(Math.max(1, Math.min(600, Math.round(currentSeconds))));
        }
        updateBroadcastDurationUi();
    });
}
if (Array.isArray(elements.broadcastDurationPresets)) {
    elements.broadcastDurationPresets.forEach(function (button) {
        button.addEventListener("click", function () {
            const seconds = Math.max(1, Math.min(600, Number(button.dataset.broadcastSeconds) || 8));
            if (seconds >= 60 && seconds % 60 === 0) {
                elements.broadcastDurationUnit.value = "minutes";
                elements.broadcastDuration.value = String(seconds / 60);
            } else {
                elements.broadcastDurationUnit.value = "seconds";
                elements.broadcastDuration.value = String(seconds);
            }
            updateBroadcastDurationUi();
        });
    });
}

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
    const displaySeconds = getBroadcastDisplaySeconds();
    if (!Number.isFinite(displaySeconds) || displaySeconds < 1 || displaySeconds > 600) {
        elements.broadcastModalNotice.textContent = "Bitte eine Anzeigedauer zwischen 1 Sekunde und 10 Minuten wählen.";
        elements.broadcastModalNotice.className = "modal-notice";
        if (elements.broadcastDuration) elements.broadcastDuration.focus();
        return;
    }
    elements.confirmBroadcastButton.disabled = true;
    elements.confirmBroadcastButton.textContent = "SENDE …";
    elements.broadcastModalNotice.textContent = "";
    elements.broadcastModalNotice.className = "modal-notice";
    try {
        const result = await sendBroadcastMessage(message, displaySeconds);
        const count = Number(result.targetedPlayers) || 0;
        const durationLabel = formatBroadcastDuration(Number(result.displaySeconds) || displaySeconds);
        elements.broadcastModalNotice.textContent = count === 1
            ? "Nachricht wurde an 1 aktiven Spieler gesendet und bleibt " + durationLabel + " sichtbar."
            : "Nachricht wurde an " + count + " aktive Spieler gesendet und bleibt " + durationLabel + " sichtbar.";
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
        elements.confirmDmButton.textContent = "DIREKTNACHRICHT SENDEN";
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



/* --------------------------------------------------------------------------
 * NEXU V200 // AURORA-ERLEBNIS LAYER
 *
 * Die vorhandenen Server-, Login-, Account- und Dashboard-Funktionen bleiben
 * unverändert. Diese Schicht modernisiert ausschließlich das ausgegebene HTML,
 * damit sämtliche Routen dieselbe visuelle Sprache und Interaktionsqualität
 * verwenden, ohne die bestehenden Formulare, IDs oder API-Handler zu brechen.
 * -------------------------------------------------------------------------- */

const NEXU_V200_BASE_LOGIN_HTML = loginHtml;
const NEXU_V200_BASE_HOME_HTML = homeHtml;
const NEXU_V200_BASE_ACCOUNTS_HTML = dashboardAccountsHtml;
const NEXU_V200_BASE_DASHBOARD_HTML = dashboardHtml;

function nexuV200SharedCss() {
    return String.raw`
/* NEXU V200 AURORA-ERLEBNIS */
:root{
    --nx-bg-0:#020409;
    --nx-bg-1:#050a12;
    --nx-bg-2:#08111d;
    --nx-surface:rgba(8,15,27,.82);
    --nx-surface-strong:rgba(7,13,23,.95);
    --nx-surface-soft:rgba(255,255,255,.035);
    --nx-line:rgba(128,216,255,.16);
    --nx-line-strong:rgba(93,217,255,.34);
    --nx-text:#eefaff;
    --nx-muted:#84a0b4;
    --nx-cyan:#19d6ff;
    --nx-blue:#3988ff;
    --nx-violet:#8b63ff;
    --nx-green:#45ffb0;
    --nx-red:#ff5b82;
    --nx-gold:#ffc766;
    --nx-radius-xl:32px;
    --nx-radius-lg:24px;
    --nx-radius-md:16px;
    --nx-shadow:0 30px 90px rgba(0,0,0,.42);
    --nx-glow:0 0 60px rgba(25,214,255,.10);
}
html{scroll-behavior:smooth;background:var(--nx-bg-0);}
body.nexu-v200{
    position:relative;
    isolation:isolate;
    overflow-x:hidden;
    background:
        radial-gradient(circle at 12% -8%,rgba(25,214,255,.16),transparent 32rem),
        radial-gradient(circle at 92% 6%,rgba(139,99,255,.15),transparent 34rem),
        radial-gradient(circle at 50% 112%,rgba(69,255,176,.07),transparent 35rem),
        linear-gradient(155deg,var(--nx-bg-0),var(--nx-bg-1) 44%,#030710 100%) !important;
    color:var(--nx-text);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    letter-spacing:-.006em;
}
body.nexu-v200::before{
    opacity:.32 !important;
    background-image:
        linear-gradient(rgba(109,219,255,.055) 1px,transparent 1px),
        linear-gradient(90deg,rgba(109,219,255,.055) 1px,transparent 1px) !important;
    background-size:44px 44px !important;
    mask-image:linear-gradient(to bottom,black 0%,rgba(0,0,0,.75) 42%,transparent 92%) !important;
}
body.nexu-v200::after{
    content:"";
    position:fixed;
    inset:0;
    z-index:-3;
    pointer-events:none;
    background:linear-gradient(110deg,transparent 0 45%,rgba(255,255,255,.015) 50%,transparent 55% 100%);
    background-size:260% 100%;
    animation:nxAmbientSweep 18s ease-in-out infinite;
}
@keyframes nxAmbientSweep{0%,100%{background-position:120% 0}50%{background-position:-20% 0}}
::selection{background:rgba(25,214,255,.25);color:white;}
.nx-ambient{position:fixed;inset:0;z-index:-2;overflow:hidden;pointer-events:none;}
.nx-ambient-orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.26;will-change:transform;}
.nx-ambient-orb.a{width:420px;height:420px;left:-180px;top:12%;background:var(--nx-cyan);animation:nxFloatA 16s ease-in-out infinite;}
.nx-ambient-orb.b{width:460px;height:460px;right:-210px;top:28%;background:var(--nx-violet);animation:nxFloatB 20s ease-in-out infinite;}
.nx-ambient-orb.c{width:330px;height:330px;left:43%;bottom:-210px;background:var(--nx-green);opacity:.10;animation:nxFloatA 22s ease-in-out infinite reverse;}
@keyframes nxFloatA{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(42px,-34px,0) scale(1.08)}}
@keyframes nxFloatB{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-46px,38px,0) scale(.94)}}
.nx-progress-line{position:fixed;z-index:50000;left:0;top:0;width:100%;height:2px;transform-origin:left;background:linear-gradient(90deg,var(--nx-cyan),var(--nx-blue),var(--nx-violet));box-shadow:0 0 18px rgba(25,214,255,.8);animation:nxProgress 1.1s cubic-bezier(.2,.8,.2,1) both;pointer-events:none;}
@keyframes nxProgress{0%{transform:scaleX(0);opacity:1}70%{transform:scaleX(.82)}100%{transform:scaleX(1);opacity:0}}
body.nexu-v200 .shell,body.nexu-v200 .login-shell{position:relative;z-index:2;}
body.nexu-v200 .scan{opacity:.34;mix-blend-mode:screen;}
body.nexu-v200 a,body.nexu-v200 button,body.nexu-v200 input,body.nexu-v200 select,body.nexu-v200 textarea{font:inherit;}
body.nexu-v200 a,body.nexu-v200 button{transition:transform .22s cubic-bezier(.2,.8,.2,1),border-color .22s ease,background .22s ease,box-shadow .22s ease,filter .22s ease;}
body.nexu-v200 a:hover,body.nexu-v200 button:hover{filter:brightness(1.06);}
body.nexu-v200 a:active,body.nexu-v200 button:active{transform:translateY(1px) scale(.992);}
body.nexu-v200 :focus-visible{outline:2px solid rgba(25,214,255,.95) !important;outline-offset:3px;box-shadow:0 0 0 6px rgba(25,214,255,.12) !important;}
body.nexu-v200 input,body.nexu-v200 textarea,body.nexu-v200 select{
    border-color:rgba(110,205,255,.20) !important;
    background:linear-gradient(180deg,rgba(4,10,18,.94),rgba(7,16,27,.90)) !important;
    box-shadow:0 1px 0 rgba(255,255,255,.025) inset;
}
body.nexu-v200 input:hover,body.nexu-v200 textarea:hover,body.nexu-v200 select:hover{border-color:rgba(110,205,255,.34) !important;}
body.nexu-v200 input:focus,body.nexu-v200 textarea:focus,body.nexu-v200 select:focus{border-color:rgba(25,214,255,.72) !important;box-shadow:0 0 0 4px rgba(25,214,255,.09),0 16px 32px rgba(0,0,0,.18) !important;}
.nx-glass{
    border:1px solid var(--nx-line);
    background:linear-gradient(145deg,rgba(255,255,255,.042),rgba(255,255,255,.012)),var(--nx-surface);
    box-shadow:var(--nx-shadow),0 1px 0 rgba(255,255,255,.05) inset,var(--nx-glow);
    backdrop-filter:blur(18px) saturate(130%);
}
.nx-command-strip{
    display:flex;align-items:center;gap:12px;min-height:42px;margin:0 0 18px;padding:0 15px;border:1px solid rgba(113,216,255,.14);border-radius:15px;
    background:linear-gradient(90deg,rgba(25,214,255,.055),rgba(139,99,255,.035),rgba(69,255,176,.035));
    color:#7695aa;font-size:10px;font-weight:850;letter-spacing:.16em;text-transform:uppercase;overflow:hidden;
}
.nx-command-strip i{width:4px;height:4px;border-radius:50%;background:var(--nx-cyan);box-shadow:0 0 10px var(--nx-cyan);}
.nx-command-strip .nx-live{margin-left:auto;color:#93ffd0;}
.nx-command-strip .nx-live::before{content:"";display:inline-block;width:6px;height:6px;margin-right:7px;border-radius:50%;background:var(--nx-green);box-shadow:0 0 12px rgba(69,255,176,.8);}
.nx-page-footer{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:24px;padding:18px 4px;color:#587287;font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
.nx-page-footer strong{color:#8db0c5;}

/* LOGIN */
.page-login{display:grid !important;place-items:center !important;padding:28px !important;}
.page-login .login-shell{width:min(1160px,100%) !important;grid-template-columns:1.08fr .92fr !important;gap:18px !important;animation:nxPageIn .75s cubic-bezier(.18,.8,.2,1) both;}
.page-login .brand-card,.page-login .auth-card{
    position:relative;overflow:hidden;border-radius:30px !important;border-color:rgba(103,214,255,.18) !important;
    background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012)),rgba(5,11,20,.90) !important;
    box-shadow:0 34px 100px rgba(0,0,0,.48),0 1px 0 rgba(255,255,255,.05) inset !important;
}
.page-login .brand-card{padding:46px !important;min-height:650px;display:flex;flex-direction:column;justify-content:center;}
.page-login .brand-card::after{content:"N";position:absolute;right:-34px;bottom:-108px;font-size:420px;font-weight:1000;line-height:1;color:rgba(25,214,255,.035);letter-spacing:-.15em;pointer-events:none;}
.page-login .brand-card .logo{width:88px !important;height:88px !important;border-radius:26px !important;font-size:36px !important;box-shadow:0 22px 70px rgba(25,214,255,.25),0 0 0 1px rgba(255,255,255,.16) inset !important;}
.page-login .brand-card h1{max-width:520px;font-size:clamp(48px,6vw,78px) !important;line-height:.92 !important;letter-spacing:-.065em !important;background:linear-gradient(135deg,#fff 8%,#a8efff 48%,#c7bcff 90%);-webkit-background-clip:text;background-clip:text;color:transparent;}
.page-login .statline{grid-template-columns:repeat(3,1fr);gap:10px !important;}
.page-login .stat{min-height:92px;padding:16px !important;border-radius:18px !important;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018)) !important;}
.page-login .auth-card{padding:18px !important;display:flex;align-items:center;}
.page-login .auth-grid{width:100%;gap:12px !important;}
.page-login .auth-panel,.page-login .remembered-list{border-radius:22px !important;padding:22px !important;background:rgba(6,13,23,.74) !important;border-color:rgba(103,214,255,.14) !important;}
.page-login input{min-height:48px;border-radius:14px !important;}
.page-login button,.page-login .button-link{min-height:46px;border-radius:14px !important;background:linear-gradient(135deg,var(--nx-cyan),var(--nx-blue) 58%,var(--nx-violet)) !important;box-shadow:0 16px 34px rgba(42,132,255,.21) !important;}
.page-login button:hover,.page-login .button-link:hover{transform:translateY(-2px);box-shadow:0 22px 44px rgba(42,132,255,.29) !important;}

/* HOME / LANDING */
.page-home .shell{width:min(1320px,calc(100% - 34px)) !important;padding:18px 0 54px !important;}
.page-home .header{position:sticky !important;top:14px;z-index:12000;margin-bottom:22px !important;padding:13px 15px !important;border-radius:22px !important;border:1px solid rgba(107,216,255,.16) !important;background:rgba(4,10,18,.74) !important;box-shadow:0 20px 54px rgba(0,0,0,.30),0 1px 0 rgba(255,255,255,.045) inset !important;backdrop-filter:blur(22px) saturate(130%) !important;}
.page-home .hero{min-height:650px !important;grid-template-columns:minmax(0,1.07fr) minmax(440px,.93fr) !important;gap:18px !important;}
.page-home .panel{position:relative;overflow:hidden;border-radius:32px !important;border-color:rgba(107,216,255,.17) !important;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012)),rgba(5,12,21,.86) !important;box-shadow:0 34px 90px rgba(0,0,0,.38),0 1px 0 rgba(255,255,255,.05) inset,0 0 70px rgba(25,214,255,.04) !important;}
.page-home .welcome{padding:54px !important;justify-content:flex-start !important;}
.page-home .welcome::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(25,214,255,.08),transparent 40%),radial-gradient(circle at 84% 74%,rgba(139,99,255,.18),transparent 36%);pointer-events:none;}
.page-home .welcome .eyebrow{margin-top:78px;}
.page-home h1{position:relative;z-index:2;margin:16px 0 18px !important;font-size:clamp(70px,9vw,126px) !important;line-height:.78 !important;letter-spacing:-.085em !important;background:linear-gradient(135deg,#fff 8%,#a7efff 45%,#c4b7ff 82%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 18px 45px rgba(25,214,255,.08));}
.page-home .welcome p{position:relative;z-index:2;max-width:570px;font-size:16px;line-height:1.8 !important;color:#91adbf !important;}
.page-home .action-grid{padding:18px !important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px !important;align-content:stretch !important;}
.page-home .primary-tile{min-height:194px !important;padding:22px !important;border-radius:24px !important;border-color:rgba(104,216,255,.18) !important;background:linear-gradient(150deg,rgba(25,214,255,.10),rgba(139,99,255,.045) 60%,rgba(255,255,255,.015)) !important;box-shadow:0 1px 0 rgba(255,255,255,.045) inset !important;}
.page-home .primary-tile:hover{transform:translateY(-5px) !important;border-color:rgba(25,214,255,.46) !important;box-shadow:0 28px 55px rgba(0,0,0,.28),0 0 42px rgba(25,214,255,.08) inset !important;}
.page-home .primary-tile strong{font-size:25px !important;letter-spacing:-.035em;}
.page-home .primary-tile small{line-height:1.55;}
.page-home .primary-tile.copy-script{grid-column:span 2;min-height:168px !important;background:linear-gradient(135deg,rgba(69,255,176,.10),rgba(25,214,255,.07),rgba(139,99,255,.04)) !important;}
.page-home .quick-info{grid-column:span 2;gap:12px !important;}
.page-home .info-card{min-height:118px !important;padding:18px !important;border-radius:20px !important;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015)) !important;}
.nx-hero-orbit{position:absolute;right:36px;bottom:34px;width:258px;aspect-ratio:1;z-index:1;pointer-events:none;filter:drop-shadow(0 0 28px rgba(25,214,255,.13));}
.nx-hero-orbit .ring{position:absolute;inset:0;border:1px solid rgba(94,221,255,.22);border-radius:50%;animation:nxOrbit 16s linear infinite;}
.nx-hero-orbit .ring.r2{inset:28px;border-color:rgba(139,99,255,.28);animation-direction:reverse;animation-duration:11s;}
.nx-hero-orbit .ring.r3{inset:66px;border-color:rgba(69,255,176,.24);animation-duration:8s;}
.nx-hero-orbit .ring::before{content:"";position:absolute;left:50%;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--nx-cyan);box-shadow:0 0 16px var(--nx-cyan);}
.nx-hero-orbit .ring.r2::before{background:var(--nx-violet);box-shadow:0 0 16px var(--nx-violet);}
.nx-hero-orbit .ring.r3::before{background:var(--nx-green);box-shadow:0 0 16px var(--nx-green);}
.nx-hero-orbit .core{position:absolute;inset:91px;display:grid;place-items:center;border-radius:24px;transform:rotate(45deg);background:linear-gradient(135deg,rgba(25,214,255,.22),rgba(139,99,255,.20));border:1px solid rgba(255,255,255,.14);box-shadow:0 0 36px rgba(25,214,255,.15) inset;}
.nx-hero-orbit .core b{transform:rotate(-45deg);font-size:38px;letter-spacing:-.1em;}
@keyframes nxOrbit{to{transform:rotate(360deg)}}
.nx-home-introline{position:absolute;left:54px;top:40px;display:flex;align-items:center;gap:10px;color:#6e8ba0;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;}
.nx-home-introline i{width:36px;height:1px;background:linear-gradient(90deg,var(--nx-cyan),transparent);}
.nx-trust-rail{display:grid;grid-template-columns:1.25fr repeat(3,1fr);gap:12px;margin-top:18px;}
.nx-trust-card{min-height:134px;padding:20px;border:1px solid rgba(106,216,255,.13);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012)),rgba(5,12,21,.78);box-shadow:0 20px 50px rgba(0,0,0,.20);}
.nx-trust-card.lead{display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,rgba(25,214,255,.09),rgba(139,99,255,.055)),rgba(5,12,21,.86);}
.nx-trust-label{color:#668297;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;}
.nx-trust-value{margin-top:10px;color:#f4fcff;font-size:28px;font-weight:950;letter-spacing:-.045em;}
.nx-trust-note{margin-top:6px;color:#7794a8;font-size:12px;line-height:1.5;}
.nx-capabilities{margin-top:18px;padding:30px;border:1px solid rgba(106,216,255,.14);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.01)),rgba(5,11,20,.78);box-shadow:0 28px 74px rgba(0,0,0,.26);}
.nx-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px;}
.nx-section-head h2{margin:8px 0 0;font-size:clamp(30px,4vw,48px);letter-spacing:-.055em;line-height:1;}
.nx-section-head p{max-width:520px;color:#7996aa;line-height:1.6;}
.nx-capability-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
.nx-capability{position:relative;min-height:240px;padding:22px;border:1px solid rgba(112,214,255,.13);border-radius:22px;background:linear-gradient(155deg,rgba(25,214,255,.05),rgba(255,255,255,.014) 55%,rgba(139,99,255,.035));overflow:hidden;}
.nx-capability::after{content:attr(data-index);position:absolute;right:12px;bottom:-20px;color:rgba(255,255,255,.025);font-size:108px;font-weight:1000;letter-spacing:-.12em;}
.nx-capability-icon{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(111,220,255,.22);border-radius:14px;color:var(--nx-cyan);background:rgba(25,214,255,.06);font-weight:950;}
.nx-capability h3{margin:42px 0 10px;font-size:20px;letter-spacing:-.03em;}
.nx-capability p{color:#7592a7;font-size:13px;line-height:1.65;}
.nx-system-banner{display:grid;grid-template-columns:1fr auto;align-items:center;gap:24px;margin-top:18px;padding:28px 30px;border:1px solid rgba(69,255,176,.18);border-radius:28px;background:linear-gradient(120deg,rgba(69,255,176,.075),rgba(25,214,255,.05),rgba(139,99,255,.04)),rgba(5,12,21,.82);box-shadow:0 28px 70px rgba(0,0,0,.24);}
.nx-system-banner h2{margin:7px 0 7px;font-size:30px;letter-spacing:-.045em;}
.nx-system-banner p{color:#7b98ab;}
.nx-status-orb{width:92px;height:92px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(69,255,176,.24);background:radial-gradient(circle,rgba(69,255,176,.16),rgba(69,255,176,.03) 56%,transparent 57%);box-shadow:0 0 50px rgba(69,255,176,.10);}
.nx-status-orb span{width:14px;height:14px;border-radius:50%;background:var(--nx-green);box-shadow:0 0 0 9px rgba(69,255,176,.08),0 0 26px rgba(69,255,176,.85);}
.nx-status-orb.offline{border-color:rgba(255,91,130,.30);background:radial-gradient(circle,rgba(255,91,130,.16),rgba(255,91,130,.03) 56%,transparent 57%);}
.nx-status-orb.offline span{background:var(--nx-red);box-shadow:0 0 0 9px rgba(255,91,130,.08),0 0 26px rgba(255,91,130,.85);}

/* HOME STARTUP CINEMATIC */
.nx-startup{position:fixed;inset:0;z-index:60000;display:grid;place-items:center;background:#020409;overflow:hidden;transition:opacity .55s ease,visibility .55s ease;}
.nx-startup::before{content:"";position:absolute;inset:-30%;background:conic-gradient(from 0deg,transparent,rgba(25,214,255,.12),transparent 32%,rgba(139,99,255,.10),transparent 64%,rgba(69,255,176,.06),transparent);animation:nxStartupSpin 8s linear infinite;filter:blur(42px);}
.nx-startup-grid{position:absolute;inset:0;opacity:.35;background-image:linear-gradient(rgba(25,214,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(25,214,255,.08) 1px,transparent 1px);background-size:54px 54px;perspective:700px;mask-image:radial-gradient(circle at center,black,transparent 74%);}
.nx-startup-grid::after{content:"";position:absolute;left:0;right:0;top:-2px;height:2px;background:linear-gradient(90deg,transparent,var(--nx-cyan),transparent);box-shadow:0 0 28px var(--nx-cyan);animation:nxStartupScan 1.7s ease-in-out infinite;}
.nx-startup-content{position:relative;z-index:2;width:min(430px,calc(100% - 44px));text-align:center;}
.nx-startup-mark{position:relative;width:112px;height:112px;margin:0 auto 28px;display:grid;place-items:center;border-radius:32px;background:linear-gradient(145deg,rgba(25,214,255,.18),rgba(139,99,255,.18));border:1px solid rgba(255,255,255,.14);box-shadow:0 0 0 10px rgba(25,214,255,.025),0 0 70px rgba(25,214,255,.19);animation:nxStartupMark .8s cubic-bezier(.18,.9,.2,1) both;}
.nx-startup-mark::before,.nx-startup-mark::after{content:"";position:absolute;inset:-18px;border:1px solid rgba(25,214,255,.20);border-radius:42px;animation:nxStartupRing 2.4s linear infinite;}
.nx-startup-mark::after{inset:-34px;border-color:rgba(139,99,255,.14);animation-direction:reverse;animation-duration:3.2s;}
.nx-startup-mark b{font-size:48px;letter-spacing:-.13em;}
.nx-startup-kicker{color:#718ca1;font-size:10px;font-weight:900;letter-spacing:.28em;text-transform:uppercase;}
.nx-startup-title{margin:10px 0 20px;font-size:34px;font-weight:950;letter-spacing:-.055em;background:linear-gradient(135deg,#fff,#9eeeff 48%,#c0b3ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.nx-startup-track{height:3px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;}
.nx-startup-track span{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--nx-cyan),var(--nx-blue),var(--nx-violet));box-shadow:0 0 18px rgba(25,214,255,.75);animation:nxStartupLoad 1.95s cubic-bezier(.2,.8,.2,1) forwards;}
.nx-startup-status{min-height:18px;margin-top:13px;color:#6f8da2;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;}
.nx-startup.done{opacity:0;visibility:hidden;}
@keyframes nxStartupSpin{to{transform:rotate(360deg)}}
@keyframes nxStartupScan{0%{transform:translateY(0);opacity:0}15%,85%{opacity:.9}100%{transform:translateY(100vh);opacity:0}}
@keyframes nxStartupMark{from{opacity:0;transform:scale(.55) rotate(-12deg);filter:blur(12px)}to{opacity:1;transform:scale(1) rotate(0);filter:blur(0)}}
@keyframes nxStartupRing{to{transform:rotate(360deg)}}
@keyframes nxStartupLoad{0%{width:0}22%{width:18%}52%{width:58%}78%{width:82%}100%{width:100%}}
body.page-home.nx-booting{overflow:hidden;}
body.page-home.nx-booting > *:not(.nx-startup):not(.nx-ambient):not(.nx-progress-line){opacity:0;}
body.page-home:not(.nx-booting) > main{animation:nxLandingReveal .9s cubic-bezier(.18,.82,.2,1) both;}
@keyframes nxLandingReveal{from{opacity:0;transform:translateY(18px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}

/* ACCOUNT MANAGEMENT */
.page-accounts .shell{width:min(1320px,calc(100% - 34px)) !important;padding:18px 0 54px !important;}
.page-accounts .topbar{position:sticky;top:14px;z-index:1000;border-radius:22px !important;background:rgba(4,10,18,.78) !important;backdrop-filter:blur(22px) saturate(130%) !important;}
.page-accounts .intro{border:1px solid rgba(104,216,255,.14) !important;background:linear-gradient(135deg,rgba(25,214,255,.055),rgba(139,99,255,.035)),rgba(5,12,21,.78) !important;box-shadow:0 24px 60px rgba(0,0,0,.22);}
.nx-account-overview{display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:12px;margin:18px 0;}
.nx-account-overview article{min-height:118px;padding:18px;border:1px solid rgba(104,216,255,.13);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.038),rgba(255,255,255,.012)),rgba(5,12,21,.76);}
.nx-account-overview article:first-child{background:linear-gradient(135deg,rgba(25,214,255,.08),rgba(139,99,255,.05)),rgba(5,12,21,.80);}
.nx-account-overview span{color:#68869a;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;}
.nx-account-overview strong{display:block;margin-top:12px;font-size:25px;letter-spacing:-.04em;}
.nx-account-overview small{display:block;margin-top:5px;color:#7592a6;line-height:1.45;}
.page-accounts .account-list{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px !important;}
.page-accounts .account-card{position:relative;overflow:hidden;border-radius:26px !important;border-color:rgba(104,216,255,.14) !important;background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012)),rgba(5,12,21,.82) !important;box-shadow:0 24px 64px rgba(0,0,0,.25) !important;}
.page-accounts .account-card::after{content:"";position:absolute;width:200px;height:200px;right:-110px;top:-110px;border-radius:50%;background:radial-gradient(circle,rgba(25,214,255,.10),transparent 68%);pointer-events:none;}
.page-accounts .account-card:hover{transform:translateY(-3px);border-color:rgba(25,214,255,.30) !important;box-shadow:0 30px 76px rgba(0,0,0,.32) !important;}
.page-accounts .access-box{border-radius:18px !important;}

/* MENU SERVER / DASHBOARD */
.page-dashboard .shell{width:min(1500px,calc(100% - 30px)) !important;padding:16px 0 52px !important;}
.page-dashboard header{position:sticky !important;top:12px;z-index:12000;padding:14px 16px !important;border:1px solid rgba(104,216,255,.15);border-radius:22px;background:rgba(4,10,18,.78);box-shadow:0 20px 54px rgba(0,0,0,.28),0 1px 0 rgba(255,255,255,.04) inset;backdrop-filter:blur(22px) saturate(130%);}
.page-dashboard header .logo{width:50px !important;height:50px !important;border-radius:16px !important;}
.page-dashboard .hero{position:relative;overflow:hidden;padding:38px !important;border:1px solid rgba(104,216,255,.15) !important;border-radius:30px !important;background:linear-gradient(135deg,rgba(25,214,255,.07),rgba(139,99,255,.045) 62%,rgba(69,255,176,.025)),rgba(5,12,21,.82) !important;box-shadow:0 30px 80px rgba(0,0,0,.30),0 1px 0 rgba(255,255,255,.04) inset !important;}
.page-dashboard .hero::after{content:"";position:absolute;right:-100px;top:-190px;width:520px;height:520px;border-radius:50%;border:1px solid rgba(25,214,255,.08);box-shadow:0 0 0 45px rgba(25,214,255,.018),0 0 0 90px rgba(139,99,255,.015);pointer-events:none;}
.page-dashboard .hero h1{max-width:820px;font-size:clamp(48px,6vw,84px) !important;line-height:.92 !important;letter-spacing:-.065em !important;background:linear-gradient(135deg,#fff,#a7efff 50%,#c5b8ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.page-dashboard .hero > p{max-width:800px;color:#829fb2 !important;font-size:15px;line-height:1.75 !important;}
.page-dashboard .stats{grid-template-columns:1.15fr repeat(3,1fr) !important;gap:12px !important;margin-top:28px !important;}
.page-dashboard .stat{min-height:140px;padding:20px !important;border-radius:21px !important;border-color:rgba(104,216,255,.13) !important;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.014)) !important;}
.page-dashboard .stat-value{font-size:34px !important;letter-spacing:-.05em;}
.page-dashboard .menu-status-panel,.page-dashboard .update-status,.page-dashboard .directory{border-radius:26px !important;border-color:rgba(104,216,255,.14) !important;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.01)),rgba(5,12,21,.82) !important;box-shadow:0 26px 70px rgba(0,0,0,.25),0 1px 0 rgba(255,255,255,.035) inset !important;}
.page-dashboard .menu-status-panel{position:relative;overflow:hidden;}
.page-dashboard .menu-status-panel::after{content:"";position:absolute;right:-70px;top:-90px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(69,255,176,.10),transparent 68%);pointer-events:none;}
.page-dashboard .menu-status-panel.offline::after{background:radial-gradient(circle,rgba(255,91,130,.12),transparent 68%);}
.page-dashboard .directory-tabs{padding:8px !important;gap:7px !important;border-radius:18px !important;background:rgba(2,7,13,.48) !important;}
.page-dashboard .directory-tab{min-height:46px;border-radius:13px !important;}
.page-dashboard .directory-tab.active{background:linear-gradient(135deg,rgba(25,214,255,.15),rgba(139,99,255,.10)) !important;border-color:rgba(25,214,255,.30) !important;box-shadow:0 10px 28px rgba(0,0,0,.18),0 0 24px rgba(25,214,255,.06) inset;}
.page-dashboard .directory-panel{padding:28px !important;}
.page-dashboard .search{min-width:270px;min-height:45px;border-radius:14px !important;}
.page-dashboard .players{gap:12px !important;}
.page-dashboard .player-card,.page-dashboard .player,.page-dashboard .banned-card{border-radius:20px !important;border-color:rgba(104,216,255,.12) !important;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.01)),rgba(5,12,21,.76) !important;box-shadow:0 16px 42px rgba(0,0,0,.16);}
.page-dashboard .modal-card{border-radius:26px !important;background:linear-gradient(150deg,rgba(255,255,255,.045),rgba(255,255,255,.012)),rgba(5,11,20,.97) !important;box-shadow:0 36px 110px rgba(0,0,0,.56),0 1px 0 rgba(255,255,255,.05) inset !important;}
.page-dashboard .toast{border-radius:18px !important;background:rgba(6,13,23,.96) !important;backdrop-filter:blur(18px);}

@keyframes nxPageIn{from{opacity:0;transform:translateY(16px);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}
.page-accounts .shell,.page-dashboard .shell{animation:nxPageIn .72s cubic-bezier(.18,.8,.2,1) both;}

@media(max-width:1120px){
    .page-home .hero{grid-template-columns:1fr !important;}
    .page-home .welcome{min-height:560px;}
    .page-home .action-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
    .nx-capability-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
    .nx-trust-rail,.nx-account-overview{grid-template-columns:repeat(2,minmax(0,1fr));}
    .page-dashboard .stats{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
}
@media(max-width:860px){
    .page-login{align-items:start !important;padding:14px !important;}
    .page-login .login-shell{grid-template-columns:1fr !important;}
    .page-login .brand-card{min-height:440px;padding:30px !important;}
    .page-login .brand-card::after{font-size:280px;}
    .page-home .header,.page-dashboard header,.page-accounts .topbar{position:relative !important;top:auto;}
    .page-home .welcome{padding:34px !important;min-height:520px;}
    .page-home .welcome .eyebrow{margin-top:62px;}
    .nx-home-introline{left:34px;top:30px;}
    .nx-hero-orbit{width:210px;right:20px;bottom:22px;opacity:.72;}
    .page-accounts .account-list{grid-template-columns:1fr !important;}
    .nx-section-head{align-items:flex-start;flex-direction:column;}
    .page-dashboard .header-actions{flex-wrap:wrap;}
}
@media(max-width:620px){
    .page-home .shell,.page-accounts .shell,.page-dashboard .shell{width:min(100% - 18px,1500px) !important;}
    .page-home .header{padding:10px !important;border-radius:18px !important;}
    .page-home .brand span{display:none;}
    .page-home .account-name{max-width:104px;}
    .page-home .action-grid{grid-template-columns:1fr !important;}
    .page-home .primary-tile.copy-script,.page-home .quick-info{grid-column:auto;}
    .page-home .quick-info{grid-template-columns:1fr;}
    .nx-hero-orbit{display:none;}
    .page-home .welcome{min-height:470px;padding:28px !important;}
    .page-home h1{font-size:72px !important;}
    .nx-home-introline{left:28px;}
    .nx-trust-rail,.nx-account-overview,.nx-capability-grid{grid-template-columns:1fr;}
    .nx-capabilities{padding:22px;}
    .nx-system-banner{grid-template-columns:1fr;padding:22px;}
    .nx-status-orb{width:72px;height:72px;}
    .page-login .statline{grid-template-columns:1fr;}
    .page-dashboard .stats{grid-template-columns:1fr !important;}
    .page-dashboard .hero{padding:25px !important;}
    .page-dashboard .directory-panel{padding:17px !important;}
    .page-dashboard .directory-head{align-items:stretch !important;flex-direction:column;}
    .page-dashboard .search{min-width:0;width:100%;}
    .nx-command-strip{white-space:nowrap;overflow:auto;scrollbar-width:none;}
    .nx-command-strip::-webkit-scrollbar{display:none;}
    .nx-page-footer{align-items:flex-start;flex-direction:column;}
}
@media(prefers-reduced-motion:reduce){
    html{scroll-behavior:auto;}
    *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
    .nx-startup{display:none !important;}
    body.page-home.nx-booting{overflow:auto;}
    body.page-home.nx-booting > *{opacity:1 !important;}
}
`;
}

function nexuV200HomeAddon() {
    const status = getMenuAvailabilityStatus();
    const isOnline = status.online === true;
    const knownCount = knownPlayers.size;
    const accountCount = dashboardAccounts.size;
    const banCount = bans.size;
    return String.raw`
<section class="nx-trust-rail" aria-label="Nexu Systemübersicht">
    <article class="nx-trust-card lead"><div><div class="nx-trust-label">NEXU CONTROL PLANE</div><div class="nx-trust-value">One interface. Full control.</div></div><div class="nx-trust-note">Presence, Rollen, Sessions und Runtime-Kommandos in einer zentralen, geschützten Oberfläche.</div></article>
    <article class="nx-trust-card"><div class="nx-trust-label">Menu Network</div><div class="nx-trust-value">${isOnline ? "Online" : "Offline"}</div><div class="nx-trust-note">Globaler Lua-Menüstatus</div></article>
    <article class="nx-trust-card"><div class="nx-trust-label">Known Players</div><div class="nx-trust-value">${knownCount}</div><div class="nx-trust-note">Persistente Nutzerprofile</div></article>
    <article class="nx-trust-card"><div class="nx-trust-label">Dashboard Accounts</div><div class="nx-trust-value">${accountCount}</div><div class="nx-trust-note">Berechtigungsbasierte Zugänge</div></article>
</section>
<section class="nx-capabilities">
    <div class="nx-section-head"><div><div class="eyebrow">NEXU // PLATFORM</div><h2>Built like a real control platform.</h2></div><p>Jeder Bereich ist auf schnelle Entscheidungen ausgelegt: klare Zustände, sichere Aktionen und eine visuelle Hierarchie, die auch bei vielen Spielern übersichtlich bleibt.</p></div>
    <div class="nx-capability-grid">
        <article class="nx-capability" data-index="01"><div class="nx-capability-icon">PN</div><h3>Presence Network</h3><p>Live-Sitzungen, bekannte Spieler und Plattformdaten werden in einem einzigen autoritativen Snapshot zusammengeführt.</p></article>
        <article class="nx-capability" data-index="02"><div class="nx-capability-icon">RC</div><h3>Runtime Control</h3><p>Direktnachrichten, Herbeiholen, Serverbeitritt, Aktualisierungsmodus und globale Skriptsteuerung ohne Umwege.</p></article>
        <article class="nx-capability" data-index="03"><div class="nx-capability-icon">AG</div><h3>Access Governance</h3><p>Granulare Rechte, geschützter OwnerAccount und getrennte Rollen für jede administrative Funktion.</p></article>
        <article class="nx-capability" data-index="04"><div class="nx-capability-icon">SD</div><h3>Secure Delivery</h3><p>Signierte Sitzungen, serverseitige Validierung und persistente Zustände für einen belastbaren Betrieb.</p></article>
    </div>
</section>
<section class="nx-system-banner">
    <div><div class="eyebrow">SYSTEM READY</div><h2>${isOnline ? "Nexu ist bereit für den nächsten Einsatz." : "Nexu befindet sich aktuell im Offline-Modus."}</h2><p>${isOnline ? `Das Kontrollsystem ist erreichbar. ${knownCount} Spielerprofile sind registriert und ${banCount} Nutzer derzeit gesperrt.` : "Neue Lua-Starts werden blockiert, bis der Menüstatus im Menu Server wieder aktiviert wird."}</p></div>
    <div class="nx-status-orb${isOnline ? "" : " offline"}" aria-label="${isOnline ? "Online" : "Offline"}"><span></span></div>
</section>
<div class="nx-page-footer"><span><strong>NEXU</strong> · CONTROL NETWORK</span><span>GESICHERTE SITZUNG · V207</span></div>`;
}

function nexuV200StartupHtml() {
    return String.raw`<div id="nxStartup" class="nx-startup" aria-hidden="true"><div class="nx-startup-grid"></div><div class="nx-startup-content"><div class="nx-startup-mark"><b>N</b></div><div class="nx-startup-kicker">NEXU STEUERNETZWERK</div><div class="nx-startup-title">Arbeitsbereich wird vorbereitet</div><div class="nx-startup-track"><span></span></div><div id="nxStartupStatus" class="nx-startup-status">GESICHERTER KANAL // WIRD INITIALISIERT</div></div></div>`;
}

function nexuV200ClientScript(pageType) {
    return String.raw`<script>
(function(){
    "use strict";
    var pageType = ${JSON.stringify(pageType)};
    var body = document.body;
    requestAnimationFrame(function(){ body.classList.add("nx-page-ready"); });

    var spotlightTargets = Array.prototype.slice.call(document.querySelectorAll(".panel,.primary-tile,.stat,.account-card,.auth-panel,.remembered-list,.directory,.menu-status-panel,.update-status,.nx-trust-card,.nx-capability"));
    spotlightTargets.forEach(function(card){
        card.addEventListener("pointermove",function(event){
            var rect = card.getBoundingClientRect();
            card.style.setProperty("--nx-pointer-x",(event.clientX-rect.left)+"px");
            card.style.setProperty("--nx-pointer-y",(event.clientY-rect.top)+"px");
        },{passive:true});
    });

    if(pageType === "home"){
        var splash = document.getElementById("nxStartup");
        var status = document.getElementById("nxStartupStatus");
        var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if(reduced || !splash){
            body.classList.remove("nx-booting");
            if(splash) splash.remove();
        }else{
            var steps = [
                [320,"AUTHENTICATING // ÜBERSICHTS-SITZUNG"],
                [760,"SYNCING // PRESENCE NETWORK"],
                [1220,"LOADING // CONTROL MODULES"],
                [1660,"SYSTEM READY // WELCOME TO NEXU"]
            ];
            steps.forEach(function(step){ setTimeout(function(){ if(status) status.textContent=step[1]; },step[0]); });
            setTimeout(function(){
                splash.classList.add("done");
                body.classList.remove("nx-booting");
                setTimeout(function(){ if(splash && splash.parentNode) splash.parentNode.removeChild(splash); },650);
            },2050);
        }
    }
})();
</script>`;
}

function enhanceNexuV200Page(html, pageType) {
    if (typeof html !== "string" || html.includes("NEXU V200 AURORA-ERLEBNIS")) return html;

    const bodyClasses = `nexu-v200 page-${pageType}${pageType === "home" ? " nx-booting" : ""}`;
    const ambient = `<div class="nx-ambient" aria-hidden="true"><span class="nx-ambient-orb a"></span><span class="nx-ambient-orb b"></span><span class="nx-ambient-orb c"></span></div><div class="nx-progress-line" aria-hidden="true"></div>`;
    const startup = pageType === "home" ? nexuV200StartupHtml() : "";

    html = html.replace(/<body([^>]*)>/i, function(match, attributes) {
        let nextAttributes = attributes || "";
        if (/\bclass\s*=\s*"[^"]*"/i.test(nextAttributes)) {
            nextAttributes = nextAttributes.replace(/\bclass\s*=\s*"([^"]*)"/i, function(_, current) {
                return `class="${current} ${bodyClasses}"`;
            });
        } else {
            nextAttributes += ` class="${bodyClasses}"`;
        }
        return `<body${nextAttributes}>${ambient}${startup}`;
    });

    html = html.replace("</style>", nexuV200SharedCss() + "</style>");

    if (pageType === "home") {
        html = html.replace('<div class="panel welcome">', '<div class="panel welcome"><div class="nx-home-introline"><span>Authenticated workspace</span><i></i><span>Live control</span></div><div class="nx-hero-orbit" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="core"><b>N</b></span></div>');
        html = html.replace("</main>", nexuV200HomeAddon() + "</main>");
    } else if (pageType === "dashboard") {
        const strip = '<div class="nx-command-strip"><span>CONTROL PLANE</span><i></i><span>PRESENCE NETWORK</span><i></i><span>ROLE GOVERNANCE</span><i></i><span>RUNTIME COMMANDS</span><span class="nx-live">SECURE SESSION</span></div>';
        html = html.replace("</header>", "</header>" + strip);
        html = html.replace("</main>", '<div class="nx-page-footer"><span><strong>NEXU</strong> · MENU SERVER</span><span>PROFESSIONELLE SERVERÜBERSICHT · V207</span></div></main>');
    } else if (pageType === "accounts") {
        const accountOverview = `<section class="nx-account-overview"><article><span>Access Governance</span><strong>Kontrollzentrum für Konten</strong><small>Zentrale Verwaltung für Roblox-Verknüpfungen, Passwörter und granulare Rechte.</small></article><article><span>Accounts</span><strong>${dashboardAccounts.size}</strong><small>Registrierte Zugänge zur Übersicht</small></article><article><span>Permission Modules</span><strong>${DASHBOARD_PERMISSION_DEFINITIONS.length}</strong><small>Einzeln steuerbare Berechtigungen</small></article><article><span>Owner Protection</span><strong>Active</strong><small>OwnerAccount bleibt geschützt; Roblox-Verknüpfung ist änderbar</small></article></section>`;
        html = html.replace('<section class="account-list">', accountOverview + '<section class="account-list">');
        html = html.replace("</main>", '<div class="nx-page-footer"><span><strong>NEXU</strong> · ACCOUNT GOVERNANCE</span><span>OWNER GESCHÜTZT · V207</span></div></main>');
    }

    html = html.replace("</body>", nexuV200ClientScript(pageType) + "</body>");
    return html;
}

loginHtml = function(...args) {
    return enhanceNexuV200Page(NEXU_V200_BASE_LOGIN_HTML(...args), "login");
};
homeHtml = function(...args) {
    return enhanceNexuV200Page(NEXU_V200_BASE_HOME_HTML(...args), "home");
};
dashboardAccountsHtml = function(...args) {
    return enhanceNexuV200Page(NEXU_V200_BASE_ACCOUNTS_HTML(...args), "accounts");
};
dashboardHtml = function(...args) {
    return enhanceNexuV200Page(NEXU_V200_BASE_DASHBOARD_HTML(...args), "dashboard");
};


/* --------------------------------------------------------------------------
 * NEXU V201 // DEUTSCHE SERVERÜBERSICHT
 *
 * V200 bleibt als visuelle Basis erhalten. V201 übersetzt die sichtbare
 * Oberfläche vollständig ins Deutsche und erweitert die Übersicht um eine
 * echte Serverzentrale mit Live-Metriken, Systemnavigation und Laufzeitdaten.
 * Interne API-Schlüssel, Rollen-Keys und bestehende Formulare bleiben stabil.
 * -------------------------------------------------------------------------- */

const NEXU_V201_BASE_LOGIN_HTML = loginHtml;
const NEXU_V201_BASE_HOME_HTML = homeHtml;
const NEXU_V201_BASE_ACCOUNTS_HTML = dashboardAccountsHtml;
const NEXU_V201_BASE_OVERVIEW_HTML = dashboardHtml;

function buildNexuOverviewRuntimeSnapshot() {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
        success: true,
        version: "V207",
        serviceName: cleanText(process.env.RENDER_SERVICE_NAME || "Nexu Server", 100) || "Nexu Server",
        instanceId: SERVER_INSTANCE_ID,
        startedAtMs: SERVER_STARTED_AT_MS,
        startedAt: new Date(SERVER_STARTED_AT_MS).toISOString(),
        uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
        nodeVersion: process.version,
        platform: `${process.platform}/${process.arch}`,
        environment: cleanText(process.env.NODE_ENV || "production", 40) || "production",
        port: PORT,
        cpuUserMicros: Number(cpu.user) || 0,
        cpuSystemMicros: Number(cpu.system) || 0,
        rssBytes: Number(memory.rss) || 0,
        heapUsedBytes: Number(memory.heapUsed) || 0,
        heapTotalBytes: Number(memory.heapTotal) || 0,
        externalBytes: Number(memory.external) || 0,
        activePlayers: countActivePresenceUsers(),
        activeSessions: presence.size,
        knownPlayers: knownPlayers.size,
        bannedPlayers: bans.size,
        overviewAccounts: dashboardAccounts.size,
        queuedDirectMessages: directMessages.size,
        pendingCommands:
            joinCommands.size +
            bringCommands.size +
            shutdownCommandsBySession.size +
            shutdownCommandsByUser.size,
        menuOnline: getMenuAvailabilityStatus().online === true,
        maintenanceActive: getMenuUpdateStatus().active === true,
        storageMode: isGitHubStorageConfigured()
            ? "GitHub-Speicher mit lokalem Fallback"
            : "Lokaler Dateispeicher",
        activeWindowSeconds: Math.floor(ACTIVE_PRESENCE_WINDOW_MS / 1000),
        retentionSeconds: Math.floor(PRESENCE_ENTRY_RETENTION_MS / 1000),
        checkedAtMs: Date.now(),
        checkedAt: new Date().toISOString(),
    };
}

function nexuV201GermanizeHtml(html) {
    if (typeof html !== "string") return html;
    const translations = [
        ["NEXU AURORA-ERLEBNIS", "NEXU AURORA-ERLEBNIS"],
        ["Privates Dashboard", "Private Serverübersicht"],
        ["DASHBOARD SESSION", "ÜBERSICHTS-SITZUNG"],
        ["START SCRIPT", "SKRIPT STARTEN"],
        ["Script kopieren", "Skript kopieren"],
        ["ACCOUNT SETTINGS", "KONTOEINSTELLUNGEN"],
        ["Account bearbeiten", "Konto bearbeiten"],
        ["NEXU // ACCOUNT SICHERHEIT", "NEXU // KONTOSICHERHEIT"],
        ["Account wirklich löschen?", "Konto wirklich löschen?"],
        ["OWNER LOCK", "OWNER-SCHUTZ"],
        ["Script-Update", "Skript-Aktualisierung"],
        ["Scripts deaktivieren", "Skripte deaktivieren"],
        ["Lua-Script", "Lua-Skript"],
        ["NEXU // MENU STATUS", "NEXU // MENÜSTATUS"],
        ["MENU SPIELER", "MENÜ-SPIELER"],
        ["OFFLINE ARCHIV", "OFFLINE-ARCHIV"],
        ["BAN BESTÄTIGEN", "SPERRE BESTÄTIGEN"],
        ["ALLE SCRIPTS AUS", "ALLE SKRIPTE AUS"],
        ["Gebannt", "Gesperrt"],
        ["Gebannte Nutzer", "Gesperrte Nutzer"],
        ["Spieler bannen", "Spieler sperren"],
        ["Bannen/Entbannen", "Sperren/Entsperren"],
        ["Entbannen", "Entsperren"],
        ["Bring benutzen", "Herbeiholen verwenden"],
        ["BRING", "HERBEIHOLEN"],
        ["DM SENDEN", "DIREKTNACHRICHT SENDEN"],
        ["Control Home", "Steuerzentrale"],
        ["SECURE CHANNEL", "GESICHERTER KANAL"],
        ["Settings", "Einstellungen"],
        ["Dashboard-Rechte", "Übersichtsrechte"],
        ["Dashboard-Funktionen", "Funktionen der Übersicht"],
        ["NEXU STEUERNETZWERK", "NEXU STEUERNETZWERK"],
        ["CONTROL NETWORK", "STEUERNETZWERK"],
        ["CONTROL PLANE", "STEUERZENTRALE"],
        ["Presence Network", "Präsenznetzwerk"],
        ["PRESENCE NETWORK", "PRÄSENZNETZWERK"],
        ["Presence, Rollen, Sessions und Runtime-Kommandos", "Präsenz, Rollen, Sitzungen und Laufzeitbefehle"],
        ["ROLE GOVERNANCE", "ROLLENVERWALTUNG"],
        ["RUNTIME COMMANDS", "LAUFZEITBEFEHLE"],
        ["Runtime Control", "Laufzeitsteuerung"],
        ["Access Governance", "Zugriffsverwaltung"],
        ["ACCOUNT GOVERNANCE", "KONTOVERWALTUNG"],
        ["Secure Delivery", "Sichere Bereitstellung"],
        ["SECURE SESSION", "GESICHERTE SITZUNG"],
        ["LIVE CONTROL INTERFACE", "LIVE-STEUEROBERFLÄCHE"],
        ["Authenticated workspace", "Authentifizierter Arbeitsbereich"],
        ["Live control", "Live-Steuerung"],
        ["One interface. Full control.", "Eine Oberfläche. Volle Kontrolle."],
        ["Menu Network", "Menü-Netzwerk"],
        ["Known Players", "Bekannte Spieler"],
        ["Dashboard Accounts", "Übersichts-Konten"],
        ["Dashboard-Zugänge", "Übersichts-Zugänge"],
        ["Übersicht öffnen", "Übersicht öffnen"],
        ["Spieler-Übersicht öffnen", "Serverübersicht öffnen"],
        ["Built like a real control platform.", "Gebaut wie eine echte Steuerplattform."],
        ["Kontrollzentrum für Konten", "Kontrollzentrum für Konten"],
        ["Permission Modules", "Berechtigungsmodule"],
        ["Owner Protection", "Owner-Schutz"],
        [">Active<", ">Aktiv<"],
        ["OWNER PROTECTED", "OWNER GESCHÜTZT"],
        ["SYSTEM READY", "SYSTEM BEREIT"],
        ["Arbeitsbereich wird vorbereitet", "Arbeitsbereich wird vorbereitet"],
        ["INITIALIZING", "WIRD INITIALISIERT"],
        ["AUTHENTICATING", "ANMELDUNG WIRD GEPRÜFT"],
        ["SYNCING", "DATEN WERDEN ABGEGLICHEN"],
        ["LOADING", "MODULE WERDEN GELADEN"],
        ["WELCOME TO NEXU", "WILLKOMMEN BEI NEXU"],
        ["PLATFORM", "PLATTFORM"],
        ["Menu Server", "Menüserver"],
        ["MENU SERVER", "ÜBERSICHT"],
        ["Server Join", "Serverbeitritt"],
        ["SCRIPT UPDATE", "SKRIPT-AKTUALISIERUNG"],
        ["UPDATE SCRIPT", "SKRIPT AKTUALISIEREN"],
        ["UPDATE STARTEN", "AKTUALISIERUNG STARTEN"],
        ["UPDATE ABBRECHEN", "AKTUALISIERUNG BEENDEN"],
        ["LIVE SYSTEM", "LIVESYSTEM"],
        ["OwnerAccount Zugriff", "OwnerAccount-Zugriff"],
        ["Accounts", "Konten"],
        ["Kontoverwaltung", "Kontoverwaltung"],
        ["Account-Einstellungen", "Kontoeinstellungen"],
        ["Konto löschen", "Konto löschen"],
        ["Konto wurde gelöscht.", "Konto wurde gelöscht."],
        ["Account konnte nicht gespeichert werden.", "Konto konnte nicht gespeichert werden."],
        ["Registrierte Übersicht-Zugänge", "Registrierte Zugänge zur Übersicht"],
        ["Render-Web-Service", "Render-Webdienst"],
        ["PLAYERS", "SPIELER"],
        ["SUPPORTER", "UNTERSTÜTZER"],
        ["MENU CREATOR", "MENÜ-ERSTELLER"],
        ["CONTROL MODULES", "STEUERMODULE"],
    ];
    for (const [source, target] of translations) {
        html = html.split(source).join(target);
    }
    return html;
}

function nexuV201OverviewCss() {
    return String.raw`
/* NEXU V201 // DEUTSCHE SERVERÜBERSICHT */
.page-dashboard .nx-overview-layout{
    display:grid;
    grid-template-columns:324px minmax(0,1fr);
    gap:18px;
    align-items:start;
}
.page-dashboard .nx-overview-content{min-width:0;display:grid;gap:0;}
.page-dashboard .nx-overview-sidebar{
    position:sticky;
    top:104px;
    max-height:calc(100vh - 120px);
    overflow:auto;
    overscroll-behavior:contain;
    scrollbar-width:thin;
    scrollbar-color:rgba(25,214,255,.34) transparent;
    border:1px solid rgba(104,216,255,.16);
    border-radius:28px;
    padding:16px;
    background:
        radial-gradient(circle at 12% 0,rgba(25,214,255,.09),transparent 18rem),
        linear-gradient(155deg,rgba(255,255,255,.042),rgba(255,255,255,.012)),
        rgba(4,10,18,.91);
    box-shadow:0 30px 80px rgba(0,0,0,.34),0 1px 0 rgba(255,255,255,.05) inset,0 0 50px rgba(25,214,255,.055);
    backdrop-filter:blur(24px) saturate(135%);
}
.page-dashboard .nx-overview-sidebar::-webkit-scrollbar{width:6px;}
.page-dashboard .nx-overview-sidebar::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(25,214,255,.28);}
.nx-server-head{
    position:relative;
    overflow:hidden;
    display:grid;
    grid-template-columns:58px minmax(0,1fr);
    gap:13px;
    align-items:center;
    min-height:92px;
    padding:14px;
    border:1px solid rgba(104,216,255,.14);
    border-radius:21px;
    background:linear-gradient(145deg,rgba(25,214,255,.075),rgba(139,99,255,.04)),rgba(7,15,26,.76);
}
.nx-server-head::after{
    content:"";
    position:absolute;
    width:150px;
    height:150px;
    right:-90px;
    top:-92px;
    border-radius:50%;
    background:radial-gradient(circle,rgba(25,214,255,.14),transparent 68%);
    pointer-events:none;
}
.nx-server-logo{
    position:relative;
    width:58px;
    height:58px;
    display:grid;
    place-items:center;
    border-radius:18px;
    color:white;
    font-size:24px;
    font-weight:950;
    background:linear-gradient(145deg,var(--nx-cyan),var(--nx-blue) 58%,var(--nx-violet));
    box-shadow:0 15px 36px rgba(25,214,255,.22),0 0 0 1px rgba(255,255,255,.18) inset;
}
.nx-server-logo::after{
    content:"";
    position:absolute;
    inset:-6px;
    border:1px solid rgba(25,214,255,.18);
    border-radius:23px;
    animation:nxServerHalo 3.2s ease-in-out infinite;
}
@keyframes nxServerHalo{0%,100%{opacity:.35;transform:scale(.96)}50%{opacity:.9;transform:scale(1.04)}}
.nx-server-copy{min-width:0;position:relative;z-index:1;}
.nx-server-copy span{display:block;color:#6f8ea3;font-size:9px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;}
.nx-server-copy strong{display:block;margin-top:5px;overflow:hidden;color:#f3fbff;font-size:17px;letter-spacing:-.025em;text-overflow:ellipsis;white-space:nowrap;}
.nx-server-copy small{display:flex;align-items:center;gap:7px;margin-top:7px;color:#87a4b7;font-size:10px;}
.nx-server-copy small i{width:7px;height:7px;border-radius:50%;background:var(--nx-green);box-shadow:0 0 12px rgba(69,255,176,.85);}
.nx-server-copy small.offline i{background:var(--nx-red);box-shadow:0 0 12px rgba(255,91,130,.85);}
.nx-sidebar-section{
    margin-top:14px;
    padding:14px;
    border:1px solid rgba(104,216,255,.10);
    border-radius:20px;
    background:linear-gradient(180deg,rgba(255,255,255,.026),rgba(255,255,255,.008));
}
.nx-sidebar-title{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom:11px;
    color:#68869a;
    font-size:9px;
    font-weight:950;
    letter-spacing:.17em;
    text-transform:uppercase;
}
.nx-sidebar-title b{color:#8eacbf;font-size:8px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;}
.nx-overview-nav{display:grid;gap:7px;}
.nx-overview-nav a{
    position:relative;
    min-height:47px;
    display:grid;
    grid-template-columns:30px minmax(0,1fr) 12px;
    align-items:center;
    gap:9px;
    padding:0 11px;
    border:1px solid rgba(104,216,255,.08);
    border-radius:14px;
    color:#91abba;
    background:rgba(4,10,18,.40);
    text-decoration:none;
    font-size:11px;
    font-weight:820;
}
.nx-overview-nav a::after{content:"›";color:#527187;font-size:16px;}
.nx-overview-nav a:hover,.nx-overview-nav a.active{
    color:#effaff;
    border-color:rgba(25,214,255,.28);
    background:linear-gradient(135deg,rgba(25,214,255,.10),rgba(139,99,255,.055));
    box-shadow:0 12px 28px rgba(0,0,0,.16),0 0 22px rgba(25,214,255,.045) inset;
    transform:translateX(2px);
}
.nx-nav-icon{
    width:28px;
    height:28px;
    display:grid;
    place-items:center;
    border:1px solid rgba(104,216,255,.12);
    border-radius:9px;
    color:#75dfff;
    background:rgba(4,12,21,.72);
    font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
    font-size:9px;
}
.nx-live-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.nx-live-tile{
    min-height:76px;
    padding:11px;
    border:1px solid rgba(104,216,255,.09);
    border-radius:15px;
    background:linear-gradient(155deg,rgba(255,255,255,.036),rgba(255,255,255,.01)),rgba(4,10,18,.38);
}
.nx-live-tile span{display:block;color:#607d91;font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;}
.nx-live-tile strong{display:block;margin-top:8px;color:#eaf9ff;font-size:21px;letter-spacing:-.04em;}
.nx-live-tile strong.good{color:#69ffc0;}
.nx-live-tile strong.warn{color:#ffc979;}
.nx-live-tile strong.bad{color:#ff7898;}
.nx-health-panel{display:grid;grid-template-columns:98px minmax(0,1fr);gap:13px;align-items:center;}
.nx-health-ring{
    --nx-health:100;
    position:relative;
    width:96px;
    height:96px;
    display:grid;
    place-items:center;
    border-radius:50%;
    background:conic-gradient(var(--nx-green) calc(var(--nx-health)*1%),rgba(255,255,255,.055) 0);
    box-shadow:0 0 32px rgba(69,255,176,.08);
}
.nx-health-ring::before{content:"";position:absolute;inset:8px;border-radius:50%;background:#07101b;border:1px solid rgba(255,255,255,.045);}
.nx-health-ring b,.nx-health-ring small{position:relative;z-index:1;display:block;text-align:center;}
.nx-health-ring b{font-size:22px;letter-spacing:-.05em;}
.nx-health-ring small{margin-top:-3px;color:#648297;font-size:8px;letter-spacing:.12em;text-transform:uppercase;}
.nx-health-copy strong{display:block;font-size:14px;}
.nx-health-copy span{display:block;margin-top:5px;color:#6f8da1;font-size:10px;line-height:1.45;}
.nx-meter{margin-top:10px;}
.nx-meter-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:6px;color:#7895a9;font-size:9px;}
.nx-meter-track{height:6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.055);}
.nx-meter-track i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--nx-cyan),var(--nx-blue));box-shadow:0 0 10px rgba(25,214,255,.42);transition:width .55s cubic-bezier(.2,.8,.2,1);}
.nx-meter.heap .nx-meter-track i{background:linear-gradient(90deg,var(--nx-violet),#c28dff);}
.nx-runtime-chart{
    width:100%;
    height:92px;
    display:block;
    margin-top:10px;
    border:1px solid rgba(104,216,255,.08);
    border-radius:14px;
    background:linear-gradient(180deg,rgba(3,9,16,.72),rgba(5,12,21,.46));
}
.nx-info-list{display:grid;gap:0;}
.nx-info-row{
    display:grid;
    grid-template-columns:92px minmax(0,1fr);
    gap:10px;
    align-items:start;
    padding:9px 0;
    border-bottom:1px solid rgba(104,216,255,.065);
}
.nx-info-row:last-child{border-bottom:0;padding-bottom:0;}
.nx-info-row span{color:#5f7d92;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;}
.nx-info-row b{min-width:0;color:#aec7d7;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9px;font-weight:600;overflow-wrap:anywhere;}
.nx-sidebar-foot{display:flex;align-items:center;gap:8px;margin-top:12px;padding:0 4px;color:#58758a;font-size:9px;line-height:1.45;}
.nx-sidebar-foot i{width:6px;height:6px;border-radius:50%;background:var(--nx-green);box-shadow:0 0 10px rgba(69,255,176,.75);}
.page-dashboard #uebersicht-status{scroll-margin-top:112px;}
.page-dashboard #menuStatusPanel,.page-dashboard #updateStatusPanel,.page-dashboard #uebersicht-spieler{scroll-margin-top:112px;}
.page-dashboard .nx-command-strip span:first-child{color:#b9efff;}
.page-dashboard .hero{margin-top:0 !important;}
.page-dashboard .nx-overview-content > section + section{margin-top:18px;}
.page-dashboard .nx-page-footer{grid-column:1/-1;}
@media(max-width:1180px){
    .page-dashboard .nx-overview-layout{grid-template-columns:1fr;}
    .page-dashboard .nx-overview-sidebar{position:relative;top:auto;max-height:none;}
    .nx-overview-nav{grid-template-columns:repeat(4,minmax(0,1fr));}
    .nx-overview-nav a{grid-template-columns:28px minmax(0,1fr);padding:0 9px;}
    .nx-overview-nav a::after{display:none;}
    .nx-sidebar-section.nx-server-details{display:none;}
}
@media(max-width:760px){
    .page-dashboard .nx-overview-layout{gap:12px;}
    .page-dashboard .nx-overview-sidebar{padding:12px;border-radius:23px;}
    .nx-overview-nav{grid-template-columns:1fr 1fr;}
    .nx-health-panel{grid-template-columns:86px minmax(0,1fr);}
    .nx-health-ring{width:84px;height:84px;}
    .nx-live-grid{grid-template-columns:repeat(2,1fr);}
}
@media(max-width:480px){
    .nx-overview-nav{grid-template-columns:1fr;}
    .nx-live-grid{grid-template-columns:1fr 1fr;}
}

/* NEXU V202 // SPIELERKARTEN UND RANG-AUSWAHL */
.page-dashboard .directory{
    overflow:visible;
}
.page-dashboard .directory::before{
    border-radius:inherit;
}
.page-dashboard .directory-panel,
.page-dashboard .players{
    overflow:visible;
}
.page-dashboard .players{
    align-items:start;
}
.page-dashboard .player{
    position:relative;
    display:grid;
    grid-template-columns:58px minmax(0,1fr);
    grid-template-areas:
        "avatar identity"
        "actions actions";
    align-items:start;
    gap:12px 13px;
    min-width:0;
    padding:14px;
    overflow:visible;
}
.page-dashboard .player .avatar{
    grid-area:avatar;
    width:58px;
    height:58px;
    flex:none;
    border-radius:16px;
}
.page-dashboard .player .identity{
    grid-area:identity;
    width:100%;
    min-width:0;
}
.page-dashboard .player .display-name{
    max-width:100%;
    font-size:15px;
    line-height:1.25;
}
.page-dashboard .player .username{
    max-width:100%;
    font-size:11px;
    line-height:1.35;
}
.page-dashboard .player-actions{
    grid-area:actions;
    width:100%;
    min-width:0;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding-top:10px;
    border-top:1px solid rgba(108,223,255,.08);
}
.page-dashboard .player-state{
    flex:0 0 auto;
    min-width:max-content;
    font-size:9px;
    font-weight:900;
    letter-spacing:.12em;
}
.page-dashboard .player .button-row{
    min-width:0;
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:6px;
    flex-wrap:wrap;
}
.page-dashboard .player .action-button{
    min-height:30px !important;
    height:30px;
    min-width:0;
    padding:0 9px !important;
    border-radius:10px !important;
    font-size:8px !important;
    font-weight:900;
    letter-spacing:.055em !important;
    line-height:1;
    white-space:nowrap;
    box-shadow:0 6px 14px rgba(0,0,0,.16),0 0 0 1px rgba(255,255,255,.015) inset;
}
.page-dashboard .player .action-button:hover{
    transform:translateY(-1px);
}
.page-dashboard .player .role-picker{
    max-width:100%;
    margin-top:7px;
}
.page-dashboard .player .role-trigger.role-badge{
    min-height:28px !important;
    max-width:100%;
    padding:0 10px !important;
    border-radius:10px;
    font-size:8px !important;
    letter-spacing:.09em !important;
}
.page-dashboard .player .role-trigger.role-badge > span:first-child{
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.page-dashboard .player .role-trigger-chevron{
    flex:0 0 auto;
    font-size:11px;
}
.page-dashboard .player.role-menu-open{
    z-index:80;
}
.page-dashboard .role-dropdown{
    z-index:120;
    width:min(272px,calc(100vw - 34px));
    max-height:min(360px,calc(100vh - 150px));
    overflow:auto;
    padding:10px;
    border-radius:16px;
    scrollbar-width:thin;
    scrollbar-color:rgba(25,214,255,.32) transparent;
}
.page-dashboard .role-dropdown::-webkit-scrollbar{
    width:6px;
}
.page-dashboard .role-dropdown::-webkit-scrollbar-thumb{
    border-radius:999px;
    background:rgba(25,214,255,.3);
}
.page-dashboard .role-dropdown-head{
    padding:2px 3px 9px;
}
.page-dashboard .role-dropdown-head strong{
    font-size:12px;
}
.page-dashboard .role-dropdown-head .role-dropdown-badge{
    max-width:104px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.page-dashboard .role-search{
    height:36px;
    border-radius:11px;
    font-size:10px;
}
.page-dashboard .role-option-list{
    gap:6px;
}
.page-dashboard .role-option{
    min-height:46px;
    grid-template-columns:24px minmax(0,1fr);
    gap:8px;
    padding:7px 8px;
    border-radius:12px;
}
.page-dashboard .role-option-icon{
    width:23px;
    height:23px;
    border-radius:8px;
    font-size:10px;
}
.page-dashboard .role-option-copy strong{
    font-size:10px;
}
.page-dashboard .role-option-copy small{
    margin-top:2px;
    font-size:9px;
    line-height:1.25;
}
.page-dashboard .presence-details{
    width:100%;
    min-width:0;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:7px;
    margin-top:10px;
    padding:0;
    border:0;
    background:transparent;
}
.page-dashboard .presence-line{
    min-width:0;
    display:block;
    padding:8px 9px;
    border:1px solid rgba(108,223,255,.075);
    border-radius:11px;
    background:linear-gradient(180deg,rgba(2,8,14,.46),rgba(4,10,18,.28));
    font-size:9px;
    line-height:1.3;
}
.page-dashboard .presence-line:nth-child(1),
.page-dashboard .presence-line:nth-child(3),
.page-dashboard .presence-line:nth-child(4),
.page-dashboard .presence-line:nth-child(6){
    grid-column:1/-1;
}
.page-dashboard .presence-key{
    display:block;
    margin-bottom:4px;
    color:#628196;
    font-size:7px;
    font-weight:900;
    letter-spacing:.13em;
}
.page-dashboard .presence-value{
    display:-webkit-box;
    min-width:0;
    max-width:100%;
    overflow:hidden;
    color:#c5dbe8;
    font-size:9px;
    line-height:1.35;
    overflow-wrap:normal;
    word-break:normal;
    -webkit-box-orient:vertical;
    -webkit-line-clamp:2;
}
.page-dashboard .presence-value.server-id{
    display:block;
    overflow:hidden;
    color:#7fc5e5;
    font-size:8px;
    line-height:1.35;
    text-overflow:ellipsis;
    white-space:nowrap;
    word-break:normal;
}
.page-dashboard .reason{
    max-height:3.1em;
    overflow:hidden;
    font-size:10px;
    display:-webkit-box;
    -webkit-box-orient:vertical;
    -webkit-line-clamp:2;
}
@media(max-width:1320px){
    .page-dashboard .players{
        grid-template-columns:1fr;
    }
}
@media(max-width:760px){
    .page-dashboard .player{
        grid-template-columns:50px minmax(0,1fr);
        gap:10px;
        padding:12px;
    }
    .page-dashboard .player .avatar{
        width:50px;
        height:50px;
        border-radius:14px;
    }
    .page-dashboard .player-actions{
        align-items:flex-start;
        flex-direction:column;
    }
    .page-dashboard .player .button-row{
        width:100%;
        justify-content:flex-start;
    }
    .page-dashboard .player .action-button{
        flex:1 1 auto;
    }
    .page-dashboard .presence-details{
        grid-template-columns:1fr;
    }
    .page-dashboard .presence-line,
    .page-dashboard .presence-line:nth-child(n){
        grid-column:1;
    }
}
@media(max-width:430px){
    .page-dashboard .player{
        grid-template-columns:42px minmax(0,1fr);
    }
    .page-dashboard .player .avatar{
        width:42px;
        height:42px;
        border-radius:12px;
    }
    .page-dashboard .player .action-button{
        flex:1 1 calc(50% - 4px);
    }
}

/* NEXU V203 // GEMEINSAMER SPIELER-INFORMATIONSBLOCK */
.page-dashboard .presence-details{
    display:grid !important;
    grid-template-columns:1fr !important;
    gap:0 !important;
    width:100%;
    margin-top:10px;
    padding:0 !important;
    overflow:hidden;
    border:1px solid rgba(108,223,255,.10) !important;
    border-radius:14px;
    background:
        linear-gradient(180deg,rgba(7,15,26,.78),rgba(3,9,16,.70)),
        rgba(3,9,16,.82) !important;
    box-shadow:
        0 10px 28px rgba(0,0,0,.15),
        0 1px 0 rgba(255,255,255,.025) inset;
}
.page-dashboard .presence-line,
.page-dashboard .presence-line:nth-child(n){
    grid-column:1 !important;
    display:grid !important;
    grid-template-columns:92px minmax(0,1fr);
    align-items:center;
    gap:12px;
    min-width:0;
    min-height:42px;
    margin:0 !important;
    padding:9px 12px !important;
    border:0 !important;
    border-bottom:1px solid rgba(108,223,255,.065) !important;
    border-radius:0 !important;
    background:transparent !important;
    box-shadow:none !important;
}
.page-dashboard .presence-line:nth-child(even){
    background:rgba(255,255,255,.008) !important;
}
.page-dashboard .presence-line:last-child{
    border-bottom:0 !important;
}
.page-dashboard .presence-key{
    display:block;
    margin:0 !important;
    color:#638297;
    font-size:7px;
    font-weight:950;
    letter-spacing:.13em;
    line-height:1.2;
    text-transform:uppercase;
}
.page-dashboard .presence-value{
    display:block !important;
    min-width:0;
    max-width:100%;
    overflow:hidden;
    color:#c9deea;
    font-size:9px;
    line-height:1.4;
    overflow-wrap:anywhere;
    word-break:break-word;
    text-overflow:ellipsis;
    white-space:normal;
    -webkit-line-clamp:unset !important;
}
.page-dashboard .presence-value.server-id{
    display:block !important;
    overflow:hidden;
    color:#7fcce9;
    font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
    font-size:8px;
    line-height:1.35;
    text-overflow:ellipsis;
    white-space:nowrap;
    overflow-wrap:normal;
    word-break:normal;
}
@media(max-width:760px){
    .page-dashboard .presence-line,
    .page-dashboard .presence-line:nth-child(n){
        grid-template-columns:78px minmax(0,1fr);
        gap:9px;
        min-height:40px;
        padding:8px 10px !important;
    }
}
@media(max-width:430px){
    .page-dashboard .presence-line,
    .page-dashboard .presence-line:nth-child(n){
        grid-template-columns:1fr;
        gap:3px;
        align-items:start;
    }
}

@media(prefers-reduced-motion:reduce){
    .page-dashboard .player .action-button,
    .page-dashboard .role-option{
        transition:none;
    }
}

@media(prefers-reduced-motion:reduce){
    .nx-server-logo::after{animation:none;}
    .nx-meter-track i{transition:none;}
}
`;
}

function nexuV201OverviewSidebarHtml() {
    const startedAt = new Date(SERVER_STARTED_AT_MS).toLocaleString("de-DE");
    const storageMode = isGitHubStorageConfigured()
        ? "GitHub + lokaler Fallback"
        : "Lokaler Speicher";
    return String.raw`
<aside class="nx-overview-sidebar" aria-label="Serverzentrale">
    <div class="nx-server-head">
        <div class="nx-server-logo">N</div>
        <div class="nx-server-copy">
            <span>Serverzentrale</span>
            <strong>${escapeHtml(process.env.RENDER_SERVICE_NAME || "Nexu Server")}</strong>
            <small id="nxServerState"><i></i><span>Verbindung wird geprüft</span></small>
        </div>
    </div>

    <section class="nx-sidebar-section">
        <div class="nx-sidebar-title"><span>Bereiche</span><b>01–04</b></div>
        <nav class="nx-overview-nav" aria-label="Navigation der Übersicht">
            <a class="active" href="#uebersicht-status" data-nx-nav="uebersicht-status"><span class="nx-nav-icon">01</span><span>Systemlage</span></a>
            <a href="#menuStatusPanel" data-nx-nav="menuStatusPanel"><span class="nx-nav-icon">02</span><span>Menüstatus</span></a>
            <a href="#updateStatusPanel" data-nx-nav="updateStatusPanel"><span class="nx-nav-icon">03</span><span>Wartung</span></a>
            <a href="#uebersicht-spieler" data-nx-nav="uebersicht-spieler"><span class="nx-nav-icon">04</span><span>Spielerlisten</span></a>
        </nav>
    </section>

    <section class="nx-sidebar-section">
        <div class="nx-sidebar-title"><span>Live-Statistik</span><b id="nxLastCheck">JETZT</b></div>
        <div class="nx-live-grid">
            <article class="nx-live-tile"><span>Aktiv</span><strong id="nxSideOnline" class="good">0</strong></article>
            <article class="nx-live-tile"><span>Offline</span><strong id="nxSideOffline">0</strong></article>
            <article class="nx-live-tile"><span>Gespeichert</span><strong id="nxSideKnown">0</strong></article>
            <article class="nx-live-tile"><span>Gesperrt</span><strong id="nxSideBanned" class="warn">0</strong></article>
        </div>
    </section>

    <section class="nx-sidebar-section">
        <div class="nx-sidebar-title"><span>Systemzustand</span><b>LIVE</b></div>
        <div class="nx-health-panel">
            <div id="nxHealthRing" class="nx-health-ring"><div><b id="nxHealthScore">100%</b><small>Zustand</small></div></div>
            <div class="nx-health-copy"><strong id="nxHealthLabel">System stabil</strong><span id="nxHealthText">Laufzeitdaten werden geladen und automatisch bewertet.</span></div>
        </div>
        <div class="nx-meter">
            <div class="nx-meter-head"><span>Prozessorauslastung</span><b id="nxCpuText">0%</b></div>
            <div class="nx-meter-track"><i id="nxCpuBar"></i></div>
        </div>
        <div class="nx-meter heap">
            <div class="nx-meter-head"><span>Arbeitsspeicher</span><b id="nxHeapText">0%</b></div>
            <div class="nx-meter-track"><i id="nxHeapBar"></i></div>
        </div>
        <canvas id="nxRuntimeChart" class="nx-runtime-chart" width="270" height="92" aria-label="Leistungsverlauf"></canvas>
    </section>

    <section class="nx-sidebar-section nx-server-details">
        <div class="nx-sidebar-title"><span>Serverinformationen</span><b>V207</b></div>
        <div class="nx-info-list">
            <div class="nx-info-row"><span>Instanz</span><b id="nxInstanceId" title="${escapeHtml(SERVER_INSTANCE_ID)}">${escapeHtml(SERVER_INSTANCE_ID.slice(0, 13))}…</b></div>
            <div class="nx-info-row"><span>Gestartet</span><b>${escapeHtml(startedAt)}</b></div>
            <div class="nx-info-row"><span>Laufzeit</span><b id="nxUptime">0 Sekunden</b></div>
            <div class="nx-info-row"><span>Node.js</span><b id="nxNodeVersion">${escapeHtml(process.version)}</b></div>
            <div class="nx-info-row"><span>Plattform</span><b id="nxPlatform">${escapeHtml(`${process.platform}/${process.arch}`)}</b></div>
            <div class="nx-info-row"><span>Port</span><b id="nxPort">${PORT}</b></div>
            <div class="nx-info-row"><span>Speicher</span><b id="nxStorageMode">${escapeHtml(storageMode)}</b></div>
            <div class="nx-info-row"><span>Sitzungen</span><b id="nxSessions">0</b></div>
            <div class="nx-info-row"><span>Befehle</span><b id="nxCommands">0 ausstehend</b></div>
            <div class="nx-info-row"><span>RSS</span><b id="nxRss">0 MB</b></div>
        </div>
    </section>

    <div class="nx-sidebar-foot"><i></i><span>Automatische Serverprüfung alle fünf Sekunden. Interne Schlüssel und sensible Zugangsdaten werden nicht angezeigt.</span></div>
</aside>`;
}

function nexuV201OverviewClientScript() {
    return String.raw`<script>
(function(){
    "use strict";
    if(!document.body.classList.contains("page-dashboard")) return;

    var byId=function(id){return document.getElementById(id);};
    var cpuHistory=[];
    var heapHistory=[];
    var lastCpuTotal=null;
    var lastCpuAt=null;

    function numberText(id){
        var node=byId(id);
        return node ? String(node.textContent || "0").trim() : "0";
    }

    function syncVisibleStatistics(){
        var pairs=[
            ["onlinePlayerCount","nxSideOnline"],
            ["offlinePlayerCount","nxSideOffline"],
            ["playerCount","nxSideKnown"],
            ["bannedCount","nxSideBanned"]
        ];
        pairs.forEach(function(pair){
            var source=byId(pair[0]);
            var target=byId(pair[1]);
            if(source&&target&&target.textContent!==source.textContent) target.textContent=source.textContent;
        });
    }

    function formatBytes(bytes){
        var value=Number(bytes)||0;
        if(value<1024) return value+" B";
        var units=["KB","MB","GB","TB"];
        var index=-1;
        do{value/=1024;index+=1;}while(value>=1024&&index<units.length-1);
        return value.toFixed(value>=100?0:value>=10?1:2)+" "+units[index];
    }

    function formatDuration(totalSeconds){
        var seconds=Math.max(0,Math.floor(Number(totalSeconds)||0));
        var days=Math.floor(seconds/86400);
        var hours=Math.floor((seconds%86400)/3600);
        var minutes=Math.floor((seconds%3600)/60);
        var rest=seconds%60;
        if(days>0) return days+" T "+hours+" Std";
        if(hours>0) return hours+" Std "+minutes+" Min";
        if(minutes>0) return minutes+" Min "+rest+" Sek";
        return rest+" Sekunden";
    }

    function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

    function drawChart(){
        var canvas=byId("nxRuntimeChart");
        if(!canvas||!canvas.getContext) return;
        var rect=canvas.getBoundingClientRect();
        var ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1));
        var width=Math.max(220,Math.floor(rect.width||270));
        var height=92;
        if(canvas.width!==Math.floor(width*ratio)||canvas.height!==Math.floor(height*ratio)){
            canvas.width=Math.floor(width*ratio);
            canvas.height=Math.floor(height*ratio);
        }
        var ctx=canvas.getContext("2d");
        ctx.setTransform(ratio,0,0,ratio,0,0);
        ctx.clearRect(0,0,width,height);

        ctx.strokeStyle="rgba(120,210,255,.08)";
        ctx.lineWidth=1;
        for(var y=18;y<height;y+=18){
            ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(width,y+.5);ctx.stroke();
        }

        function line(values,color){
            if(values.length<2) return;
            ctx.beginPath();
            values.forEach(function(value,index){
                var x=(index/(Math.max(1,values.length-1)))*(width-12)+6;
                var y=height-8-(clamp(value,0,100)/100)*(height-18);
                if(index===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            });
            ctx.strokeStyle=color;
            ctx.lineWidth=2;
            ctx.shadowColor=color;
            ctx.shadowBlur=8;
            ctx.stroke();
            ctx.shadowBlur=0;
        }
        line(cpuHistory,"rgba(25,214,255,.95)");
        line(heapHistory,"rgba(154,112,255,.90)");
    }

    function updateHealth(cpuPercent,heapPercent,online){
        var score=online ? 100 : 28;
        score-=Math.max(0,cpuPercent-55)*.45;
        score-=Math.max(0,heapPercent-68)*.42;
        score=Math.round(clamp(score,5,100));

        var ring=byId("nxHealthRing");
        var scoreNode=byId("nxHealthScore");
        var label=byId("nxHealthLabel");
        var text=byId("nxHealthText");
        if(ring){
            ring.style.setProperty("--nx-health",score);
            ring.style.background="conic-gradient("+(score>=82?"var(--nx-green)":score>=58?"var(--nx-gold)":"var(--nx-red)")+" "+score+"%,rgba(255,255,255,.055) 0)";
        }
        if(scoreNode) scoreNode.textContent=score+"%";
        if(label) label.textContent=score>=82?"System stabil":score>=58?"System unter Last":"System prüfen";
        if(text) text.textContent=!online
            ?"Der Server meldet aktuell keine stabile Verbindung."
            : score>=82
                ?"Laufzeit, Speicher und Prozessorauslastung liegen im normalen Bereich."
                : score>=58
                    ?"Erhöhte Last wurde erkannt. Die Übersicht bleibt weiterhin erreichbar."
                    :"Starke Last oder ein Verbindungsproblem wurde erkannt.";
    }

    function applyRuntime(data){
        var runtime=data&&data.runtime?data.runtime:data;
        if(!runtime||runtime.success===false) return;

        var now=Number(runtime.checkedAtMs)||Date.now();
        var cpuTotal=(Number(runtime.cpuUserMicros)||0)+(Number(runtime.cpuSystemMicros)||0);
        var cpuPercent=0;
        if(lastCpuTotal!==null&&lastCpuAt!==null&&now>lastCpuAt){
            cpuPercent=clamp(((cpuTotal-lastCpuTotal)/((now-lastCpuAt)*1000))*100,0,100);
        }
        lastCpuTotal=cpuTotal;
        lastCpuAt=now;

        var heapUsed=Number(runtime.heapUsedBytes)||0;
        var heapTotal=Math.max(1,Number(runtime.heapTotalBytes)||1);
        var heapPercent=clamp((heapUsed/heapTotal)*100,0,100);
        var online=runtime.menuOnline!==false;

        var cpuText=byId("nxCpuText");
        var heapText=byId("nxHeapText");
        var cpuBar=byId("nxCpuBar");
        var heapBar=byId("nxHeapBar");
        if(cpuText) cpuText.textContent=cpuPercent.toFixed(cpuPercent>=10?0:1)+"%";
        if(heapText) heapText.textContent=heapPercent.toFixed(0)+"% · "+formatBytes(heapUsed);
        if(cpuBar) cpuBar.style.width=cpuPercent+"%";
        if(heapBar) heapBar.style.width=heapPercent+"%";

        cpuHistory.push(cpuPercent);
        heapHistory.push(heapPercent);
        if(cpuHistory.length>36) cpuHistory.shift();
        if(heapHistory.length>36) heapHistory.shift();
        drawChart();
        updateHealth(cpuPercent,heapPercent,online);

        var state=byId("nxServerState");
        if(state){
            state.classList.toggle("offline",!online);
            var copy=state.querySelector("span");
            if(copy) copy.textContent=online?"Server erreichbar":"Menü global offline";
        }

        var values={
            nxSideOnline:runtime.activePlayers,
            nxSideKnown:runtime.knownPlayers,
            nxSideBanned:runtime.bannedPlayers,
            nxInstanceId:runtime.instanceId,
            nxUptime:formatDuration(runtime.uptimeSeconds),
            nxNodeVersion:runtime.nodeVersion,
            nxPlatform:runtime.platform,
            nxPort:runtime.port,
            nxStorageMode:runtime.storageMode,
            nxSessions:(Number(runtime.activeSessions)||0)+" aktive Sitzungen",
            nxCommands:(Number(runtime.pendingCommands)||0)+" ausstehend",
            nxRss:formatBytes(runtime.rssBytes)
        };
        Object.keys(values).forEach(function(id){
            var node=byId(id);
            if(node&&values[id]!==undefined&&values[id]!==null) node.textContent=String(values[id]);
        });
        var instance=byId("nxInstanceId");
        if(instance&&runtime.instanceId){
            instance.title=String(runtime.instanceId);
            instance.textContent=String(runtime.instanceId).slice(0,13)+"…";
        }

        var last=byId("nxLastCheck");
        if(last) last.textContent=new Date(now).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    }

    async function refreshRuntime(){
        try{
            var response=await fetch("/api/uebersicht/runtime",{headers:{Accept:"application/json"},cache:"no-store"});
            if(!response.ok) throw new Error("HTTP "+response.status);
            applyRuntime(await response.json());
        }catch(error){
            var state=byId("nxServerState");
            if(state){
                state.classList.add("offline");
                var copy=state.querySelector("span");
                if(copy) copy.textContent="Serverprüfung fehlgeschlagen";
            }
            updateHealth(100,100,false);
        }
    }

    var watched=["onlinePlayerCount","offlinePlayerCount","playerCount","bannedCount","serverStatus"];
    watched.forEach(function(id){
        var node=byId(id);
        if(node&&window.MutationObserver){
            new MutationObserver(syncVisibleStatistics).observe(node,{childList:true,subtree:true,characterData:true});
        }
    });
    syncVisibleStatistics();

    document.querySelectorAll(".nx-overview-nav a").forEach(function(link){
        link.addEventListener("click",function(event){
            var target=document.querySelector(link.getAttribute("href"));
            if(!target) return;
            event.preventDefault();
            target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
        });
    });

    if("IntersectionObserver" in window){
        var links=Array.prototype.slice.call(document.querySelectorAll(".nx-overview-nav a"));
        var sections=links.map(function(link){return document.querySelector(link.getAttribute("href"));}).filter(Boolean);
        var observer=new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if(!entry.isIntersecting) return;
                links.forEach(function(link){link.classList.toggle("active",link.getAttribute("href")==="#"+entry.target.id);});
            });
        },{rootMargin:"-18% 0px -68% 0px",threshold:.01});
        sections.forEach(function(section){observer.observe(section);});
    }

    refreshRuntime();
    setInterval(refreshRuntime,5000);
    setInterval(syncVisibleStatistics,1500);
    window.addEventListener("resize",drawChart,{passive:true});
})();
</script>`;
}

function enhanceNexuV201Page(html, pageType) {
    html = nexuV201GermanizeHtml(html);
    if (typeof html !== "string" || html.includes("NEXU V201 // DEUTSCHE SERVERÜBERSICHT")) return html;

    html = html.replace("</style>", nexuV201OverviewCss() + "</style>");

    if (pageType === "home") {
        html = html.replace('href="/menu-server"', 'href="/uebersicht"');
        html = html.replace(
            '<span>ÜBERSICHT</span><strong>Spieler-Dashboard öffnen</strong>',
            '<span>ÜBERSICHT</span><strong>Serverübersicht öffnen</strong>'
        );
    }

    if (pageType === "overview") {
        html = html.replace(/<body([^>]*)>/i, function(match, attributes) {
            let next = attributes || "";
            if (/\bclass\s*=\s*"[^"]*"/i.test(next)) {
                next = next.replace(/\bclass\s*=\s*"([^"]*)"/i, function(_, current) {
                    return `class="${current} page-overview"`;
                });
            } else {
                next += ' class="page-overview"';
            }
            return `<body${next}>`;
        });
        html = html.replace("<title>Nexu Übersicht</title>", "<title>Nexu Serverübersicht</title>");
        html = html.replace(
            '<section class="hero">',
            '<div class="nx-overview-layout">' +
                nexuV201OverviewSidebarHtml() +
                '<div class="nx-overview-content"><section id="uebersicht-status" class="hero">'
        );
        html = html.replace('<section class="directory">', '<section id="uebersicht-spieler" class="directory">');
        html = html.replace(
            '<div class="nx-page-footer">',
            '</div></div><div class="nx-page-footer">'
        );
        html = html.replace("</body>", nexuV201OverviewClientScript() + "</body>");
    }

    return html;
}

loginHtml = function(...args) {
    return enhanceNexuV201Page(NEXU_V201_BASE_LOGIN_HTML(...args), "login");
};
homeHtml = function(...args) {
    return enhanceNexuV201Page(NEXU_V201_BASE_HOME_HTML(...args), "home");
};
dashboardAccountsHtml = function(...args) {
    return enhanceNexuV201Page(NEXU_V201_BASE_ACCOUNTS_HTML(...args), "accounts");
};
dashboardHtml = function(...args) {
    return enhanceNexuV201Page(NEXU_V201_BASE_OVERVIEW_HTML(...args), "overview");
};



/* --------------------------------------------------------------------------
 * NEXU V204 // PROFESSIONAL CLEAN SYSTEM
 *
 * Dieser Layer verändert ausschließlich Aufbau, Darstellung und clientseitige
 * Anordnung. Bestehende IDs, Formulare, API-Routen, Berechtigungen und Server-
 * Aktionen bleiben erhalten. Bereits gebundene Elemente werden verschoben,
 * niemals geklont oder ersetzt.
 * -------------------------------------------------------------------------- */

const NEXU_V204_BASE_LOGIN_HTML = loginHtml;
const NEXU_V204_BASE_HOME_HTML = homeHtml;
const NEXU_V204_BASE_ACCOUNTS_HTML = dashboardAccountsHtml;
const NEXU_V204_BASE_OVERVIEW_HTML = dashboardHtml;

function nexuV204Css() {
    return String.raw`
/* ========================================================================
   NEXU V204 // PROFESSIONAL CLEAN SYSTEM
   ======================================================================== */

:root{
    --v204-bg:#05080d;
    --v204-bg-soft:#080d14;
    --v204-panel:#0b121c;
    --v204-panel-2:#0e1723;
    --v204-panel-3:#111c29;
    --v204-line:rgba(151,190,216,.115);
    --v204-line-strong:rgba(91,208,255,.24);
    --v204-text:#eef7fb;
    --v204-muted:#8298a8;
    --v204-soft:#a8bbc7;
    --v204-cyan:#25d6ff;
    --v204-blue:#4388ff;
    --v204-violet:#8b63ff;
    --v204-green:#45ffb0;
    --v204-yellow:#ffc96b;
    --v204-red:#ff668c;
    --v204-radius:18px;
    --v204-radius-lg:24px;
    --v204-shadow:0 20px 55px rgba(0,0,0,.24);
    --v204-shadow-lg:0 34px 95px rgba(0,0,0,.34);
    --v204-ease:cubic-bezier(.2,.75,.25,1);
}

html{
    scroll-behavior:smooth;
    background:var(--v204-bg);
}
body.nexu-v204{
    color:var(--v204-text);
    background:
        radial-gradient(circle at 12% -10%,rgba(37,214,255,.095),transparent 34rem),
        radial-gradient(circle at 90% 4%,rgba(139,99,255,.075),transparent 31rem),
        linear-gradient(180deg,#05080d,#060b12 42%,#05080d);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    letter-spacing:-.006em;
}
body.nexu-v204::before{
    opacity:.075 !important;
    background-size:48px 48px !important;
    mask-image:linear-gradient(to bottom,black,transparent 72%) !important;
}
body.nexu-v204 .scan{
    opacity:.28;
    animation-duration:12s;
}
body.nexu-v204 .nx-ambient{
    opacity:.44;
    filter:saturate(.75);
}
body.nexu-v204 button,
body.nexu-v204 a,
body.nexu-v204 input,
body.nexu-v204 textarea,
body.nexu-v204 select{
    transition:
        color .18s ease,
        border-color .18s ease,
        background-color .18s ease,
        box-shadow .18s ease,
        transform .18s var(--v204-ease),
        opacity .18s ease;
}
body.nexu-v204 button:focus-visible,
body.nexu-v204 a:focus-visible,
body.nexu-v204 input:focus-visible,
body.nexu-v204 textarea:focus-visible,
body.nexu-v204 select:focus-visible{
    outline:none;
    box-shadow:0 0 0 3px rgba(37,214,255,.14),0 0 0 1px rgba(37,214,255,.48) inset !important;
}
body.nexu-v204 .eyebrow{
    color:#6edfff;
    font-size:9px;
    font-weight:900;
    letter-spacing:.18em;
}
body.nexu-v204 .nx-command-strip{
    display:none !important;
}
body.nexu-v204 .nx-page-footer{
    margin-top:18px;
    padding:14px 4px;
    border:0;
    color:#526a7a;
    font-size:9px;
}
body.nexu-v204 .nx-page-footer strong{
    color:#9eb5c3;
}

/* Gemeinsame Oberflächen */
body.nexu-v204 .panel,
body.nexu-v204 .hero,
body.nexu-v204 .directory,
body.nexu-v204 .menu-status-panel,
body.nexu-v204 .update-status,
body.nexu-v204 .intro,
body.nexu-v204 .account-card,
body.nexu-v204 .auth-panel,
body.nexu-v204 .remembered-list,
body.nexu-v204 .brand-card,
body.nexu-v204 .auth-card{
    border:1px solid var(--v204-line) !important;
    background:
        linear-gradient(145deg,rgba(255,255,255,.022),rgba(255,255,255,.006)),
        rgba(9,15,23,.90) !important;
    box-shadow:var(--v204-shadow),0 1px 0 rgba(255,255,255,.025) inset !important;
    backdrop-filter:blur(18px) saturate(112%);
}
body.nexu-v204 .stat,
body.nexu-v204 .info-card,
body.nexu-v204 .primary-tile,
body.nexu-v204 .access-box,
body.nexu-v204 .nx-sidebar-section,
body.nexu-v204 .nx-live-tile{
    border:1px solid rgba(151,190,216,.095) !important;
    background:rgba(255,255,255,.018) !important;
    box-shadow:none !important;
}
body.nexu-v204 .modal-backdrop,
body.nexu-v204 .account-confirm-backdrop{
    background:rgba(1,4,8,.78) !important;
    backdrop-filter:blur(12px) saturate(90%);
}
body.nexu-v204 .modal-card,
body.nexu-v204 .account-confirm-card{
    border:1px solid rgba(113,207,246,.19) !important;
    border-radius:22px !important;
    background:#0a111b !important;
    box-shadow:0 45px 130px rgba(0,0,0,.62),0 1px 0 rgba(255,255,255,.035) inset !important;
}

/* ------------------------------------------------------------------------
   Anmeldung
   ------------------------------------------------------------------------ */
.page-login.nexu-v204{
    min-height:100vh;
    padding:22px !important;
}
.page-login.nexu-v204 .login-shell{
    width:min(1120px,100%) !important;
    grid-template-columns:minmax(350px,.82fr) minmax(520px,1.18fr) !important;
    gap:12px !important;
}
.page-login.nexu-v204 .brand-card{
    min-height:620px !important;
    padding:42px !important;
    border-radius:24px !important;
    justify-content:flex-end !important;
    overflow:hidden;
}
.page-login.nexu-v204 .brand-card::before{
    content:"";
    position:absolute;
    inset:0;
    background:
        linear-gradient(180deg,transparent 34%,rgba(5,11,18,.85)),
        radial-gradient(circle at 20% 10%,rgba(37,214,255,.14),transparent 28rem);
    pointer-events:none;
}
.page-login.nexu-v204 .brand-card::after{
    right:-45px !important;
    bottom:-86px !important;
    font-size:330px !important;
    color:rgba(37,214,255,.025) !important;
}
.page-login.nexu-v204 .brand-card > *{
    position:relative;
    z-index:1;
}
.page-login.nexu-v204 .brand-card .logo{
    position:absolute;
    top:32px;
    left:32px;
    width:62px !important;
    height:62px !important;
    border-radius:18px !important;
    font-size:25px !important;
    box-shadow:0 18px 45px rgba(37,214,255,.18),0 0 0 1px rgba(255,255,255,.13) inset !important;
}
.page-login.nexu-v204 .brand-card h1{
    max-width:520px;
    margin-bottom:18px !important;
    font-size:clamp(46px,5.8vw,72px) !important;
    line-height:.94 !important;
    letter-spacing:-.065em !important;
}
.page-login.nexu-v204 .brand-card p{
    max-width:530px;
    color:#8ea4b3 !important;
    line-height:1.72 !important;
}
.page-login.nexu-v204 .statline{
    grid-template-columns:1fr !important;
    gap:7px !important;
    margin-top:30px !important;
}
.page-login.nexu-v204 .statline .stat{
    min-height:62px !important;
    display:grid;
    grid-template-columns:150px minmax(0,1fr);
    align-items:center;
    gap:12px;
    padding:12px 14px !important;
    border-radius:13px !important;
}
.page-login.nexu-v204 .statline .stat b{
    font-size:10px;
}
.page-login.nexu-v204 .statline .stat span{
    font-size:10px;
    text-align:right;
}
.page-login.nexu-v204 .auth-card{
    min-height:620px;
    padding:12px !important;
    border-radius:24px !important;
}
.page-login.nexu-v204 .auth-grid{
    align-content:center;
    gap:9px !important;
}
.page-login.nexu-v204 .auth-panel,
.page-login.nexu-v204 .remembered-list{
    padding:22px !important;
    border-radius:17px !important;
}
.page-login.nexu-v204 .auth-panel h2,
.page-login.nexu-v204 .remembered-list h2{
    font-size:18px;
    letter-spacing:-.025em;
}
.page-login.nexu-v204 .field{
    gap:7px;
}
.page-login.nexu-v204 label{
    color:#718797;
    font-size:9px;
    font-weight:850;
    letter-spacing:.08em;
}
.page-login.nexu-v204 input{
    min-height:44px !important;
    border:1px solid rgba(151,190,216,.13) !important;
    border-radius:11px !important;
    background:#070d14 !important;
}
.page-login.nexu-v204 button,
.page-login.nexu-v204 .button-link{
    min-height:43px !important;
    border-radius:11px !important;
    box-shadow:none !important;
}
.page-login.nexu-v204 button:hover,
.page-login.nexu-v204 .button-link:hover{
    transform:translateY(-1px);
    box-shadow:0 12px 25px rgba(32,132,214,.16) !important;
}
.page-login.nexu-v204 .remembered-account{
    border-radius:12px !important;
    background:#080f18 !important;
}

/* ------------------------------------------------------------------------
   Startseite
   ------------------------------------------------------------------------ */
.page-home.nexu-v204 .shell{
    width:min(1240px,calc(100% - 30px)) !important;
    padding:14px 0 44px !important;
}
.page-home.nexu-v204 .header{
    top:10px !important;
    min-height:62px;
    margin-bottom:14px !important;
    padding:9px 10px 9px 13px !important;
    border:1px solid var(--v204-line) !important;
    border-radius:16px !important;
    background:rgba(7,12,19,.88) !important;
    box-shadow:0 15px 40px rgba(0,0,0,.22) !important;
}
.page-home.nexu-v204 .header .logo{
    width:38px !important;
    height:38px !important;
    border-radius:11px !important;
    font-size:16px !important;
}
.page-home.nexu-v204 .brand strong{
    font-size:16px !important;
}
.page-home.nexu-v204 .brand span{
    font-size:9px !important;
}
.page-home.nexu-v204 .account-button{
    min-height:39px;
    border-radius:12px;
    background:#0a111a;
}
.page-home.nexu-v204 .hero{
    min-height:0 !important;
    display:grid !important;
    grid-template-columns:minmax(0,1.08fr) minmax(380px,.92fr) !important;
    gap:12px !important;
}
.page-home.nexu-v204 .panel{
    border-radius:22px !important;
}
.page-home.nexu-v204 .welcome{
    min-height:570px !important;
    padding:44px !important;
    justify-content:center !important;
}
.page-home.nexu-v204 .welcome::before{
    background:
        linear-gradient(115deg,rgba(37,214,255,.075),transparent 44%),
        radial-gradient(circle at 86% 76%,rgba(139,99,255,.11),transparent 34%) !important;
}
.page-home.nexu-v204 .welcome .eyebrow{
    margin-top:0 !important;
}
.page-home.nexu-v204 .nx-home-introline{
    top:28px !important;
    left:34px !important;
    right:34px !important;
    color:#607989;
    font-size:8px;
}
.page-home.nexu-v204 h1{
    max-width:700px;
    margin:14px 0 18px !important;
    font-size:clamp(62px,7.5vw,94px) !important;
    line-height:.84 !important;
}
.page-home.nexu-v204 .welcome p{
    max-width:590px;
    font-size:14px;
    line-height:1.75 !important;
}
.page-home.nexu-v204 .nx-hero-orbit{
    right:-40px !important;
    bottom:-75px !important;
    opacity:.68;
    transform:scale(.8);
}
.page-home.nexu-v204 .action-grid{
    padding:12px !important;
    grid-template-columns:1fr !important;
    gap:8px !important;
    align-content:stretch !important;
}
.page-home.nexu-v204 .primary-tile{
    position:relative;
    min-height:118px !important;
    display:flex;
    flex-direction:column;
    justify-content:center;
    padding:19px 20px 19px 66px !important;
    border-radius:16px !important;
    background:#0b131e !important;
}
.page-home.nexu-v204 .primary-tile::before{
    position:absolute;
    left:18px;
    top:50%;
    width:34px;
    height:34px;
    display:grid;
    place-items:center;
    border:1px solid rgba(37,214,255,.15);
    border-radius:11px;
    color:#80e8ff;
    background:#07111a;
    font-size:12px;
    font-weight:900;
    transform:translateY(-50%);
}
.page-home.nexu-v204 .primary-tile.menu-server::before{content:"01";}
.page-home.nexu-v204 .primary-tile.account-admin::before{content:"02";}
.page-home.nexu-v204 .primary-tile.copy-script::before{content:"03";}
.page-home.nexu-v204 .primary-tile:hover{
    transform:translateY(-2px) !important;
    border-color:rgba(37,214,255,.25) !important;
    background:#0d1723 !important;
    box-shadow:0 18px 38px rgba(0,0,0,.20) !important;
}
.page-home.nexu-v204 .primary-tile span{
    font-size:8px;
}
.page-home.nexu-v204 .primary-tile strong{
    margin-top:5px;
    font-size:18px !important;
}
.page-home.nexu-v204 .primary-tile small{
    margin-top:5px;
    color:#71899a;
    line-height:1.45;
}
.page-home.nexu-v204 .primary-tile.copy-script{
    grid-column:auto !important;
    min-height:136px !important;
}
.page-home.nexu-v204 .copy-command{
    max-width:100%;
    margin-top:9px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.page-home.nexu-v204 .quick-info{
    grid-column:auto !important;
    grid-template-columns:1fr 1fr !important;
    gap:8px !important;
}
.page-home.nexu-v204 .info-card{
    min-height:88px !important;
    padding:14px !important;
    border-radius:14px !important;
}
.page-home.nexu-v204 .info-label{
    font-size:8px;
}
.page-home.nexu-v204 .info-value{
    margin-top:7px;
    font-size:15px;
}
.page-home.nexu-v204 .nx-trust-grid,
.page-home.nexu-v204 .nx-capability-grid{
    gap:10px !important;
}
.page-home.nexu-v204 .nx-trust-card,
.page-home.nexu-v204 .nx-capability{
    border-radius:17px !important;
    background:#0a111a !important;
}

/* ------------------------------------------------------------------------
   Kontoverwaltung
   ------------------------------------------------------------------------ */
.page-accounts.nexu-v204 .shell{
    width:min(1260px,calc(100% - 30px)) !important;
    padding:14px 0 46px !important;
}
.page-accounts.nexu-v204 .topbar{
    top:10px;
    min-height:66px;
    padding:11px 14px !important;
    border:1px solid var(--v204-line) !important;
    border-radius:16px !important;
    background:rgba(7,12,19,.88) !important;
    box-shadow:0 15px 40px rgba(0,0,0,.22) !important;
}
.page-accounts.nexu-v204 .topbar .logo{
    width:40px !important;
    height:40px !important;
    border-radius:12px !important;
}
.page-accounts.nexu-v204 .topbar h1{
    font-size:17px !important;
}
.page-accounts.nexu-v204 .topbar p{
    margin-top:2px !important;
    font-size:9px !important;
}
.page-accounts.nexu-v204 .back{
    min-height:38px;
    display:inline-flex;
    align-items:center;
    padding:0 13px;
    border:1px solid var(--v204-line);
    border-radius:11px;
    color:#a5bac7;
    text-decoration:none;
    background:#0a111a;
}
.page-accounts.nexu-v204 .intro{
    margin-top:14px !important;
    padding:25px !important;
    border-radius:20px !important;
}
.page-accounts.nexu-v204 .intro h2{
    margin:6px 0 7px !important;
    font-size:28px !important;
    letter-spacing:-.04em;
}
.page-accounts.nexu-v204 .nx-account-overview{
    grid-template-columns:2fr repeat(3,1fr) !important;
    gap:9px !important;
    margin-top:12px !important;
}
.page-accounts.nexu-v204 .nx-account-overview article{
    min-height:112px !important;
    padding:16px !important;
    border:1px solid var(--v204-line) !important;
    border-radius:15px !important;
    background:#0a111a !important;
}
.page-accounts.nexu-v204 .nx-v204-account-tools{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    margin:14px 0 10px;
    padding:12px 14px;
    border:1px solid var(--v204-line);
    border-radius:15px;
    background:#09111a;
}
.page-accounts.nexu-v204 .nx-v204-account-tools-copy strong{
    display:block;
    font-size:13px;
}
.page-accounts.nexu-v204 .nx-v204-account-tools-copy span{
    display:block;
    margin-top:3px;
    color:#6d8596;
    font-size:9px;
}
.page-accounts.nexu-v204 .nx-v204-account-search{
    width:min(330px,100%);
    min-height:39px;
    padding:0 12px;
    border:1px solid var(--v204-line);
    border-radius:10px;
    color:var(--v204-text);
    background:#060c13;
}
.page-accounts.nexu-v204 .account-list{
    grid-template-columns:1fr !important;
    gap:10px !important;
}
.page-accounts.nexu-v204 .account-card{
    padding:20px !important;
    border-radius:18px !important;
    overflow:visible !important;
}
.page-accounts.nexu-v204 .account-card:hover{
    transform:none !important;
    border-color:rgba(37,214,255,.19) !important;
    box-shadow:var(--v204-shadow) !important;
}
.page-accounts.nexu-v204 .account-card-head{
    align-items:center;
    padding-bottom:14px;
    border-bottom:1px solid rgba(151,190,216,.08);
}
.page-accounts.nexu-v204 .account-card-head strong{
    font-size:17px;
}
.page-accounts.nexu-v204 .account-card form > .grid{
    grid-template-columns:minmax(250px,.68fr) minmax(520px,1.32fr) !important;
    gap:12px !important;
    margin-top:14px;
}
.page-accounts.nexu-v204 .account-card .field,
.page-accounts.nexu-v204 .access-box{
    border-radius:14px !important;
}
.page-accounts.nexu-v204 .access-grid{
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    gap:7px !important;
}
.page-accounts.nexu-v204 .access-item{
    min-height:68px;
    padding:10px !important;
    border-radius:11px !important;
}
.page-accounts.nexu-v204 .access-item b{
    font-size:10px;
}
.page-accounts.nexu-v204 .access-item small{
    font-size:8px;
    line-height:1.35;
}
.page-accounts.nexu-v204 .actions button,
.page-accounts.nexu-v204 .delete-account-form button{
    min-height:38px !important;
    border-radius:10px !important;
}

/* ------------------------------------------------------------------------
   Serverübersicht / App-Shell
   ------------------------------------------------------------------------ */
.page-dashboard.nexu-v204 .shell{
    width:min(1580px,calc(100% - 24px)) !important;
    padding:10px 0 36px !important;
}
.page-dashboard.nexu-v204 header{
    top:8px !important;
    min-height:64px;
    margin-bottom:10px !important;
    padding:9px 10px 9px 13px !important;
    border:1px solid var(--v204-line) !important;
    border-radius:15px !important;
    background:rgba(7,12,19,.91) !important;
    box-shadow:0 15px 42px rgba(0,0,0,.24) !important;
    backdrop-filter:blur(18px) saturate(110%) !important;
}
.page-dashboard.nexu-v204 header .logo{
    width:40px !important;
    height:40px !important;
    border-radius:12px !important;
    font-size:17px !important;
}
.page-dashboard.nexu-v204 header .brand-copy strong{
    font-size:16px;
}
.page-dashboard.nexu-v204 header .brand-copy span{
    font-size:8px;
}
.page-dashboard.nexu-v204 .header-actions{
    gap:7px !important;
}
.page-dashboard.nexu-v204 .header-actions > .logout-button,
.page-dashboard.nexu-v204 .header-actions > a.logout-button,
.page-dashboard.nexu-v204 .header-actions .logout-form .logout-button{
    min-height:36px;
    padding:0 12px;
    border:1px solid var(--v204-line) !important;
    border-radius:10px !important;
    color:#9db2c0 !important;
    background:#09111a !important;
    font-size:9px;
}
.page-dashboard.nexu-v204 .header-actions .logout-form .logout-button{
    color:#ff9bb2 !important;
    border-color:rgba(255,102,140,.18) !important;
}
.page-dashboard.nexu-v204 .live-pill{
    min-height:36px;
    padding:0 11px;
    border:1px solid var(--v204-line);
    border-radius:10px;
    background:#09111a;
    font-size:10px;
}
.page-dashboard.nexu-v204 .nx-overview-layout{
    grid-template-columns:274px minmax(0,1fr) !important;
    gap:10px !important;
}
.page-dashboard.nexu-v204 .nx-overview-sidebar{
    top:82px !important;
    max-height:calc(100vh - 94px) !important;
    padding:10px !important;
    border:1px solid var(--v204-line) !important;
    border-radius:17px !important;
    background:rgba(7,12,19,.92) !important;
    box-shadow:0 18px 55px rgba(0,0,0,.25) !important;
    backdrop-filter:blur(18px) saturate(108%);
}
.page-dashboard.nexu-v204 .nx-server-head{
    min-height:76px;
    grid-template-columns:44px minmax(0,1fr);
    gap:10px;
    padding:11px;
    border:0;
    border-radius:12px;
    background:#0a121c;
}
.page-dashboard.nexu-v204 .nx-server-logo{
    width:44px;
    height:44px;
    border-radius:12px;
    font-size:18px;
    box-shadow:none;
}
.page-dashboard.nexu-v204 .nx-server-logo::after{
    display:none;
}
.page-dashboard.nexu-v204 .nx-server-copy span{
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-server-copy strong{
    font-size:13px;
}
.page-dashboard.nexu-v204 .nx-server-copy small{
    margin-top:5px;
    font-size:8px;
}
.page-dashboard.nexu-v204 .nx-sidebar-section{
    margin-top:7px;
    padding:10px;
    border-radius:12px;
    background:#09111a !important;
}
.page-dashboard.nexu-v204 .nx-sidebar-title{
    margin-bottom:8px;
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-overview-nav{
    gap:4px;
}
.page-dashboard.nexu-v204 .nx-overview-nav a{
    min-height:38px;
    grid-template-columns:25px minmax(0,1fr) 9px;
    gap:7px;
    padding:0 8px;
    border:0;
    border-radius:9px;
    background:transparent;
    font-size:9px;
}
.page-dashboard.nexu-v204 .nx-overview-nav a:hover,
.page-dashboard.nexu-v204 .nx-overview-nav a.active{
    transform:none;
    border:0;
    background:rgba(37,214,255,.075);
    box-shadow:none;
}
.page-dashboard.nexu-v204 .nx-nav-icon{
    width:24px;
    height:24px;
    border:0;
    border-radius:7px;
    background:#0e1925;
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-live-grid{
    gap:5px;
}
.page-dashboard.nexu-v204 .nx-live-tile{
    min-height:58px;
    padding:8px;
    border-radius:9px;
}
.page-dashboard.nexu-v204 .nx-live-tile span{
    font-size:6px;
}
.page-dashboard.nexu-v204 .nx-live-tile strong{
    margin-top:5px;
    font-size:17px;
}
.page-dashboard.nexu-v204 .nx-health-panel{
    grid-template-columns:62px minmax(0,1fr);
    gap:9px;
}
.page-dashboard.nexu-v204 .nx-health-ring{
    width:61px;
    height:61px;
    box-shadow:none;
}
.page-dashboard.nexu-v204 .nx-health-ring::before{
    inset:6px;
}
.page-dashboard.nexu-v204 .nx-health-ring b{
    font-size:15px;
}
.page-dashboard.nexu-v204 .nx-health-ring small{
    font-size:6px;
}
.page-dashboard.nexu-v204 .nx-health-copy strong{
    font-size:10px;
}
.page-dashboard.nexu-v204 .nx-health-copy span{
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-meter{
    margin-top:7px;
}
.page-dashboard.nexu-v204 .nx-meter-head{
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-runtime-chart{
    height:68px;
    margin-top:8px;
    border-radius:9px;
}
.page-dashboard.nexu-v204 .nx-info-row{
    grid-template-columns:70px minmax(0,1fr);
    padding:6px 0;
}
.page-dashboard.nexu-v204 .nx-info-row span,
.page-dashboard.nexu-v204 .nx-info-row b{
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-sidebar-foot{
    font-size:7px;
}
.page-dashboard.nexu-v204 .nx-overview-content{
    gap:10px !important;
}
.page-dashboard.nexu-v204 .hero{
    min-height:300px;
    display:grid !important;
    grid-template-columns:minmax(0,1.08fr) minmax(430px,.92fr);
    grid-template-rows:auto auto 1fr;
    gap:7px 26px;
    padding:30px !important;
    border-radius:19px !important;
    overflow:hidden;
}
.page-dashboard.nexu-v204 .hero::after{
    right:-160px !important;
    top:-280px !important;
    opacity:.34;
}
.page-dashboard.nexu-v204 .hero > .eyebrow{
    grid-column:1;
    align-self:end;
}
.page-dashboard.nexu-v204 .hero > h1{
    grid-column:1;
    max-width:720px;
    margin:5px 0 6px !important;
    font-size:clamp(38px,4vw,61px) !important;
    line-height:.96 !important;
    letter-spacing:-.055em !important;
}
.page-dashboard.nexu-v204 .hero > p{
    grid-column:1;
    max-width:680px;
    font-size:12px !important;
    line-height:1.65 !important;
}
.page-dashboard.nexu-v204 .hero > .stats{
    grid-column:2;
    grid-row:1/4;
    align-self:stretch;
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    gap:7px !important;
    margin:0 !important;
}
.page-dashboard.nexu-v204 .stat{
    min-height:0 !important;
    padding:14px !important;
    border-radius:12px !important;
    background:#0a121c !important;
}
.page-dashboard.nexu-v204 .stat-label{
    color:#6c8394;
    font-size:7px;
    font-weight:850;
}
.page-dashboard.nexu-v204 .stat-value{
    margin-top:8px;
    font-size:22px !important;
}
.page-dashboard.nexu-v204 .stat-note{
    margin-top:6px;
    color:#577183;
    font-size:8px;
    line-height:1.35;
}
.page-dashboard.nexu-v204 .stat-split{
    gap:6px;
    margin-top:8px;
}
.page-dashboard.nexu-v204 .stat-mini{
    padding:7px;
    border:0;
    border-radius:8px;
    background:#07101a;
}
.page-dashboard.nexu-v204 .stat-mini-label{
    font-size:6px;
}
.page-dashboard.nexu-v204 .stat-mini-value{
    margin-top:4px;
    font-size:17px;
}

/* Neue Kommandozentrale */
.page-dashboard.nexu-v204 .nx-v204-command-center{
    display:grid;
    grid-template-columns:minmax(260px,.9fr) minmax(420px,1.5fr) minmax(210px,.7fr);
    gap:10px;
    align-items:stretch;
    padding:14px;
    border:1px solid var(--v204-line);
    border-radius:17px;
    background:#09111a;
    box-shadow:0 18px 50px rgba(0,0,0,.20);
}
.page-dashboard.nexu-v204 .nx-v204-command-copy{
    display:flex;
    flex-direction:column;
    justify-content:center;
    min-width:0;
    padding:5px 7px;
}
.page-dashboard.nexu-v204 .nx-v204-command-copy span{
    color:#5f7889;
    font-size:7px;
    font-weight:900;
    letter-spacing:.17em;
    text-transform:uppercase;
}
.page-dashboard.nexu-v204 .nx-v204-command-copy strong{
    margin-top:6px;
    font-size:16px;
    letter-spacing:-.025em;
}
.page-dashboard.nexu-v204 .nx-v204-command-copy small{
    margin-top:5px;
    color:#6f8797;
    font-size:9px;
    line-height:1.45;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions{
    min-width:0;
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:7px;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions:empty::before{
    content:"Für dieses Konto sind keine erweiterten Aktionen freigegeben.";
    grid-column:1/-1;
    display:grid;
    place-items:center;
    min-height:70px;
    padding:12px;
    border:1px dashed rgba(151,190,216,.13);
    border-radius:11px;
    color:#60798a;
    font-size:9px;
    text-align:center;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .logout-button{
    width:100%;
    min-height:54px;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0 11px;
    border:1px solid rgba(37,214,255,.14) !important;
    border-radius:11px !important;
    color:#bcefff !important;
    background:#0b1621 !important;
    font-size:8px;
    line-height:1.25;
    text-align:center;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .logout-button:hover{
    transform:translateY(-1px);
    border-color:rgba(37,214,255,.30) !important;
    background:#0e1b27 !important;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .broadcast-button{
    color:#b8f5ff !important;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .update-button{
    color:#d1c6ff !important;
    border-color:rgba(139,99,255,.19) !important;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .shutdown-button{
    color:#ff9eb5 !important;
    border-color:rgba(255,102,140,.20) !important;
    background:#170c13 !important;
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .clear-players-button{
    color:#ffe09a !important;
    border-color:rgba(255,190,70,.22) !important;
    background:#171207 !important;
}
.page-dashboard.nexu-v204 .nx-v204-command-meta{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:6px;
}
.page-dashboard.nexu-v204 .nx-v204-command-meta article{
    display:flex;
    flex-direction:column;
    justify-content:center;
    padding:9px;
    border:1px solid rgba(151,190,216,.08);
    border-radius:10px;
    background:#07101a;
}
.page-dashboard.nexu-v204 .nx-v204-command-meta span{
    color:#587183;
    font-size:6px;
    font-weight:900;
    letter-spacing:.12em;
    text-transform:uppercase;
}
.page-dashboard.nexu-v204 .nx-v204-command-meta b{
    margin-top:5px;
    overflow:hidden;
    color:#c7dbe7;
    font-size:9px;
    text-overflow:ellipsis;
    white-space:nowrap;
}

/* Statusmodule */
.page-dashboard.nexu-v204 .nx-v204-control-grid{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
}
.page-dashboard.nexu-v204 .nx-v204-control-grid.is-single{
    grid-template-columns:1fr;
}
.page-dashboard.nexu-v204 .menu-status-panel,
.page-dashboard.nexu-v204 .update-status{
    min-height:145px;
    margin:0 !important;
    padding:20px !important;
    border-radius:17px !important;
}
.page-dashboard.nexu-v204 .menu-status-panel::after{
    opacity:.35;
}
.page-dashboard.nexu-v204 .menu-status-row,
.page-dashboard.nexu-v204 .update-status-row{
    height:100%;
    align-items:center;
}
.page-dashboard.nexu-v204 .menu-status-copy h2,
.page-dashboard.nexu-v204 .update-status h2{
    margin:6px 0 !important;
    font-size:20px !important;
}
.page-dashboard.nexu-v204 .menu-status-copy p,
.page-dashboard.nexu-v204 .update-status p{
    max-width:660px;
    color:#71899a !important;
    font-size:10px;
    line-height:1.5;
}
.page-dashboard.nexu-v204 .menu-status-badge,
.page-dashboard.nexu-v204 .menu-status-toggle,
.page-dashboard.nexu-v204 .update-cancel{
    border-radius:10px !important;
}
.page-dashboard.nexu-v204 .update-countdown{
    font-size:29px !important;
}

/* Spieler-Verzeichnis */
.page-dashboard.nexu-v204 .directory{
    margin:0 !important;
    padding:0 !important;
    overflow:visible;
    border-radius:18px !important;
}
.page-dashboard.nexu-v204 .directory-tabs{
    margin:0 !important;
    padding:8px !important;
    gap:5px !important;
    border:0 !important;
    border-bottom:1px solid rgba(151,190,216,.08) !important;
    border-radius:18px 18px 0 0 !important;
    background:#081019 !important;
}
.page-dashboard.nexu-v204 .directory-tab{
    min-height:38px;
    padding:0 12px;
    border:0 !important;
    border-radius:9px !important;
    background:transparent !important;
    font-size:8px;
}
.page-dashboard.nexu-v204 .directory-tab.active{
    border:0 !important;
    background:#101c28 !important;
    box-shadow:none !important;
}
.page-dashboard.nexu-v204 .directory-tab b{
    min-width:20px;
    padding:2px 5px;
    font-size:7px;
}
.page-dashboard.nexu-v204 .directory-panel{
    padding:18px !important;
}
.page-dashboard.nexu-v204 .directory-head{
    align-items:center;
    margin-bottom:13px;
}
.page-dashboard.nexu-v204 .directory h2{
    font-size:17px;
}
.page-dashboard.nexu-v204 .search{
    width:min(330px,100%);
    min-width:0;
    min-height:39px;
    height:39px;
    border:1px solid var(--v204-line);
    border-radius:10px !important;
    background:#060c13;
    font-size:10px;
}
.page-dashboard.nexu-v204 .players{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px !important;
}
.page-dashboard.nexu-v204 .player,
.page-dashboard.nexu-v204 .banned-card{
    padding:12px !important;
    border:1px solid rgba(151,190,216,.09) !important;
    border-radius:14px !important;
    background:#09111a !important;
    box-shadow:none !important;
}
.page-dashboard.nexu-v204 .player:hover{
    transform:none;
    border-color:rgba(37,214,255,.18) !important;
    background:#0a141e !important;
}
.page-dashboard.nexu-v204 .player .avatar{
    width:52px;
    height:52px;
    border-radius:13px;
}
.page-dashboard.nexu-v204 .player .display-name{
    font-size:14px;
}
.page-dashboard.nexu-v204 .player .username{
    font-size:9px;
}
.page-dashboard.nexu-v204 .player-actions{
    gap:7px;
    padding-top:8px;
}
.page-dashboard.nexu-v204 .player .action-button{
    min-height:29px !important;
    height:29px;
    padding:0 8px !important;
    border-radius:8px !important;
    font-size:7px !important;
}
.page-dashboard.nexu-v204 .player .role-trigger.role-badge{
    min-height:27px !important;
    border-radius:8px;
}
.page-dashboard.nexu-v204 .presence-details{
    margin-top:8px;
    border-radius:10px !important;
    box-shadow:none !important;
}
.page-dashboard.nexu-v204 .presence-line,
.page-dashboard.nexu-v204 .presence-line:nth-child(n){
    grid-template-columns:78px minmax(0,1fr);
    min-height:35px;
    padding:7px 9px !important;
}
.page-dashboard.nexu-v204 .presence-key{
    font-size:6px;
}
.page-dashboard.nexu-v204 .presence-value{
    font-size:8px;
}
.page-dashboard.nexu-v204 .footer-note{
    margin-top:10px;
    color:#587183;
    font-size:8px;
}

/* Sichtbarer, ruhiger Seitenaufbau */
body.nexu-v204 [data-v204-enter]{
    opacity:0;
    transform:translateY(10px);
}
body.nexu-v204 [data-v204-enter].is-visible{
    opacity:1;
    transform:none;
    transition:opacity .46s var(--v204-ease),transform .46s var(--v204-ease);
}

/* ------------------------------------------------------------------------
   Responsive
   ------------------------------------------------------------------------ */
@media(max-width:1320px){
    .page-dashboard.nexu-v204 .nx-overview-layout{
        grid-template-columns:242px minmax(0,1fr) !important;
    }
    .page-dashboard.nexu-v204 .hero{
        grid-template-columns:1fr !important;
        grid-template-rows:auto !important;
    }
    .page-dashboard.nexu-v204 .hero > .eyebrow,
    .page-dashboard.nexu-v204 .hero > h1,
    .page-dashboard.nexu-v204 .hero > p,
    .page-dashboard.nexu-v204 .hero > .stats{
        grid-column:1;
        grid-row:auto;
    }
    .page-dashboard.nexu-v204 .hero > .stats{
        grid-template-columns:repeat(4,minmax(0,1fr)) !important;
        margin-top:15px !important;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-center{
        grid-template-columns:260px minmax(0,1fr);
    }
    .page-dashboard.nexu-v204 .nx-v204-command-meta{
        grid-column:1/-1;
        grid-template-columns:repeat(4,minmax(0,1fr));
    }
    .page-accounts.nexu-v204 .account-card form > .grid{
        grid-template-columns:1fr !important;
    }
}
@media(max-width:1060px){
    .page-login.nexu-v204 .login-shell{
        grid-template-columns:1fr !important;
    }
    .page-login.nexu-v204 .brand-card{
        min-height:420px !important;
    }
    .page-login.nexu-v204 .auth-card{
        min-height:0;
    }
    .page-home.nexu-v204 .hero{
        grid-template-columns:1fr !important;
    }
    .page-home.nexu-v204 .welcome{
        min-height:500px !important;
    }
    .page-dashboard.nexu-v204 .nx-overview-layout{
        grid-template-columns:1fr !important;
    }
    .page-dashboard.nexu-v204 .nx-overview-sidebar{
        position:relative !important;
        top:auto !important;
        max-height:none !important;
        display:grid;
        grid-template-columns:1.2fr 1fr 1.2fr;
        gap:7px;
    }
    .page-dashboard.nexu-v204 .nx-server-head{
        grid-column:1;
    }
    .page-dashboard.nexu-v204 .nx-sidebar-section{
        margin-top:0;
    }
    .page-dashboard.nexu-v204 .nx-sidebar-section:nth-of-type(1){
        grid-column:2;
    }
    .page-dashboard.nexu-v204 .nx-sidebar-section:nth-of-type(2){
        grid-column:3;
    }
    .page-dashboard.nexu-v204 .nx-sidebar-section:nth-of-type(3),
    .page-dashboard.nexu-v204 .nx-server-details,
    .page-dashboard.nexu-v204 .nx-sidebar-foot{
        display:none;
    }
    .page-dashboard.nexu-v204 .nx-overview-nav{
        grid-template-columns:1fr 1fr;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-center{
        grid-template-columns:1fr;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-actions{
        grid-template-columns:repeat(3,minmax(0,1fr));
    }
}
@media(max-width:760px){
    body.nexu-v204 .nx-ambient{
        opacity:.22;
    }
    .page-login.nexu-v204{
        padding:9px !important;
    }
    .page-login.nexu-v204 .brand-card{
        min-height:360px !important;
        padding:27px !important;
    }
    .page-login.nexu-v204 .brand-card .logo{
        top:22px;
        left:22px;
    }
    .page-login.nexu-v204 .statline .stat{
        grid-template-columns:1fr;
    }
    .page-login.nexu-v204 .statline .stat span{
        text-align:left;
    }
    .page-home.nexu-v204 .shell,
    .page-accounts.nexu-v204 .shell,
    .page-dashboard.nexu-v204 .shell{
        width:min(100% - 14px,1580px) !important;
    }
    .page-home.nexu-v204 .header,
    .page-accounts.nexu-v204 .topbar,
    .page-dashboard.nexu-v204 header{
        position:relative !important;
        top:auto !important;
    }
    .page-home.nexu-v204 .welcome{
        min-height:430px !important;
        padding:26px !important;
    }
    .page-home.nexu-v204 h1{
        font-size:58px !important;
    }
    .page-home.nexu-v204 .quick-info{
        grid-template-columns:1fr !important;
    }
    .page-accounts.nexu-v204 .nx-account-overview{
        grid-template-columns:1fr 1fr !important;
    }
    .page-accounts.nexu-v204 .nx-account-overview article:first-child{
        grid-column:1/-1;
    }
    .page-accounts.nexu-v204 .nx-v204-account-tools{
        align-items:stretch;
        flex-direction:column;
    }
    .page-accounts.nexu-v204 .nx-v204-account-search{
        width:100%;
    }
    .page-accounts.nexu-v204 .access-grid{
        grid-template-columns:1fr !important;
    }
    .page-dashboard.nexu-v204 .header-actions{
        width:100%;
        justify-content:flex-start;
    }
    .page-dashboard.nexu-v204 .live-pill{
        margin-left:auto;
    }
    .page-dashboard.nexu-v204 .nx-overview-sidebar{
        grid-template-columns:1fr !important;
    }
    .page-dashboard.nexu-v204 .nx-server-head,
    .page-dashboard.nexu-v204 .nx-sidebar-section:nth-of-type(1),
    .page-dashboard.nexu-v204 .nx-sidebar-section:nth-of-type(2){
        grid-column:1;
    }
    .page-dashboard.nexu-v204 .nx-overview-nav{
        grid-template-columns:repeat(2,minmax(0,1fr));
    }
    .page-dashboard.nexu-v204 .hero{
        min-height:0;
        padding:22px !important;
    }
    .page-dashboard.nexu-v204 .hero > h1{
        font-size:38px !important;
    }
    .page-dashboard.nexu-v204 .hero > .stats{
        grid-template-columns:1fr 1fr !important;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-actions{
        grid-template-columns:1fr;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-meta{
        grid-template-columns:1fr 1fr;
    }
    .page-dashboard.nexu-v204 .nx-v204-control-grid{
        grid-template-columns:1fr;
    }
    .page-dashboard.nexu-v204 .menu-status-row,
    .page-dashboard.nexu-v204 .update-status-row{
        align-items:flex-start;
        flex-direction:column;
    }
    .page-dashboard.nexu-v204 .directory-panel{
        padding:13px !important;
    }
    .page-dashboard.nexu-v204 .directory-head{
        align-items:stretch;
        flex-direction:column;
    }
    .page-dashboard.nexu-v204 .search{
        width:100%;
    }
    .page-dashboard.nexu-v204 .players{
        grid-template-columns:1fr;
    }
}
@media(max-width:470px){
    .page-home.nexu-v204 h1{
        font-size:48px !important;
    }
    .page-accounts.nexu-v204 .nx-account-overview{
        grid-template-columns:1fr !important;
    }
    .page-accounts.nexu-v204 .nx-account-overview article:first-child{
        grid-column:1;
    }
    .page-dashboard.nexu-v204 .hero > .stats{
        grid-template-columns:1fr !important;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-meta{
        grid-template-columns:1fr;
    }
}
@media(prefers-reduced-motion:reduce){
    html{scroll-behavior:auto;}
    body.nexu-v204 [data-v204-enter]{
        opacity:1 !important;
        transform:none !important;
        transition:none !important;
    }
}
/* ========================================================================
   NEXU V205 // EINHEITLICHES BEDIENELEMENT-SYSTEM
   ======================================================================== */

body.nexu-v204{
    --v205-control-height:40px;
    --v205-control-height-compact:32px;
    --v205-control-radius:10px;
    --v205-control-font:10px;
    --v205-control-font-compact:8.5px;
    --v205-control-padding:0 13px;
    --v205-control-gap:7px;
}

/* Gemeinsame Typografie und Ausrichtung */
body.nexu-v204 button,
body.nexu-v204 .logout-button,
body.nexu-v204 .button-link,
body.nexu-v204 .back{
    font-family:inherit;
    font-weight:850;
    letter-spacing:.055em;
    line-height:1.15;
    text-align:center;
    text-decoration:none;
    -webkit-font-smoothing:antialiased;
}
body.nexu-v204 button:not(.primary-tile):not(.account-button):not(.role-option),
body.nexu-v204 .logout-button,
body.nexu-v204 .button-link,
body.nexu-v204 .back{
    border-radius:var(--v205-control-radius) !important;
}

/* Anmeldung: alle Hauptaktionen exakt gleich */
.page-login.nexu-v204 .auth-panel button,
.page-login.nexu-v204 .remembered-list button,
.page-login.nexu-v204 .button-link{
    width:100%;
    min-height:var(--v205-control-height) !important;
    height:var(--v205-control-height);
    padding:var(--v205-control-padding) !important;
    border-radius:var(--v205-control-radius) !important;
    font-size:var(--v205-control-font) !important;
    letter-spacing:.055em !important;
    line-height:1 !important;
    white-space:nowrap;
}
.page-login.nexu-v204 .remembered-account{
    align-items:center;
    gap:8px;
}
.page-login.nexu-v204 .remembered-account form{
    flex:0 0 auto;
}
.page-login.nexu-v204 .remembered-account button{
    width:auto;
    min-width:112px;
}

/* Startseite: Profil- und Menüaktionen vereinheitlichen */
.page-home.nexu-v204 .account-button{
    min-height:38px !important;
    height:38px;
    padding:0 12px 0 7px !important;
    border-radius:10px !important;
    font-size:9px !important;
}
.page-home.nexu-v204 .account-avatar{
    width:27px;
    height:27px;
    font-size:10px;
}
.page-home.nexu-v204 .menu-item{
    min-height:38px !important;
    height:38px;
    display:flex;
    align-items:center;
    padding:0 12px !important;
    border-radius:9px !important;
    font-size:9px !important;
    letter-spacing:.035em !important;
}
.page-home.nexu-v204 .primary-tile{
    font-size:inherit !important;
}

/* Kontoverwaltung: Speichern, Löschen und Zurück einheitlich */
.page-accounts.nexu-v204 .back,
.page-accounts.nexu-v204 .save,
.page-accounts.nexu-v204 .danger,
.page-accounts.nexu-v204 .confirm-delete,
.page-accounts.nexu-v204 .account-confirm-actions button{
    min-height:var(--v205-control-height) !important;
    height:var(--v205-control-height);
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:var(--v205-control-padding) !important;
    border-radius:var(--v205-control-radius) !important;
    font-size:var(--v205-control-font) !important;
    letter-spacing:.055em !important;
    line-height:1 !important;
    white-space:nowrap;
}
.page-accounts.nexu-v204 .actions{
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:var(--v205-control-gap);
    flex-wrap:wrap;
}
.page-accounts.nexu-v204 .actions button{
    min-width:132px;
}
.page-accounts.nexu-v204 .delete-account-form button{
    min-width:132px;
}

/* Kopfzeile der Übersicht */
.page-dashboard.nexu-v204 .header-actions{
    display:flex;
    align-items:center;
    gap:var(--v205-control-gap) !important;
    flex-wrap:wrap;
}
.page-dashboard.nexu-v204 .header-actions > .logout-button,
.page-dashboard.nexu-v204 .header-actions > a.logout-button,
.page-dashboard.nexu-v204 .header-actions .logout-form .logout-button{
    min-height:38px !important;
    height:38px;
    min-width:110px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:0 12px !important;
    border-radius:10px !important;
    font-size:9px !important;
    letter-spacing:.05em !important;
    line-height:1 !important;
    white-space:nowrap;
}
.page-dashboard.nexu-v204 .header-actions .logout-form{
    display:flex;
    margin:0;
}

/* Steuerzentrale: keine übergroßen Flächen mit winziger Schrift */
.page-dashboard.nexu-v204 .nx-v204-command-actions{
    align-content:center;
    grid-template-columns:repeat(3,minmax(118px,1fr));
    gap:var(--v205-control-gap);
}
.page-dashboard.nexu-v204 .nx-v204-command-actions .logout-button{
    width:100%;
    min-width:0;
    min-height:42px !important;
    height:42px;
    padding:0 12px !important;
    border-radius:10px !important;
    font-size:9.5px !important;
    font-weight:900 !important;
    letter-spacing:.045em !important;
    line-height:1.15 !important;
    white-space:normal;
    overflow-wrap:normal;
    word-break:normal;
}

/* Status- und Wartungsschaltflächen */
.page-dashboard.nexu-v204 .menu-status-toggle,
.page-dashboard.nexu-v204 .update-cancel{
    min-height:var(--v205-control-height) !important;
    height:var(--v205-control-height);
    min-width:138px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:var(--v205-control-padding) !important;
    border-radius:var(--v205-control-radius) !important;
    font-size:var(--v205-control-font) !important;
    font-weight:900 !important;
    letter-spacing:.05em !important;
    line-height:1 !important;
    white-space:nowrap;
}
.page-dashboard.nexu-v204 .menu-status-actions{
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:var(--v205-control-gap);
    flex-wrap:wrap;
}

/* Tabs: gleiche Höhe, gleiche Typografie */
.page-dashboard.nexu-v204 .directory-tab{
    min-height:38px !important;
    height:38px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:7px;
    padding:0 12px !important;
    border-radius:9px !important;
    font-size:9px !important;
    font-weight:850 !important;
    letter-spacing:.045em !important;
    line-height:1 !important;
    white-space:nowrap;
}
.page-dashboard.nexu-v204 .directory-tab b{
    min-width:20px;
    height:18px;
    display:inline-grid;
    place-items:center;
    padding:0 5px !important;
    border-radius:6px;
    font-size:7px !important;
    line-height:1 !important;
}

/* Spieleraktionen als gleichmäßiges Raster */
.page-dashboard.nexu-v204 .player-actions{
    display:grid !important;
    grid-template-columns:auto minmax(0,1fr);
    align-items:center !important;
    gap:10px !important;
}
.page-dashboard.nexu-v204 .player .button-row{
    width:100%;
    min-width:0;
    display:grid !important;
    grid-template-columns:repeat(auto-fit,minmax(82px,1fr));
    align-items:center;
    gap:6px !important;
}
.page-dashboard.nexu-v204 .player .action-button{
    width:100%;
    min-width:0;
    min-height:var(--v205-control-height-compact) !important;
    height:var(--v205-control-height-compact) !important;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:0 9px !important;
    border-radius:9px !important;
    font-size:var(--v205-control-font-compact) !important;
    font-weight:900 !important;
    letter-spacing:.045em !important;
    line-height:1 !important;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
}
.page-dashboard.nexu-v204 .player .action-button:hover{
    transform:translateY(-1px);
}
.page-dashboard.nexu-v204 .player-state{
    min-width:64px;
    font-size:8px !important;
    letter-spacing:.10em !important;
}

/* Rangwahl exakt so groß wie die Spieleraktionen */
.page-dashboard.nexu-v204 .player .role-picker{
    width:min(100%,230px);
}
.page-dashboard.nexu-v204 .player .role-trigger.role-badge{
    width:100%;
    min-height:var(--v205-control-height-compact) !important;
    height:var(--v205-control-height-compact);
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    padding:0 10px !important;
    border-radius:9px !important;
    font-size:var(--v205-control-font-compact) !important;
    font-weight:900 !important;
    letter-spacing:.055em !important;
    line-height:1 !important;
}
.page-dashboard.nexu-v204 .role-option{
    min-height:44px !important;
    padding:7px 9px !important;
    border-radius:10px !important;
}
.page-dashboard.nexu-v204 .role-option-copy strong{
    font-size:9.5px !important;
    line-height:1.15;
}
.page-dashboard.nexu-v204 .role-option-copy small{
    font-size:8px !important;
    line-height:1.35;
}

/* Dialoge: identische Aktionsgrößen */
.page-dashboard.nexu-v204 .modal-actions,
.page-dashboard.nexu-v204 .account-confirm-actions{
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:var(--v205-control-gap);
    flex-wrap:wrap;
}
.page-dashboard.nexu-v204 .modal-actions button,
.page-dashboard.nexu-v204 .account-confirm-actions button,
.page-dashboard.nexu-v204 .action-confirm-submit{
    min-height:var(--v205-control-height) !important;
    height:var(--v205-control-height);
    min-width:124px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:var(--v205-control-padding) !important;
    border-radius:var(--v205-control-radius) !important;
    font-size:var(--v205-control-font) !important;
    font-weight:900 !important;
    letter-spacing:.05em !important;
    line-height:1 !important;
    white-space:nowrap;
}

/* Eingabefelder folgen derselben vertikalen Skala */
.page-login.nexu-v204 input,
.page-home.nexu-v204 input,
.page-accounts.nexu-v204 input:not([type="checkbox"]),
.page-dashboard.nexu-v204 input:not([type="checkbox"]),
.page-dashboard.nexu-v204 textarea,
.page-dashboard.nexu-v204 select{
    min-height:var(--v205-control-height) !important;
    border-radius:var(--v205-control-radius) !important;
    font-size:10px !important;
}
.page-dashboard.nexu-v204 textarea{
    min-height:92px !important;
    padding:11px 12px !important;
    line-height:1.5;
}

/* Verhindert ungewolltes Aufblasen durch alte width/min-width-Regeln */
body.nexu-v204 button[hidden],
body.nexu-v204 .hidden{
    display:none !important;
}
body.nexu-v204 button:disabled{
    opacity:.48;
    cursor:not-allowed;
    transform:none !important;
}

/* Responsive Kontrollraster */
@media(max-width:1180px){
    .page-dashboard.nexu-v204 .nx-v204-command-actions{
        grid-template-columns:repeat(3,minmax(100px,1fr));
    }
}
@media(max-width:760px){
    .page-dashboard.nexu-v204 .header-actions > .logout-button,
    .page-dashboard.nexu-v204 .header-actions > a.logout-button,
    .page-dashboard.nexu-v204 .header-actions .logout-form .logout-button{
        min-width:0;
        flex:1 1 120px;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-actions{
        grid-template-columns:1fr !important;
    }
    .page-dashboard.nexu-v204 .nx-v204-command-actions .logout-button{
        min-height:40px !important;
        height:40px;
    }
    .page-dashboard.nexu-v204 .player-actions{
        grid-template-columns:1fr !important;
        align-items:stretch !important;
    }
    .page-dashboard.nexu-v204 .player .button-row{
        grid-template-columns:repeat(2,minmax(0,1fr));
    }
    .page-dashboard.nexu-v204 .player-state{
        min-width:0;
    }
    .page-dashboard.nexu-v204 .player .role-picker{
        width:100%;
    }
    .page-dashboard.nexu-v204 .menu-status-toggle,
    .page-dashboard.nexu-v204 .update-cancel{
        width:100%;
        min-width:0;
    }
}
@media(max-width:430px){
    .page-login.nexu-v204 .remembered-account{
        align-items:stretch;
        flex-direction:column;
    }
    .page-login.nexu-v204 .remembered-account form,
    .page-login.nexu-v204 .remembered-account button{
        width:100%;
    }
    .page-accounts.nexu-v204 .actions button,
    .page-accounts.nexu-v204 .delete-account-form button{
        width:100%;
        min-width:0;
    }
    .page-dashboard.nexu-v204 .player .button-row{
        grid-template-columns:1fr 1fr;
    }
    .page-dashboard.nexu-v204 .modal-actions button,
    .page-dashboard.nexu-v204 .account-confirm-actions button{
        width:100%;
        min-width:0;
    }
}

/* NEXU V207 // RUNDSENDUNGSDAUER */
.page-dashboard.nexu-v204 .broadcast-duration-panel{
    margin-top:12px;
    padding:13px;
    border:1px solid rgba(151,190,216,.10);
    border-radius:13px;
    background:#07101a;
}
.page-dashboard.nexu-v204 .broadcast-duration-head{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:14px;
}
.page-dashboard.nexu-v204 .broadcast-duration-head span{
    display:block;
    color:#5d7789;
    font-size:7px;
    font-weight:900;
    letter-spacing:.14em;
}
.page-dashboard.nexu-v204 .broadcast-duration-head strong{
    display:block;
    margin-top:5px;
    color:#d7e7ef;
    font-size:10px;
    line-height:1.35;
}
.page-dashboard.nexu-v204 .broadcast-duration-head > b{
    flex:0 0 auto;
    min-height:28px;
    display:inline-flex;
    align-items:center;
    padding:0 9px;
    border:1px solid rgba(37,214,255,.18);
    border-radius:8px;
    color:#9cecff;
    background:rgba(37,214,255,.06);
    font-size:8px;
    font-weight:900;
    letter-spacing:.055em;
}
.page-dashboard.nexu-v204 .broadcast-duration-grid{
    display:grid;
    grid-template-columns:minmax(0,1fr) 150px;
    gap:8px;
    margin-top:11px;
}
.page-dashboard.nexu-v204 .broadcast-duration-presets{
    display:grid;
    grid-template-columns:repeat(6,minmax(0,1fr));
    gap:5px;
    margin-top:8px;
}
.page-dashboard.nexu-v204 .broadcast-duration-presets button{
    min-height:30px !important;
    height:30px;
    padding:0 7px !important;
    border:1px solid rgba(151,190,216,.10);
    border-radius:8px !important;
    color:#859dac;
    background:#0a141e;
    font-size:7px !important;
    font-weight:900;
    letter-spacing:.045em;
    cursor:pointer;
}
.page-dashboard.nexu-v204 .broadcast-duration-presets button:hover,
.page-dashboard.nexu-v204 .broadcast-duration-presets button.active{
    color:#ddf8ff;
    border-color:rgba(37,214,255,.26);
    background:rgba(37,214,255,.075);
}
@media(max-width:620px){
    .page-dashboard.nexu-v204 .broadcast-duration-grid{
        grid-template-columns:1fr;
    }
    .page-dashboard.nexu-v204 .broadcast-duration-presets{
        grid-template-columns:repeat(3,minmax(0,1fr));
    }
}

`;
}

function nexuV204ClientScript(pageType) {
    return String.raw`<script>
(function(){
    "use strict";
    var pageType=${JSON.stringify(pageType)};
    var body=document.body;
    body.classList.add("nexu-v204");

    function one(selector,root){return (root||document).querySelector(selector);}
    function all(selector,root){return Array.prototype.slice.call((root||document).querySelectorAll(selector));}
    function make(tag,className,html){
        var node=document.createElement(tag);
        if(className) node.className=className;
        if(html!==undefined) node.innerHTML=html;
        return node;
    }

    function enableEntrance(){
        var reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var targets=all(".hero,.directory,.menu-status-panel,.update-status,.primary-tile,.info-card,.account-card,.auth-panel,.remembered-list,.nx-v204-command-center,.nx-v204-control-grid");
        targets.forEach(function(node,index){
            node.setAttribute("data-v204-enter","");
            if(reduced){
                node.classList.add("is-visible");
                return;
            }
            node.style.transitionDelay=Math.min(index*24,180)+"ms";
        });
        if(reduced||!("IntersectionObserver" in window)){
            targets.forEach(function(node){node.classList.add("is-visible");});
            return;
        }
        var observer=new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if(!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },{rootMargin:"0px 0px -5% 0px",threshold:.04});
        targets.forEach(function(node){observer.observe(node);});
    }

    function setupOverview(){
        var content=one(".nx-overview-content");
        var hero=content&&one(".hero",content);
        if(!content||!hero) return;

        var command=make("section","nx-v204-command-center");
        command.id="nxV204CommandCenter";
        command.innerHTML=
            '<div class="nx-v204-command-copy">'+
                '<span>Direktaktionen</span>'+
                '<strong>Steuerzentrale</strong>'+
                '<small>Wichtige Laufzeitbefehle sind hier gebündelt und bleiben mit den bestehenden Berechtigungen geschützt.</small>'+
            '</div>'+
            '<div class="nx-v204-command-actions" id="nxV204CommandActions"></div>'+
            '<div class="nx-v204-command-meta">'+
                '<article><span>Menü</span><b id="nxV204MenuState">Wird geprüft</b></article>'+
                '<article><span>Sitzungen</span><b id="nxV204Sessions">0 aktiv</b></article>'+
                '<article><span>Laufzeit</span><b id="nxV204Uptime">0 Sekunden</b></article>'+
                '<article><span>Speicher</span><b id="nxV204Memory">0 MB</b></article>'+
            '</div>';
        hero.insertAdjacentElement("afterend",command);

        var actionHolder=one("#nxV204CommandActions");
        ["broadcastDmButton","openUpdateButton","shutdownAllButton","clearStoredPlayersButton"].forEach(function(id){
            var button=document.getElementById(id);
            if(button&&actionHolder) actionHolder.appendChild(button);
        });

        var menuPanel=document.getElementById("menuStatusPanel");
        var updatePanel=document.getElementById("updateStatusPanel");
        var controlGrid=make("div","nx-v204-control-grid");
        controlGrid.id="nxV204ControlGrid";
        command.insertAdjacentElement("afterend",controlGrid);
        if(menuPanel) controlGrid.appendChild(menuPanel);
        if(updatePanel) controlGrid.appendChild(updatePanel);

        function updateGrid(){
            var updateVisible=updatePanel&&!updatePanel.classList.contains("hidden");
            controlGrid.classList.toggle("is-single",!updateVisible);
        }
        updateGrid();
        if(updatePanel&&window.MutationObserver){
            new MutationObserver(updateGrid).observe(updatePanel,{attributes:true,attributeFilter:["class"]});
        }

        var directory=one(".directory",content);
        if(directory){
            directory.setAttribute("aria-label","Spielerverzeichnis");
        }

        var stats=all(".stat",hero);
        var kinds=["status","players","presence","bans"];
        stats.forEach(function(card,index){card.setAttribute("data-v204-kind",kinds[index]||"metric");});

        function syncMeta(){
            var menuBadge=document.getElementById("menuStatusBadgeText");
            var sessions=document.getElementById("nxSessions");
            var uptime=document.getElementById("nxUptime");
            var rss=document.getElementById("nxRss");
            var menuTarget=document.getElementById("nxV204MenuState");
            var sessionsTarget=document.getElementById("nxV204Sessions");
            var uptimeTarget=document.getElementById("nxV204Uptime");
            var memoryTarget=document.getElementById("nxV204Memory");
            if(menuBadge&&menuTarget) menuTarget.textContent=menuBadge.textContent||"Wird geprüft";
            if(sessions&&sessionsTarget) sessionsTarget.textContent=sessions.textContent||"0 aktiv";
            if(uptime&&uptimeTarget) uptimeTarget.textContent=uptime.textContent||"0 Sekunden";
            if(rss&&memoryTarget) memoryTarget.textContent=rss.textContent||"0 MB";
        }
        syncMeta();
        if(window.MutationObserver){
            ["menuStatusBadgeText","nxSessions","nxUptime","nxRss"].forEach(function(id){
                var node=document.getElementById(id);
                if(node) new MutationObserver(syncMeta).observe(node,{childList:true,subtree:true,characterData:true});
            });
        }
        setInterval(syncMeta,2200);

        function markPlayerCards(root){
            all(".player,.banned-card",root||document).forEach(function(card){
                if(card.dataset.v204Ready) return;
                card.dataset.v204Ready="1";
                var details=one(".presence-details",card);
                if(details) details.setAttribute("aria-label","Spielerinformationen");
            });
        }
        ["players","offlinePlayers","bannedPlayers"].forEach(function(id){
            var container=document.getElementById(id);
            if(!container) return;
            markPlayerCards(container);
            if(window.MutationObserver){
                new MutationObserver(function(){markPlayerCards(container);}).observe(container,{childList:true,subtree:true});
            }
        });
    }

    function setupAccounts(){
        var list=one(".account-list");
        if(!list) return;
        var cards=all(".account-card",list);
        var tools=make("section","nx-v204-account-tools");
        tools.innerHTML=
            '<div class="nx-v204-account-tools-copy">'+
                '<strong>Konten und Berechtigungen</strong>'+
                '<span>'+cards.length+' registrierte Konten · Änderungen werden weiterhin über die vorhandenen Formulare gespeichert.</span>'+
            '</div>'+
            '<input class="nx-v204-account-search" type="search" autocomplete="off" placeholder="Konten durchsuchen …" aria-label="Konten durchsuchen">';
        list.parentNode.insertBefore(tools,list);

        var search=one(".nx-v204-account-search",tools);
        if(search){
            search.addEventListener("input",function(){
                var query=String(search.value||"").trim().toLowerCase();
                cards.forEach(function(card){
                    card.hidden=query&&String(card.textContent||"").toLowerCase().indexOf(query)===-1;
                });
            });
        }
    }

    function setupHome(){
        var tiles=all(".primary-tile");
        tiles.forEach(function(tile,index){
            tile.setAttribute("data-v204-index",String(index+1).padStart(2,"0"));
        });
    }

    if(pageType==="overview") setupOverview();
    if(pageType==="accounts") setupAccounts();
    if(pageType==="home") setupHome();

    requestAnimationFrame(function(){
        enableEntrance();
        body.classList.add("nx-v204-ready");
    });
})();
</script>`;
}

function enhanceNexuV204Page(html,pageType){
    if(typeof html!=="string"||html.includes("NEXU V204 // PROFESSIONAL CLEAN SYSTEM")) return html;

    html=html.replace(/<body([^>]*)>/i,function(match,attributes){
        var next=attributes||"";
        if(/\bclass\s*=\s*"[^"]*"/i.test(next)){
            next=next.replace(/\bclass\s*=\s*"([^"]*)"/i,function(_,current){
                return 'class="'+current+' nexu-v204"';
            });
        }else{
            next+=' class="nexu-v204"';
        }
        return "<body"+next+">";
    });

    html=html.replace("</style>",nexuV204Css()+"</style>");
    html=html.replace("</body>",nexuV204ClientScript(pageType)+"</body>");
    return html;
}

loginHtml=function(...args){
    return enhanceNexuV204Page(NEXU_V204_BASE_LOGIN_HTML(...args),"login");
};
homeHtml=function(...args){
    return enhanceNexuV204Page(NEXU_V204_BASE_HOME_HTML(...args),"home");
};
dashboardAccountsHtml=function(...args){
    return enhanceNexuV204Page(NEXU_V204_BASE_ACCOUNTS_HTML(...args),"accounts");
};
dashboardHtml=function(...args){
    return enhanceNexuV204Page(NEXU_V204_BASE_OVERVIEW_HTML(...args),"overview");
};



/* --------------------------------------------------------------------------
 * NEXU V206 // PUBLIC START + PERSISTENT AUTH
 *
 * Die Startseite ist öffentlich. Ein Konto wird nur für geschützte Bereiche
 * benötigt. Der 30-Tage-Erinnerungs-Cookie dient gleichzeitig als sichere,
 * persistente Anmeldung, bis der Nutzer sich ausdrücklich abmeldet.
 * -------------------------------------------------------------------------- */

const NEXU_V206_BASE_HOME_HTML = homeHtml;
const NEXU_V206_BASE_GET_DASHBOARD_SESSION = getDashboardSession;

function nexuV206GuestAccount() {
    return {
        username: "Gast",
        email: "",
        isOwner: false,
        access: normalizeDashboardAccess({}, "Gast", ""),
        createdAt: "",
        updatedAt: "",
    };
}

// Eine gültige Erinnerungskennung stellt die Anmeldung nach Browser-Neustart,
// abgelaufener Kurzzeitsitzung oder Seitenaktualisierung automatisch wieder her.
getDashboardSession = function(req) {
    const activeSession = NEXU_V206_BASE_GET_DASHBOARD_SESSION(req);
    if (activeSession) return activeSession;

    const remembered = getRememberedDashboardAccount(req);
    if (!remembered) return null;
    const account =
        getDashboardAccountByEmail(remembered.email) ||
        getDashboardAccountByUsername(remembered.username);
    if (!account) return null;

    const isOwner = isOwnerDashboardAccount(account);
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
        token: `remembered:${rememberTokenHash(remembered.rememberToken).slice(0, 24)}`,
        username: effectiveAccount.username,
        email: effectiveAccount.email,
        account: effectiveAccount,
        isOwner,
        remembered: true,
        expiresAtMs: remembered.expiresAtMs,
    };
};

function nexuV206HomeCss() {
    return String.raw`
/* NEXU V206 // DIREKTER SEITENAUFBAU OHNE LADESCHEIBE */
body.page-home.nx-v206-direct{overflow-x:hidden !important;}
body.page-home.nx-v206-direct .nx-startup{display:none !important;}
body.page-home.nx-v206-direct.nx-booting > *{opacity:1 !important;}
body.page-home.nx-v206-direct .header,
body.page-home.nx-v206-direct .welcome,
body.page-home.nx-v206-direct .action-grid,
body.page-home.nx-v206-direct .nx-trust-grid,
body.page-home.nx-v206-direct .nx-capability-grid{
    animation:nxV206Build .42s cubic-bezier(.2,.82,.25,1) both;
}
body.page-home.nx-v206-direct .welcome{animation-delay:.035s;}
body.page-home.nx-v206-direct .action-grid{animation-delay:.075s;}
body.page-home.nx-v206-direct .nx-trust-grid{animation-delay:.11s;}
body.page-home.nx-v206-direct .nx-capability-grid{animation-delay:.145s;}
body.page-home.nx-v206-direct .primary-tile,
body.page-home.nx-v206-direct .info-card{animation:nxV206Card .34s cubic-bezier(.2,.82,.25,1) both;}
body.page-home.nx-v206-direct .primary-tile:nth-child(1){animation-delay:.10s;}
body.page-home.nx-v206-direct .primary-tile:nth-child(2){animation-delay:.135s;}
body.page-home.nx-v206-direct .primary-tile:nth-child(3){animation-delay:.17s;}
body.page-home.nx-v206-direct .quick-info{animation-delay:.20s;}
@keyframes nxV206Build{from{opacity:0;transform:translateY(12px) scale(.994);filter:blur(3px);}to{opacity:1;transform:none;filter:none;}}
@keyframes nxV206Card{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}

.nx-v206-guest #account{display:none !important;}
.nx-v206-auth-actions{display:flex;align-items:center;gap:7px;}
.nx-v206-auth-button{
    min-height:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;
    border:1px solid rgba(151,190,216,.14);border-radius:10px;color:#a9bdca;background:#09111a;
    font:inherit;font-size:9px;font-weight:880;letter-spacing:.05em;cursor:pointer;
}
.nx-v206-auth-button.primary{
    color:#ecfbff;border-color:rgba(37,214,255,.28);
    background:linear-gradient(135deg,rgba(37,214,255,.17),rgba(67,136,255,.12)),#0a1520;
    box-shadow:0 10px 26px rgba(25,163,226,.10);
}
.nx-v206-auth-button:hover{transform:translateY(-1px);border-color:rgba(37,214,255,.36);}
.page-home.nexu-v204 .primary-tile.menu-server.locked{cursor:pointer;opacity:.76 !important;}
.page-home.nexu-v204 .primary-tile.menu-server.locked:hover{opacity:1 !important;border-color:rgba(37,214,255,.22) !important;}
.page-home.nexu-v204 .primary-tile.menu-server.locked::after{
    content:"ANMELDUNG ERFORDERLICH";position:absolute;top:13px;right:13px;padding:5px 7px;
    border:1px solid rgba(255,201,107,.18);border-radius:7px;color:#f2c97f;background:rgba(39,28,10,.72);
    font-size:6px;font-weight:900;letter-spacing:.10em;
}

.nx-v206-auth-modal{
    position:fixed;z-index:60000;inset:0;display:grid;place-items:center;padding:16px;background:rgba(1,4,8,.78);
    backdrop-filter:blur(13px) saturate(90%);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease;
}
.nx-v206-auth-modal.open{opacity:1;visibility:visible;}
.nx-v206-auth-dialog{
    width:min(920px,100%);max-height:min(760px,calc(100vh - 32px));overflow:auto;display:grid;
    grid-template-columns:minmax(260px,.78fr) minmax(360px,1.22fr);border:1px solid rgba(113,207,246,.18);
    border-radius:22px;background:#08101a;box-shadow:0 45px 130px rgba(0,0,0,.64),0 1px 0 rgba(255,255,255,.035) inset;
    transform:translateY(10px) scale(.988);transition:transform .22s cubic-bezier(.2,.82,.25,1);
}
.nx-v206-auth-modal.open .nx-v206-auth-dialog{transform:none;}
.nx-v206-auth-side{
    position:relative;overflow:hidden;min-height:470px;display:flex;flex-direction:column;justify-content:flex-end;padding:28px;
    border-right:1px solid rgba(151,190,216,.09);
    background:radial-gradient(circle at 18% 6%,rgba(37,214,255,.15),transparent 22rem),linear-gradient(145deg,#0a1520,#08101a 66%);
}
.nx-v206-auth-side::after{content:"N";position:absolute;right:-28px;top:-72px;color:rgba(37,214,255,.035);font-size:260px;font-weight:950;line-height:1;}
.nx-v206-auth-mark{position:absolute;top:26px;left:26px;width:48px;height:48px;display:grid;place-items:center;border-radius:14px;color:white;background:linear-gradient(145deg,#25d6ff,#4388ff 58%,#8b63ff);font-size:19px;font-weight:950;}
.nx-v206-auth-side span{position:relative;z-index:1;color:#66dfff;font-size:8px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;}
.nx-v206-auth-side h2{position:relative;z-index:1;margin:9px 0 10px;color:#effaff;font-size:30px;line-height:1.02;letter-spacing:-.045em;}
.nx-v206-auth-side p{position:relative;z-index:1;color:#7992a3;font-size:10px;line-height:1.65;}
.nx-v206-auth-main{position:relative;padding:22px;}
.nx-v206-auth-close{position:absolute;z-index:2;top:13px;right:13px;width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(151,190,216,.11);border-radius:10px;color:#7e96a6;background:#0a131d;font-size:17px;cursor:pointer;}
.nx-v206-auth-tabs{width:calc(100% - 44px);display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border:1px solid rgba(151,190,216,.09);border-radius:12px;background:#060c13;}
.nx-v206-auth-tab{min-height:36px;border:0;border-radius:9px;color:#708898;background:transparent;font:inherit;font-size:9px;font-weight:900;letter-spacing:.06em;cursor:pointer;}
.nx-v206-auth-tab.active{color:#e7f8ff;background:#101d29;box-shadow:0 1px 0 rgba(255,255,255,.035) inset;}
.nx-v206-auth-form{display:none;margin-top:17px;}
.nx-v206-auth-form.active{display:block;}
.nx-v206-auth-form h3{margin:0 0 5px;font-size:19px;letter-spacing:-.025em;}
.nx-v206-auth-form > p{color:#6d8596;font-size:9px;line-height:1.5;}
.nx-v206-auth-field{margin-top:12px;}
.nx-v206-auth-field label{display:block;margin-bottom:6px;color:#748b9b;font-size:8px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;}
.nx-v206-auth-field input{width:100%;min-height:42px;padding:0 12px;border:1px solid rgba(151,190,216,.13);border-radius:10px;outline:none;color:#edf8fc;background:#060c13;font:inherit;font-size:10px;}
.nx-v206-auth-field input:focus{border-color:rgba(37,214,255,.52);box-shadow:0 0 0 3px rgba(37,214,255,.08);}
.nx-v206-auth-submit{width:100%;min-height:42px;margin-top:16px;border:1px solid rgba(37,214,255,.26);border-radius:10px;color:#effbff;background:linear-gradient(135deg,rgba(37,214,255,.18),rgba(67,136,255,.14)),#0a1520;font:inherit;font-size:9px;font-weight:900;letter-spacing:.06em;cursor:pointer;}
.nx-v206-auth-foot{display:flex;align-items:center;gap:7px;margin-top:12px;color:#60798a;font-size:8px;line-height:1.45;}
.nx-v206-auth-foot i{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:#45ffb0;box-shadow:0 0 10px rgba(69,255,176,.7);}
.nx-v206-owner-link{color:#d9d1ff !important;border-color:rgba(139,99,255,.18) !important;}
@media(max-width:760px){.nx-v206-auth-dialog{grid-template-columns:1fr;}.nx-v206-auth-side{display:none;}.nx-v206-auth-main{padding:18px;}}
@media(max-width:520px){.nx-v206-auth-actions{gap:5px;}.nx-v206-auth-button{padding:0 10px;font-size:8px;}.nx-v206-auth-button:first-child{display:none;}}
@media(prefers-reduced-motion:reduce){
    body.page-home.nx-v206-direct .header,body.page-home.nx-v206-direct .welcome,body.page-home.nx-v206-direct .action-grid,
    body.page-home.nx-v206-direct .nx-trust-grid,body.page-home.nx-v206-direct .nx-capability-grid,
    body.page-home.nx-v206-direct .primary-tile,body.page-home.nx-v206-direct .info-card{animation:none !important;}
}
`;
}

function nexuV206HomeScript(isGuest, isOwner, initialAuthMode) {
    return String.raw`<script>
(function(){
    "use strict";
    var isGuest=${JSON.stringify(isGuest)};
    var isOwner=${JSON.stringify(isOwner)};
    var initialMode=${JSON.stringify(initialAuthMode || "")};
    var body=document.body;
    body.classList.remove("nx-booting");
    var splash=document.getElementById("nxStartup");
    if(splash) splash.remove();

    function create(tag,className,text){var node=document.createElement(tag);if(className) node.className=className;if(text!==undefined) node.textContent=text;return node;}
    var accountManagerTile=document.querySelector(".primary-tile.account-admin");
    if(accountManagerTile) accountManagerTile.remove();

    var modal=null;
    function ensureAuthModal(){
        if(modal) return modal;
        modal=create("div","nx-v206-auth-modal");
        modal.id="nxV206AuthModal";
        modal.setAttribute("aria-hidden","true");
        modal.innerHTML=
            '<div class="nx-v206-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="nxV206AuthTitle">'+
                '<aside class="nx-v206-auth-side"><div class="nx-v206-auth-mark">N</div><span>Nexu Konto</span><h2 id="nxV206AuthTitle">Geschützte Bereiche freischalten.</h2><p>Die Startseite bleibt öffentlich. Nach der Anmeldung werden Übersicht und freigegebene Steuerfunktionen verfügbar. Deine Anmeldung bleibt auf diesem Gerät gespeichert, bis du dich abmeldest.</p></aside>'+
                '<main class="nx-v206-auth-main"><button class="nx-v206-auth-close" type="button" aria-label="Schließen">×</button>'+
                    '<div class="nx-v206-auth-tabs" role="tablist"><button class="nx-v206-auth-tab active" type="button" data-mode="login">ANMELDEN</button><button class="nx-v206-auth-tab" type="button" data-mode="register">REGISTRIEREN</button></div>'+
                    '<form class="nx-v206-auth-form active" data-form="login" method="post" action="/login" autocomplete="on"><h3>Willkommen zurück</h3><p>Melde dich mit deinem Nexu-Konto an.</p><div class="nx-v206-auth-field"><label for="nxV206LoginUsername">Benutzername</label><input id="nxV206LoginUsername" name="username" type="text" maxlength="80" autocomplete="username" required></div><div class="nx-v206-auth-field"><label for="nxV206LoginPassword">Passwort</label><input id="nxV206LoginPassword" name="password" type="password" maxlength="200" autocomplete="current-password" required></div><button class="nx-v206-auth-submit" type="submit">ANMELDEN</button><div class="nx-v206-auth-foot"><i></i><span>Die Anmeldung wird automatisch für dieses Gerät gespeichert.</span></div></form>'+
                    '<form class="nx-v206-auth-form" data-form="register" method="post" action="/register/request" autocomplete="on"><h3>Konto erstellen</h3><p>Erstelle direkt dein persönliches Nexu-Konto.</p><div class="nx-v206-auth-field"><label for="nxV206RegisterUsername">Benutzername</label><input id="nxV206RegisterUsername" name="username" type="text" maxlength="80" autocomplete="username" required></div><div class="nx-v206-auth-field"><label for="nxV206RegisterRobloxUserId">Roblox User-ID</label><input id="nxV206RegisterRobloxUserId" name="robloxUserId" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="30" placeholder="z. B. 10199760908" required></div><div class="nx-v206-auth-field"><label for="nxV206RegisterPassword">Passwort</label><input id="nxV206RegisterPassword" name="password" type="password" minlength="8" maxlength="200" autocomplete="new-password" required></div><div class="nx-v206-auth-field"><label for="nxV206RegisterConfirm">Passwort bestätigen</label><input id="nxV206RegisterConfirm" name="confirmPassword" type="password" minlength="8" maxlength="200" autocomplete="new-password" required></div><button class="nx-v206-auth-submit" type="submit">KONTO ERSTELLEN</button><div class="nx-v206-auth-foot"><i></i><span>Die Roblox-ID wird geprüft und eindeutig mit diesem Konto verbunden.</span></div></form>'+
                '</main></div>';
        document.body.appendChild(modal);
        var tabs=Array.prototype.slice.call(modal.querySelectorAll(".nx-v206-auth-tab"));
        var forms=Array.prototype.slice.call(modal.querySelectorAll(".nx-v206-auth-form"));
        function setMode(mode){
            mode=mode==="register"?"register":"login";
            tabs.forEach(function(tab){tab.classList.toggle("active",tab.dataset.mode===mode);});
            forms.forEach(function(form){form.classList.toggle("active",form.dataset.form===mode);});
            var input=modal.querySelector(mode==="register"?"#nxV206RegisterUsername":"#nxV206LoginUsername");
            setTimeout(function(){if(input) input.focus();},40);
        }
        modal.setMode=setMode;
        tabs.forEach(function(tab){tab.addEventListener("click",function(){setMode(tab.dataset.mode);});});
        modal.querySelector(".nx-v206-auth-close").addEventListener("click",closeAuth);
        modal.addEventListener("click",function(event){if(event.target===modal) closeAuth();});
        return modal;
    }
    function openAuth(mode){var dialog=ensureAuthModal();dialog.setMode(mode||"login");dialog.classList.add("open");dialog.setAttribute("aria-hidden","false");document.documentElement.style.overflow="hidden";}
    function closeAuth(){if(!modal) return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.documentElement.style.overflow="";}

    if(isGuest){
        var account=document.getElementById("account");
        var header=account&&account.parentNode;
        var actions=create("div","nx-v206-auth-actions");
        actions.innerHTML='<button class="nx-v206-auth-button" type="button" data-auth="login">ANMELDEN</button><button class="nx-v206-auth-button primary" type="button" data-auth="register">REGISTRIEREN</button>';
        if(header){header.insertBefore(actions,account);account.remove();}
        actions.querySelectorAll("[data-auth]").forEach(function(button){button.addEventListener("click",function(){openAuth(button.dataset.auth);});});
        var locked=document.querySelector(".primary-tile.menu-server.locked");
        if(locked){
            locked.setAttribute("role","button");locked.setAttribute("tabindex","0");locked.setAttribute("aria-label","Anmelden, um die Serverübersicht zu öffnen");
            locked.addEventListener("click",function(){openAuth("login");});
            locked.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();openAuth("login");}});
        }
    }else if(isOwner){
        var menu=document.querySelector("#account .account-menu");
        var logoutForm=menu&&menu.querySelector(".menu-item-form");
        if(menu&&!menu.querySelector(".nx-v206-owner-link")){
            var ownerLink=create("a","menu-item nx-v206-owner-link");ownerLink.href="/accounts";ownerLink.innerHTML='Owner-Verwaltung <span>›</span>';menu.insertBefore(ownerLink,logoutForm||null);
        }
    }
    if(initialMode==="login"||initialMode==="register") openAuth(initialMode);
    document.addEventListener("keydown",function(event){if(event.key==="Escape") closeAuth();});
})();
</script>`;
}

homeHtml = function(notice = "", error = "", account = null, options = {}) {
    const isGuest = !account || !cleanDashboardUsername(account.username);
    const effectiveAccount = isGuest ? nexuV206GuestAccount() : account;
    const isOwner = !isGuest && isOwnerDashboardAccount(effectiveAccount);
    const authMode = options && (options.authMode === "register" ? "register" : options.authMode === "login" ? "login" : "");
    let html = NEXU_V206_BASE_HOME_HTML(notice, error, effectiveAccount);
    html = html.replace(nexuV200StartupHtml(), "");
    html = html.replace(/\bnx-booting\b/g, "");
    html = html.replace(/<a class="primary-tile account-admin"[\s\S]*?<\/a>/i, "");
    html = html.replace(/<body([^>]*)>/i, function(match, attributes) {
        let next = attributes || "";
        const classes = `nx-v206-direct${isGuest ? " nx-v206-guest" : " nx-v206-authenticated"}`;
        if (/\bclass\s*=\s*"[^"]*"/i.test(next)) {
            next = next.replace(/\bclass\s*=\s*"([^"]*)"/i, function(_, current) {return `class="${current} ${classes}"`;});
        } else next += ` class="${classes}"`;
        return `<body${next}>`;
    });
    html = html.replace("</style>", nexuV206HomeCss() + "</style>");
    html = html.replace("</body>", nexuV206HomeScript(isGuest, isOwner, authMode) + "</body>");
    return html;
};


loadBans();loadKnownPlayers();loadDashboardAccount();loadRememberedDashboardDevices();loadMenuUpdateState();loadMenuAvailabilityState();
const githubStorageStartupPromise = Promise.all([loadGitHubStorage(), loadGitHubAccounts()]).then(() => { refreshDashboardAccountRobloxIdentities().catch((error) => console.warn("[NEXU] Roblox-Verknüpfungen konnten nicht vollständig aktualisiert werden:", error.message)); syncPresenceRevision(); console.log("[NEXU] Gespeicherte Spieler und Accounts geladen; Roblox-Verknüpfungen werden aktualisiert; Online-Status wartet auf echte Heartbeats"); }).catch((error) => { syncPresenceRevision(); console.warn("[NEXU] GitHub-Startspeicher fehlgeschlagen:", error.message); });


/* --------------------------------------------------------------------------
 * NEXU V213 // WEBSITE GLOBAL CHAT
 * Globaler Chat als vierte Liste der Übersicht. Der geschützte OwnerAccount
 * schreibt mit der echten Roblox-Identität 10199760908.
 * -------------------------------------------------------------------------- */

const NEXU_V213_BASE_OVERVIEW_HTML = dashboardHtml;

function nexuV213OverviewChatCss() {
    return String.raw`
.page-dashboard .nx-web-chat-panel{min-height:560px;}
.nx-web-chat-shell{display:grid;grid-template-rows:auto minmax(330px,1fr) auto;gap:14px;min-height:540px;}
.nx-web-chat-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid rgba(108,223,255,.12);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));}
.nx-web-chat-head h2{margin:3px 0 0;font-size:20px;}
.nx-web-chat-state{display:inline-flex;align-items:center;gap:8px;color:#8faabd;font-size:11px;font-weight:850;letter-spacing:.07em;text-transform:uppercase;}
.nx-web-chat-state::before{content:"";width:8px;height:8px;border-radius:50%;background:#2dffa5;box-shadow:0 0 14px rgba(45,255,165,.55);}
.nx-web-chat-state.error::before{background:#ff4d78;box-shadow:0 0 14px rgba(255,77,120,.55);}
.nx-web-chat-messages{min-height:330px;max-height:560px;overflow:auto;display:flex;flex-direction:column;gap:11px;padding:18px;border:1px solid rgba(108,223,255,.12);border-radius:20px;background:linear-gradient(180deg,rgba(2,8,15,.7),rgba(4,10,18,.58));scrollbar-gutter:stable;}
.nx-web-chat-empty{margin:auto;color:#69889d;font-size:13px;text-align:center;line-height:1.6;}
.nx-web-chat-row{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:start;gap:10px;max-width:min(760px,86%);}
.nx-web-chat-row.own{align-self:flex-end;grid-template-columns:minmax(0,1fr) 42px;}
.nx-web-chat-row.own .nx-web-chat-avatar{grid-column:2;}
.nx-web-chat-row.own .nx-web-chat-bubble{grid-column:1;grid-row:1;}
.nx-web-chat-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;border:1px solid rgba(0,200,255,.34);background:#07111d;box-shadow:0 8px 22px rgba(0,0,0,.25);}
.nx-web-chat-bubble{min-width:0;padding:11px 13px 12px;border:1px solid rgba(108,223,255,.15);border-radius:6px 17px 17px 17px;background:linear-gradient(180deg,rgba(13,24,39,.94),rgba(8,16,28,.9));box-shadow:0 12px 28px rgba(0,0,0,.18);}
.nx-web-chat-row.own .nx-web-chat-bubble{border-radius:17px 6px 17px 17px;border-color:rgba(111,70,255,.28);background:linear-gradient(180deg,rgba(24,23,54,.94),rgba(12,19,37,.92));}
.nx-web-chat-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;}
.nx-web-chat-name{min-width:0;color:#dff7ff;font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.nx-web-chat-name small{color:#7895aa;font-size:10px;font-weight:700;}
.nx-web-chat-time{flex:0 0 auto;color:#617e92;font-size:9px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;}
.nx-web-chat-text{color:#dcecf5;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text !important;-webkit-user-select:text !important;}
.nx-web-chat-composer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:12px;border:1px solid rgba(108,223,255,.13);border-radius:18px;background:linear-gradient(180deg,rgba(10,17,29,.9),rgba(6,13,23,.82));}
.nx-web-chat-input-wrap{position:relative;min-width:0;}
.nx-web-chat-input{width:100%;min-height:48px;max-height:130px;resize:vertical;padding:13px 66px 11px 14px;border:1px solid rgba(108,223,255,.18);border-radius:14px;outline:none;color:#e6f5fc;background:rgba(2,8,15,.76);font:inherit;font-size:13px;line-height:1.45;}
.nx-web-chat-input:focus{border-color:rgba(0,200,255,.55);box-shadow:0 0 0 3px rgba(0,200,255,.08);}
.nx-web-chat-count{position:absolute;right:11px;bottom:9px;color:#66859a;font-size:9px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;}
.nx-web-chat-send{min-width:118px;min-height:48px;border-color:rgba(0,200,255,.34)!important;color:#b8efff!important;background:linear-gradient(135deg,rgba(0,200,255,.18),rgba(111,70,255,.16))!important;}
.nx-web-chat-send:disabled,.nx-web-chat-input:disabled{opacity:.5;cursor:not-allowed;}
.nx-web-chat-owner-note{grid-column:1/-1;margin:0;color:#7895aa;font-size:10px;line-height:1.45;}
@media(max-width:760px){.nx-web-chat-shell{min-height:480px}.nx-web-chat-head{align-items:flex-start;flex-direction:column}.nx-web-chat-messages{min-height:300px;max-height:460px;padding:12px}.nx-web-chat-row{max-width:96%}.nx-web-chat-composer{grid-template-columns:1fr}.nx-web-chat-send{width:100%}}
`;
}

function nexuV213OverviewChatScript(canSend, currentRobloxUserId) {
    const currentUserIdJson = JSON.stringify(cleanNumericId(currentRobloxUserId));
    const canSendJson = canSend === true ? "true" : "false";
    return String.raw`<script>
(function(){
    var CURRENT_ROBLOX_USER_ID=${currentUserIdJson};
    var canSend=${canSendJson};
    var panel=document.querySelector('[data-directory-panel="chat"]');
    var list=document.getElementById('websiteGlobalChatMessages');
    var input=document.getElementById('websiteGlobalChatInput');
    var sendButton=document.getElementById('websiteGlobalChatSend');
    var stateLabel=document.getElementById('websiteGlobalChatState');
    var countLabel=document.getElementById('websiteGlobalChatCount');
    var tabCount=document.getElementById('chatTabCount');
    if(!panel||!list||!input||!sendButton) return;

    var state={lastId:0,seen:new Set(),sending:false,polling:false,rows:0,resetToken:""};
    function setStatus(text,error){
        if(!stateLabel)return;
        stateLabel.textContent=String(text||'');
        stateLabel.classList.toggle('error',error===true);
    }
    function fallbackAvatar(userId){
        return 'https://www.roblox.com/headshot-thumbnail/image?userId='+encodeURIComponent(String(userId||0))+'&width=150&height=150&format=png';
    }
    function formatTime(value){
        var date=new Date(value||Date.now());
        if(Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    }
    function nearBottom(){return list.scrollHeight-list.scrollTop-list.clientHeight<90;}
    function scrollBottom(){requestAnimationFrame(function(){list.scrollTop=list.scrollHeight;});}
    function removeEmpty(){var empty=list.querySelector('.nx-web-chat-empty');if(empty)empty.remove();}
    function resetChatView(resetToken){
        state.resetToken=String(resetToken||'');
        state.lastId=0;state.seen.clear();state.rows=0;
        list.replaceChildren();
        var empty=document.createElement('div');empty.className='nx-web-chat-empty';empty.innerHTML='Noch keine Nachrichten vorhanden.<br>Der Chat wird täglich um 00:00 Uhr geleert. Beleidigungen, Hassrede, Drohungen und sexuelle Inhalte werden automatisch vollständig zensiert.';list.appendChild(empty);
        if(tabCount)tabCount.textContent='0';
    }
    function appendMessage(entry){
        if(!entry||!entry.id||state.seen.has(String(entry.id)))return;
        var keepBottom=nearBottom();
        state.seen.add(String(entry.id));
        state.lastId=Math.max(state.lastId,Number(entry.id)||0);
        state.rows+=1;
        removeEmpty();

        var own=String(entry.userId||'')===String(CURRENT_ROBLOX_USER_ID);
        var row=document.createElement('article');
        row.className='nx-web-chat-row'+(own?' own':'');
        row.dataset.messageId=String(entry.id);
        var avatar=document.createElement('img');
        avatar.className='nx-web-chat-avatar';
        avatar.alt='';
        avatar.loading='lazy';
        avatar.referrerPolicy='no-referrer';
        avatar.src=String(entry.avatarUrl||fallbackAvatar(entry.userId));
        avatar.addEventListener('error',function(){if(avatar.src!==fallbackAvatar(entry.userId))avatar.src=fallbackAvatar(entry.userId);},{once:true});

        var bubble=document.createElement('div');
        bubble.className='nx-web-chat-bubble';
        var meta=document.createElement('div');
        meta.className='nx-web-chat-meta';
        var name=document.createElement('div');
        name.className='nx-web-chat-name';
        name.textContent=String(entry.displayName||entry.username||('User '+entry.userId));
        var username=document.createElement('small');
        username.textContent='  @'+String(entry.username||entry.displayName||entry.userId||'');
        name.appendChild(username);
        var time=document.createElement('time');
        time.className='nx-web-chat-time';
        time.textContent=formatTime(entry.sentAt);
        var message=document.createElement('div');
        message.className='nx-web-chat-text';
        message.textContent=String(entry.message||'');
        meta.append(name,time);
        bubble.append(meta,message);
        row.append(avatar,bubble);
        list.appendChild(row);
        if(tabCount)tabCount.textContent=String(state.rows);
        if(keepBottom)scrollBottom();
    }
    function consume(payload){
        var incomingResetToken=String(payload&&payload.chatResetToken||'');
        if(incomingResetToken&&state.resetToken&&incomingResetToken!==state.resetToken)resetChatView(incomingResetToken);
        else if(incomingResetToken&&!state.resetToken)state.resetToken=incomingResetToken;
        (Array.isArray(payload&&payload.messages)?payload.messages:[]).forEach(appendMessage);
        if(payload&&payload.chatMessage)appendMessage(payload.chatMessage);
        state.lastId=Math.max(state.lastId,Number(payload&&payload.latestId)||0);
        if(payload&&Object.prototype.hasOwnProperty.call(payload,'currentRobloxUserId')){CURRENT_ROBLOX_USER_ID=String(payload.currentRobloxUserId||'');}
        if(payload&&typeof payload.canSend==='boolean'){
            canSend=payload.canSend;
            input.disabled=!canSend;
            sendButton.disabled=!canSend;
        }
    }
    async function poll(){
        if(state.polling)return;
        state.polling=true;
        try{
            var response=await fetch('/api/chat/poll',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({afterId:state.lastId})});
            var payload=await response.json().catch(function(){return {};});
            if(!response.ok||payload.success===false)throw new Error(payload.error||('HTTP '+response.status));
            consume(payload);
            setStatus('Live verbunden',false);
        }catch(error){setStatus(error&&error.message?error.message:'Chat nicht erreichbar',true);}
        finally{state.polling=false;}
    }
    async function send(){
        if(!canSend||state.sending)return;
        var message=String(input.value||'').trim().slice(0,300);
        if(!message)return;
        state.sending=true;sendButton.disabled=true;setStatus('Wird gesendet …',false);
        try{
            var response=await fetch('/api/chat/send',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:message})});
            var payload=await response.json().catch(function(){return {};});
            if(!response.ok||payload.success===false)throw new Error(payload.error||('HTTP '+response.status));
            input.value='';updateCount();consume(payload);scrollBottom();setStatus('Gesendet',false);
        }catch(error){setStatus(error&&error.message?error.message:'Senden fehlgeschlagen',true);}
        finally{state.sending=false;sendButton.disabled=!canSend;}
    }
    function updateCount(){if(countLabel)countLabel.textContent=String(input.value.length)+' / 300';}
    input.maxLength=300;
    input.disabled=!canSend;
    sendButton.disabled=!canSend;
    input.addEventListener('input',updateCount);
    input.addEventListener('keydown',function(event){if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send();}});
    sendButton.addEventListener('click',send);
    updateCount();poll();setInterval(poll,2400);
})();
</script>`;
}

dashboardHtml = function(account = null, notice = "") {
    let html = NEXU_V213_BASE_OVERVIEW_HTML(account, notice);
    const currentRobloxUserId = cleanNumericId(account && account.robloxUserId);
    const canSend = Boolean(currentRobloxUserId && canAccessMenuServer(account));

    html = html.replace(
        '<button class="directory-tab" type="button" data-directory-tab="banned" role="tab" aria-selected="false">Gesperrt <b id="bannedTabCount">0</b></button>',
        '<button class="directory-tab" type="button" data-directory-tab="banned" role="tab" aria-selected="false">Gesperrt <b id="bannedTabCount">0</b></button><button class="directory-tab" type="button" data-directory-tab="chat" role="tab" aria-selected="false">Chat <b id="chatTabCount">0</b></button>'
    );

    const bannedPanelEnd = '<div id="bannedPlayers" class="players"></div><div id="bannedFooter" class="footer-note"></div>\n    </div>\n</section>';
    const chatPanel = `<div id="bannedPlayers" class="players"></div><div id="bannedFooter" class="footer-note"></div>
    </div>
    <div class="directory-panel hidden nx-web-chat-panel" data-directory-panel="chat" role="tabpanel">
        <div class="nx-web-chat-shell">
            <div class="nx-web-chat-head"><div><div class="eyebrow">NEXU // GLOBALER CHAT</div><h2>Chat für alle Nexu-Nutzer</h2></div><div id="websiteGlobalChatState" class="nx-web-chat-state">Verbindung wird hergestellt</div></div>
            <div id="websiteGlobalChatMessages" class="nx-web-chat-messages" aria-live="polite"><div class="nx-web-chat-empty">Noch keine Nachrichten vorhanden.<br>Schreibe die erste Nachricht aus der Übersicht oder dem Lua-Menü.</div></div>
            <div class="nx-web-chat-composer">
                <div class="nx-web-chat-input-wrap"><textarea id="websiteGlobalChatInput" class="nx-web-chat-input" maxlength="300" placeholder="Nachricht an alle Nexu-Nutzer schreiben …"></textarea><span id="websiteGlobalChatCount" class="nx-web-chat-count">0 / 300</span></div>
                <button id="websiteGlobalChatSend" class="nx-web-chat-send" type="button">ABSENDEN</button>
                <p class="nx-web-chat-owner-note">${canSend ? 'Du schreibst als der mit diesem Website-Konto verbundene Roblox-Account. Enter sendet, Shift + Enter erzeugt eine neue Zeile.' : 'Lesemodus: Dieses Website-Konto benötigt eine Roblox-Verknüpfung und Zugriff auf die Übersicht.'}</p>
            </div>
        </div>
    </div>
</section>`;
    html = html.replace(bannedPanelEnd, chatPanel);
    html = html.replace('["online","offline","banned"].includes(name)', '["online","offline","banned","chat"].includes(name)');
    html = html.replace('</style>', nexuV213OverviewChatCss() + '</style>');
    html = html.replace('</body>', nexuV213OverviewChatScript(canSend, currentRobloxUserId) + '</body>');
    return html;
};

const server = http.createServer(async (req, res) => {const requestUrl = new URL(req.url, "http://localhost");const pathname = requestUrl.pathname;

if (req.method === "GET" && pathname === "/") {
    const session = getDashboardSession(req);
    const message = requestUrl.searchParams.get("settings") === "updated"
        ? "Kontoeinstellungen wurden gespeichert."
        : requestUrl.searchParams.get("account") === "deleted"
            ? "Konto wurde gelöscht."
            : requestUrl.searchParams.get("logout") === "1"
                ? "Du wurdest erfolgreich abgemeldet."
                : "";
    const authMode = requestUrl.searchParams.get("auth") === "register" ? "register"
        : requestUrl.searchParams.get("auth") === "login" ? "login" : "";
    sendHtml(res, 200, homeHtml(message, "", session && session.account, { authMode }));
    return;
}

if (req.method === "GET" && pathname === "/login") {
    redirect(res, isDashboardAuthenticated(req) ? "/" : "/?auth=login");
    return;
}

if (req.method === "GET" && pathname === "/register") {
    redirect(res, isDashboardAuthenticated(req) ? "/" : "/?auth=register");
    return;
}

if (req.method === "GET" && (pathname === "/menu-server" || pathname === "/uebersicht")) {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/?auth=login");
        return;
    }
    if (!canAccessMenuServer(session.account)) {
        sendHtml(res, 403, homeHtml("", "Der Zugriff auf die Serverübersicht ist für dieses Konto nicht freigegeben.", session.account));
        return;
    }
    console.log("[NEXU] Serverübersicht aufgerufen");
    const clearedPlayerCount = cleanInteger(requestUrl.searchParams.get("count"));
    const updateNotice = requestUrl.searchParams.get("players") === "cleared"
        ? (clearedPlayerCount === 1
            ? "1 gespeicherter Spieler wurde entfernt. Die Übersicht wurde aktualisiert."
            : `${clearedPlayerCount} gespeicherte Spieler wurden entfernt. Die Übersicht wurde aktualisiert.`)
        : requestUrl.searchParams.get("update") === "cancelled"
            ? "Das Skript-Aktualisierung wurde beendet. Alle Spieler können das Menü wieder starten."
            : requestUrl.searchParams.get("update") === "already-inactive"
                ? "Der Aktualisierungsmodus war bereits beendet."
                : "";
    sendHtml(res, 200, dashboardHtml(session.account, updateNotice));
    return;
}

if (req.method === "POST" && pathname === "/menu-server/update/cancel") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/?auth=login");
        return;
    }
    if (!hasDashboardPermission(session.account, "updateScript")) {
        sendHtml(res, 403, homeHtml("", dashboardPermissionError("updateScript"), session.account));
        return;
    }
    const result = cancelMenuUpdate();
    console.log(`[NEXU] Skript-Aktualisierung ${result.wasActive ? "über Dashboard-Formular beendet" : "war bereits inaktiv"}: ${session.username}`);
    redirect(res, result.wasActive ? "/uebersicht?update=cancelled" : "/uebersicht?update=already-inactive");
    return;
}

if (req.method === "GET" && pathname === "/accounts") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/?auth=login");
        return;
    }
    if (!canManageDashboardAccounts(session.account)) {
        sendHtml(res, 403, homeHtml("", "Kontoverwaltung ist nur für OwnerAccount freigegeben.", session.account));
        return;
    }
    const notice = requestUrl.searchParams.get("updated") === "1"
        ? "Account wurde gespeichert."
        : requestUrl.searchParams.get("deleted") === "1"
            ? "Konto wurde gelöscht."
            : "";
    sendHtml(res, 200, dashboardAccountsHtml(notice, "", session.account));
    return;
}

if (req.method === "POST" && pathname === "/accounts/update") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/?auth=login");
        return;
    }
    if (!canManageDashboardAccounts(session.account)) {
        sendHtml(res, 403, homeHtml("", "Kontoverwaltung ist nur für OwnerAccount freigegeben.", session.account));
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
        const nextRobloxUserId = cleanNumericId(form.robloxUserId);
        if (!nextRobloxUserId) {
            sendHtml(res, 400, dashboardAccountsHtml("", "Eine gültige Roblox User-ID ist erforderlich.", session.account));
            return;
        }
        if (dashboardRobloxUserIdExists(nextRobloxUserId, target.email)) {
            sendHtml(res, 409, dashboardAccountsHtml("", "Diese Roblox User-ID ist bereits mit einem anderen Website-Konto verbunden.", session.account));
            return;
        }
        let robloxIdentity;
        try {
            robloxIdentity = await verifyDashboardRobloxIdentity(nextRobloxUserId);
        } catch (error) {
            sendHtml(res, 503, dashboardAccountsHtml("", "Die Roblox-ID konnte gerade nicht überprüft werden. Bitte später erneut versuchen.", session.account));
            return;
        }
        if (!robloxIdentity) {
            sendHtml(res, 400, dashboardAccountsHtml("", "Unter dieser Roblox User-ID wurde kein Benutzer gefunden.", session.account));
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
            robloxUserId: robloxIdentity.userId,
            robloxUsername: robloxIdentity.username,
            robloxDisplayName: robloxIdentity.displayName,
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
                    shutdownScript: dashboardAccessEnabled && (form.dashboardShutdownScript === "1" || form.dashboardShutdownScript === "on"),
                    menuStatus: dashboardAccessEnabled && (form.dashboardMenuStatus === "1" || form.dashboardMenuStatus === "on"),
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
        redirect(res, "/?auth=login");
        return;
    }
    if (!canManageDashboardAccounts(session.account)) {
        sendHtml(res, 403, homeHtml("", "Kontoverwaltung ist nur für OwnerAccount freigegeben.", session.account));
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
            sendHtml(res, 429, homeHtml("", "Zu viele Anmeldeversuche. Bitte später erneut versuchen.", null, { authMode: "login" }));
            return;
        }
        const form = await readFormBody(req);
        const username = cleanDashboardUsername(form.username || form.email);
        const password = String(form.password || "");
        const account = getDashboardAccountByUsername(username);
        const validLogin = Boolean(account && validDashboardAccountPassword(account, password));
        if (!validLogin) {
            console.warn("[NEXU] Fehlgeschlagene Anmeldung von", getClientIp(req));
            sendHtml(res, 401, homeHtml("", "Benutzername oder Passwort ist falsch.", null, { authMode: "login" }));
            return;
        }
        clearLoginAttempts(req);
        const token = createDashboardSession(account);
        const rememberToken = createRememberedDashboardDevice(account);
        console.log("[NEXU] Konto erfolgreich angemeldet");
        redirect(res, "/", {"Set-Cookie": [
            dashboardCookie(req, token, DASHBOARD_SESSION_TTL_MS / 1000),
            dashboardRememberCookie(req, rememberCookieValueWithNewToken(req, rememberToken), DASHBOARD_REMEMBER_TTL_MS / 1000),
        ]});
    } catch (error) {
        const message = error.message === "BODY_TOO_LARGE" ? "Anmeldedaten sind zu groß." : "Anmeldung konnte nicht verarbeitet werden.";
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, homeHtml("", message, null, { authMode: "login" }));
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
        redirect(res, "/?auth=login", {
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
    redirect(res, "/?auth=login", {
        "Set-Cookie": [
            dashboardCookie(req, "", 0),
            dashboardRememberCookie(req, nextRememberValue, nextRememberValue ? DASHBOARD_REMEMBER_TTL_MS / 1000 : 0),
        ],
    });
    return;
}

if (req.method === "POST" && pathname === "/logout") {
    removeDashboardSession(req);
    removeRememberedDashboardDevice(req);
    redirect(res, "/?logout=1", {"Set-Cookie": [
        dashboardCookie(req, "", 0),
        dashboardRememberCookie(req, "", 0),
    ]});
    return;
}


if (req.method === "POST" && pathname === "/account/settings") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        redirect(res, "/?auth=login");
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
        redirect(res, "/?auth=login");
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
        redirect(res, "/?account=deleted", {
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
            sendHtml(res, 429, homeHtml("", "Zu viele Registrierungsversuche. Bitte später erneut versuchen.", null, { authMode: "register" }));
            return;
        }
        const form = await readFormBody(req);
        const username = cleanDashboardUsername(form.username);
        const robloxUserId = cleanNumericId(form.robloxUserId);
        const password = String(form.password || "");
        const confirmPassword = String(form.confirmPassword || "");
        if (!username) {sendHtml(res, 400, homeHtml("", "Benutzername ungültig. Erlaubt sind 3–80 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich, @ und -.", null, { authMode: "register" }));return;}
        if (dashboardUsernameExists(username)) {sendHtml(res, 409, homeHtml("", "Dieser Benutzername ist bereits vergeben.", null, { authMode: "register" }));return;}
        if (!robloxUserId) {sendHtml(res, 400, homeHtml("", "Eine gültige Roblox User-ID ist erforderlich.", null, { authMode: "register" }));return;}
        if (dashboardRobloxUserIdExists(robloxUserId)) {sendHtml(res, 409, homeHtml("", "Diese Roblox User-ID ist bereits mit einem anderen Website-Konto verbunden.", null, { authMode: "register" }));return;}
        if (password.length < 8) {sendHtml(res, 400, homeHtml("", "Das Passwort muss mindestens 8 Zeichen haben.", null, { authMode: "register" }));return;}
        if (password !== confirmPassword) {sendHtml(res, 400, homeHtml("", "Passwörter stimmen nicht überein.", null, { authMode: "register" }));return;}
        let robloxIdentity;
        try {
            robloxIdentity = await verifyDashboardRobloxIdentity(robloxUserId);
        } catch (error) {
            sendHtml(res, 503, homeHtml("", "Die Roblox-ID konnte gerade nicht überprüft werden. Bitte später erneut versuchen.", null, { authMode: "register" }));
            return;
        }
        if (!robloxIdentity) {sendHtml(res, 400, homeHtml("", "Unter dieser Roblox User-ID wurde kein Benutzer gefunden.", null, { authMode: "register" }));return;}
        const account = putDashboardAccount({username,email: internalDashboardEmailForUsername(username),passwordHash: sha256Hex(password),robloxUserId:robloxIdentity.userId,robloxUsername:robloxIdentity.username,robloxDisplayName:robloxIdentity.displayName,createdAt: new Date().toISOString(),updatedAt: new Date().toISOString()});
        if (!account || !saveDashboardAccount()) {sendHtml(res, 500, homeHtml("", "Konto konnte nicht gespeichert werden.", null, { authMode: "register" }));return;}
        clearLoginAttempts(req);
        const token = createDashboardSession(account);
        const rememberToken = createRememberedDashboardDevice(account);
        redirect(res, "/", {"Set-Cookie": [
            dashboardCookie(req, token, DASHBOARD_SESSION_TTL_MS / 1000),
            dashboardRememberCookie(req, rememberCookieValueWithNewToken(req, rememberToken), DASHBOARD_REMEMBER_TTL_MS / 1000),
        ]});
    } catch (error) {
        const message = error.message === "BODY_TOO_LARGE" ? "Registrierungsdaten sind zu groß." : "Registrierung konnte nicht verarbeitet werden.";
        sendHtml(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, homeHtml("", message, null, { authMode: "register" }));
    }
    return;
}

if (req.method === "POST" && pathname === "/register/verify") {
    redirect(res, "/?auth=login");
    return;
}



if (req.method === "GET" && pathname === "/api/uebersicht/runtime") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        sendJson(res, 401, { success: false, error: "Anmeldung erforderlich" });
        return;
    }
    if (!canAccessMenuServer(session.account)) {
        sendJson(res, 403, { success: false, error: "Zugriff auf die Übersicht nicht freigegeben" });
        return;
    }
    sendJson(res, 200, {
        success: true,
        runtime: buildNexuOverviewRuntimeSnapshot(),
    });
    return;
}

if (req.method === "POST" && pathname === "/api/admin/players/clear") {
    const session = getDashboardSession(req);
    if (!session || !session.account) {
        sendJson(res, 401, { success: false, error: "Anmeldung erforderlich" });
        return;
    }
    if (!isOwnerDashboardAccount(session.account)) {
        sendJson(res, 403, {
            success: false,
            error: "Gespeicherte Spieler dürfen nur vom OwnerAccount entfernt werden.",
        });
        return;
    }

    await githubStorageStartupPromise;
    const result = await clearStoredKnownPlayers();
    if (result.success !== true) {
        sendJson(res, 502, result);
        return;
    }

    console.log(`[NEXU] Spielerspeicher durch ${session.username || OWNER_ACCOUNT_USERNAME} geleert (${result.removedCount} entfernt).`);
    sendJson(res, 200, result);
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
            sendJson(res, 409, {success:false,error:"Der Update-Start wurde verworfen, weil der Aktualisierungsmodus inzwischen beendet oder geändert wurde."});
            return;
        }
        const result = startMenuUpdate(body.durationMinutes, session.username);
        if (result.error) {
            sendJson(res, 400, {success:false,error:result.error});
            return;
        }
        console.log(`[NEXU] Skript-Aktualisierung gestartet: ${result.status.durationMinutes} Minuten von ${session.username}`);
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
    console.log(`[NEXU] Skript-Aktualisierung ${result.wasActive ? "vorzeitig beendet" : "war bereits inaktiv"}: ${session.username}`);
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
        // So bleibt die Website nach „ALLE SKRIPTE AUS“ sofort offline und ein
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
        removeSharedGhostState(userId, sessionId);

        sendJson(res, 200, { success: true, removed, snapshotToken: getPresenceSnapshotToken() });
    } catch {
        sendJson(res, 400, {
            success: false,
            error: "Ungültiges JSON",
        });
    }
    return;
}



if (req.method === "POST" && pathname === "/api/ghost/sync") {
    if (!isHeartbeatAuthorized(req)) {
        sendJson(res, 401, { success: false, error: "Ungültiger Heartbeat-Token" });
        return;
    }
    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const sessionId = cleanText(body.sessionId, 120);
        if (!userId || !sessionId) {
            sendJson(res, 400, { success: false, error: "Ungültige Geist-Sitzung" });
            return;
        }
        if (bans.has(userId)) {
            removeSharedGhostState(userId, sessionId);
            sendJson(res, 403, { success: false, error: "Der Spieler ist vom Menü gebannt." });
            return;
        }
        const live = findActivePresenceSession(userId, sessionId);
        if (!live) {
            removeSharedGhostState(userId, sessionId);
            sendJson(res, 409, { success: false, error: "Die Nexu-Sitzung ist nicht mehr online." });
            return;
        }
        const now = Date.now();
        if (!allowSharedGhostSync(userId, sessionId, now)) {
            sendJson(res, 429, { success: false, error: "Geist-Synchronisierung zu schnell." });
            return;
        }

        let sharing = false;
        if (body.share === true) {
            sharing = Boolean(upsertSharedGhostState(live, body.state, now));
            if (!sharing) removeSharedGhostState(userId, sessionId);
        } else {
            const accepted = acceptSharedGhostSequence(
                userId,
                sessionId,
                body.sequence || (body.state && body.state.sequence),
                now
            );
            if (accepted) removeSharedGhostState(userId, sessionId);
        }

        const states = body.receive === false ? [] : getSharedGhostStatesForViewer(live, now);
        sendJson(res, 200, {
            success: true,
            sharing,
            states,
            ttlMs: GHOST_STATE_TTL_MS,
            historyLimit: GHOST_HISTORY_LIMIT,
            timestampMs: now,
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: error.message === "BODY_TOO_LARGE" ? "Anfrage zu groß" : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/ghost/stop") {
    if (!isHeartbeatAuthorized(req)) {
        sendJson(res, 401, { success: false, error: "Ungültiger Heartbeat-Token" });
        return;
    }
    try {
        const body = await readJsonBody(req);
        const userId = cleanNumericId(body.userId);
        const sessionId = cleanText(body.sessionId, 120);
        const accepted = acceptSharedGhostSequence(userId, sessionId, body.sequence, Date.now());
        const removed = accepted ? removeSharedGhostState(userId, sessionId) : 0;
        sendJson(res, 200, { success: true, removed });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: error.message === "BODY_TOO_LARGE" ? "Anfrage zu groß" : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/chat/send") {
    const websiteSession = getDashboardSession(req);
    const websiteIdentity = await getWebsiteChatIdentity(websiteSession);
    if (!websiteIdentity && !isHeartbeatAuthorized(req)) {
        sendJson(res, 401, { success: false, error: "Ungültiger Heartbeat-Token" });
        return;
    }
    try {
        const body = await readJsonBody(req);
        const message = cleanText(body.message, CHAT_MAX_LENGTH);
        let userId = cleanNumericId(body.userId);
        let sessionId = cleanText(body.sessionId, 120);
        let live = null;

        if (websiteIdentity) {
            userId = websiteIdentity.userId;
            const accountKey = cleanText(websiteSession && websiteSession.account && websiteSession.account.email, 120) || String(userId);
            sessionId = `website-${crypto.createHash("sha1").update(accountKey, "utf8").digest("hex").slice(0, 16)}`;
            live = {
                userId: websiteIdentity.userId,
                username: websiteIdentity.username,
                displayName: websiteIdentity.displayName,
                sessionId,
                lastSeenMs: Date.now(),
            };
        }

        if (!userId) {
            sendJson(res, 400, { success: false, error: "Ungültige User-ID" });
            return;
        }
        if (!message) {
            sendJson(res, 400, { success: false, error: "Nachricht fehlt" });
            return;
        }
        if (bans.has(userId)) {
            sendJson(res, 403, { success: false, error: "Der Spieler ist vom Menü gebannt." });
            return;
        }
        if (!live) live = findActivePresenceSession(userId, sessionId);
        if (!live) {
            sendJson(res, 409, { success: false, error: "Die Nexu-Sitzung ist nicht mehr online." });
            return;
        }
        if (!allowGlobalChatSend(userId)) {
            sendJson(res, 429, { success: false, error: "Zu viele Nachrichten. Bitte kurz warten." });
            return;
        }
        const chatMessage = queueGlobalChatMessage(live, message);
        if (!chatMessage) {
            sendJson(res, 400, { success: false, error: "Nachricht fehlt" });
            return;
        }
        await attachAvatarUrlsToChatMessages([chatMessage]);
        console.log(`[NEXU] CHAT ${userId}${websiteIdentity ? " (WEBSITE)" : ""}: ${chatMessage.moderated ? `[ZENSIERT:${chatMessage.moderationCategory || "INHALT"}]` : chatMessage.message.slice(0, 80)}`);
        sendJson(res, 200, {
            success: true,
            chatMessage,
            latestId: chatMessage.id,
            chatResetToken: getGlobalChatResetToken(),
            chatDayKey: globalChatDayKey,
            chatResetAtMs: globalChatResetAtMs,
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: error.message === "BODY_TOO_LARGE" ? "Anfrage zu groß" : "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/chat/poll") {
    const websiteSession = getDashboardSession(req);
    const websiteAllowed = Boolean(
        websiteSession &&
        (websiteSession.isOwner === true || canAccessMenuServer(websiteSession.account))
    );
    if (!websiteAllowed && !isHeartbeatAuthorized(req)) {
        sendJson(res, 401, { success: false, error: "Ungültiger Heartbeat-Token" });
        return;
    }
    try {
        const body = await readJsonBody(req);
        const afterId = Math.max(0, Number(body.afterId) || 0);

        if (!websiteAllowed) {
            const userId = cleanNumericId(body.userId);
            const sessionId = cleanText(body.sessionId, 120);
            if (!userId) {
                sendJson(res, 400, { success: false, error: "Ungültige User-ID" });
                return;
            }
            if (bans.has(userId)) {
                sendJson(res, 403, { success: false, error: "Der Spieler ist vom Menü gebannt." });
                return;
            }
            const live = findActivePresenceSession(userId, sessionId);
            if (!live) {
                sendJson(res, 409, { success: false, error: "Die Nexu-Sitzung ist nicht mehr online." });
                return;
            }
        }

        const messages = getGlobalChatMessages(afterId);
        await attachAvatarUrlsToChatMessages(messages);
        const latestId = globalChatMessages.length > 0
            ? Number(globalChatMessages[globalChatMessages.length - 1].id || 0)
            : 0;
        sendJson(res, 200, {
            success: true,
            messages,
            latestId,
            canSend: Boolean(websiteSession && cleanNumericId(websiteSession.account && websiteSession.account.robloxUserId) && canAccessMenuServer(websiteSession.account)),
            currentRobloxUserId: cleanNumericId(websiteSession && websiteSession.account && websiteSession.account.robloxUserId),
            chatResetToken: getGlobalChatResetToken(),
            chatDayKey: globalChatDayKey,
            chatResetAtMs: globalChatResetAtMs,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        sendJson(res, error.message === "BODY_TOO_LARGE" ? 413 : 400, {
            success: false,
            error: error.message === "BODY_TOO_LARGE" ? "Anfrage zu groß" : "Ungültiges JSON",
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
        const displaySeconds = normalizeDirectMessageDisplaySeconds(body.displaySeconds, null);
        if (!message) {
            sendJson(res, 400, {success:false, error:"Nachricht fehlt"});
            return;
        }
        if (displaySeconds === null) {
            sendJson(res, 400, {
                success:false,
                error:"Anzeigedauer muss zwischen 1 Sekunde und 10 Minuten liegen.",
            });
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
            const directMessage = queueDirectMessage(userId, message, "NEXU", displaySeconds);
            queued.push({userId, id:directMessage.id});
        }
        console.log(`[NEXU] RUNDSENDUNG an ${queued.length} aktive Spieler (${displaySeconds}s): ${message.slice(0, 60)}`);
        sendJson(res, 200, {
            success:true,
            queued:true,
            targetedPlayers:queued.length,
            message,
            displaySeconds,
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
                displaySeconds: directMessage.displaySeconds,
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

ensureGlobalChatDay();
scheduleGlobalChatMidnightReset();
setInterval(() => {prunePresence();pruneDirectMessages();pruneGlobalChat();pruneSharedGhostStates();pruneDashboardAuth();pruneShutdownCommands();}, 20_000).unref();

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
        console.log("NEXU PRESENCE & MODERATION V214 GESTARTET");
        console.log("Port:", PORT);
        console.log("Heartbeat-Schutz:", HEARTBEAT_TOKEN ? "AKTIV" : "AUS (Kompatibilitätsmodus)");
        console.log("Ban-Datei:", BAN_FILE_PATH);
        console.log("Spieler-Speicher:", KNOWN_PLAYERS_FILE_PATH);
        console.log("GitHub-Speicher:", isGitHubStorageConfigured() ? "AKTIV" : "NICHT KONFIGURIERT");
        console.log("GitHub-Datendatei:", `${GITHUB_DATA_OWNER}/${GITHUB_DATA_REPO}/${GITHUB_DATA_PATH}`);
        console.log("GitHub-Accountdatei:", `${GITHUB_DATA_OWNER}/${GITHUB_DATA_REPO}/${GITHUB_ACCOUNTS_PATH}`);
        console.log("Accountdatei-Verschlüsselung:", "AES-256-GCM");
        console.log("Dashboard-Anmeldung: /");
        console.log("Übersichts-Konten:", dashboardAccounts.size);
        console.log("Owner-Account vorhanden:", getOwnerDashboardAccount() ? "JA" : "NEIN");console.log("Owner-Rundsendung:", getOwnerDashboardAccount() && hasDashboardPermission(getOwnerDashboardAccount(), "dm") ? "FREIGEGEBEN" : "NICHT FREIGEGEBEN");console.log("Owner-Session-Fix:", "V148 SIGNIERT UND NEUSTARTFEST");
        console.log("Presence: /api/presence");
        console.log("Presence-Aufbewahrung:", Math.round(PRESENCE_ENTRY_RETENTION_MS / 1000), "Sekunden");
        console.log("Presence-Neustart-Schutz:", Math.round(PRESENCE_RESTART_GRACE_MS / 1000), "Sekunden");
        console.log("Direct Messages: /api/dm/send + /api/dm/broadcast + /api/dm/poll");
        console.log("Global Chat: /api/chat/send + /api/chat/poll");console.log("Chat-Tagesreset:", `00:00 ${CHAT_TIME_ZONE}`);console.log("Geteilte Geister: /api/ghost/sync + /api/ghost/stop");
        console.log("Website-Chat: ÜBERSICHT // VIERTER REITER // ACCOUNT-ROBLOX-ID VERKNÜPFUNG");
        console.log("Website Join: /api/join/send + /api/join/poll");
        console.log("Access: /api/menu/access?userId=...");
        console.log("Skript-Aktualisierung-Datei:", MENU_UPDATE_FILE_PATH);
        console.log("Menüstatus-Datei:", MENU_STATUS_FILE_PATH);
        console.log("Skript-Aktualisierung:", getMenuUpdateStatus().active ? "AKTIV" : "INAKTIV");
        console.log("Globales Deaktivieren: /api/admin/shutdown/all");console.log("Dashboard-Button-Fix: V156 ALLE SKRIPTE AUS SICHTBAR");console.log("Menüstatus: V162 PERSISTENT ONLINE/OFFLINE + STARTSPERRE");console.log("Dashboard-Aktionsfeedback: V163 EIGENE DIALOGE + TOASTS // KEINE BROWSER-POPUPS");console.log("Account-Persistenz: V164 SEPARATE VERSCHLÜSSELTE GITHUB-DATEI // CHANGE-ONLY");console.log("Design-Refresh: V165 MODERNE GLASS UI + VISUELLE AUFWERTUNG");console.log("Design-Refresh: V166 ULTRA MODERN HEADER + PREMIUM DASHBOARD VISUALS");console.log("Ingame-Moderation: V172 AKTIVE CREATOR-SESSION + BAN/UNBAN");console.log("Rang-Banner-Sync: V168 LIVE SNAPSHOT INVALIDATION + INGAME COLOR REFRESH");console.log("Rang-Auswahl: V167 SUCHBARES DROPDOWN AM AKTUELLEN RANG");console.log("Owner-Session-Fix: V148 SIGNIERT UND NEUSTARTFEST");console.log("Global-Shutdown-Fix: V149 SESSION-SNAPSHOT + SOFORT-OFFLINE");console.log("Presence-Abgleich: V154 STABILE USER-LEASE + RESTART-WARMUP");console.log("Persistenz: NUR NEUE/GEÄNDERTE IDENTITÄTEN // KEINE HEARTBEAT-SPEICHERUNG");console.log("GitHub-Deduplizierung: INHALTSHASH // KEIN COMMIT OHNE DATENÄNDERUNG");console.log("Dashboard-Ausfallschutz: LETZTEN SNAPSHOT BEHALTEN");console.log("Aktiv-Fenster:", Math.round(ACTIVE_PRESENCE_WINDOW_MS / 1000), "Sekunden");console.log("Server-Instanz:", SERVER_INSTANCE_ID);console.log("GitHub-Schreiben:", GITHUB_STORAGE_WRITES_ALLOWED ? "AKTIV AUF DATEN-BRANCH" : "GESPERRT AUF DEPLOY-BRANCH");
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
