const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3100;

app.use(cors());
app.use(bodyParser.json());

// Serve static files
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.use('/static', express.static(path.join(__dirname, 'static')));

// --- DATABASE SETUP ---
const dbFolder = path.join(__dirname, 'session');
const dbPath = path.join(dbFolder, 'session.db');

// Ensure folder exists
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder);
    console.log("Created session directory.");
}

const db = new sqlite3.Database(dbPath);
db.run(`CREATE TABLE IF NOT EXISTS player_state (id INTEGER PRIMARY KEY, data TEXT)`);

// --- API ROUTES ---

// 1. Load State
app.get('/api/state', (req, res) => {
    db.get("SELECT data FROM player_state WHERE id = 1", [], (err, row) => {
        if (err) return res.status(500).send();
        if (!row) return res.json(null);

        let state = JSON.parse(row.data);
        const config = state.config;

        // Live Mode Math
        if (config && config.mode === 'live') {
            const now = Date.now();
            const lastUpdate = state.lastServerUpdate || now;
            const timeElapsed = (now - lastUpdate) / 1000;
            let newTimestamp = state.timestamp + timeElapsed;

            if (state.duration > 0) {
                newTimestamp = newTimestamp % state.duration;
            }
            state.timestamp = newTimestamp;
            state.status = 1;
        }

        res.json(state);
    });
});

// 2. Save State
app.post('/api/state', (req, res) => {
    const state = req.body;
    state.lastServerUpdate = Date.now();
    
    db.run(`INSERT OR REPLACE INTO player_state (id, data) VALUES (1, ?)`, [JSON.stringify(state)], (err) => {
        if (err) return res.status(500).send();
        res.json({ status: 'saved' });
    });
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('update_state', (state) => {
        state.lastServerUpdate = Date.now();
        db.run(`INSERT OR REPLACE INTO player_state (id, data) VALUES (1, ?)`, [JSON.stringify(state)]);
        socket.broadcast.emit('sync_event', state);
    });
});

// --- AUTO-CLEANUP ON EXIT ---
function handleShutdown() {
    console.log("\n🔴 Stopping server... Cleaning up session data...");
    
    // 1. Delete all rows from the table
    db.run("DELETE FROM player_state", [], (err) => {
        if (err) {
            console.error("Error cleaning session:", err.message);
        } else {
            console.log("✅ Session data wiped successfully.");
        }
        
        // 2. Close Database connection
        db.close((err) => {
            if (err) console.error("Error closing DB:", err.message);
            console.log("✅ Database closed. Bye!");
            process.exit(0);
        });
    });
}

// Listen for termination signals (Ctrl+C or Docker Stop)
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

server.listen(PORT, () => {
    console.log(`>> YT_Restream running at http://localhost:${PORT}`);
});