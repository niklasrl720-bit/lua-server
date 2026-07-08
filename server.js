const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const HEARTBEAT_TOKEN = String(process.env.HEARTBEAT_TOKEN || "");
const ONLINE_TIMEOUT_MS = 75_000;
const MAX_BODY_BYTES = 20_000;
const AVATAR_CACHE_MS = 10 * 60_000;

const presence = new Map();
const avatarCache = new Map();

function cleanText(value, maxLength = 100) {
    return typeof value === "string"
        ? value.trim().slice(0, maxLength)
        : "";
}

function cleanUserId(value) {
    const text = String(value ?? "").trim();
    return /^\d{1,30}$/.test(text) ? text : "";
}

function cleanInteger(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
            "Content-Type, Accept, X-Nexu-Heartbeat-Token",
    });

    res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
            "default-src 'self'; " +
            "img-src https: data:; " +
            "style-src 'unsafe-inline'; " +
            "script-src 'unsafe-inline'; " +
            "connect-src 'self'; " +
            "frame-ancestors 'none'",
    });

    res.end(html);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        let tooLarge = false;

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

            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch {
                reject(new Error("INVALID_JSON"));
            }
        });

        req.on("error", reject);
    });
}

function isAuthorized(req) {
    /*
        Falls bei Render keine Umgebungsvariable namens
        HEARTBEAT_TOKEN eingetragen ist, wird kein Token verlangt.

        Falls du dort ein Token einträgst, muss im Lua-Script bei
        NEXU_PRESENCE_HEARTBEAT_TOKEN genau dasselbe Token stehen.
    */

    if (!HEARTBEAT_TOKEN) {
        return true;
    }

    return req.headers["x-nexu-heartbeat-token"] === HEARTBEAT_TOKEN;
}

function prunePresence() {
    const now = Date.now();

    for (const [userId, entry] of presence) {
        if (now - entry.lastSeenMs > ONLINE_TIMEOUT_MS) {
            presence.delete(userId);

            console.log(
                `[NEXU] TIMEOUT/OFFLINE: ${entry.displayName} ` +
                `(@${entry.username}) [${entry.userId}]`
            );
        }
    }
}

async function getAvatarUrls(userIds) {
    const now = Date.now();
    const result = new Map();
    const missing = [];

    for (const userId of userIds) {
        const cached = avatarCache.get(userId);

        if (cached && now - cached.savedAt < AVATAR_CACHE_MS) {
            result.set(userId, cached.url);
        } else {
            missing.push(userId);
        }
    }

    for (let index = 0; index < missing.length; index += 100) {
        const batch = missing.slice(index, index + 100);

        try {
            const url =
                "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
                "?userIds=" + encodeURIComponent(batch.join(",")) +
                "&size=150x150&format=Png&isCircular=false";

            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "Nexu-Presence/1.0",
                },
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const json = await response.json();
            const rows = Array.isArray(json.data) ? json.data : [];

            for (const row of rows) {
                const userId = cleanUserId(row.targetId);
                const imageUrl = cleanText(row.imageUrl, 600);

                if (userId && imageUrl.startsWith("https://")) {
                    result.set(userId, imageUrl);

                    avatarCache.set(userId, {
                        url: imageUrl,
                        savedAt: now,
                    });
                }
            }
        } catch (error) {
            console.warn(
                "[NEXU] Avatar-Abfrage fehlgeschlagen:",
                error.message
            );
        }
    }

    /*
        Ersatzbild-URL, falls die Roblox Thumbnail-API vorübergehend
        nicht antwortet.
    */

    for (const userId of userIds) {
        if (!result.has(userId)) {
            result.set(
                userId,
                "https://www.roblox.com/headshot-thumbnail/image" +
                    "?userId=" + encodeURIComponent(userId) +
                    "&width=150&height=150&format=png"
            );
        }
    }

    return result;
}

async function getPublicPlayers(jobId = "") {
    prunePresence();

    const rows = [...presence.values()]
        .filter((entry) => {
            return !jobId || entry.jobId === jobId;
        })
        .sort((a, b) => {
            return a.displayName.localeCompare(
                b.displayName,
                "de",
                {
                    sensitivity: "base",
                }
            );
        });

    const avatarUrls = await getAvatarUrls(
        [...new Set(rows.map((entry) => entry.userId))]
    );

    return rows.map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        displayName: entry.displayName,
        avatarUrl: avatarUrls.get(entry.userId) || "",
        placeId: entry.placeId,
        jobId: entry.jobId,
        joinedAt: new Date(entry.joinedAtMs).toISOString(),
        lastSeen: new Date(entry.lastSeenMs).toISOString(),
    }));
}

function dashboardHtml() {
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nexu Presence</title>

<style>
:root {
    color-scheme: dark;
    --bg: #03070e;
    --panel: #08111e;
    --text: #e1f4ff;
    --muted: #7895aa;
    --cyan: #00c8ff;
    --green: #2dffa5;
    --red: #ff4d78;
    --border: rgba(0, 200, 255, .25);
}

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    color: var(--text);
    font-family: Arial, sans-serif;
    background:
        radial-gradient(
            circle at 20% 0,
            rgba(0, 200, 255, .15),
            transparent 35rem
        ),
        radial-gradient(
            circle at 90% 20%,
            rgba(111, 70, 255, .14),
            transparent 32rem
        ),
        var(--bg);
}

main {
    width: min(1050px, calc(100% - 28px));
    margin: auto;
    padding: 28px 0 50px;
}

header,
.panel {
    border: 1px solid var(--border);
    background: rgba(8, 17, 30, .9);
    box-shadow: 0 24px 70px rgba(0, 0, 0, .35);
}

header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px;
    border-radius: 22px;
}

h1 {
    margin: 0;
    font-size: clamp(26px, 5vw, 44px);
}

.subtitle {
    margin-top: 7px;
    color: var(--muted);
}

.status {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted);
}

.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    color: var(--red);
    background: var(--red);
    box-shadow: 0 0 14px currentColor;
}

.dot.online {
    color: var(--green);
    background: var(--green);
}

.panel {
    margin-top: 20px;
    padding: 22px;
    border-radius: 22px;
}

.panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
}

.count {
    color: var(--cyan);
    font-weight: 700;
}

input {
    width: min(360px, 100%);
    height: 42px;
    padding: 0 13px;
    color: var(--text);
    background: #050c16;
    border: 1px solid var(--border);
    border-radius: 12px;
    outline: none;
}

.players {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.player {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
    padding: 13px;
    border: 1px solid rgba(0, 200, 255, .16);
    border-radius: 16px;
    background: #0b1728;
}

.avatar {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    object-fit: cover;
    border-radius: 14px;
    border: 1px solid var(--border);
}

.identity {
    min-width: 0;
    flex: 1;
}

.display-name,
.username {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.display-name {
    font-weight: 700;
}

.username {
    margin-top: 4px;
    color: var(--muted);
    font-size: 13px;
}

.online {
    color: var(--green);
    font-size: 12px;
}

.empty {
    grid-column: 1 / -1;
    padding: 36px 15px;
    color: var(--muted);
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 16px;
}

footer {
    margin-top: 14px;
    color: var(--muted);
    font-size: 12px;
}

@media (max-width: 700px) {
    header,
    .panel-head {
        align-items: stretch;
        flex-direction: column;
    }

    .players {
        grid-template-columns: 1fr;
    }

    input {
        width: 100%;
    }
}
</style>
</head>

<body>
<main>
    <header>
        <div>
            <h1>Nexu Presence</h1>

            <div class="subtitle">
                Aktuell verbundene Nutzer des Nexu-Menüs
            </div>
        </div>

        <div class="status">
            <span id="dot" class="dot"></span>
            <span id="serverStatus">Prüfe Server …</span>
        </div>
    </header>

    <section class="panel">
        <div class="panel-head">
            <div>
                <span id="count" class="count">0</span>
                aktive Spieler
            </div>

            <input
                id="search"
                type="search"
                placeholder="Spieler suchen …"
            >
        </div>

        <div id="players" class="players"></div>

        <footer id="updated">
            Noch nicht aktualisiert
        </footer>
    </section>
</main>

<script>
const dot = document.getElementById("dot");
const serverStatus = document.getElementById("serverStatus");
const count = document.getElementById("count");
const search = document.getElementById("search");
const playersContainer = document.getElementById("players");
const updated = document.getElementById("updated");

let players = [];

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function render() {
    const query = search.value.trim().toLowerCase();

    const filtered = players.filter((player) => {
        return (
            !query ||
            String(player.displayName)
                .toLowerCase()
                .includes(query) ||
            String(player.username)
                .toLowerCase()
                .includes(query)
        );
    });

    count.textContent = String(players.length);

    if (filtered.length === 0) {
        playersContainer.innerHTML =
            '<div class="empty">' +
            (
                players.length === 0
                    ? "Zurzeit ist kein Nexu-Nutzer online."
                    : "Kein Spieler passt zur Suche."
            ) +
            "</div>";

        return;
    }

    playersContainer.innerHTML = filtered
        .map((player) => {
            return (
                '<article class="player">' +
                    '<img class="avatar" src="' +
                        escapeHtml(player.avatarUrl) +
                        '" alt="">' +

                    '<div class="identity">' +
                        '<div class="display-name">' +
                            escapeHtml(player.displayName) +
                        "</div>" +

                        '<div class="username">@' +
                            escapeHtml(player.username) +
                        "</div>" +
                    "</div>" +

                    '<div class="online">ONLINE</div>' +
                "</article>"
            );
        })
        .join("");
}

async function refresh() {
    try {
        const response = await fetch(
            "/api/presence",
            {
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        players = Array.isArray(data.players)
            ? data.players
            : [];

        dot.className = "dot online";
        serverStatus.textContent = "Server online";

        updated.textContent =
            "Letzte Aktualisierung: " +
            new Date().toLocaleTimeString("de-DE");
    } catch (error) {
        players = [];

        dot.className = "dot";
        serverStatus.textContent =
            "Server nicht erreichbar";

        updated.textContent =
            "Fehler: " + error.message;
    }

    render();
}

search.addEventListener("input", render);

refresh();

setInterval(refresh, 10_000);
</script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(
        req.url,
        "http://localhost"
    );

    const pathname = requestUrl.pathname;

    /*
        CORS-Voranfrage
    */

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers":
                "Content-Type, Accept, X-Nexu-Heartbeat-Token",
        });

        res.end();
        return;
    }

    /*
        Dashboard
    */

    if (
        req.method === "GET" &&
        pathname === "/"
    ) {
        console.log("[NEXU] Dashboard aufgerufen");

        sendHtml(
            res,
            dashboardHtml()
        );

        return;
    }

    /*
        Serverstatus
    */

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
            service: "Nexu Presence",
            activePlayers: presence.size,
            timeoutSeconds:
                ONLINE_TIMEOUT_MS / 1000,
            timestamp:
                new Date().toISOString(),
        });

        return;
    }

    /*
        Aktive Spieler abrufen.

        Ohne jobId:
        /api/presence

        Nur Spieler aus derselben Roblox-Serverinstanz:
        /api/presence?jobId=DEINE_JOB_ID
    */

    if (
        req.method === "GET" &&
        pathname === "/api/presence"
    ) {
        const jobId = cleanText(
            requestUrl.searchParams.get("jobId"),
            100
        );

        const players =
            await getPublicPlayers(jobId);

        sendJson(res, 200, {
            success: true,
            online: true,
            activePlayers: players.length,
            filteredJobId: jobId || null,
            timeoutSeconds:
                ONLINE_TIMEOUT_MS / 1000,
            players,
            timestamp:
                new Date().toISOString(),
        });

        return;
    }

    /*
        Heartbeat eines einzelnen Lua-Nutzers
    */

    if (
        req.method === "POST" &&
        pathname === "/api/presence/heartbeat"
    ) {
        if (!isAuthorized(req)) {
            console.warn(
                "[NEXU] Heartbeat abgelehnt: falsches Token"
            );

            sendJson(res, 401, {
                success: false,
                error:
                    "Ungültiges Heartbeat-Token",
            });

            return;
        }

        try {
            const body =
                await readJsonBody(req);

            const userId =
                cleanUserId(body.userId);

            const username =
                cleanText(body.username, 40);

            const displayName =
                cleanText(body.displayName, 80);

            const placeId =
                cleanInteger(body.placeId);

            const jobId =
                cleanText(body.jobId, 100);

            const sessionId =
                cleanText(body.sessionId, 100);

            if (
                !userId ||
                !username ||
                !displayName ||
                !jobId ||
                !sessionId
            ) {
                sendJson(res, 400, {
                    success: false,
                    error:
                        "userId, username, displayName, jobId und sessionId fehlen",
                });

                return;
            }

            const now = Date.now();
            const oldEntry =
                presence.get(userId);

            const isNewSession =
                !oldEntry ||
                oldEntry.sessionId !== sessionId;

            presence.set(userId, {
                userId,
                username,
                displayName,
                placeId,
                jobId,
                sessionId,

                joinedAtMs:
                    isNewSession
                        ? now
                        : oldEntry.joinedAtMs,

                lastSeenMs: now,
            });

            prunePresence();

            console.log(
                `[NEXU] ${
                    isNewSession
                        ? "ONLINE"
                        : "HEARTBEAT"
                }: ` +
                `${displayName} ` +
                `(@${username}) ` +
                `[${userId}] | ` +
                `Place ${placeId} | ` +
                `Job ${jobId} | ` +
                `${presence.size} insgesamt`
            );

            const activePlayersInJob =
                [...presence.values()]
                    .filter((entry) => {
                        return entry.jobId === jobId;
                    })
                    .length;

            sendJson(res, 200, {
                success: true,
                activePlayers:
                    presence.size,
                activePlayersInJob,
                timeoutSeconds:
                    ONLINE_TIMEOUT_MS / 1000,
                timestamp:
                    new Date().toISOString(),
            });
        } catch (error) {
            sendJson(
                res,
                error.message === "BODY_TOO_LARGE"
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

    /*
        Lua-Nutzer meldet sich beim Schließen
        des Menüs ab.
    */

    if (
        req.method === "POST" &&
        pathname === "/api/presence/offline"
    ) {
        if (!isAuthorized(req)) {
            sendJson(res, 401, {
                success: false,
                error:
                    "Ungültiges Heartbeat-Token",
            });

            return;
        }

        try {
            const body =
                await readJsonBody(req);

            const userId =
                cleanUserId(body.userId);

            const sessionId =
                cleanText(body.sessionId, 100);

            const entry =
                userId
                    ? presence.get(userId)
                    : null;

            /*
                Nur die aktuell registrierte Sitzung
                darf diesen Nutzer entfernen.
            */

            if (
                entry &&
                entry.sessionId === sessionId
            ) {
                presence.delete(userId);

                console.log(
                    `[NEXU] OFFLINE: ` +
                    `${entry.displayName} ` +
                    `(@${entry.username}) ` +
                    `[${entry.userId}]`
                );
            }

            sendJson(res, 200, {
                success: true,
                activePlayers:
                    presence.size,
                timestamp:
                    new Date().toISOString(),
            });
        } catch {
            sendJson(res, 400, {
                success: false,
                error: "Ungültiges JSON",
            });
        }

        return;
    }

    /*
        Unbekannte Route
    */

    sendJson(res, 404, {
        success: false,
        error: "Route nicht gefunden",
    });
});

/*
    Alle 20 Sekunden alte Nutzer entfernen.
*/

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
            "NEXU PRESENCE SERVER GESTARTET"
        );

        console.log(
            "Port:",
            PORT
        );

        console.log(
            "Dashboard: /"
        );

        console.log(
            "Status: /api/status"
        );

        console.log(
            "Presence: /api/presence"
        );

        console.log(
            "Heartbeat: POST /api/presence/heartbeat"
        );

        console.log(
            "Offline: POST /api/presence/offline"
        );

        console.log(
            "Heartbeat-Token eingerichtet:",
            HEARTBEAT_TOKEN.length > 0
        );

        console.log(
            "========================================"
        );
    }
);
