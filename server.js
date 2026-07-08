const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = String(process.env.API_KEY || "");
const ONLINE_TIMEOUT_MS = 75_000;
const MAX_BODY_BYTES = 100_000;
const AVATAR_CACHE_MS = 10 * 60_000;

const presence = new Map();
const avatarCache = new Map();

function sendJson(res, statusCode, data, extraHeaders = {}) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...extraHeaders,
    });
    res.end(JSON.stringify(data));
}

function sendHtml(res, statusCode, html) {
    res.writeHead(statusCode, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
            "default-src 'self'; " +
            "img-src 'self' https: data:; " +
            "style-src 'unsafe-inline'; " +
            "script-src 'unsafe-inline'; " +
            "connect-src 'self'; " +
            "base-uri 'none'; " +
            "frame-ancestors 'none'",
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
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function prunePresence() {
    const now = Date.now();
    for (const [key, entry] of presence) {
        if (now - entry.lastSeenMs > ONLINE_TIMEOUT_MS) {
            presence.delete(key);
        }
    }
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        let tooLarge = false;

        req.on("data", (chunk) => {
            raw += chunk.toString("utf8");
            if (raw.length > MAX_BODY_BYTES) {
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
    return API_KEY.length >= 16 && req.headers["x-api-key"] === API_KEY;
}

async function fetchAvatarUrls(userIds) {
    const now = Date.now();
    const result = new Map();
    const missing = [];

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
                "?userIds=" + encodeURIComponent(batch.join(",")) +
                "&size=150x150&format=Png&isCircular=false";

            const response = await fetch(endpoint, {
                headers: {
                    "User-Agent": "Nexu-Presence-Dashboard/1.0",
                    "Accept": "application/json",
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
            console.warn("Avatar lookup failed:", error.message);
        }
    }

    for (const id of userIds) {
        if (!result.has(id)) {
            const fallback =
                "https://www.roblox.com/headshot-thumbnail/image" +
                "?userId=" + encodeURIComponent(id) +
                "&width=150&height=150&format=png";
            result.set(id, fallback);
        }
    }

    return result;
}

async function getPublicPresence() {
    prunePresence();

    const rows = [...presence.values()]
        .sort((a, b) => {
            const left = a.displayName.toLocaleLowerCase();
            const right = b.displayName.toLocaleLowerCase();
            return left.localeCompare(right);
        });

    const avatarUrls = await fetchAvatarUrls(
        [...new Set(rows.map((row) => row.userId))]
    );

    return rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: avatarUrls.get(row.userId) || "",
        placeId: row.placeId,
        jobId: row.jobId,
        joinedAt: new Date(row.joinedAtMs).toISOString(),
        lastSeen: new Date(row.lastSeenMs).toISOString(),
    }));
}

function dashboardHtml() {
    return String.raw`<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#03070e">
    <title>Nexu</title>
    <style>
        :root {
            --bg: #03070e;
            --panel: rgba(7, 13, 23, .86);
            --panel2: rgba(10, 18, 31, .76);
            --text: #dceef8;
            --muted: #7894a8;
            --cyan: #00c8ff;
            --violet: #6f46ff;
            --green: #2dffa5;
            --red: #ff4d78;
            --border: rgba(74, 178, 230, .28);
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            min-height: 100%;
            color: var(--text);
            background:
                radial-gradient(circle at 18% 5%, rgba(0,200,255,.14), transparent 34rem),
                radial-gradient(circle at 88% 20%, rgba(111,70,255,.14), transparent 32rem),
                var(--bg);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        }

        body::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            opacity: .23;
            background-image:
                linear-gradient(rgba(0,200,255,.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,200,255,.06) 1px, transparent 1px);
            background-size: 32px 32px;
            mask-image: linear-gradient(to bottom, black, transparent 85%);
        }

        .scan {
            position: fixed;
            z-index: 0;
            left: 0;
            right: 0;
            height: 1px;
            top: -2px;
            background: linear-gradient(90deg, transparent, rgba(0,200,255,.8), transparent);
            box-shadow: 0 0 20px rgba(0,200,255,.75);
            animation: scan 7s linear infinite;
            pointer-events: none;
        }

        @keyframes scan {
            from { transform: translateY(0); opacity: 0; }
            8% { opacity: .65; }
            92% { opacity: .65; }
            to { transform: translateY(100vh); opacity: 0; }
        }

        .shell {
            position: relative;
            z-index: 1;
            width: min(1180px, calc(100% - 32px));
            margin: 0 auto;
            padding: 26px 0 54px;
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 28px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 13px;
        }

        .logo {
            width: 44px;
            height: 44px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            font-weight: 850;
            font-size: 19px;
            color: white;
            background: linear-gradient(135deg, var(--cyan), var(--violet));
            box-shadow:
                0 0 0 1px rgba(255,255,255,.17) inset,
                0 0 28px rgba(0,200,255,.28);
        }

        .brand-copy strong {
            display: block;
            font-size: 20px;
            letter-spacing: .02em;
        }

        .brand-copy span {
            color: var(--muted);
            font-size: 12px;
            letter-spacing: .13em;
            text-transform: uppercase;
        }

        .live-pill {
            display: flex;
            align-items: center;
            gap: 9px;
            min-height: 38px;
            padding: 0 14px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: rgba(7,13,23,.72);
            color: var(--muted);
            font-size: 13px;
            backdrop-filter: blur(14px);
        }

        .dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: var(--muted);
            box-shadow: 0 0 14px currentColor;
        }

        .dot.online { background: var(--green); color: var(--green); }
        .dot.offline { background: var(--red); color: var(--red); }

        .hero {
            padding: 29px;
            border: 1px solid var(--border);
            border-radius: 28px;
            background:
                linear-gradient(135deg, rgba(0,200,255,.07), rgba(111,70,255,.05)),
                var(--panel);
            box-shadow:
                0 26px 80px rgba(0,0,0,.34),
                0 0 0 1px rgba(255,255,255,.025) inset;
            backdrop-filter: blur(18px);
        }

        .eyebrow {
            color: var(--cyan);
            font-size: 11px;
            letter-spacing: .19em;
            text-transform: uppercase;
        }

        h1 {
            margin: 8px 0 8px;
            max-width: 760px;
            font-size: clamp(30px, 5vw, 52px);
            line-height: 1.03;
            letter-spacing: -.04em;
        }

        .hero p {
            margin: 0;
            max-width: 760px;
            color: var(--muted);
            line-height: 1.65;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-top: 24px;
        }

        .stat {
            min-height: 122px;
            padding: 18px;
            border: 1px solid rgba(74,178,230,.19);
            border-radius: 19px;
            background: var(--panel2);
        }

        .stat-label {
            color: var(--muted);
            font-size: 11px;
            letter-spacing: .12em;
            text-transform: uppercase;
        }

        .stat-value {
            margin-top: 11px;
            font-size: 27px;
            font-weight: 780;
        }

        .stat-note {
            margin-top: 8px;
            color: #66849a;
            font-size: 12px;
        }

        .directory {
            margin-top: 22px;
            padding: 24px;
            border: 1px solid var(--border);
            border-radius: 25px;
            background: var(--panel);
            backdrop-filter: blur(18px);
        }

        .directory-head {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
        }

        .directory h2 {
            margin: 4px 0 0;
            font-size: 21px;
        }

        .search {
            width: min(380px, 100%);
            height: 44px;
            border: 1px solid rgba(74,178,230,.25);
            border-radius: 13px;
            outline: none;
            padding: 0 15px;
            color: var(--text);
            background: rgba(3,8,15,.8);
            font: inherit;
        }

        .search:focus {
            border-color: rgba(0,200,255,.68);
            box-shadow: 0 0 0 3px rgba(0,200,255,.08);
        }

        .players {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .player {
            display: flex;
            align-items: center;
            gap: 14px;
            min-width: 0;
            padding: 13px;
            border: 1px solid rgba(74,178,230,.16);
            border-radius: 17px;
            background: rgba(8,15,26,.76);
            transition: transform .16s ease, border-color .16s ease;
        }

        .player:hover {
            transform: translateY(-2px);
            border-color: rgba(0,200,255,.37);
        }

        .avatar {
            width: 58px;
            height: 58px;
            flex: 0 0 58px;
            object-fit: cover;
            border-radius: 14px;
            background: #0b1422;
            border: 1px solid rgba(0,200,255,.26);
        }

        .identity {
            min-width: 0;
            flex: 1;
        }

        .display-name {
            overflow: hidden;
            font-weight: 760;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .username {
            overflow: hidden;
            margin-top: 3px;
            color: var(--muted);
            font-size: 13px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .player-state {
            flex: 0 0 auto;
            color: var(--green);
            font-size: 11px;
            letter-spacing: .1em;
            text-transform: uppercase;
        }

        .empty {
            grid-column: 1 / -1;
            padding: 40px 20px;
            border: 1px dashed rgba(74,178,230,.22);
            border-radius: 17px;
            color: var(--muted);
            text-align: center;
        }

        .footer-note {
            margin-top: 14px;
            color: #557084;
            font-size: 12px;
            text-align: right;
        }

        @media (max-width: 760px) {
            .shell { width: min(100% - 20px, 1180px); padding-top: 16px; }
            header { align-items: flex-start; }
            .brand-copy span { display: none; }
            .hero { padding: 22px; border-radius: 22px; }
            .stats { grid-template-columns: 1fr; }
            .directory { padding: 18px; }
            .directory-head { align-items: stretch; flex-direction: column; }
            .search { width: 100%; }
            .players { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="scan"></div>
    <main class="shell">
        <header>
            <div class="brand">
                <div class="logo">N</div>
                <div class="brand-copy">
                    <strong>Nexu</strong>
                    <span>Presence Network</span>
                </div>
            </div>
            <div class="live-pill">
                <span id="headerDot" class="dot"></span>
                <span id="headerStatus">Verbindung wird geprüft</span>
            </div>
        </header>

        <section class="hero">
            <div class="eyebrow">NEXU // LIVE SYSTEM</div>
            <h1>Aktive Nutzer auf einen Blick.</h1>
            <p>
                Das Dashboard zeigt Spieler, deren Nexu-Menü in deiner eigenen
                Experience gerade aktiv ist. Ein Nutzer wird automatisch als
                offline entfernt, wenn längere Zeit kein Heartbeat eingeht.
            </p>

            <div class="stats">
                <article class="stat">
                    <div class="stat-label">Serverstatus</div>
                    <div id="serverStatus" class="stat-value">Prüfe …</div>
                    <div class="stat-note">Render-Web-Service</div>
                </article>
                <article class="stat">
                    <div class="stat-label">Aktive Spieler</div>
                    <div id="playerCount" class="stat-value">0</div>
                    <div class="stat-note">Heartbeat in den letzten 75 Sekunden</div>
                </article>
                <article class="stat">
                    <div class="stat-label">Letzte Aktualisierung</div>
                    <div id="updatedAt" class="stat-value">–</div>
                    <div class="stat-note">Automatisch alle 10 Sekunden</div>
                </article>
            </div>
        </section>

        <section class="directory">
            <div class="directory-head">
                <div>
                    <div class="eyebrow">MENU SPIELER</div>
                    <h2>Verbundenes Spieler-Verzeichnis</h2>
                </div>
                <input
                    id="search"
                    class="search"
                    type="search"
                    autocomplete="off"
                    placeholder="Spieler suchen …"
                    aria-label="Spieler suchen"
                >
            </div>

            <div id="players" class="players"></div>
            <div id="footerNote" class="footer-note"></div>
        </section>
    </main>

    <script>
        const state = {
            online: false,
            players: [],
            query: "",
        };

        const elements = {
            headerDot: document.getElementById("headerDot"),
            headerStatus: document.getElementById("headerStatus"),
            serverStatus: document.getElementById("serverStatus"),
            playerCount: document.getElementById("playerCount"),
            updatedAt: document.getElementById("updatedAt"),
            search: document.getElementById("search"),
            players: document.getElementById("players"),
            footerNote: document.getElementById("footerNote"),
        };

        function escapeHtml(value) {
            return String(value)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        function render() {
            elements.headerDot.className =
                "dot " + (state.online ? "online" : "offline");
            elements.headerStatus.textContent =
                state.online ? "Server online" : "Server nicht erreichbar";
            elements.serverStatus.textContent =
                state.online ? "ONLINE" : "OFFLINE";
            elements.serverStatus.style.color =
                state.online ? "var(--green)" : "var(--red)";
            elements.playerCount.textContent = String(state.players.length);

            const query = state.query.trim().toLocaleLowerCase();
            const filtered = state.players.filter((player) => {
                return !query ||
                    player.displayName.toLocaleLowerCase().includes(query) ||
                    player.username.toLocaleLowerCase().includes(query);
            });

            if (filtered.length === 0) {
                elements.players.innerHTML =
                    '<div class="empty">' +
                    (state.players.length === 0
                        ? "Zurzeit ist kein Spieler mit dem Nexu-Menü verbunden."
                        : "Kein Spieler passt zu deiner Suche.") +
                    "</div>";
            } else {
                elements.players.innerHTML = filtered.map((player) =>
                    '<article class="player">' +
                        '<img class="avatar" src="' + escapeHtml(player.avatarUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' +
                        '<div class="identity">' +
                            '<div class="display-name">' + escapeHtml(player.displayName) + '</div>' +
                            '<div class="username">@' + escapeHtml(player.username) + '</div>' +
                        '</div>' +
                        '<div class="player-state">Online</div>' +
                    '</article>'
                ).join("");
            }

            elements.footerNote.textContent =
                filtered.length + " von " + state.players.length + " Spielern angezeigt";
        }

        async function refresh() {
            try {
                const response = await fetch("/api/presence", {
                    headers: { "Accept": "application/json" },
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("HTTP " + response.status);
                }

                const data = await response.json();
                state.online = data.online === true;
                state.players = Array.isArray(data.players) ? data.players : [];
                elements.updatedAt.textContent =
                    new Date().toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    });
            } catch {
                state.online = false;
                state.players = [];
                elements.updatedAt.textContent = "Fehler";
            }

            render();
        }

        elements.search.addEventListener("input", (event) => {
            state.query = event.target.value || "";
            render();
        });

        refresh();
        setInterval(refresh, 10_000);
    </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, "http://localhost");
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/") {
        console.log("[NEXU] Dashboard aufgerufen");
        sendHtml(res, 200, dashboardHtml());
        return;
    }

    if (req.method === "GET" && (pathname === "/status" || pathname === "/api/status")) {
        prunePresence();
        sendJson(res, 200, {
            success: true,
            online: true,
            service: "Nexu Presence",
            activePlayers: presence.size,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    if (req.method === "GET" && pathname === "/api/presence") {
        const players = await getPublicPresence();
        sendJson(res, 200, {
            success: true,
            online: true,
            activePlayers: players.length,
            timeoutSeconds: ONLINE_TIMEOUT_MS / 1000,
            players,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    if (req.method === "POST" && pathname === "/api/presence/heartbeat") {
        if (!isAuthorized(req)) {
            console.warn("[NEXU] Heartbeat abgelehnt: ungültiger API-Key");
            sendJson(res, 401, {
                success: false,
                error: "Ungültiger API-Key",
            });
            return;
        }

        try {
            const body = await readJsonBody(req);
            const jobId = cleanText(body.jobId, 100);
            const placeId = cleanInteger(body.placeId);
            const incomingPlayers = Array.isArray(body.players)
                ? body.players.slice(0, 200)
                : [];

            if (!jobId) {
                sendJson(res, 400, {
                    success: false,
                    error: "jobId fehlt",
                });
                return;
            }

            const now = Date.now();
            const currentKeys = new Set();

            for (const rawPlayer of incomingPlayers) {
                if (!rawPlayer || typeof rawPlayer !== "object") {
                    continue;
                }

                const userId = cleanNumericId(rawPlayer.userId);
                const username = cleanText(rawPlayer.username, 40);
                const displayName = cleanText(rawPlayer.displayName, 80);

                if (!userId || !username || !displayName) {
                    continue;
                }

                const key = `${jobId}:${userId}`;
                currentKeys.add(key);

                const existing = presence.get(key);
                presence.set(key, {
                    userId,
                    username,
                    displayName,
                    placeId,
                    jobId,
                    joinedAtMs: existing ? existing.joinedAtMs : now,
                    lastSeenMs: now,
                });
            }

            // Der Roblox-Server sendet immer die vollständige aktuelle Liste.
            // Nutzer, die in diesem Job nicht mehr gemeldet werden, gehen sofort offline.
            for (const [key, entry] of presence) {
                if (entry.jobId === jobId && !currentKeys.has(key)) {
                    presence.delete(key);
                }
            }

            prunePresence();

            console.log(
                `[NEXU] Heartbeat: Job ${jobId}, ` +
                `${currentKeys.size} aktive Spieler, ` +
                `${presence.size} insgesamt`
            );

            sendJson(res, 200, {
                success: true,
                activePlayers: presence.size,
                receivedPlayers: currentKeys.size,
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

    sendJson(res, 404, {
        success: false,
        error: "Route nicht gefunden",
    });
});

setInterval(prunePresence, 20_000).unref();

server.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log("NEXU PRESENCE SERVER GESTARTET");
    console.log("Port:", PORT);
    console.log("API-Key eingerichtet:", API_KEY.length >= 16);
    console.log("Dashboard: /");
    console.log("Status: /api/status");
    console.log("Presence: /api/presence");
    console.log("========================================");
});
