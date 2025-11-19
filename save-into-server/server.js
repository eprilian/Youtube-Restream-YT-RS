const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app); // Wrap Express in HTTP
const io = new Server(server); // Initialize Socket.io

const PORT = 3100;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Database
const db = new sqlite3.Database('./session.db');
db.run(`CREATE TABLE IF NOT EXISTS player_state (id INTEGER PRIMARY KEY, data TEXT)`);

// 1. Load State (API)
app.get('/api/state', (req, res) => {
    db.get("SELECT data FROM player_state WHERE id = 1", [], (err, row) => {
        if (err) return res.status(500).send();
        res.json(row ? JSON.parse(row.data) : null);
    });
});

// 2. SOCKET.IO REAL-TIME CONNECTION
io.on('connection', (socket) => {
    console.log('New client connected');

    // When a client sends a state update
    socket.on('update_state', (state) => {
        const stateString = JSON.stringify(state);
        
        // 1. Save to DB
        db.run(`INSERT OR REPLACE INTO player_state (id, data) VALUES (1, ?)`, [stateString]);

        // 2. Broadcast to EVERYONE ELSE (excluding sender)
        socket.broadcast.emit('sync_event', state);
    });
});

server.listen(PORT, () => {
    console.log(`>> Real-Time Server running at http://localhost:${PORT}`);
});