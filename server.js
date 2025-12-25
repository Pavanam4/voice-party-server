const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const wss = new WebSocket.Server({ port: PORT });

console.log("🚀 WebSocket server running on port", PORT);




/*
  Map:
  ws -> { id, name, room }
*/
const clients = new Map();

/* ---------------- HELPERS ---------------- */

function getUsersInRoom(room) {
    const users = [];
    for (const c of clients.values()) {
        if (c.room === room) {
            users.push({
                id: c.id,
                name: c.name
            });
        }
    }
    return users;
}

function broadcastToRoom(room, data) {
    const msg = JSON.stringify(data);
    for (const [ws, c] of clients.entries()) {
        if (c.room === room && ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }
}

/* ---------------- SERVER ---------------- */

wss.on("connection", (ws) => {
    const id = Math.random().toString(36).slice(2, 9);

    clients.set(ws, {
        id,
        name: null,
        room: null
    });

    console.log("✅ Connected:", id);

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg.toString());
        } catch {
            console.error("❌ Invalid JSON");
            return;
        }

        const client = clients.get(ws);
        if (!client) return;

        /* -------- JOIN ROOM -------- */
        if (data.type === "join-room") {
            client.name = data.name;
            client.room = data.room;

            console.log(`🎉 ${client.name} joined room ${client.room}`);

            // ✅ SEND FULL ROOM STATE TO EVERYONE
            const users = getUsersInRoom(client.room);

            broadcastToRoom(client.room, {
                type: "room-update",
                users
            });
        }

        /* -------- WEBRTC SIGNALING -------- */
        if (data.target) {
            for (const [peerWs, peer] of clients.entries()) {
                if (
                    peer.id === data.target &&
                    peerWs.readyState === WebSocket.OPEN
                ) {
                    peerWs.send(JSON.stringify({
                        ...data,
                        from: client.id
                    }));
                }
            }
        }
    });

    ws.on("close", () => {
        const client = clients.get(ws);
        if (!client) return;

        console.log("❌ Disconnected:", client.id);

        const room = client.room;
        clients.delete(ws);

        // ✅ UPDATE ROOM AFTER LEAVE
        if (room) {
            const users = getUsersInRoom(room);
            broadcastToRoom(room, {
                type: "room-update",
                users
            });
        }
    });
});

console.log("🚀 WebSocket server running on ws://localhost:3000");
