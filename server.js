const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const HEARTBEAT_TOKEN = String(
    process.env.HEARTBEAT_TOKEN ||
    process.env.API_KEY ||
    ""
);
const ADMIN_KEY = String(process.env.ADMIN_KEY || "");

const MENU_CREATOR_USER_ID = "10199760908";
const ONLINE_TIMEOUT_MS = 75_000;
const MAX_BODY_BYTES = 100_000;

const BAN_FILE_PATH = String(
    process.env.BAN_FILE_PATH ||
    path.join(process.cwd(), "data", "nexu-bans.json")
);

const presence = new Map();
const bans = new Map();

function sendJson(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    });

    res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
            "default-src 'self'; " +
            "img-src https: data:; " +
            "style-src 'unsafe-inline'; " +
            "script-src 'unsafe-inline'; " +
            "connect-src 'self'",
    });

    res.end(html);
}

function cleanText(value, maxLength) {
    return typeof value === "string"
        ? value.trim().slice(0, maxLength)
        : "";
}

function cleanNumericId(value) {
    const text = String(value ?? "").trim();
    return /^\d{1,30}$/.test(text) ? text : "";
}

function cleanInteger(value) {
    const number = Number(value);

    return Number.isSafeInteger(number) && number >= 0
        ? number
        : 0;
}

function avatarUrl(userId) {
    return (
        "https://www.roblox.com/headshot-thumbnail/image" +
        `?userId=${encodeURIComponent(userId)}` +
        "&width=150&height=150&format=png"
    );
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        let tooLarge = false;

        req.on("data", (chunk) => {
            raw += chunk.toString("utf8");

            if (
                Buffer.byteLength(raw, "utf8") >
                MAX_BODY_BYTES
            ) {
                tooLarge = true;
            }
        });

        req.on("end", () => {
            if (tooLarge) {
                reject(new Error("BODY_TOO_LARGE"));
                return;
            }

            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch {
                reject(new Error("INVALID_JSON"));
            }
        });

        req.on("error", reject);
    });
}

function heartbeatAuthorized(req) {
    const supplied = String(
        req.headers["x-nexu-heartbeat-token"] ||
        req.headers["x-api-key"] ||
        ""
    );

    return (
        HEARTBEAT_TOKEN.length >= 16 &&
        supplied === HEARTBEAT_TOKEN
    );
}

function adminAuthorized(req) {
    return (
        ADMIN_KEY.length >= 20 &&
        String(req.headers["x-admin-key"] || "") ===
            ADMIN_KEY
    );
}

function prunePresence() {
    const now = Date.now();

    for (const [key, entry] of presence) {
        if (
            now - entry.lastSeenMs >
                ONLINE_TIMEOUT_MS ||
            bans.has(entry.userId)
        ) {
            presence.delete(key);
        }
    }
}

function removePresenceForUser(userId) {
    let removed = 0;

    for (const [key, entry] of presence) {
        if (entry.userId === userId) {
            presence.delete(key);
            removed += 1;
        }
    }

    return removed;
}

function latestPresence(userId) {
    let latest = null;

    for (const entry of presence.values()) {
        if (
            entry.userId === userId &&
            (
                !latest ||
                entry.lastSeenMs > latest.lastSeenMs
            )
        ) {
            latest = entry;
        }
    }

    return latest;
}

function loadBans() {
    try {
        if (!fs.existsSync(BAN_FILE_PATH)) {
            return;
        }

        const parsed = JSON.parse(
            fs.readFileSync(BAN_FILE_PATH, "utf8")
        );

        const rows = Array.isArray(parsed)
            ? parsed
            : parsed.bans;

        if (!Array.isArray(rows)) {
            return;
        }

        for (const row of rows) {
            const userId = cleanNumericId(
                row?.userId
            );

            if (!userId) {
                continue;
            }

            bans.set(userId, {
                userId,

                username: cleanText(
                    row.username,
                    40
                ),

                displayName: cleanText(
                    row.displayName,
                    80
                ),

                reason:
                    cleanText(
                        row.reason,
                        240
                    ) ||
                    "Vom Nexu-Menü ausgeschlossen",

                bannedAt:
                    cleanText(
                        row.bannedAt,
                        64
                    ) ||
                    new Date().toISOString(),

                bannedBy:
                    cleanText(
                        row.bannedBy,
                        80
                    ) ||
                    "server",
            });
        }

        console.log(
            `[NEXU] ${bans.size} Bans geladen`
        );
    } catch (error) {
        console.warn(
            "[NEXU] Ban-Datei konnte nicht geladen werden:",
            error.message
        );
    }
}

function saveBans() {
    try {
        fs.mkdirSync(
            path.dirname(BAN_FILE_PATH),
            {
                recursive: true,
            }
        );

        const temporary =
            `${BAN_FILE_PATH}.tmp`;

        fs.writeFileSync(
            temporary,
            JSON.stringify(
                {
                    bans: [...bans.values()],
                },
                null,
                2
            ),
            "utf8"
        );

        fs.renameSync(
            temporary,
            BAN_FILE_PATH
        );

        return true;
    } catch (error) {
        console.warn(
            "[NEXU] Ban-Datei konnte nicht gespeichert werden:",
            error.message
        );

        return false;
    }
}

function publicPresence() {
    prunePresence();

    const players = [
        ...presence.values(),
    ]
        .sort((a, b) =>
            a.displayName.localeCompare(
                b.displayName,
                "de"
            )
        )
        .map((entry) => ({
            userId: entry.userId,
            username: entry.username,
            displayName: entry.displayName,

            avatarUrl: avatarUrl(
                entry.userId
            ),

            placeId: entry.placeId,
            jobId: entry.jobId,

            joinedAt: new Date(
                entry.joinedAtMs
            ).toISOString(),

            lastSeen: new Date(
                entry.lastSeenMs
            ).toISOString(),

            banned: false,
        }));

    const bannedPlayers = [
        ...bans.values(),
    ]
        .sort((a, b) =>
            (
                a.displayName ||
                a.username ||
                a.userId
            ).localeCompare(
                b.displayName ||
                b.username ||
                b.userId,
                "de"
            )
        )
        .map((entry) => ({
            userId: entry.userId,

            username:
                entry.username ||
                `User${entry.userId}`,

            displayName:
                entry.displayName ||
                entry.username ||
                `User ${entry.userId}`,

            avatarUrl: avatarUrl(
                entry.userId
            ),

            placeId: 0,
            jobId: "",

            banned: true,
            reason: entry.reason,
            bannedAt: entry.bannedAt,
        }));

    return {
        players,
        bannedPlayers,
    };
}

function heartbeatRows(body) {
    if (Array.isArray(body.players)) {
        return {
            batch: true,

            rows: body.players.slice(
                0,
                200
            ),
        };
    }

    return {
        batch: false,

        rows: [
            {
                userId: body.userId,
                username: body.username,
                displayName:
                    body.displayName,
                sessionId:
                    body.sessionId,
            },
        ],
    };
}

function dashboardHtml() {
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>
<title>Nexu</title>

<style>
body {
    margin: 0;
    background: #03070e;
    color: #dceef8;
    font-family: Arial, sans-serif;
}

main {
    width: min(950px, calc(100% - 28px));
    margin: auto;
    padding: 28px 0;
}

.box {
    background: #081321;
    border: 1px solid #00c8ff42;
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 15px;
}

.stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.stat {
    flex: 1;
    min-width: 170px;
    background: #0c1a2b;
    border-radius: 13px;
    padding: 15px;
}

.muted {
    color: #7894a8;
    font-size: 12px;
}

.value {
    font-size: 26px;
    font-weight: bold;
    margin-top: 7px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(2, 1fr);
    gap: 9px;
}

.player {
    display: flex;
    align-items: center;
    gap: 11px;
    background: #0c1a2b;
    border-radius: 13px;
    padding: 10px;
}

.player img {
    width: 48px;
    height: 48px;
    border-radius: 12px;
}

.grow {
    flex: 1;
}

.user {
    color: #7894a8;
    font-size: 13px;
    margin-top: 3px;
}

.online {
    color: #2dffa5;
}

.ban {
    color: #ff5269;
}

@media (max-width: 650px) {
    .grid {
        grid-template-columns: 1fr;
    }
}
</style>
</head>

<body>
<main>

<div class="box">
    <h1>
        NEXU Presence & Moderation
    </h1>

    <div id="status">
        Verbinde …
    </div>
</div>

<div class="box stats">
    <div class="stat">
        <div class="muted">
            SERVER
        </div>

        <div
            id="server"
            class="value"
        >
            …
        </div>
    </div>

    <div class="stat">
        <div class="muted">
            AKTIV
        </div>

        <div
            id="active"
            class="value"
        >
            0
        </div>
    </div>

    <div class="stat">
        <div class="muted">
            GEBANNT
        </div>

        <div
            id="banned"
            class="value"
        >
            0
        </div>
    </div>
</div>

<div class="box">
    <h2>Aktive Nutzer</h2>
    <div
        id="players"
        class="grid"
    ></div>
</div>

<div class="box">
    <h2>Gebannte Nutzer</h2>
    <div
        id="bans"
        class="grid"
    ></div>
</div>

<script>
const esc = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

const card = (player, banned) =>
    '<div class="player">' +
        '<img src="' +
            esc(player.avatarUrl) +
        '">' +

        '<div class="grow">' +
            '<b>' +
                esc(player.displayName) +
            '</b>' +

            '<div class="user">' +
                '@' +
                esc(player.username) +
                ' · ' +
                esc(player.userId) +
            '</div>' +
        '</div>' +

        '<span class="' +
            (banned ? "ban" : "online") +
        '">' +
            (
                banned
                    ? "GEBANNT"
                    : "ONLINE"
            ) +
        '</span>' +
    '</div>';

async function refresh() {
    try {
        const response = await fetch(
            "/api/presence",
            {
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        const data =
            await response.json();

        status.textContent =
            "Server online";

        server.textContent =
            "ONLINE";

        server.style.color =
            "#2dffa5";

        active.textContent =
            data.players.length;

        banned.textContent =
            data.bannedPlayers.length;

        players.innerHTML =
            data.players.length
                ? data.players
                    .map((player) =>
                        card(
                            player,
                            false
                        )
                    )
                    .join("")
                : "Keine aktiven Nutzer";

        bans.innerHTML =
            data.bannedPlayers.length
                ? data.bannedPlayers
                    .map((player) =>
                        card(
                            player,
                            true
                        )
                    )
                    .join("")
                : "Keine gebannten Nutzer";
    } catch {
        status.textContent =
            "Server nicht erreichbar";

        server.textContent =
            "OFFLINE";

        server.style.color =
            "#ff5269";
    }
}

refresh();
setInterval(refresh, 5000);
</script>

</main>
</body>
</html>`;
}

loadBans();

const server = http.createServer(
    async (req, res) => {
        const url = new URL(
            req.url,
            "http://localhost"
        );

        const pathname =
            url.pathname;

        if (
            req.method === "GET" &&
            pathname === "/"
        ) {
            sendHtml(
                res,
                dashboardHtml()
            );

            return;
        }

        if (
            req.method === "GET" &&
            (
                pathname === "/status" ||
                pathname === "/api/status"
            )
        ) {
            prunePresence();

            sendJson(res, 200, {
                success: true,
                online: true,

                service:
                    "Nexu Presence & Moderation",

                activePlayers:
                    presence.size,

                bannedPlayers:
                    bans.size,

                timestamp:
                    new Date().toISOString(),
            });

            return;
        }

        if (
            req.method === "GET" &&
            pathname ===
                "/api/menu/access"
        ) {
            const userId =
                cleanNumericId(
                    url.searchParams.get(
                        "userId"
                    )
                );

            if (!userId) {
                sendJson(res, 400, {
                    success: false,
                    error:
                        "Ungültige User-ID",
                });

                return;
            }

            const ban =
                bans.get(userId);

            sendJson(res, 200, {
                success: true,
                allowed: !ban,
                banned: Boolean(ban),
                userId,

                reason:
                    ban?.reason || "",

                bannedAt:
                    ban?.bannedAt || "",

                timestamp:
                    new Date().toISOString(),
            });

            return;
        }

        if (
            req.method === "GET" &&
            pathname === "/api/presence"
        ) {
            const data =
                publicPresence();

            sendJson(res, 200, {
                success: true,
                online: true,

                activePlayers:
                    data.players.length,

                bannedCount:
                    data.bannedPlayers.length,

                timeoutSeconds:
                    ONLINE_TIMEOUT_MS / 1000,

                players:
                    data.players,

                bannedPlayers:
                    data.bannedPlayers,

                timestamp:
                    new Date().toISOString(),
            });

            return;
        }

        if (
            req.method === "POST" &&
            pathname ===
                "/api/presence/heartbeat"
        ) {
            if (
                !heartbeatAuthorized(req)
            ) {
                sendJson(res, 401, {
                    success: false,

                    error:
                        "Ungültiger Heartbeat-Token",
                });

                return;
            }

            try {
                const body =
                    await readJsonBody(req);

                const jobId =
                    cleanText(
                        body.jobId,
                        100
                    );

                const placeId =
                    cleanInteger(
                        body.placeId
                    );

                const sessionId =
                    cleanText(
                        body.sessionId,
                        100
                    );

                const normalized =
                    heartbeatRows(body);

                if (!jobId) {
                    sendJson(res, 400, {
                        success: false,
                        error: "jobId fehlt",
                    });

                    return;
                }

                const now = Date.now();
                const currentKeys =
                    new Set();

                const blockedUserIds =
                    [];

                for (
                    const raw
                    of normalized.rows
                ) {
                    if (
                        !raw ||
                        typeof raw !==
                            "object"
                    ) {
                        continue;
                    }

                    const userId =
                        cleanNumericId(
                            raw.userId
                        );

                    const username =
                        cleanText(
                            raw.username,
                            40
                        );

                    const displayName =
                        cleanText(
                            raw.displayName,
                            80
                        );

                    if (
                        !userId ||
                        !username ||
                        !displayName
                    ) {
                        continue;
                    }

                    if (bans.has(userId)) {
                        blockedUserIds.push(
                            userId
                        );

                        removePresenceForUser(
                            userId
                        );

                        continue;
                    }

                    const key =
                        `${jobId}:${userId}`;

                    const previous =
                        presence.get(key);

                    currentKeys.add(key);

                    presence.set(key, {
                        userId,
                        username,
                        displayName,
                        placeId,
                        jobId,

                        sessionId:
                            cleanText(
                                raw.sessionId,
                                100
                            ) ||
                            sessionId,

                        joinedAtMs:
                            previous?.joinedAtMs ||
                            now,

                        lastSeenMs: now,
                    });
                }

                if (normalized.batch) {
                    for (
                        const [
                            key,
                            entry,
                        ]
                        of presence
                    ) {
                        if (
                            entry.jobId ===
                                jobId &&
                            !currentKeys.has(
                                key
                            )
                        ) {
                            presence.delete(
                                key
                            );
                        }
                    }
                }

                prunePresence();

                if (
                    !normalized.batch &&
                    blockedUserIds.length
                ) {
                    const userId =
                        blockedUserIds[0];

                    sendJson(res, 403, {
                        success: false,
                        banned: true,
                        userId,

                        reason:
                            bans.get(userId)
                                ?.reason ||
                            "Vom Nexu-Menü ausgeschlossen",
                    });

                    return;
                }

                console.log(
                    `[NEXU] Job ${jobId}: ` +
                    `${currentKeys.size} aktiv, ` +
                    `${blockedUserIds.length} blockiert`
                );

                sendJson(res, 200, {
                    success: true,

                    activePlayers:
                        presence.size,

                    receivedPlayers:
                        currentKeys.size,

                    blockedUserIds,

                    timestamp:
                        new Date().toISOString(),
                });
            } catch (error) {
                sendJson(
                    res,

                    error.message ===
                        "BODY_TOO_LARGE"
                        ? 413
                        : 400,

                    {
                        success: false,

                        error:
                            error.message ===
                                "BODY_TOO_LARGE"
                                ? "Anfrage zu groß"
                                : "Ungültiges JSON",
                    }
                );
            }

            return;
        }

        if (
            req.method === "POST" &&
            pathname ===
                "/api/presence/offline"
        ) {
            if (
                !heartbeatAuthorized(req)
            ) {
                sendJson(res, 401, {
                    success: false,

                    error:
                        "Ungültiger Heartbeat-Token",
                });

                return;
            }

            try {
                const body =
                    await readJsonBody(req);

                const userId =
                    cleanNumericId(
                        body.userId
                    );

                const sessionId =
                    cleanText(
                        body.sessionId,
                        100
                    );

                let removed = 0;

                for (
                    const [
                        key,
                        entry,
                    ]
                    of presence
                ) {
                    if (
                        entry.userId ===
                            userId &&
                        (
                            !sessionId ||
                            !entry.sessionId ||
                            entry.sessionId ===
                                sessionId
                        )
                    ) {
                        presence.delete(key);
                        removed += 1;
                    }
                }

                sendJson(res, 200, {
                    success: true,
                    removed,
                });
            } catch {
                sendJson(res, 400, {
                    success: false,
                    error:
                        "Ungültiges JSON",
                });
            }

            return;
        }

        if (
            req.method === "GET" &&
            pathname ===
                "/api/admin/bans"
        ) {
            if (!adminAuthorized(req)) {
                sendJson(res, 401, {
                    success: false,

                    error:
                        "Ungültiger Admin-Key",
                });

                return;
            }

            sendJson(res, 200, {
                success: true,
                bans: [...bans.values()],
            });

            return;
        }

        if (
            req.method === "POST" &&
            pathname ===
                "/api/admin/ban"
        ) {
            if (!adminAuthorized(req)) {
                sendJson(res, 401, {
                    success: false,

                    error:
                        "Ungültiger Admin-Key",
                });

                return;
            }

            try {
                const body =
                    await readJsonBody(req);

                const userId =
                    cleanNumericId(
                        body.userId
                    );

                if (!userId) {
                    sendJson(res, 400, {
                        success: false,

                        error:
                            "Ungültige User-ID",
                    });

                    return;
                }

                if (
                    userId ===
                    MENU_CREATOR_USER_ID
                ) {
                    sendJson(res, 403, {
                        success: false,

                        error:
                            "Der Menu Creator kann nicht gebannt werden",
                    });

                    return;
                }

                const live =
                    latestPresence(userId);

                const old =
                    bans.get(userId);

                const record = {
                    userId,

                    username:
                        cleanText(
                            body.username,
                            40
                        ) ||
                        live?.username ||
                        old?.username ||
                        `User${userId}`,

                    displayName:
                        cleanText(
                            body.displayName,
                            80
                        ) ||
                        live?.displayName ||
                        old?.displayName ||
                        `User ${userId}`,

                    reason:
                        cleanText(
                            body.reason,
                            240
                        ) ||
                        "Vom Nexu-Menü ausgeschlossen",

                    bannedAt:
                        new Date().toISOString(),

                    bannedBy: "admin",
                };

                bans.set(
                    userId,
                    record
                );

                const removedPresence =
                    removePresenceForUser(
                        userId
                    );

                const persisted =
                    saveBans();

                console.log(
                    `[NEXU] BAN ${userId}`
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

                    error.message ===
                        "BODY_TOO_LARGE"
                        ? 413
                        : 400,

                    {
                        success: false,

                        error:
                            error.message ===
                                "BODY_TOO_LARGE"
                                ? "Anfrage zu groß"
                                : "Ungültiges JSON",
                    }
                );
            }

            return;
        }

        if (
            req.method === "POST" &&
            pathname ===
                "/api/admin/unban"
        ) {
            if (!adminAuthorized(req)) {
                sendJson(res, 401, {
                    success: false,

                    error:
                        "Ungültiger Admin-Key",
                });

                return;
            }

            try {
                const body =
                    await readJsonBody(req);

                const userId =
                    cleanNumericId(
                        body.userId
                    );

                if (!userId) {
                    sendJson(res, 400, {
                        success: false,

                        error:
                            "Ungültige User-ID",
                    });

                    return;
                }

                const existed =
                    bans.delete(userId);

                const persisted =
                    saveBans();

                console.log(
                    `[NEXU] UNBAN ${userId}`
                );

                sendJson(res, 200, {
                    success: true,
                    banned: false,
                    existed,
                    persisted,
                });
            } catch (error) {
                sendJson(
                    res,

                    error.message ===
                        "BODY_TOO_LARGE"
                        ? 413
                        : 400,

                    {
                        success: false,

                        error:
                            error.message ===
                                "BODY_TOO_LARGE"
                                ? "Anfrage zu groß"
                                : "Ungültiges JSON",
                    }
                );
            }

            return;
        }

        sendJson(res, 404, {
            success: false,
            error:
                "Route nicht gefunden",
        });
    }
);

setInterval(
    prunePresence,
    20_000
).unref();

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            "========================================"
        );

        console.log(
            "NEXU PRESENCE & MODERATION GESTARTET"
        );

        console.log(
            "Port:",
            PORT
        );

        console.log(
            "Heartbeat-Token eingerichtet:",
            HEARTBEAT_TOKEN.length >= 16
        );

        console.log(
            "Admin-Key eingerichtet:",
            ADMIN_KEY.length >= 20
        );

        console.log(
            "Ban-Datei:",
            BAN_FILE_PATH
        );

        console.log(
            "========================================"
        );
    }
);
