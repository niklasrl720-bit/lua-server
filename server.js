const http = require("node:http");const fs = require("node:fs");const path = require("node:path");const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);const HEARTBEAT_TOKEN = String(process.env.HEARTBEAT_TOKEN || "");const ONLINE_TIMEOUT_MS = 75_000;const MAX_BODY_BYTES = 100_000;const AVATAR_CACHE_MS = 10 * 60_000;const MENU_CREATOR_USER_ID = "10199760908";const MENU_CREATOR_RANK_ENABLED = false;const SUPPORTER_USER_IDS = new Set(["11203703629"]);const BRING_COMMAND_TTL_MS = 2 * 60_000;const DM_MAX_LENGTH = 240;const DM_TTL_MS = 10 * 60_000;const DM_QUEUE_LIMIT = 12;const DM_RATE_WINDOW_MS = 30_000;const DM_RATE_LIMIT = 10;const DASHBOARD_USERNAME = String(process.env.DASHBOARD_USERNAME || "OwnerAccount");const DASHBOARD_PASSWORD_HASH = String(process.env.DASHBOARD_PASSWORD_HASH ||"df3b0f6227afa43d620dc1c5c639dab7036878674a3c7e699c9583be6425f2d8").toLowerCase();const DASHBOARD_SESSION_COOKIE = "nexu_dashboard_session";const DASHBOARD_REMEMBER_COOKIE = "nexu_dashboard_remember";const DASHBOARD_SESSION_TTL_MS = 12 * 60 * 60_000;const DASHBOARD_REMEMBER_TTL_MS = 30 * 24 * 60 * 60_000;const LOGIN_RATE_WINDOW_MS = 10 * 60_000;const LOGIN_RATE_LIMIT = 8;const JOIN_COMMAND_TTL_MS = 2 * 60_000;const BAN_FILE_PATH = String(process.env.BAN_FILE_PATH || path.join(process.cwd(), "data", "nexu-bans.json"));const REMEMBER_FILE_PATH = String(process.env.REMEMBER_FILE_PATH ||path.join(path.dirname(BAN_FILE_PATH), "nexu-remembered-accounts.json"));

const presence = new Map();const bans = new Map();const avatarCache = new Map();const directMessages = new Map();const dmRateLimits = new Map();const dashboardSessions = new Map();const rememberedDashboardDevices = new Map();const loginRateLimits = new Map();const joinCommands = new Map();const bringCommands = new Map();let nextDirectMessageId = 1;let nextJoinCommandId = 1;let nextBringCommandId = 1;

function sendJson(res, statusCode, data, extraHeaders = {}) {res.writeHead(statusCode, {"Content-Type": "application/json; charset=utf-8","Cache-Control": "no-store","X-Content-Type-Options": "nosniff",...extraHeaders,});res.end(JSON.stringify(data));}

function sendHtml(res, statusCode, html, extraHeaders = {}) {res.writeHead(statusCode, {"Content-Type": "text/html; charset=utf-8","Cache-Control": "no-store","X-Content-Type-Options": "nosniff","Referrer-Policy": "no-referrer","Content-Security-Policy":"default-src 'self'; " +"img-src 'self' https: data:; " +"style-src 'unsafe-inline'; " +"script-src 'unsafe-inline'; " +"connect-src 'self'; " +"form-action 'self'; " +"base-uri 'none'; " +"frame-ancestors 'none'",...extraHeaders,});res.end(html);}

function redirect(res, location, extraHeaders = {}) {res.writeHead(303, {Location: location,"Cache-Control": "no-store","X-Content-Type-Options": "nosniff",...extraHeaders,});res.end();}

function escapeHtml(value) {return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");}

function cleanText(value, maxLength) {return typeof value === "string"? value.trim().slice(0, maxLength): "";}

function cleanNumericId(value) {const text = String(value ?? "").trim();return /^\d{1,30}$/.test(text) ? text : "";}

function cleanInteger(value) {const number = Number(value);return Number.isSafeInteger(number) && number >= 0 ? number : 0;}

function getNexuRoleInfo(userId) {const id = cleanNumericId(userId);if (MENU_CREATOR_RANK_ENABLED && id === MENU_CREATOR_USER_ID) {return {title: "MENU CREATOR", key: "creator"};}if (SUPPORTER_USER_IDS.has(id)) {return {title: "SUPPORTER", key: "supporter"};}return {title: "SPIELER", key: "player"};}

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

async function readFormBody(req) {const raw = await readRawBody(req);const params = new URLSearchParams(raw);return {username: params.get("username") || "",password: params.get("password") || "",};}

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

function saveBans() {try {fs.mkdirSync(path.dirname(BAN_FILE_PATH), { recursive: true });

    const tempPath = `${BAN_FILE_PATH}.tmp`;
    fs.writeFileSync(
        tempPath,
        JSON.stringify({ bans: [...bans.values()] }, null, 2),
        "utf8"
    );
    fs.renameSync(tempPath, BAN_FILE_PATH);
    return true;
} catch (error) {
    console.warn(
        "[NEXU] Ban-Datei konnte nicht gespeichert werden:",
        error.message
    );
    return false;
}

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

function pruneDashboardAuth() {const now = Date.now();

for (const [token, expiresAtMs] of dashboardSessions) {
    if (expiresAtMs <= now) {
        dashboardSessions.delete(token);
    }
}

for (const [ip, state] of loginRateLimits) {
    if (now - state.windowStartedAtMs > LOGIN_RATE_WINDOW_MS) {
        loginRateLimits.delete(ip);
    }
}

}

function isDashboardAuthenticated(req) {pruneDashboardAuth();const token = parseCookies(req).get(DASHBOARD_SESSION_COOKIE) || "";const expiresAtMs = dashboardSessions.get(token) || 0;

if (!token || expiresAtMs <= Date.now()) {
    if (token) dashboardSessions.delete(token);
    return false;
}

return true;

}

function createDashboardSession() {pruneDashboardAuth();const token = crypto.randomBytes(32).toString("hex");dashboardSessions.set(token, Date.now() + DASHBOARD_SESSION_TTL_MS);return token;}

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
        const username = cleanText(raw && raw.username, 80);
        const expiresAtMs = Number(raw && raw.expiresAtMs) || 0;

        if (
            /^[a-f0-9]{64}$/.test(tokenHash) &&
            username === DASHBOARD_USERNAME &&
            expiresAtMs > Date.now()
        ) {
            rememberedDashboardDevices.set(tokenHash, {
                username,
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

function saveRememberedDashboardDevices() {try {fs.mkdirSync(path.dirname(REMEMBER_FILE_PATH), { recursive: true });const tempPath = `${REMEMBER_FILE_PATH}.tmp`;fs.writeFileSync(tempPath,JSON.stringify({devices: [...rememberedDashboardDevices.entries()].map(([tokenHash, entry]) => ({tokenHash,username: entry.username,expiresAtMs: entry.expiresAtMs,createdAt: entry.createdAt,})),},null,2),"utf8");fs.renameSync(tempPath, REMEMBER_FILE_PATH);return true;} catch (error) {console.warn("[NEXU] Gespeicherte Dashboard-Accounts konnten nicht gespeichert werden:",error.message);return false;}}

function createRememberedDashboardDevice() {pruneRememberedDashboardDevices(false);

const rawToken = crypto.randomBytes(32).toString("hex");
const tokenHash = rememberTokenHash(rawToken);
rememberedDashboardDevices.set(tokenHash, {
    username: DASHBOARD_USERNAME,
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

function getRememberedDashboardAccount(req) {pruneRememberedDashboardDevices(true);const rawToken = parseCookies(req).get(DASHBOARD_REMEMBER_COOKIE) || "";if (!/^[a-f0-9]{64}$/i.test(rawToken)) {return null;}

const entry = rememberedDashboardDevices.get(rememberTokenHash(rawToken));
if (!entry || entry.expiresAtMs <= Date.now()) {
    return null;
}

return {
    username: entry.username,
    expiresAtMs: entry.expiresAtMs,
};

}

function removeRememberedDashboardDevice(req) {const rawToken = parseCookies(req).get(DASHBOARD_REMEMBER_COOKIE) || "";if (!rawToken) {return;}

rememberedDashboardDevices.delete(rememberTokenHash(rawToken));
saveRememberedDashboardDevices();

}

function validDashboardPassword(password) {if (!/^[a-f0-9]{64}$/.test(DASHBOARD_PASSWORD_HASH)) {return false;}

const suppliedHash = sha256(password);
const expectedHash = Buffer.from(DASHBOARD_PASSWORD_HASH, "hex");
return suppliedHash.length === expectedHash.length &&
    crypto.timingSafeEqual(suppliedHash, expectedHash);

}

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

const activeRows = [...presence.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "de", {
        sensitivity: "base",
    })
);

const bannedRows = [...bans.values()].sort((a, b) =>
    (a.displayName || a.username || a.userId).localeCompare(
        b.displayName || b.username || b.userId,
        "de",
        { sensitivity: "base" }
    )
);

const allIds = [
    ...new Set([
        ...activeRows.map((row) => row.userId),
        ...bannedRows.map((row) => row.userId),
    ]),
];

const avatarUrls = await fetchAvatarUrls(allIds);

const players = activeRows.map((row) => {
    const role = getNexuRoleInfo(row.userId);
    return {
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: avatarUrls.get(row.userId) || "",
        gameName: row.gameName || `Place ${row.placeId || 0}`,
        placeId: row.placeId,
        jobId: row.jobId,
        joinedAt: new Date(row.joinedAtMs).toISOString(),
        lastSeen: new Date(row.lastSeenMs).toISOString(),
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

return { players, bannedPlayers };

}

function normalizeHeartbeatPlayers(body) {if (Array.isArray(body.players)) {return {batch: true,rows: body.players.slice(0, 200),};}

return {
    batch: false,
    rows: [
        {
            userId: body.userId,
            username: body.username,
            displayName: body.displayName,
            sessionId: body.sessionId,
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

function loginHtml(errorMessage = "", rememberedAccount = null) {const errorBlock = errorMessage ? `<div class="login-error" role="alert">${escapeHtml(errorMessage)}</div>` : "";const rememberedBlock = rememberedAccount ? `<section class="remembered-account" aria-label="Gespeicherter Account">
            <div class="remembered-heading">GESPEICHERTER ACCOUNT</div>
            <form method="post" action="/quick-login">
                <button class="account-card" type="submit">
                    <span class="account-avatar">O</span>
                    <span class="account-copy">
                        <strong>${escapeHtml(rememberedAccount.username)}</strong>
                        <small>Zum direkten Anmelden klicken</small>
                    </span>
                    <span class="account-arrow">›</span>
                </button>
            </form>
            <form method="post" action="/forget-account">
                <button class="forget-account" type="submit">Gespeicherten Account entfernen</button>
            </form>
        </section>
        <div class="login-divider"><span>oder mit Passwort anmelden</span></div>` : "";

return String.raw`<!doctype html>

<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#03070e">
<title>Nexu Anmeldung</title>
<style>
:root {
    --bg:#03070e;
    --panel:rgba(7,13,23,.94);
    --text:#dceef8;
    --muted:#7894a8;
    --cyan:#00c8ff;
    --violet:#6f46ff;
    --red:#ff4d78;
}
* { box-sizing:border-box; }
html,body { margin:0; min-height:100%; }
body {
    min-height:100vh;
    display:grid;
    place-items:center;
    padding:22px;
    color:var(--text);
    background:
        radial-gradient(circle at 18% 5%,rgba(0,200,255,.16),transparent 34rem),
        radial-gradient(circle at 88% 20%,rgba(111,70,255,.17),transparent 32rem),
        var(--bg);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;
    overflow:hidden;
}
body::before {
    content:"";
    position:fixed;
    inset:0;
    pointer-events:none;
    opacity:.25;
    background-image:
        linear-gradient(rgba(0,200,255,.06) 1px,transparent 1px),
        linear-gradient(90deg,rgba(0,200,255,.06) 1px,transparent 1px);
    background-size:32px 32px;
    mask-image:linear-gradient(to bottom,black,transparent 90%);
}
.scan {
    position:fixed;
    left:0;
    right:0;
    top:-2px;
    height:1px;
    pointer-events:none;
    background:linear-gradient(90deg,transparent,rgba(0,200,255,.9),transparent);
    box-shadow:0 0 22px rgba(0,200,255,.8);
    animation:scan 7s linear infinite;
}
@keyframes scan {
    from { transform:translateY(0); opacity:0; }
    8%,92% { opacity:.7; }
    to { transform:translateY(100vh); opacity:0; }
}
.login-card {
    position:relative;
    z-index:1;
    width:min(430px,100%);
    padding:30px;
    border:1px solid rgba(74,178,230,.34);
    border-radius:24px;
    background:
        linear-gradient(145deg,rgba(0,200,255,.075),rgba(111,70,255,.055)),
        var(--panel);
    box-shadow:0 30px 100px rgba(0,0,0,.58),0 0 42px rgba(0,200,255,.08);
    backdrop-filter:blur(18px);
}
.brand { display:flex; align-items:center; gap:13px; margin-bottom:25px; }
.logo {
    width:48px;
    height:48px;
    display:grid;
    place-items:center;
    border-radius:50%;
    color:white;
    font-size:20px;
    font-weight:900;
    background:linear-gradient(145deg,var(--cyan),var(--violet));
    box-shadow:0 0 26px rgba(0,200,255,.24);
}
.brand strong { display:block; font-size:21px; }
.brand span { display:block; margin-top:2px; color:var(--muted); font-size:11px; letter-spacing:.14em; text-transform:uppercase; }
.eyebrow { color:var(--cyan); font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
h1 { margin:7px 0 8px; font-size:28px; line-height:1.1; }
p { margin:0 0 23px; color:var(--muted); font-size:13px; line-height:1.6; }
label { display:block; margin:0 0 7px; color:#a8c2d4; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.field { margin-bottom:16px; }
input {
    width:100%;
    height:48px;
    border:1px solid rgba(74,178,230,.3);
    border-radius:13px;
    outline:none;
    padding:0 14px;
    color:var(--text);
    background:rgba(3,8,15,.84);
    font:inherit;
    transition:border-color .16s ease,box-shadow .16s ease;
}
input:focus { border-color:var(--cyan); box-shadow:0 0 0 3px rgba(0,200,255,.09); }
button {
    width:100%;
    height:49px;
    margin-top:5px;
    border:1px solid rgba(0,200,255,.55);
    border-radius:13px;
    color:#e9f9ff;
    background:linear-gradient(135deg,rgba(0,200,255,.24),rgba(111,70,255,.22));
    font:inherit;
    font-size:12px;
    font-weight:850;
    letter-spacing:.09em;
    text-transform:uppercase;
    cursor:pointer;
}
button:hover { border-color:var(--cyan); box-shadow:0 0 22px rgba(0,200,255,.12); }
.remembered-account {
    margin:0 0 18px;
    padding:14px;
    border:1px solid rgba(0,200,255,.26);
    border-radius:16px;
    background:rgba(3,10,18,.62);
}
.remembered-heading {
    margin:0 0 9px;
    color:#6f93aa;
    font-size:9px;
    font-weight:850;
    letter-spacing:.15em;
}
.account-card {
    height:auto;
    min-height:64px;
    margin:0;
    display:grid;
    grid-template-columns:42px minmax(0,1fr) 20px;
    align-items:center;
    gap:11px;
    padding:10px 12px;
    text-align:left;
    text-transform:none;
    letter-spacing:0;
    background:linear-gradient(135deg,rgba(0,200,255,.13),rgba(111,70,255,.12));
}
.account-avatar {
    width:42px;
    height:42px;
    display:grid;
    place-items:center;
    border-radius:50%;
    color:white;
    font-size:17px;
    font-weight:950;
    background:linear-gradient(145deg,var(--cyan),var(--violet));
    box-shadow:0 0 18px rgba(0,200,255,.18);
}
.account-copy { min-width:0; }
.account-copy strong {
    display:block;
    overflow:hidden;
    color:#eefaff;
    font-size:14px;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.account-copy small {
    display:block;
    margin-top:4px;
    color:#7894a8;
    font-size:10px;
}
.account-arrow { color:var(--cyan); font-size:25px; line-height:1; text-align:right; }
.forget-account {
    height:auto;
    margin:9px 0 0;
    padding:4px 0 0;
    border:0;
    color:#70899b;
    background:transparent;
    box-shadow:none;
    font-size:9px;
    letter-spacing:.08em;
}
.forget-account:hover { color:#ff9fb4; border:0; box-shadow:none; }
.login-divider {
    display:flex;
    align-items:center;
    gap:10px;
    margin:0 0 18px;
    color:#526d80;
    font-size:9px;
    font-weight:800;
    letter-spacing:.08em;
    text-transform:uppercase;
}
.login-divider::before,.login-divider::after {
    content:"";
    flex:1;
    height:1px;
    background:rgba(74,178,230,.18);
}
.login-error {
    margin:0 0 16px;
    padding:11px 12px;
    border:1px solid rgba(255,77,120,.38);
    border-radius:11px;
    color:#ffb0c1;
    background:rgba(55,7,20,.58);
    font-size:12px;
}
.security-note { margin:18px 0 0; text-align:center; color:#557084; font-size:11px; }
</style>
</head>
<body>
<div class="scan"></div>
<main class="login-card">
    <div class="brand">
        <div class="logo">N</div>
        <div><strong>Nexu</strong><span>Owner Dashboard</span></div>
    </div>
    <div class="eyebrow">GESCHÜTZTER ZUGANG</div>
    <h1>Anmelden</h1>
    <p>Melde dich an, um das Spieler-, Nachrichten- und Moderations-Dashboard zu öffnen.</p>
    ${errorBlock}
    ${rememberedBlock}
    <form method="post" action="/login" autocomplete="on">
        <div class="field">
            <label for="username">Benutzername</label>
            <input id="username" name="username" type="text" maxlength="80" autocomplete="username" required autofocus>
        </div>
        <div class="field">
            <label for="password">Passwort</label>
            <input id="password" name="password" type="password" maxlength="200" autocomplete="current-password" required>
        </div>
        <button type="submit">Dashboard öffnen</button>
    </form>
    <div class="security-note">NEXU // GESICHERTE OWNER-SESSION</div>
</main>
</body>
</html>`;
}

function dashboardHtml() {return String.raw`<!doctype html>

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
.eyebrow { color:var(--cyan); font-size:11px; letter-spacing:.19em; text-transform:uppercase; }
h1 { margin:8px 0; max-width:760px; font-size:clamp(30px,5vw,52px); line-height:1.03; letter-spacing:-.04em; }
.hero p { margin:0; max-width:760px; color:var(--muted); line-height:1.65; }
.stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin-top:24px; }
.stat { min-height:122px; padding:18px; border:1px solid rgba(74,178,230,.19); border-radius:19px; background:var(--panel2); }
.stat-label { color:var(--muted); font-size:11px; letter-spacing:.12em; text-transform:uppercase; }
.stat-value { margin-top:11px; font-size:27px; font-weight:780; }
.stat-note { margin-top:8px; color:#66849a; font-size:12px; }
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
.avatar { width:58px; height:58px; flex:0 0 58px; object-fit:cover; border-radius:14px; background:#0b1422; border:1px solid rgba(0,200,255,.26); }
.identity { min-width:0; flex:1; }
.display-name { overflow:hidden; font-weight:760; text-overflow:ellipsis; white-space:nowrap; }
.username { overflow:hidden; margin-top:3px; color:var(--muted); font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.reason { margin-top:5px; color:#ff9bb1; font-size:11px; line-height:1.4; }
.presence-details { margin-top:9px; display:grid; gap:4px; }
.presence-line { display:grid; grid-template-columns:58px minmax(0,1fr); gap:7px; align-items:start; font-size:10px; line-height:1.35; }
.presence-key { color:#5f7e95; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.06em; }
.presence-value { min-width:0; color:#b8d0df; overflow-wrap:anywhere; word-break:break-word; }
.presence-value.server-id { color:#78b8d8; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:9px; word-break:break-all; }
.player-actions { flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.player-state { color:var(--green); font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
.player-state.banned { color:var(--red); }
.role-badge { display:inline-flex; align-items:center; justify-content:center; margin-top:7px; width:max-content; max-width:100%; border:1px solid rgba(66,255,145,.42); border-radius:999px; padding:4px 9px; font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#42ff91; background:rgba(7,38,24,.72); box-shadow:0 0 14px rgba(66,255,145,.12); }
.role-badge.creator { border-color:rgba(255,194,45,.72); color:#fff6ae; background:linear-gradient(115deg,rgba(47,27,3,.9),rgba(255,194,45,.18),rgba(47,27,3,.9)); box-shadow:0 0 20px rgba(255,194,45,.28); }
.role-badge.supporter { border-color:rgba(245,250,255,.78); color:#ffffff; background:linear-gradient(115deg,rgba(23,28,38,.92),rgba(245,250,255,.24),rgba(23,28,38,.92)); box-shadow:0 0 22px rgba(245,250,255,.25); }
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
.action-button.bring { border-color:rgba(245,250,255,.58); color:#ffffff; background:rgba(28,34,46,.82); }
.action-button.bring:hover { border-color:#ffffff; }
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
        <div class="live-pill"><span id="headerDot" class="dot"></span><span id="headerStatus">Verbindung wird geprüft</span></div>
        <form class="logout-form" method="post" action="/logout"><button class="logout-button" type="submit">Abmelden</button></form>
    </div>
</header>

<section class="hero">
    <div class="eyebrow">NEXU // LIVE SYSTEM</div>
    <h1>Aktive Nutzer auf einen Blick.</h1>
    <p>Das Dashboard zeigt aktive Nexu-Spieler mit Spielname, Place-ID und exakter Server-ID. Über SERVER JOIN wird dein laufendes Nexu-Menü zum ausgewählten Server geschickt.</p>
    <div class="stats">
        <article class="stat"><div class="stat-label">Serverstatus</div><div id="serverStatus" class="stat-value">Prüfe …</div><div class="stat-note">Render-Web-Service</div></article>
        <article class="stat"><div class="stat-label">Aktive Spieler</div><div id="playerCount" class="stat-value">0</div><div class="stat-note">Heartbeat in den letzten 75 Sekunden</div></article>
        <article class="stat"><div class="stat-label">Gesperrte Spieler</div><div id="bannedCount" class="stat-value">0</div><div class="stat-note">Bleiben bis zum Entbannen gespeichert</div></article>
    </div>
</section>

<section class="directory">
    <div class="directory-head">
        <div><div class="eyebrow">MENU SPIELER</div><h2>Verbundenes Spieler-Verzeichnis</h2></div>
        <input id="search" class="search" type="search" autocomplete="off" placeholder="Spieler suchen …" aria-label="Spieler suchen">
    </div>
    <div id="players" class="players"></div>
    <div id="footerNote" class="footer-note"></div>
</section>

<section class="directory">
    <div class="directory-head"><div><div class="eyebrow">MENÜ-SPERRLISTE</div><h2>Gebannte Nutzer</h2></div></div>
    <div id="bannedPlayers" class="players"></div>
    <div id="bannedFooter" class="footer-note"></div>
</section>
</main>

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
const state = {
    online:false,
    players:[],
    bannedPlayers:[],
    query:"",
    pendingBan:null,
    pendingDm:null,
};

const elements = {
    headerDot:document.getElementById("headerDot"),
    headerStatus:document.getElementById("headerStatus"),
    serverStatus:document.getElementById("serverStatus"),
    playerCount:document.getElementById("playerCount"),
    bannedCount:document.getElementById("bannedCount"),
    search:document.getElementById("search"),
    players:document.getElementById("players"),
    footerNote:document.getElementById("footerNote"),
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
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function renderPlayer(player,banned) {
    const name = player.displayName || player.username || player.userId;
    const username = player.username || ("User" + player.userId);
    const gameName = player.gameName || (player.placeId ? ("Place " + player.placeId) : "Unbekannt");
    const placeId = String(player.placeId || "-");
    const jobId = String(player.jobId || "-");
    const joinable = !banned && /^\d+$/.test(placeId) && placeId !== "0" && jobId !== "-" && !jobId.startsWith("LOCAL-");
    const bringable = !banned && String(player.userId || "") !== "${MENU_CREATOR_USER_ID}";
    const roleKey = String(player.roleKey || "player").replace(/[^a-z0-9_-]/gi,"").toLowerCase() || "player";
    const roleTitle = player.roleTitle || "SPIELER";
    const roleBadge = '<div class="role-badge ' + escapeHtml(roleKey) + '">' + escapeHtml(roleTitle) + '</div>';
    const reason = banned && player.reason
        ? '<div class="reason">Grund: ' + escapeHtml(player.reason) + '</div>'
        : "";
    const locationDetails = banned
        ? ""
        : '<div class="presence-details">' +
            '<div class="presence-line"><span class="presence-key">SPIEL</span><span class="presence-value">' + escapeHtml(gameName) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">PLACE</span><span class="presence-value">' + escapeHtml(placeId) + '</span></div>' +
            '<div class="presence-line"><span class="presence-key">SERVER</span><span class="presence-value server-id" title="' + escapeHtml(jobId) + '">' + escapeHtml(jobId) + '</span></div>' +
        '</div>';
    const joinButton = joinable
        ? '<button class="action-button join" data-action="join" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">SERVER JOIN</button>'
        : "";
    const bringButton = bringable
        ? '<button class="action-button bring" data-action="bring" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">BRING</button>'
        : "";
    const actionButtons = banned
        ? '<button class="action-button unban" data-action="unban" data-user-id="' + escapeHtml(player.userId) + '">ENTBANNEN</button>'
        : '<div class="button-row">' +
            joinButton +
            bringButton +
            '<button class="action-button dm" data-action="dm" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">DM</button>' +
            '<button class="action-button ban" data-action="ban" data-user-id="' + escapeHtml(player.userId) + '" data-display-name="' + escapeHtml(name) + '" data-username="' + escapeHtml(username) + '">BANNEN</button>' +
        '</div>';

    return '<article class="player ' + (banned ? 'banned' : '') + '">' +
        '<img class="avatar" src="' + escapeHtml(player.avatarUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' +
        '<div class="identity">' +
            '<div class="display-name">' + escapeHtml(name) + '</div>' +
            '<div class="username">@' + escapeHtml(username) + ' · ' + escapeHtml(player.userId) + '</div>' +
            roleBadge +
            locationDetails +
            reason +
        '</div>' +
        '<div class="player-actions">' +
            '<div class="player-state ' + (banned ? 'banned' : '') + '">' + (banned ? 'Gesperrt' : 'Online') + '</div>' +
            actionButtons +
        '</div>' +
    '</article>';
}

function render() {
    elements.headerDot.className = "dot " + (state.online ? "online" : "offline");
    elements.headerStatus.textContent = state.online ? "Server online" : "Server nicht erreichbar";
    elements.serverStatus.textContent = state.online ? "ONLINE" : "OFFLINE";
    elements.serverStatus.style.color = state.online ? "var(--green)" : "var(--red)";
    elements.playerCount.textContent = String(state.players.length);
    elements.bannedCount.textContent = String(state.bannedPlayers.length);

    const query = state.query.trim().toLocaleLowerCase();
    const filtered = state.players.filter(function (player) {
        return !query ||
            String(player.displayName || "").toLocaleLowerCase().includes(query) ||
            String(player.username || "").toLocaleLowerCase().includes(query) ||
            String(player.userId || "").includes(query);
    });

    elements.players.innerHTML = filtered.length
        ? filtered.map(function (player) { return renderPlayer(player,false); }).join("")
        : '<div class="empty">' + (state.players.length === 0
            ? 'Zurzeit ist kein Spieler mit dem Nexu-Menü verbunden.'
            : 'Kein Spieler passt zu deiner Suche.') + '</div>';

    elements.bannedPlayers.innerHTML = state.bannedPlayers.length
        ? state.bannedPlayers.map(function (player) { return renderPlayer(player,true); }).join("")
        : '<div class="empty">Die Sperrliste ist leer.</div>';

    elements.footerNote.textContent = filtered.length + " von " + state.players.length + " Spielern angezeigt";
    elements.bannedFooter.textContent = state.bannedPlayers.length + " gesperrte Nutzer";
}

async function refresh() {
    try {
        const response = await fetch("/api/presence", {
            headers:{ Accept:"application/json" },
            cache:"no-store",
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();
        state.online = data.online === true;
        state.players = Array.isArray(data.players) ? data.players : [];
        state.bannedPlayers = Array.isArray(data.bannedPlayers) ? data.bannedPlayers : [];
    } catch (error) {
        console.error("Nexu refresh failed:",error);
        state.online = false;
        state.players = [];
        state.bannedPlayers = [];
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

document.addEventListener("click",async function (event) {
    const button = event.target.closest("[data-action][data-user-id]");
    if (!button) {
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
});

refresh();
setInterval(refresh,5000);
</script>

</body>
</html>`;
}

loadBans();loadRememberedDashboardDevices();

const server = http.createServer(async (req, res) => {const requestUrl = new URL(req.url, "http://localhost");const pathname = requestUrl.pathname;

if (
    req.method === "GET" &&
    (pathname === "/" || pathname === "/login")
) {
    if (isDashboardAuthenticated(req)) {
        console.log("[NEXU] Dashboard aufgerufen");
        sendHtml(res, 200, dashboardHtml());
    } else {
        sendHtml(res, 200, loginHtml("", getRememberedDashboardAccount(req)));
    }
    return;
}

if (req.method === "POST" && pathname === "/login") {
    try {
        if (!allowLoginAttempt(req)) {
            sendHtml(
                res,
                429,
                loginHtml("Zu viele Anmeldeversuche. Bitte später erneut versuchen.", getRememberedDashboardAccount(req))
            );
            return;
        }

        const form = await readFormBody(req);
        const username = cleanText(form.username, 80);
        const password = String(form.password || "");
        const validLogin = safeTextEqual(username, DASHBOARD_USERNAME) &&
            validDashboardPassword(password);

        if (!validLogin) {
            console.warn("[NEXU] Fehlgeschlagene Dashboard-Anmeldung von", getClientIp(req));
            sendHtml(
                res,
                401,
                loginHtml("Benutzername oder Passwort ist falsch.", getRememberedDashboardAccount(req))
            );
            return;
        }

        clearLoginAttempts(req);
        const token = createDashboardSession();
        const rememberToken = createRememberedDashboardDevice();
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
                    rememberToken,
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
                getRememberedDashboardAccount(req)
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
                getRememberedDashboardAccount(req)
            )
        );
        return;
    }

    const rememberedAccount = getRememberedDashboardAccount(req);
    if (!rememberedAccount || rememberedAccount.username !== DASHBOARD_USERNAME) {
        removeRememberedDashboardDevice(req);
        redirect(res, "/login", {
            "Set-Cookie": dashboardRememberCookie(req, "", 0),
        });
        return;
    }

    clearLoginAttempts(req);
    const token = createDashboardSession();
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
    removeDashboardSession(req);
    removeRememberedDashboardDevice(req);
    redirect(res, "/login", {
        "Set-Cookie": [
            dashboardCookie(req, "", 0),
            dashboardRememberCookie(req, "", 0),
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

if (
    req.method === "GET" &&
    (pathname === "/status" || pathname === "/api/status")
) {
    prunePresence();
    sendJson(res, 200, {
        success: true,
        online: true,
        service: "Nexu Presence & Moderation",
        activePlayers: presence.size,
        bannedPlayers: bans.size,
        timestamp: new Date().toISOString(),
    });
    return;
}

if (req.method === "GET" && pathname === "/api/menu/access") {
    const userId = cleanNumericId(requestUrl.searchParams.get("userId"));

    if (!userId) {
        sendJson(res, 400, {
            success: false,
            error: "Ungültige User-ID",
        });
        return;
    }

    const ban = bans.get(userId);
    sendJson(res, 200, {
        success: true,
        allowed: !ban,
        banned: Boolean(ban),
        userId,
        reason: ban ? ban.reason : "",
        bannedAt: ban ? ban.bannedAt : "",
        timestamp: new Date().toISOString(),
    });
    return;
}

if (req.method === "POST" && pathname === "/api/join/send") {
    if (!isDashboardAuthenticated(req)) {
        sendJson(res, 401, {
            success: false,
            error: "Dashboard-Anmeldung erforderlich",
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
        const dashboardAuthenticated = isDashboardAuthenticated(req);
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

            const requesterAllowed =
                requesterUserId === MENU_CREATOR_USER_ID ||
                SUPPORTER_USER_IDS.has(requesterUserId);
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
        activePlayers: data.players.length,
        bannedCount: data.bannedPlayers.length,
        timeoutSeconds: ONLINE_TIMEOUT_MS / 1000,
        players: data.players,
        bannedPlayers: data.bannedPlayers,
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

            const key = `${jobId}:${userId}`;
            currentKeys.add(key);

            const existing = presence.get(key);
            presence.set(key, {
                userId,
                username,
                displayName,
                gameName: cleanText(rawPlayer.gameName, 120) || gameName || (existing && existing.gameName) || `Place ${placeId || 0}`,
                placeId,
                jobId,
                sessionId: cleanText(rawPlayer.sessionId, 100) || sessionId,
                joinedAtMs: existing ? existing.joinedAtMs : now,
                lastSeenMs: now,
            });
        }

        // Ein Batch enthält die vollständige Liste eines Roblox-Servers.
        // Ein einzelner Client darf dagegen keine anderen Spieler entfernen.
        if (normalized.batch) {
            for (const [key, entry] of presence) {
                if (entry.jobId === jobId && !currentKeys.has(key)) {
                    presence.delete(key);
                }
            }
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

        console.log(
            `[NEXU] Heartbeat: Job ${jobId}, ` +
                `${currentKeys.size} aktiv, ` +
                `${blockedUserIds.length} blockiert, ` +
                `${presence.size} insgesamt`
        );

        sendJson(res, 200, {
            success: true,
            activePlayers: presence.size,
            receivedPlayers: currentKeys.size,
            blockedUserIds,
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

        sendJson(res, 200, { success: true, removed });
    } catch {
        sendJson(res, 400, {
            success: false,
            error: "Ungültiges JSON",
        });
    }
    return;
}

if (req.method === "POST" && pathname === "/api/dm/send") {
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

if (req.method === "GET" && pathname === "/api/admin/bans") {
    sendJson(res, 200, {
        success: true,
        bans: [...bans.values()],
    });
    return;
}

if (req.method === "POST" && pathname === "/api/admin/ban") {
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

setInterval(() => {prunePresence();pruneDirectMessages();pruneDashboardAuth();}, 20_000).unref();

server.listen(PORT, "0.0.0.0", () => {console.log("========================================");console.log("NEXU PRESENCE & MODERATION GESTARTET");console.log("Port:", PORT);console.log("Heartbeat-Schutz:",HEARTBEAT_TOKEN ? "AKTIV" : "AUS (Kompatibilitätsmodus)");console.log("Ban-Datei:", BAN_FILE_PATH);console.log("Dashboard-Anmeldung: /");console.log("Dashboard-Benutzer:", DASHBOARD_USERNAME);console.log("Presence: /api/presence");console.log("Direct Messages: /api/dm/send + /api/dm/poll");console.log("Website Join: /api/join/send + /api/join/poll");console.log("Access: /api/menu/access?userId=...");console.log("========================================");});
