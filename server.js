const http = require("node:http");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key"
    });

    res.end(JSON.stringify(data));
}

function getClientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    return req.socket.remoteAddress || "Unbekannt";
}

function writeLog(title, req, extraData) {
    console.log("========================================");
    console.log(title);
    console.log("Zeit:", new Date().toISOString());
    console.log("Methode:", req.method);
    console.log("Route:", req.url);
    console.log("IP:", getClientIp(req));
    console.log(
        "Programm:",
        req.headers["user-agent"] || "Kein User-Agent"
    );

    if (extraData !== undefined) {
        console.log("Daten:", extraData);
    }

    console.log("========================================");
}

const server = http.createServer((req, res) => {
    // Erlaubt Vorab-Anfragen von Browsern und anderen Programmen.
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key"
        });

        return res.end();
    }

    // Hauptseite
    if (req.method === "GET" && req.url === "/") {
        writeLog("HAUPTSEITE AUFGERUFEN", req);

        return sendJson(res, 200, {
            online: true,
            message: "Lua-Server läuft",
            statusRoute: "/status",
            dataRoute: "/data"
        });
    }

    // Einfacher Verbindungstest ohne API-Key
    if (req.method === "GET" && req.url === "/status") {
        const timestamp = new Date().toISOString();

        writeLog("VERBINDUNG ERFOLGREICH", req);

        return sendJson(res, 200, {
            success: true,
            online: true,
            message: "Verbindung zum Server erfolgreich",
            timestamp: timestamp
        });
    }

    // Daten vom Lua-Programm empfangen
    if (req.method === "POST" && req.url === "/data") {
        const suppliedApiKey = req.headers["x-api-key"];

        if (!API_KEY) {
            writeLog("SERVERFEHLER: API_KEY FEHLT", req);

            return sendJson(res, 500, {
                success: false,
                error: "API_KEY ist auf dem Server nicht eingerichtet"
            });
        }

        if (suppliedApiKey !== API_KEY) {
            writeLog("ANFRAGE ABGELEHNT: FALSCHER API-KEY", req);

            return sendJson(res, 401, {
                success: false,
                error: "Ungültiger API-Key"
            });
        }

        let body = "";
        let requestTooLarge = false;

        req.on("data", chunk => {
            body += chunk.toString();

            if (body.length > 100000) {
                requestTooLarge = true;
            }
        });

        req.on("end", () => {
            if (requestTooLarge) {
                writeLog("ANFRAGE ABGELEHNT: ZU GROSS", req);

                return sendJson(res, 413, {
                    success: false,
                    error: "Die Anfrage ist zu groß"
                });
            }

            try {
                const receivedData = JSON.parse(body);

                writeLog(
                    "DATEN ERFOLGREICH EMPFANGEN",
                    req,
                    receivedData
                );

                return sendJson(res, 200, {
                    success: true,
                    message: "Daten wurden erfolgreich empfangen",
                    received: receivedData,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                writeLog(
                    "UNGÜLTIGES JSON EMPFANGEN",
                    req,
                    body
                );

                return sendJson(res, 400, {
                    success: false,
                    error: "Die gesendeten Daten sind kein gültiges JSON"
                });
            }
        });

        req.on("error", error => {
            console.error("Fehler beim Lesen der Anfrage:", error);

            if (!res.headersSent) {
                sendJson(res, 500, {
                    success: false,
                    error: "Fehler beim Lesen der Anfrage"
                });
            }
        });

        return;
    }

    writeLog("UNBEKANNTE ROUTE AUFGERUFEN", req);

    return sendJson(res, 404, {
        success: false,
        error: "Route nicht gefunden"
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log("LUA-SERVER WURDE GESTARTET");
    console.log("Port:", PORT);
    console.log("API-Key eingerichtet:", Boolean(API_KEY));
    console.log("Zeit:", new Date().toISOString());
    console.log("========================================");
});
