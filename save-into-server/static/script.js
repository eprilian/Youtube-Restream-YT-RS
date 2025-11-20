// --- 1. CLOCK ---
function updateLiveClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true 
    });
    document.getElementById('live-clock').innerText = timeString;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// --- 2. YOUTUBE API LOADER ---
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// --- 3. GLOBAL VARIABLES ---
const socket = io(); 
var player;
var isPlayerReady = false;
var updateInterval;
var isDraggingScrubber = false;
var isPlaylist = false;
var activeConfig = null;
var isRemoteUpdate = false;

// --- 4. SOCKET & SERVER SYNC ---

// Receive update from Server
socket.on('sync_event', (state) => {
    // Prevent loops: If we are receiving an update, don't send one back immediately
    isRemoteUpdate = true;
    
    console.log("Remote Update:", state);
    
    // A. If video ID is different, reload everything
    if (!activeConfig || activeConfig.id !== state.config.id) {
        showToast("Remote changed video...");
        initPlayer(state.config);
        document.getElementById('center-overlay').classList.add('hidden');
        // Reset flag after a delay to allow player to load
        setTimeout(() => { isRemoteUpdate = false; }, 1000);
        return;
    }
    
    // B. Sync Time if drift > 2 seconds
    if(player && Math.abs(player.getCurrentTime() - state.timestamp) > 2) {
        player.seekTo(state.timestamp);
        showToast("Synced Time");
    }

    // C. Sync Play/Pause
    if (player) {
        if (state.status === 1 && player.getPlayerState() !== 1) player.playVideo();
        if (state.status === 2 && player.getPlayerState() !== 2) player.pauseVideo();
    }

    // Reset flag
    setTimeout(() => { isRemoteUpdate = false; }, 500);
});

// Send update to Server
function broadcastState() {
    if (!player || !isPlayerReady || isRemoteUpdate || !activeConfig) return;
    
    const state = {
        config: activeConfig,
        timestamp: player.getCurrentTime(),
        status: player.getPlayerState(), // 1=Playing, 2=Paused
        playlistIndex: isPlaylist ? player.getPlaylistIndex() : 0
    };
    socket.emit('update_state', state);
}

// Load Initial State from DB
async function loadInitialState() {
    try {
        const res = await fetch('/api/state');
        const state = await res.json();
        if(state && state.config) {
            console.log("Loading saved state from server...");
            
            // Ensure we start at the saved timestamp
            state.config.startSeconds = state.timestamp;
            state.config.playlistIndex = state.playlistIndex; 
            
            initPlayer(state.config);
            document.getElementById('center-overlay').classList.add('hidden');
            showToast("Session Restored");
        }
    } catch(e) { console.log("No saved state found."); }
}

// API Entry Point
function onYouTubeIframeAPIReady() {
    loadInitialState();
}

// --- 5. PLAYER LOGIC ---
function initPlayer(config) {
    if (player) player.destroy();
    activeConfig = config;

    // Update UI Inputs
    document.getElementById('url-input').value = ""; 
    if(config.quality) document.getElementById('initial-quality').value = config.quality;

    const wrapper = document.getElementById('player-wrapper');
    wrapper.innerHTML = '<div id="video-placeholder"></div>';

    let playerVars = {
        'autoplay': 1, 'controls': 0, 'showinfo': 0, 
        'rel': 0, 'fs': 0, 'iv_load_policy': 3,
        'origin': window.location.origin,
        'start': Math.floor(config.startSeconds || 0)
    };

    if (config.quality && config.quality !== 'auto') {
        playerVars['vq'] = config.quality;
    }

    let apiConfig = {
        height: '100%', width: '100%',
        playerVars: playerVars,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e) => showToast("Error: " + e.data)
        }
    };

    if (config.type === 'playlist') {
        isPlaylist = true;
        playerVars['listType'] = 'playlist';
        playerVars['list'] = config.id;
        if (config.playlistIndex) playerVars['index'] = config.playlistIndex;
    } else {
        isPlaylist = false;
        apiConfig.videoId = config.id;
    }

    player = new YT.Player('video-placeholder', apiConfig);
}

function onPlayerReady(event) {
    isPlayerReady = true;
    startProgressLoop();
    player.unMute();
    
    // Force Quality backup
    if(activeConfig.quality && activeConfig.quality !== 'auto') {
        player.setPlaybackQuality(activeConfig.quality);
    }

    // UI Setup
    const plBtn = document.getElementById('playlist-btn');
    if (isPlaylist) {
        plBtn.style.display = 'block';
        setTimeout(fetchPlaylistData, 2000);
    } else {
        plBtn.style.display = 'none';
        closeDrawer();
    }

    // --- HEARTBEAT FUNCTIONALITY ---
    // This saves the playback position to the server every 1 second (Tight Sync)
    setInterval(() => {
        if (player && player.getPlayerState && player.getPlayerState() === 1) { // 1 = Playing
            broadcastState();
        }
    }, 1000);
    // -------------------------------
}

function onPlayerStateChange(event) {
    if(isRemoteUpdate) return;

    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');

    // Playing
    if (event.data == YT.PlayerState.PLAYING) {
        iconPlay.style.display = 'none'; iconPause.style.display = 'block';
        document.getElementById('center-overlay').classList.add('hidden');
        updateActiveTrack();
        broadcastState();
    } 
    // Paused
    else if (event.data == YT.PlayerState.PAUSED) {
        iconPlay.style.display = 'block'; iconPause.style.display = 'none';
        broadcastState(); // Important to save pause state
    }
    // Buffering/Other
    else {
        iconPlay.style.display = 'block'; iconPause.style.display = 'none';
    }
}

// --- 6. UI EVENTS & CONTROLS ---

// Keyboard
document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
    
    const key = e.key.toLowerCase();
    
    if (key === 'f') toggleFullscreen();
    if (key === 'k' || e.code === 'Space') {
        e.preventDefault();
        if(player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo();
    }
    if (key === 'm') {
        if(player.isMuted()) { player.unMute(); showToast("Unmuted"); } else { player.mute(); showToast("Muted"); }
    }
    if (e.code === 'ArrowRight') { 
        player.seekTo(player.getCurrentTime() + 10); showToast("+10s"); broadcastState(); 
    }
    if (e.code === 'ArrowLeft') { 
        player.seekTo(player.getCurrentTime() - 10); showToast("-10s"); broadcastState(); 
    }
});

// Buttons
document.getElementById('play-btn').addEventListener('click', () => {
    if(player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo();
});
document.getElementById('prev-btn').addEventListener('click', () => {
    if(player.previousVideo) player.previousVideo(); else player.seekTo(0); broadcastState();
});
document.getElementById('next-btn').addEventListener('click', () => {
    if(player.nextVideo) player.nextVideo(); broadcastState();
});

// Load Button
document.getElementById('load-btn').addEventListener('click', () => {
    const url = document.getElementById('url-input').value;
    const quality = document.getElementById('initial-quality').value;
    
    if (!url) return;
    
    const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
    const vidMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    let config;
    if (listMatch) config = { type: 'playlist', id: listMatch[1], quality: quality };
    else if (vidMatch) config = { type: 'video', id: vidMatch[1], quality: quality };
    else { showToast("Invalid Link"); return; }

    initPlayer(config);
    activeConfig = config; // Set immediately so broadcast sends correct data
    broadcastState(); 
    document.getElementById('center-overlay').classList.add('hidden');
});

// Menu Open
document.getElementById('open-menu-btn').addEventListener('click', () => {
    document.getElementById('center-overlay').classList.remove('hidden');
});

// Fullscreen
const fsBtn = document.getElementById('fullscreen-btn');
function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
}
function updateFsIcon() {
    const enter = document.getElementById('icon-fs-enter');
    const exit = document.getElementById('icon-fs-exit');
    if (document.fullscreenElement) { enter.style.display = 'none'; exit.style.display = 'block'; }
    else { enter.style.display = 'block'; exit.style.display = 'none'; }
}
fsBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFsIcon);

// Playlist Drawer
function fetchPlaylistData() {
    if (!player || !player.getPlaylist) return;
    const playlistIds = player.getPlaylist();
    const container = document.getElementById('playlist-items-container');
    container.innerHTML = '';
    
    if (!playlistIds || playlistIds.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center;">Playlist info unavailable</div>';
        return;
    }

    playlistIds.forEach((vidId, index) => {
        const div = document.createElement('div'); div.className = 'track-item'; div.id = 'track-' + index;
        div.onclick = () => { player.playVideoAt(index); updateActiveTrack(index); broadcastState(); };
        
        const img = document.createElement('img'); img.src = `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`; img.className = 'track-thumb';
        const info = document.createElement('div'); info.className = 'track-info'; info.innerText = `Track #${index + 1}`;
        
        div.appendChild(img); div.appendChild(info); container.appendChild(div);
    });
    updateActiveTrack();
}

function updateActiveTrack(forceIndex = -1) {
    if(!isPlaylist) return;
    document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
    
    let currentIndex = 0;
    try { currentIndex = (forceIndex >= 0) ? forceIndex : player.getPlaylistIndex(); } catch(e) {}
    
    const activeEl = document.getElementById('track-' + currentIndex);
    if (activeEl) {
        activeEl.classList.add('active');
        if(document.getElementById('playlist-drawer').classList.contains('open')) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Drawer Toggles
function closeDrawer() { document.getElementById('playlist-drawer').classList.remove('open'); document.getElementById('playlist-btn').classList.remove('active'); }
document.getElementById('playlist-btn').addEventListener('click', () => {
    const drawer = document.getElementById('playlist-drawer');
    const btn = document.getElementById('playlist-btn');
    if (drawer.classList.contains('open')) { closeDrawer(); } 
    else { drawer.classList.add('open'); btn.classList.add('active'); updateActiveTrack(); }
});
document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);

// --- 7. SCRUBBER ---
const progressBar = document.getElementById('progress-bar');
const currTimeEl = document.getElementById('curr-time');
const totalTimeEl = document.getElementById('total-time');

function startProgressLoop() {
    if(updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        if (!player || !player.getCurrentTime || isDraggingScrubber) return;
        try {
            if (player.getPlayerState() === YT.PlayerState.PLAYING) {
                const current = player.getCurrentTime(); const duration = player.getDuration();
                if (duration) {
                    progressBar.value = (current / duration) * 100;
                    currTimeEl.innerText = formatTime(current);
                    totalTimeEl.innerText = formatTime(duration);
                }
            }
        } catch(e){}
    }, 500);
}

progressBar.addEventListener('input', () => { isDraggingScrubber = true; });
progressBar.addEventListener('change', (e) => {
    isDraggingScrubber = false;
    if(player) {
        player.seekTo(player.getDuration() * (e.target.value / 100), true);
        broadcastState();
    }
});

// Helpers
function formatTime(s) { if (!s) return "00:00"; s = Math.floor(s); return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }
function showToast(msg) { const toast = document.getElementById('toast-msg'); toast.innerText = msg; toast.style.opacity = 1; setTimeout(() => { toast.style.opacity = 0; }, 3000); }
let idleTimer; document.onmousemove = function() { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000); };

// Force save on close
window.addEventListener('beforeunload', () => { broadcastState(); });