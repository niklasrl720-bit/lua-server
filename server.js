const http = require("node:http");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    // Einfacher Verbindungstest
    if (req.method === "GET" && req.url === "/status") {
        return sendJson(res, 200, {
            online: true,
            message: "Lua-Server ist erreichbar"
        });
    }

    // Daten vom Lua-Script empfangen
    if (req.method === "POST" && req.url === "/data") {
        const suppliedKey = req.headers["x-api-key"];

        if (!API_KEY || suppliedKey !== API_KEY) {
            return sendJson(res, 401, {
                success: false,
                error: "Ungültiger API-Key"
            });
        }

        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 100000) {
                sendJson(res, 413, {
                    success: false,
                    error: "Anfrage zu groß"
                });

                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                const data = JSON.parse(body);

                console.log("Daten vom Lua-Script:", data);

                sendJson(res, 200, {
                    success: true,
                    received: data
                });
            } catch {
                sendJson(res, 400, {
                    success: false,
                    error: "Ungültiges JSON"
                });
            }
        });

        return;
    }

    sendJson(res, 404, {
        success: false,
        error: "Route nicht gefunden"
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
