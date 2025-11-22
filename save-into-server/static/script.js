function updateLiveClock() {
    document.getElementById('live-clock').innerText = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}
setInterval(updateLiveClock, 1000); updateLiveClock();

var tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

const socket = io(); 
var player, isPlayerReady = false, saveStateInterval, updateInterval; 
var isDraggingScrubber = false, isPlaylist = false;
var activeConfig = null, isRemoteUpdate = false;

var lastKnownPlaylistIndex = 0;
var targetPlaylistIndex = 0; 
var isRestoring = false; 
var initialSeekDone = false;

socket.on('sync_event', (state) => {
    isRemoteUpdate = true;
    
    if(state.config && state.config.mode) document.getElementById('mode-indicator').innerText = state.config.mode;

    if (!activeConfig || activeConfig.id !== state.config.id) {
        showToast("Remote loaded new content...");
        initPlayer(state.config);
        document.getElementById('center-overlay').classList.add('hidden');
        setTimeout(() => { isRemoteUpdate = false; }, 1000);
        return;
    }
    
    if(player && Math.abs(player.getCurrentTime() - state.timestamp) > 2) {
        player.seekTo(state.timestamp);
    }

    if (player) {
        if (state.status === 1 && player.getPlayerState() !== 1) player.playVideo();
        if (state.status === 2 && player.getPlayerState() !== 2) player.pauseVideo();
        
        if (isPlaylist && state.playlistIndex !== undefined) {
            if (player.getPlaylistIndex() !== state.playlistIndex) {
                targetPlaylistIndex = state.playlistIndex;
                player.playVideoAt(state.playlistIndex);
            }
        }
    }

    setTimeout(() => { isRemoteUpdate = false; }, 500);
});

function broadcastState() {

    if (isRestoring || !player || !isPlayerReady || isRemoteUpdate || !activeConfig) return;
    if (!initialSeekDone && player.getCurrentTime() < 2) return;

    let currentIndex = 0;
    if (isPlaylist) {
        let idx = player.getPlaylistIndex();
        if (idx === -1 || idx === undefined) return; 
        currentIndex = idx;
        lastKnownPlaylistIndex = idx;
    }

    const state = {
        config: activeConfig,
        timestamp: player.getCurrentTime(),
        duration: player.getDuration(),
        status: player.getPlayerState(),
        playlistIndex: currentIndex,
        volume: player.getVolume(),
        muted: player.isMuted()
    };
    socket.emit('update_state', state);
}

async function loadInitialState() {
    try {
        const res = await fetch('/api/state');
        const state = await res.json();
        if(state && state.config) {
            console.log("Restoring session...", state);
            isRestoring = true; 
            initialSeekDone = false; // Reset marker resume
            
            state.config.startSeconds = state.timestamp;
            state.config.playlistIndex = state.playlistIndex;
            state.config.startVolume = state.volume;
            state.config.startMuted = state.muted;
            
            initPlayer(state.config);
            document.getElementById('center-overlay').classList.add('hidden');
            showToast("Session Restored");
        }
    } catch(e) { console.log("No saved state."); }
}

function onYouTubeIframeAPIReady() { loadInitialState(); }

function initPlayer(config) {
    if (player) { clearInterval(saveStateInterval); player.destroy(); }
    
    activeConfig = config;
    targetPlaylistIndex = parseInt(config.playlistIndex || 0);
    lastKnownPlaylistIndex = targetPlaylistIndex;
    isRestoring = true;
    initialSeekDone = false;

    document.getElementById('url-input').value = ""; 
    document.getElementById('mode-indicator').innerText = config.mode || "RESUME";
    if(config.quality) document.getElementById('initial-quality').value = config.quality;

    const wrapper = document.getElementById('player-wrapper');
    wrapper.innerHTML = '<div id="video-placeholder"></div>';

    let playerVars = { 
        'autoplay': 1, 'controls': 0, 'showinfo': 0, 'rel': 0, 'fs': 0, 'iv_load_policy': 3, 
        'origin': window.location.origin, 
        'start': Math.floor(config.startSeconds || 0) 
    };
    
    if (config.quality && config.quality !== 'auto') playerVars['vq'] = config.quality;

    let apiConfig = {
        height: '100%', width: '100%', playerVars: playerVars,
        events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange, 'onError': (e) => showToast("Error: " + e.data) }
    };

    if (config.type === 'playlist') {
        isPlaylist = true; 
        playerVars['listType'] = 'playlist'; 
        playerVars['list'] = config.id;
        playerVars['index'] = targetPlaylistIndex; 
    } else {
        isPlaylist = false; apiConfig.videoId = config.id;
    }

    player = new YT.Player('video-placeholder', apiConfig);
}

function onPlayerReady(event) {
    isPlayerReady = true;
    startProgressLoop();
    
    const startVol = (activeConfig.startVolume !== undefined) ? activeConfig.startVolume : 100;
    player.setVolume(startVol);
    document.getElementById('vol-slider').value = startVol;
    if (activeConfig.startMuted) { player.mute(); updateVolumeUI(true); } else { player.unMute(); updateVolumeUI(false); }
    
    if(activeConfig.quality && activeConfig.quality !== 'auto') player.setPlaybackQuality(activeConfig.quality);

    const plBtn = document.getElementById('playlist-btn');
    if (isPlaylist) { plBtn.style.display = 'block'; setTimeout(fetchPlaylistData, 2000); } else { plBtn.style.display = 'none'; closeDrawer(); }

    saveStateInterval = setInterval(() => {
        if (player && player.getPlayerState && !isRestoring && initialSeekDone) {
            const pState = player.getPlayerState();
            if (pState === 1 || pState === 2) {
                broadcastState();
            }
        }
    }, 1000);
}

function onPlayerStateChange(event) {
    if(isRemoteUpdate) return;
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');

    if (event.data == YT.PlayerState.PLAYING) {
        iconPlay.style.display = 'none'; iconPause.style.display = 'block';
        document.getElementById('center-overlay').classList.add('hidden');
        updateActiveTrack(); 
        
        if (isRestoring) {

            if (isPlaylist && player.getPlaylistIndex() !== targetPlaylistIndex) {
                console.log("Koreksi Index Playlist...");
                player.playVideoAt(targetPlaylistIndex);
                return;
            }
            
            if (!initialSeekDone && activeConfig.startSeconds > 0) {
                const current = player.getCurrentTime();

                if (Math.abs(current - activeConfig.startSeconds) > 5) {
                    console.log("Force Seek ke: " + activeConfig.startSeconds);
                    player.seekTo(activeConfig.startSeconds);
                }
            }
            
            initialSeekDone = true;
            setTimeout(() => { 
                isRestoring = false; 
                broadcastState(); 
            }, 2000);
        } else {
            broadcastState();
        }
    } 
    else if (event.data == YT.PlayerState.PAUSED) {
        iconPlay.style.display = 'block'; iconPause.style.display = 'none';
        if (!isRestoring) broadcastState();
    }
    else { iconPlay.style.display = 'block'; iconPause.style.display = 'none'; }
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
    const key = e.key.toLowerCase();
    if (key === 'f') toggleFullscreen();
    if (key === 'k' || e.code === 'Space') { e.preventDefault(); if(player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo(); }
    if (key === 'm') { if(player.isMuted()) { player.unMute(); updateVolumeUI(false); showToast("Unmuted"); } else { player.mute(); updateVolumeUI(true); showToast("Muted"); } }
    if (e.code === 'ArrowRight') { player.seekTo(player.getCurrentTime() + 10); showToast("+10s"); broadcastState(); }
    if (e.code === 'ArrowLeft') { player.seekTo(player.getCurrentTime() - 10); showToast("-10s"); broadcastState(); }
});

document.getElementById('play-btn').addEventListener('click', () => { if(player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo(); });
document.getElementById('prev-btn').addEventListener('click', () => { if(player.previousVideo) player.previousVideo(); else player.seekTo(0); broadcastState(); });
document.getElementById('next-btn').addEventListener('click', () => { if(player.nextVideo) player.nextVideo(); broadcastState(); });

document.getElementById('load-btn').addEventListener('click', () => {
    const url = document.getElementById('url-input').value;
    const quality = document.getElementById('initial-quality').value;
    const mode = document.querySelector('input[name="playmode"]:checked').value;
    if (!url) return;
    const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
    const vidMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    let config;
    if (listMatch) config = { type: 'playlist', id: listMatch[1], quality: quality, mode: mode };
    else if (vidMatch) config = { type: 'video', id: vidMatch[1], quality: quality, mode: mode };
    else { showToast("Invalid Link"); return; }
    
    isRestoring = false; 
    initialSeekDone = true;
    initPlayer(config);
    activeConfig = config;
    setTimeout(broadcastState, 2000);
    document.getElementById('center-overlay').classList.add('hidden');
});

document.getElementById('open-menu-btn').addEventListener('click', () => { document.getElementById('center-overlay').classList.remove('hidden'); });

const volSlider = document.getElementById('vol-slider');
const muteBtn = document.getElementById('mute-btn');
const iconVolHigh = document.getElementById('icon-vol-high');
const iconVolMute = document.getElementById('icon-vol-mute');

function updateVolumeUI(isMuted) {
    if (isMuted) { iconVolHigh.style.display = 'none'; iconVolMute.style.display = 'block'; volSlider.value = 0; }
    else { iconVolHigh.style.display = 'block'; iconVolMute.style.display = 'none'; volSlider.value = player.getVolume(); }
    if(!isRestoring) broadcastState();
}

muteBtn.addEventListener('click', () => { if (player.isMuted()) { player.unMute(); updateVolumeUI(false); } else { player.mute(); updateVolumeUI(true); } });
volSlider.addEventListener('input', (e) => { 
    const val = e.target.value; player.setVolume(val); 
    if(val > 0 && player.isMuted()) player.unMute();
    updateVolumeUI(player.isMuted()); 
});

const fsBtn = document.getElementById('fullscreen-btn');
function toggleFullscreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else if (document.exitFullscreen) document.exitFullscreen(); }
function updateFsIcon() { const enter = document.getElementById('icon-fs-enter'); const exit = document.getElementById('icon-fs-exit'); if (document.fullscreenElement) { enter.style.display = 'none'; exit.style.display = 'block'; } else { enter.style.display = 'block'; exit.style.display = 'none'; } }
fsBtn.addEventListener('click', toggleFullscreen); document.addEventListener('fullscreenchange', updateFsIcon);

function fetchPlaylistData() {
    if (!player || !player.getPlaylist) return;
    const playlistIds = player.getPlaylist();
    const container = document.getElementById('playlist-items-container'); container.innerHTML = '';
    if (!playlistIds || playlistIds.length === 0) { container.innerHTML = '<div style="padding:20px; text-align:center;">Playlist info unavailable</div>'; return; }
    playlistIds.forEach((vidId, index) => {
        const div = document.createElement('div'); div.className = 'track-item'; div.id = 'track-' + index;
        div.onclick = () => { 
            targetPlaylistIndex = index;
            player.playVideoAt(index); 
            updateActiveTrack(index); 
            if(!isRestoring) broadcastState(); 
        };
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
    if (activeEl) { activeEl.classList.add('active'); if(document.getElementById('playlist-drawer').classList.contains('open')) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
function closeDrawer() { document.getElementById('playlist-drawer').classList.remove('open'); document.getElementById('playlist-btn').classList.remove('active'); }
document.getElementById('playlist-btn').addEventListener('click', () => { const drawer = document.getElementById('playlist-drawer'); const btn = document.getElementById('playlist-btn'); if (drawer.classList.contains('open')) { closeDrawer(); } else { drawer.classList.add('open'); btn.classList.add('active'); updateActiveTrack(); } });
document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);

const progressBar = document.getElementById('progress-bar');
const currTimeEl = document.getElementById('curr-time');
const totalTimeEl = document.getElementById('total-time');

function startProgressLoop() {
    if(updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        if (!player || !player.getCurrentTime || isDraggingScrubber) return;
        try { 
            
            const current = player.getCurrentTime(); 
            const duration = player.getDuration();
            
            currTimeEl.innerText = formatTime(current); 
            totalTimeEl.innerText = formatTime(duration);

            if (player.getPlayerState() === YT.PlayerState.PLAYING && duration > 0) {
                progressBar.value = (current / duration) * 100; 
            }
        } catch(e){}
    }, 500);
}

progressBar.addEventListener('input', () => { isDraggingScrubber = true; });
progressBar.addEventListener('change', (e) => { isDraggingScrubber = false; if(player) { player.seekTo(player.getDuration() * (e.target.value / 100), true); broadcastState(); } });


function formatTime(s) { 
    if (!s || isNaN(s) || s < 0) return "00:00"; 
    s = Math.floor(s); 
    const m = Math.floor(s/60);
    const sec = s % 60;
    return `${m < 10 ? '0'+m : m}:${sec < 10 ? '0'+sec : sec}`; 
}

function showToast(msg) { const toast = document.getElementById('toast-msg'); toast.innerText = msg; toast.style.opacity = 1; setTimeout(() => { toast.style.opacity = 0; }, 3000); }
let idleTimer; document.onmousemove = function() { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000); };
window.addEventListener('pagehide', () => { broadcastState(); });