const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);

const HEARTBEAT_TOKEN = String(
    process.env.HEARTBEAT_TOKEN || ""
);

const ADMIN_KEY = String(
    process.env.ADMIN_KEY || ""
);

const ONLINE_TIMEOUT_MS = 75_000;
const MAX_BODY_BYTES = 100_000;
const AVATAR_CACHE_MS = 10 * 60_000;

const MENU_CREATOR_USER_ID = "10199760908";

const BAN_FILE_PATH = String(
    process.env.BAN_FILE_PATH ||
    path.join(
        process.cwd(),
        "data",
        "nexu-bans.json"
    )
);

const presence = new Map();
const bans = new Map();
const avatarCache = new Map();


/* ============================================================
   HTTP-HILFSFUNKTIONEN
============================================================ */

function sendJson(
    res,
    statusCode,
    data
) {
    res.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Cache-Control":
                "no-store",

            "X-Content-Type-Options":
                "nosniff",
        }
    );

    res.end(
        JSON.stringify(data)
    );
}


function sendHtml(
    res,
    html
) {
    res.writeHead(
        200,
        {
            "Content-Type":
                "text/html; charset=utf-8",

            "Cache-Control":
                "no-store",

            "X-Content-Type-Options":
                "nosniff",

            "Referrer-Policy":
                "no-referrer",

            "Content-Security-Policy":
                "default-src 'self'; " +
                "img-src 'self' https: data:; " +
                "style-src 'unsafe-inline'; " +
                "script-src 'unsafe-inline'; " +
                "connect-src 'self'; " +
                "base-uri 'none'; " +
                "frame-ancestors 'none'",
        }
    );

    res.end(html);
}


function cleanText(
    value,
    maxLength
) {
    return typeof value === "string"
        ? value
            .trim()
            .slice(0, maxLength)
        : "";
}


function cleanNumericId(value) {
    const text =
        String(value ?? "")
            .trim();

    return /^\d{1,30}$/.test(text)
        ? text
        : "";
}


function cleanInteger(value) {
    const number =
        Number(value);

    return (
        Number.isSafeInteger(number) &&
        number >= 0
    )
        ? number
        : 0;
}


function readJsonBody(req) {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            let raw = "";
            let tooLarge = false;

            req.on(
                "data",
                (chunk) => {
                    raw +=
                        chunk.toString(
                            "utf8"
                        );

                    if (
                        Buffer.byteLength(
                            raw,
                            "utf8"
                        ) >
                        MAX_BODY_BYTES
                    ) {
                        tooLarge = true;
                    }
                }
            );

            req.on(
                "end",
                () => {
                    if (tooLarge) {
                        reject(
                            new Error(
                                "BODY_TOO_LARGE"
                            )
                        );

                        return;
                    }

                    try {
                        resolve(
                            raw
                                ? JSON.parse(raw)
                                : {}
                        );
                    } catch {
                        reject(
                            new Error(
                                "INVALID_JSON"
                            )
                        );
                    }
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}


/* ============================================================
   AUTHENTIFIZIERUNG
============================================================ */

function isHeartbeatAuthorized(req) {
    // Kein Heartbeat-Token eingestellt:
    // Presence-Verbindungen werden ohne Token angenommen.
    if (HEARTBEAT_TOKEN === "") {
        return true;
    }

    const supplied = String(
        req.headers["x-nexu-heartbeat-token"] || ""
    );

    return supplied === HEARTBEAT_TOKEN;
}


function isAdminAuthorized(req) {
    return (
        ADMIN_KEY.length >= 20 &&

        String(
            req.headers[
                "x-admin-key"
            ] || ""
        ) === ADMIN_KEY
    );
}


/* ============================================================
   PRESENCE
============================================================ */

function prunePresence() {
    const now =
        Date.now();

    for (
        const [
            key,
            entry
        ]
        of presence
    ) {
        const expired =
            now -
            entry.lastSeenMs >
            ONLINE_TIMEOUT_MS;

        const blocked =
            bans.has(
                entry.userId
            );

        if (
            expired ||
            blocked
        ) {
            presence.delete(key);
        }
    }
}


function removePresenceForUser(
    userId
) {
    let removed = 0;

    for (
        const [
            key,
            entry
        ]
        of presence
    ) {
        if (
            entry.userId ===
            userId
        ) {
            presence.delete(key);
            removed += 1;
        }
    }

    return removed;
}


function latestPresence(
    userId
) {
    let latest = null;

    for (
        const entry
        of presence.values()
    ) {
        if (
            entry.userId ===
                userId &&

            (
                !latest ||

                entry.lastSeenMs >
                latest.lastSeenMs
            )
        ) {
            latest = entry;
        }
    }

    return latest;
}


/* ============================================================
   BAN-SPEICHER
============================================================ */

function loadBans() {
    try {
        if (
            !fs.existsSync(
                BAN_FILE_PATH
            )
        ) {
            return;
        }

        const parsed =
            JSON.parse(
                fs.readFileSync(
                    BAN_FILE_PATH,
                    "utf8"
                )
            );

        const rows =
            Array.isArray(parsed)
                ? parsed
                : parsed.bans;

        if (
            !Array.isArray(rows)
        ) {
            return;
        }

        for (
            const row
            of rows
        ) {
            const userId =
                cleanNumericId(
                    row?.userId
                );

            if (!userId) {
                continue;
            }

            bans.set(
                userId,
                {
                    userId,

                    username:
                        cleanText(
                            row.username,
                            40
                        ),

                    displayName:
                        cleanText(
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

                        new Date()
                            .toISOString(),

                    bannedBy:
                        cleanText(
                            row.bannedBy,
                            80
                        ) ||

                        "server",
                }
            );
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
            path.dirname(
                BAN_FILE_PATH
            ),
            {
                recursive: true,
            }
        );

        const tempPath =
            `${BAN_FILE_PATH}.tmp`;

        fs.writeFileSync(
            tempPath,

            JSON.stringify(
                {
                    bans:
                        [
                            ...bans.values(),
                        ],
                },
                null,
                2
            ),

            "utf8"
        );

        fs.renameSync(
            tempPath,
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


/* ============================================================
   ROBLOX-PROFILBILDER
============================================================ */

async function fetchAvatarUrls(
    userIds
) {
    const now =
        Date.now();

    const result =
        new Map();

    const missing = [];

    for (
        const id
        of userIds
    ) {
        const cached =
            avatarCache.get(id);

        if (
            cached &&

            now -
            cached.cachedAtMs <
            AVATAR_CACHE_MS
        ) {
            result.set(
                id,
                cached.url
            );
        } else {
            missing.push(id);
        }
    }

    for (
        let index = 0;
        index < missing.length;
        index += 100
    ) {
        const batch =
            missing.slice(
                index,
                index + 100
            );

        try {
            const endpoint =
                "https://thumbnails.roblox.com/v1/users/avatar-headshot" +

                "?userIds=" +
                encodeURIComponent(
                    batch.join(",")
                ) +

                "&size=150x150" +
                "&format=Png" +
                "&isCircular=false";

            const response =
                await fetch(
                    endpoint,
                    {
                        headers: {
                            "User-Agent":
                                "Nexu-Presence/3.0",

                            "Accept":
                                "application/json",
                        },
                    }
                );

            if (
                !response.ok
            ) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const payload =
                await response.json();

            const rows =
                Array.isArray(
                    payload.data
                )
                    ? payload.data
                    : [];

            for (
                const row
                of rows
            ) {
                const id =
                    cleanNumericId(
                        row.targetId
                    );

                const url =
                    cleanText(
                        row.imageUrl,
                        600
                    );

                if (
                    id &&
                    url.startsWith(
                        "https://"
                    )
                ) {
                    result.set(
                        id,
                        url
                    );

                    avatarCache.set(
                        id,
                        {
                            url,
                            cachedAtMs:
                                now,
                        }
                    );
                }
            }
        } catch (error) {
            console.warn(
                "[NEXU] Avatar lookup failed:",
                error.message
            );
        }
    }

    for (
        const id
        of userIds
    ) {
        if (
            !result.has(id)
        ) {
            result.set(
                id,

                "https://www.roblox.com/headshot-thumbnail/image" +

                `?userId=${encodeURIComponent(id)}` +

                "&width=150" +
                "&height=150" +
                "&format=png"
            );
        }
    }

    return result;
}


/* ============================================================
   ÖFFENTLICHE PRESENCE-AUSGABE
============================================================ */

async function getPublicPresence(
    jobIdFilter = ""
) {
    prunePresence();

    const active =
        [
            ...presence.values(),
        ]
            .filter(
                (entry) =>
                    !jobIdFilter ||

                    entry.jobId ===
                    jobIdFilter
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    first.displayName
                        .localeCompare(
                            second.displayName,
                            "de"
                        )
            );

    const blocked =
        [
            ...bans.values(),
        ]
            .sort(
                (
                    first,
                    second
                ) =>
                    (
                        first.displayName ||
                        first.username ||
                        first.userId
                    )
                        .localeCompare(
                            second.displayName ||
                            second.username ||
                            second.userId,

                            "de"
                        )
            );

    const ids =
        [
            ...new Set(
                [
                    ...active.map(
                        (row) =>
                            row.userId
                    ),

                    ...blocked.map(
                        (row) =>
                            row.userId
                    ),
                ]
            ),
        ];

    const avatars =
        await fetchAvatarUrls(
            ids
        );

    return {
        players:
            active.map(
                (entry) => ({
                    userId:
                        entry.userId,

                    username:
                        entry.username,

                    displayName:
                        entry.displayName,

                    avatarUrl:
                        avatars.get(
                            entry.userId
                        ) || "",

                    placeId:
                        entry.placeId,

                    jobId:
                        entry.jobId,

                    joinedAt:
                        new Date(
                            entry.joinedAtMs
                        ).toISOString(),

                    lastSeen:
                        new Date(
                            entry.lastSeenMs
                        ).toISOString(),

                    banned: false,
                })
            ),

        bannedPlayers:
            blocked.map(
                (entry) => ({
                    userId:
                        entry.userId,

                    username:
                        entry.username ||
                        `User${entry.userId}`,

                    displayName:
                        entry.displayName ||
                        entry.username ||
                        `User ${entry.userId}`,

                    avatarUrl:
                        avatars.get(
                            entry.userId
                        ) || "",

                    placeId: 0,
                    jobId: "",
                    banned: true,

                    reason:
                        entry.reason,

                    bannedAt:
                        entry.bannedAt,
                })
            ),
    };
}


/* ============================================================
   ALTE UND NEUE HEARTBEATS UNTERSTÜTZEN
============================================================ */

function normalizeHeartbeat(
    body
) {
    /*
        Alte Server-Version:
        body.players = [...]

        Neues Lua-Menü:
        body.userId
        body.username
        body.displayName
    */

    if (
        Array.isArray(
            body.players
        )
    ) {
        return {
            batch: true,

            rows:
                body.players.slice(
                    0,
                    200
                ),
        };
    }

    return {
        batch: false,

        rows: [
            {
                userId:
                    body.userId,

                username:
                    body.username,

                displayName:
                    body.displayName,

                sessionId:
                    body.sessionId,
            },
        ],
    };
}


/* ============================================================
   DASHBOARD
============================================================ */

function dashboardHtml() {
    return String.raw`
<!doctype html>

<html lang="de">

<head>

<meta charset="utf-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<meta
    name="theme-color"
    content="#03070e"
>

<title>Nexu</title>

<style>

:root {
    --bg: #03070e;
    --panel: rgba(7,13,23,.86);
    --panel2: rgba(10,18,31,.76);
    --text: #dceef8;
    --muted: #7894a8;
    --cyan: #00c8ff;
    --violet: #6f46ff;
    --green: #2dffa5;
    --red: #ff4d78;
    --border: rgba(74,178,230,.28);
}

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    min-height: 100%;
    color: var(--text);

    background:
        radial-gradient(
            circle at 18% 5%,
            rgba(0,200,255,.14),
            transparent 34rem
        ),

        radial-gradient(
            circle at 88% 20%,
            rgba(111,70,255,.14),
            transparent 32rem
        ),

        var(--bg);

    font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        Segoe UI,
        sans-serif;
}

body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: .23;

    background-image:
        linear-gradient(
            rgba(0,200,255,.06) 1px,
            transparent 1px
        ),

        linear-gradient(
            90deg,
            rgba(0,200,255,.06) 1px,
            transparent 1px
        );

    background-size:
        32px 32px;

    mask-image:
        linear-gradient(
            to bottom,
            black,
            transparent 85%
        );
}

.scan {
    position: fixed;
    z-index: 0;
    left: 0;
    right: 0;
    height: 1px;
    top: -2px;

    background:
        linear-gradient(
            90deg,
            transparent,
            rgba(0,200,255,.8),
            transparent
        );

    box-shadow:
        0 0 20px
        rgba(0,200,255,.75);

    animation:
        scan 7s linear infinite;

    pointer-events: none;
}

@keyframes scan {
    from {
        transform:
            translateY(0);

        opacity: 0;
    }

    8% {
        opacity: .65;
    }

    92% {
        opacity: .65;
    }

    to {
        transform:
            translateY(100vh);

        opacity: 0;
    }
}

.shell {
    position: relative;
    z-index: 1;

    width:
        min(
            1180px,
            calc(100% - 32px)
        );

    margin:
        0 auto;

    padding:
        26px 0 54px;
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

    background:
        linear-gradient(
            135deg,
            var(--cyan),
            var(--violet)
        );

    box-shadow:
        0 0 0 1px
            rgba(255,255,255,.17)
            inset,

        0 0 28px
            rgba(0,200,255,.28);
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

    border:
        1px solid
        var(--border);

    border-radius:
        999px;

    background:
        rgba(7,13,23,.72);

    color:
        var(--muted);

    font-size:
        13px;

    backdrop-filter:
        blur(14px);
}

.dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;

    background:
        var(--muted);

    box-shadow:
        0 0 14px
        currentColor;
}

.dot.online {
    background:
        var(--green);

    color:
        var(--green);
}

.dot.offline {
    background:
        var(--red);

    color:
        var(--red);
}

.hero {
    padding: 29px;

    border:
        1px solid
        var(--border);

    border-radius:
        28px;

    background:
        linear-gradient(
            135deg,
            rgba(0,200,255,.07),
            rgba(111,70,255,.05)
        ),

        var(--panel);

    box-shadow:
        0 26px 80px
            rgba(0,0,0,.34),

        0 0 0 1px
            rgba(255,255,255,.025)
            inset;

    backdrop-filter:
        blur(18px);
}

.eyebrow {
    color:
        var(--cyan);

    font-size:
        11px;

    letter-spacing:
        .19em;

    text-transform:
        uppercase;
}

h1 {
    margin:
        8px 0;

    max-width:
        760px;

    font-size:
        clamp(
            30px,
            5vw,
            52px
        );

    line-height:
        1.03;

    letter-spacing:
        -.04em;
}

.hero p {
    margin: 0;
    max-width: 760px;
    color: var(--muted);
    line-height: 1.65;
}

.stats {
    display: grid;

    grid-template-columns:
        repeat(
            3,
            minmax(0,1fr)
        );

    gap: 14px;
    margin-top: 24px;
}

.stat {
    min-height: 122px;
    padding: 18px;

    border:
        1px solid
        rgba(74,178,230,.19);

    border-radius:
        19px;

    background:
        var(--panel2);
}

.stat-label {
    color:
        var(--muted);

    font-size:
        11px;

    letter-spacing:
        .12em;

    text-transform:
        uppercase;
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

    border:
        1px solid
        var(--border);

    border-radius:
        25px;

    background:
        var(--panel);

    backdrop-filter:
        blur(18px);
}

.directory-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
}

.directory h2 {
    margin:
        4px 0 0;

    font-size:
        21px;
}

.search {
    width:
        min(
            380px,
            100%
        );

    height: 44px;

    border:
        1px solid
        rgba(74,178,230,.25);

    border-radius:
        13px;

    outline: none;

    padding:
        0 15px;

    color:
        var(--text);

    background:
        rgba(3,8,15,.8);

    font:
        inherit;
}

.search:focus {
    border-color:
        rgba(0,200,255,.68);

    box-shadow:
        0 0 0 3px
        rgba(0,200,255,.08);
}

.players {
    display: grid;

    grid-template-columns:
        repeat(
            2,
            minmax(0,1fr)
        );

    gap: 12px;
}

.player {
    display: flex;
    align-items: center;
    gap: 14px;

    min-width: 0;
    padding: 13px;

    border:
        1px solid
        rgba(74,178,230,.16);

    border-radius:
        17px;

    background:
        rgba(8,15,26,.76);

    transition:
        transform .16s ease,
        border-color .16s ease;
}

.player:hover {
    transform:
        translateY(-2px);

    border-color:
        rgba(0,200,255,.37);
}

.player.banned {
    border-color:
        rgba(255,77,120,.30);

    background:
        rgba(30,8,15,.66);
}

.avatar {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;

    object-fit: cover;

    border-radius:
        14px;

    background:
        #0b1422;

    border:
        1px solid
        rgba(0,200,255,.26);
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

.player-state.banned {
    color:
        var(--red);
}

.reason {
    margin-top: 5px;
    color: #b6808d;
    font-size: 11px;
}

.empty {
    grid-column:
        1 / -1;

    padding:
        40px 20px;

    border:
        1px dashed
        rgba(74,178,230,.22);

    border-radius:
        17px;

    color:
        var(--muted);

    text-align:
        center;
}

.footer-note {
    margin-top: 14px;
    color: #557084;
    font-size: 12px;
    text-align: right;
}

@media (
    max-width: 760px
) {
    .shell {
        width:
            min(
                100% - 20px,
                1180px
            );

        padding-top:
            16px;
    }

    header {
        align-items:
            flex-start;
    }

    .brand-copy span {
        display:
            none;
    }

    .hero {
        padding: 22px;
        border-radius: 22px;
    }

    .stats,
    .players {
        grid-template-columns:
            1fr;
    }

    .directory {
        padding:
            18px;
    }

    .directory-head {
        align-items:
            stretch;

        flex-direction:
            column;
    }

    .search {
        width:
            100%;
    }
}

</style>

</head>

<body>

<div class="scan"></div>

<main class="shell">

<header>

<div class="brand">

<div class="logo">
N
</div>

<div class="brand-copy">

<strong>
Nexu
</strong>

<span>
Presence Network
</span>

</div>

</div>

<div class="live-pill">

<span
    id="headerDot"
    class="dot"
></span>

<span id="headerStatus">
Verbindung wird geprüft
</span>

</div>

</header>


<section class="hero">

<div class="eyebrow">
NEXU // LIVE SYSTEM
</div>

<h1>
Aktive Nutzer auf einen Blick.
</h1>

<p>
Das Dashboard zeigt Spieler,
deren Nexu-Menü gerade aktiv ist.
Ein Nutzer wird automatisch entfernt,
wenn längere Zeit kein Heartbeat mehr eingeht.
</p>


<div class="stats">

<article class="stat">

<div class="stat-label">
Serverstatus
</div>

<div
    id="serverStatus"
    class="stat-value"
>
Prüfe …
</div>

<div class="stat-note">
Render-Web-Service
</div>

</article>


<article class="stat">

<div class="stat-label">
Aktive Spieler
</div>

<div
    id="playerCount"
    class="stat-value"
>
0
</div>

<div class="stat-note">
Heartbeat in den letzten 75 Sekunden
</div>

</article>


<article class="stat">

<div class="stat-label">
Letzte Aktualisierung
</div>

<div
    id="updatedAt"
    class="stat-value"
>
–
</div>

<div class="stat-note">
Automatisch alle 5 Sekunden
</div>

</article>

</div>

</section>


<section class="directory">

<div class="directory-head">

<div>

<div class="eyebrow">
MENU SPIELER
</div>

<h2>
Verbundenes Spieler-Verzeichnis
</h2>

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

<div
    id="players"
    class="players"
></div>

<div
    id="footerNote"
    class="footer-note"
></div>

</section>


<section class="directory">

<div class="directory-head">

<div>

<div class="eyebrow">
MENÜ-SPERRLISTE
</div>

<h2>
Gebannte Nutzer
</h2>

</div>

</div>

<div
    id="bannedPlayers"
    class="players"
></div>

<div
    id="bannedFooter"
    class="footer-note"
></div>

</section>

</main>


<script>

const state = {
    online: false,
    players: [],
    bannedPlayers: [],
    query: "",
};


const elements = {
    headerDot:
        document.getElementById(
            "headerDot"
        ),

    headerStatus:
        document.getElementById(
            "headerStatus"
        ),

    serverStatus:
        document.getElementById(
            "serverStatus"
        ),

    playerCount:
        document.getElementById(
            "playerCount"
        ),

    updatedAt:
        document.getElementById(
            "updatedAt"
        ),

    search:
        document.getElementById(
            "search"
        ),

    players:
        document.getElementById(
            "players"
        ),

    footerNote:
        document.getElementById(
            "footerNote"
        ),

    bannedPlayers:
        document.getElementById(
            "bannedPlayers"
        ),

    bannedFooter:
        document.getElementById(
            "bannedFooter"
        ),
};


function escapeHtml(value) {
    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function renderPlayer(
    player,
    banned
) {
    const name =
        player.displayName ||
        player.username ||
        player.userId;

    const username =
        player.username ||
        (
            "User" +
            player.userId
        );

    const reason =
        banned &&
        player.reason

            ? (
                '<div class="reason">' +
                escapeHtml(
                    player.reason
                ) +
                "</div>"
            )

            : "";

    return (
        '<article class="player ' +
        (
            banned
                ? "banned"
                : ""
        ) +
        '">' +

        '<img class="avatar" src="' +
        escapeHtml(
            player.avatarUrl
        ) +
        '" alt="" loading="lazy" referrerpolicy="no-referrer">' +

        '<div class="identity">' +

        '<div class="display-name">' +
        escapeHtml(name) +
        "</div>" +

        '<div class="username">@' +
        escapeHtml(username) +
        " · " +
        escapeHtml(
            player.userId
        ) +
        "</div>" +

        reason +

        "</div>" +

        '<div class="player-state ' +
        (
            banned
                ? "banned"
                : ""
        ) +
        '">' +

        (
            banned
                ? "Gesperrt"
                : "Online"
        ) +

        "</div>" +

        "</article>"
    );
}


function render() {
    elements.headerDot.className =
        "dot " +
        (
            state.online
                ? "online"
                : "offline"
        );

    elements.headerStatus.textContent =
        state.online
            ? "Server online"
            : "Server nicht erreichbar";

    elements.serverStatus.textContent =
        state.online
            ? "ONLINE"
            : "OFFLINE";

    elements.serverStatus.style.color =
        state.online
            ? "var(--green)"
            : "var(--red)";

    elements.playerCount.textContent =
        String(
            state.players.length
        );

    const query =
        state.query
            .trim()
            .toLocaleLowerCase();

    const filtered =
        state.players.filter(
            (player) =>
                !query ||

                String(
                    player.displayName ||
                    ""
                )
                    .toLocaleLowerCase()
                    .includes(query) ||

                String(
                    player.username ||
                    ""
                )
                    .toLocaleLowerCase()
                    .includes(query) ||

                String(
                    player.userId ||
                    ""
                )
                    .includes(query)
        );

    elements.players.innerHTML =
        filtered.length

            ? filtered
                .map(
                    (player) =>
                        renderPlayer(
                            player,
                            false
                        )
                )
                .join("")

            : (
                '<div class="empty">' +

                (
                    state.players.length === 0

                        ? "Zurzeit ist kein Spieler mit dem Nexu-Menü verbunden."

                        : "Kein Spieler passt zu deiner Suche."
                ) +

                "</div>"
            );

    elements.bannedPlayers.innerHTML =
        state.bannedPlayers.length

            ? state.bannedPlayers
                .map(
                    (player) =>
                        renderPlayer(
                            player,
                            true
                        )
                )
                .join("")

            : (
                '<div class="empty">' +
                "Die Sperrliste ist leer." +
                "</div>"
            );

    elements.footerNote.textContent =
        filtered.length +
        " von " +
        state.players.length +
        " Spielern angezeigt";

    elements.bannedFooter.textContent =
        state.bannedPlayers.length +
        " gesperrte Nutzer";
}


async function refresh() {
    try {
        const response =
            await fetch(
                "/api/presence",
                {
                    headers: {
                        "Accept":
                            "application/json",
                    },

                    cache:
                        "no-store",
                }
            );

        if (
            !response.ok
        ) {
            throw new Error(
                "HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        state.online =
            data.online === true;

        state.players =
            Array.isArray(
                data.players
            )
                ? data.players
                : [];

        state.bannedPlayers =
            Array.isArray(
                data.bannedPlayers
            )
                ? data.bannedPlayers
                : [];

        elements.updatedAt.textContent =
            new Date()
                .toLocaleTimeString(
                    "de-DE",
                    {
                        hour:
                            "2-digit",

                        minute:
                            "2-digit",

                        second:
                            "2-digit",
                    }
                );
    } catch (error) {
        console.error(
            "Nexu refresh failed:",
            error
        );

        state.online = false;
        state.players = [];
        state.bannedPlayers = [];

        elements.updatedAt.textContent =
            "Fehler";
    }

    render();
}


elements.search.addEventListener(
    "input",
    (event) => {
        state.query =
            event.target.value ||
            "";

        render();
    }
);


refresh();

setInterval(
    refresh,
    5_000
);

</script>

</body>

</html>
`;
}


/* ============================================================
   ROUTEN
============================================================ */

loadBans();


const server =
    http.createServer(
        async (
            req,
            res
        ) => {
            const requestUrl =
                new URL(
                    req.url,
                    "http://localhost"
                );

            const pathname =
                requestUrl.pathname;


            /* DASHBOARD */

            if (
                req.method === "GET" &&
                pathname === "/"
            ) {
                console.log(
                    "[NEXU] Dashboard aufgerufen"
                );

                sendHtml(
                    res,
                    dashboardHtml()
                );

                return;
            }


            /* STATUS */

            if (
                req.method === "GET" &&

                (
                    pathname === "/status" ||
                    pathname === "/api/status"
                )
            ) {
                prunePresence();

                sendJson(
                    res,
                    200,
                    {
                        success: true,
                        online: true,

                        service:
                            "Nexu Presence & Moderation",

                        activePlayers:
                            presence.size,

                        bannedPlayers:
                            bans.size,

                        timestamp:
                            new Date()
                                .toISOString(),
                    }
                );

                return;
            }


            /* MENÜ-ZUGANGSPRÜFUNG */

            if (
                req.method === "GET" &&

                pathname ===
                "/api/menu/access"
            ) {
                const userId =
                    cleanNumericId(
                        requestUrl
                            .searchParams
                            .get(
                                "userId"
                            )
                    );

                if (!userId) {
                    sendJson(
                        res,
                        400,
                        {
                            success: false,

                            error:
                                "Ungültige User-ID",
                        }
                    );

                    return;
                }

                const ban =
                    bans.get(userId);

                sendJson(
                    res,
                    200,
                    {
                        success: true,

                        allowed:
                            !ban,

                        banned:
                            Boolean(ban),

                        userId,

                        reason:
                            ban?.reason ||
                            "",

                        bannedAt:
                            ban?.bannedAt ||
                            "",

                        timestamp:
                            new Date()
                                .toISOString(),
                    }
                );

                return;
            }


            /* PRESENCE ABRUF */

            if (
                req.method === "GET" &&

                pathname ===
                "/api/presence"
            ) {
                const jobId =
                    cleanText(
                        requestUrl
                            .searchParams
                            .get(
                                "jobId"
                            ) || "",

                        100
                    );

                const data =
                    await getPublicPresence(
                        jobId
                    );

                sendJson(
                    res,
                    200,
                    {
                        success: true,
                        online: true,

                        activePlayers:
                            data.players.length,

                        bannedCount:
                            data
                                .bannedPlayers
                                .length,

                        timeoutSeconds:
                            ONLINE_TIMEOUT_MS /
                            1000,

                        players:
                            data.players,

                        bannedPlayers:
                            data.bannedPlayers,

                        timestamp:
                            new Date()
                                .toISOString(),
                    }
                );

                return;
            }


            /* HEARTBEAT */

            if (
                req.method === "POST" &&

                pathname ===
                "/api/presence/heartbeat"
            ) {
                if (
                    !isHeartbeatAuthorized(
                        req
                    )
                ) {
                    console.warn(
                        "[NEXU] Heartbeat abgelehnt: ungültiger Token"
                    );

                    sendJson(
                        res,
                        401,
                        {
                            success: false,

                            error:
                                "Ungültiger Heartbeat-Token",
                        }
                    );

                    return;
                }

                try {
                    const body =
                        await readJsonBody(
                            req
                        );

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
                        normalizeHeartbeat(
                            body
                        );

                    if (!jobId) {
                        sendJson(
                            res,
                            400,
                            {
                                success: false,

                                error:
                                    "jobId fehlt",
                            }
                        );

                        return;
                    }

                    const now =
                        Date.now();

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

                        if (
                            bans.has(userId)
                        ) {
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

                        currentKeys.add(
                            key
                        );

                        const existing =
                            presence.get(
                                key
                            );

                        presence.set(
                            key,
                            {
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
                                    existing
                                        ?.joinedAtMs ||

                                    now,

                                lastSeenMs:
                                    now,
                            }
                        );
                    }

                    /*
                        Nur ein Batch-Heartbeat
                        enthält die vollständige
                        Serverliste.

                        Ein einzelner Lua-Client
                        sendet nur sich selbst
                        und darf deshalb keine
                        anderen Spieler löschen.
                    */

                    if (
                        normalized.batch
                    ) {
                        for (
                            const [
                                key,
                                entry
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

                        blockedUserIds.length >
                        0
                    ) {
                        const userId =
                            blockedUserIds[0];

                        sendJson(
                            res,
                            403,
                            {
                                success: false,
                                banned: true,
                                userId,

                                reason:
                                    bans.get(
                                        userId
                                    )?.reason ||

                                    "Vom Nexu-Menü ausgeschlossen",
                            }
                        );

                        return;
                    }

                    console.log(
                        `[NEXU] Heartbeat: Job ${jobId}, ` +

                        `${currentKeys.size} aktiv, ` +

                        `${blockedUserIds.length} blockiert, ` +

                        `${presence.size} insgesamt`
                    );

                    sendJson(
                        res,
                        200,
                        {
                            success: true,

                            activePlayers:
                                presence.size,

                            receivedPlayers:
                                currentKeys.size,

                            blockedUserIds,

                            timestamp:
                                new Date()
                                    .toISOString(),
                        }
                    );
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


            /* OFFLINE */

            if (
                req.method === "POST" &&

                pathname ===
                "/api/presence/offline"
            ) {
                if (
                    !isHeartbeatAuthorized(
                        req
                    )
                ) {
                    sendJson(
                        res,
                        401,
                        {
                            success: false,

                            error:
                                "Ungültiger Heartbeat-Token",
                        }
                    );

                    return;
                }

                try {
                    const body =
                        await readJsonBody(
                            req
                        );

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
                            entry
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
                            presence.delete(
                                key
                            );

                            removed += 1;
                        }
                    }

                    sendJson(
                        res,
                        200,
                        {
                            success: true,
                            removed,
                        }
                    );
                } catch {
                    sendJson(
                        res,
                        400,
                        {
                            success: false,

                            error:
                                "Ungültiges JSON",
                        }
                    );
                }

                return;
            }


            /* BAN-LISTE */

            if (
                req.method === "GET" &&

                pathname ===
                "/api/admin/bans"
            ) {
                if (
                    !isAdminAuthorized(
                        req
                    )
                ) {
                    sendJson(
                        res,
                        401,
                        {
                            success: false,

                            error:
                                "Ungültiger Admin-Key",
                        }
                    );

                    return;
                }

                sendJson(
                    res,
                    200,
                    {
                        success: true,

                        bans:
                            [
                                ...bans.values(),
                            ],
                    }
                );

                return;
            }


            /* BAN */

            if (
                req.method === "POST" &&

                pathname ===
                "/api/admin/ban"
            ) {
                if (
                    !isAdminAuthorized(
                        req
                    )
                ) {
                    sendJson(
                        res,
                        401,
                        {
                            success: false,

                            error:
                                "Ungültiger Admin-Key",
                        }
                    );

                    return;
                }

                try {
                    const body =
                        await readJsonBody(
                            req
                        );

                    const userId =
                        cleanNumericId(
                            body.userId
                        );

                    if (!userId) {
                        sendJson(
                            res,
                            400,
                            {
                                success: false,

                                error:
                                    "Ungültige User-ID",
                            }
                        );

                        return;
                    }

                    if (
                        userId ===
                        MENU_CREATOR_USER_ID
                    ) {
                        sendJson(
                            res,
                            403,
                            {
                                success: false,

                                error:
                                    "Der Menu Creator kann nicht gebannt werden",
                            }
                        );

                        return;
                    }

                    const live =
                        latestPresence(
                            userId
                        );

                    const old =
                        bans.get(
                            userId
                        );

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
                            new Date()
                                .toISOString(),

                        bannedBy:
                            "admin",
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

                    sendJson(
                        res,
                        200,
                        {
                            success: true,
                            banned: true,
                            record,
                            removedPresence,
                            persisted,
                        }
                    );
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


            /* UNBAN */

            if (
                req.method === "POST" &&

                pathname ===
                "/api/admin/unban"
            ) {
                if (
                    !isAdminAuthorized(
                        req
                    )
                ) {
                    sendJson(
                        res,
                        401,
                        {
                            success: false,

                            error:
                                "Ungültiger Admin-Key",
                        }
                    );

                    return;
                }

                try {
                    const body =
                        await readJsonBody(
                            req
                        );

                    const userId =
                        cleanNumericId(
                            body.userId
                        );

                    if (!userId) {
                        sendJson(
                            res,
                            400,
                            {
                                success: false,

                                error:
                                    "Ungültige User-ID",
                            }
                        );

                        return;
                    }

                    const existed =
                        bans.delete(
                            userId
                        );

                    const persisted =
                        saveBans();

                    console.log(
                        `[NEXU] UNBAN ${userId}`
                    );

                    sendJson(
                        res,
                        200,
                        {
                            success: true,
                            banned: false,
                            existed,
                            persisted,
                        }
                    );
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


            sendJson(
                res,
                404,
                {
                    success: false,

                    error:
                        "Route nicht gefunden",
                }
            );
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
            "Heartbeat-Schutz:",

            HEARTBEAT_TOKEN

                ? "AKTIV"

                : "AUS (Kompatibilitätsmodus)"
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
            "Dashboard: /"
        );

        console.log(
            "Presence: /api/presence"
        );

        console.log(
            "========================================"
        );
    }
);
