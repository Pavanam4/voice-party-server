const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// Create HTTP server (Railway NEEDS this)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket server is running");
});

// Attach WebSocket to HTTP server
const wss = new WebSocket.Server({ server });

/*
 ws -> { id, name, room }
*/
const clients = new Map();

function getUsersInRoom(room) {
  const list = [];
  for (const c of clients.values()) {
    if (c.room === room) {
      list.push({ id: c.id, name: c.name });
    }
  }
  return list;
}

function broadcastToRoom(room, data) {
  const msg = JSON.stringify(data);
  for (const [ws, c] of clients.entries()) {
    if (c.room === room && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 9);

  clients.set(ws, { id, name: null, room: null });
  console.log("✅ Connected:", id);

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    const client = clients.get(ws);

    if (data.type === "join-room") {
      client.name = data.name;
      client.room = data.room;

      console.log(`🎉 ${client.name} joined ${client.room}`);

      broadcastToRoom(client.room, {
        type: "room-update",
        users: getUsersInRoom(client.room),
      });
    }

    if (data.target) {
      for (const [peerWs, peer] of clients.entries()) {
        if (peer.id === data.target && peerWs.readyState === WebSocket.OPEN) {
          peerWs.send(JSON.stringify({ ...data, from: client.id }));
        }
      }
    }
  });

  ws.on("close", () => {
    const client = clients.get(ws);
    if (!client) return;

    const room = client.room;
    clients.delete(ws);

    if (room) {
      broadcastToRoom(room, {
        type: "room-update",
        users: getUsersInRoom(room),
      });
    }

    console.log("❌ Disconnected:", client.id);
  });
});

// 🔥 THIS is what Railway waits for
server.listen(PORT, () => {
  console.log("🚀 Server listening on port", PORT);
});
