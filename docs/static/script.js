function updateLiveClock() {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        clockEl.innerText = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    }
}
setInterval(updateLiveClock, 1000); 

document.addEventListener('DOMContentLoaded', updateLiveClock);

var tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player, isPlayerReady = false, updateInterval, saveStateInterval;
var isPlaylist = false, activeConfig = null; 
var lastKnownPlaylistIndex = 0, targetPlaylistIndex = 0;
var isRestoring = false; 
var initialSeekDone = false; 
const STORAGE_KEY = 'stream_session';

function saveState() {
    if (isRestoring || !player || !isPlayerReady || !activeConfig) return;
    
    if (!initialSeekDone && player.getCurrentTime() < 2) return;
    
    try {
        let currentIndex = lastKnownPlaylistIndex;
        
        if (isPlaylist && player.getPlaylistIndex) {
            let idx = player.getPlaylistIndex();
            if (idx !== -1 && idx !== undefined) {
                currentIndex = idx;
                lastKnownPlaylistIndex = idx;
            }
        }

        const currentState = {
            config: activeConfig,
            timestamp: player.getCurrentTime(),
            duration: player.getDuration(),
            playlistIndex: currentIndex,
            lastSaved: Date.now(),
            volume: player.getVolume(),
            muted: player.isMuted()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {}
}

function loadSavedState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { return JSON.parse(saved); } catch(e) { localStorage.removeItem(STORAGE_KEY); } }
    return null;
}

function restoreSession(state) {
    console.log("Restoring session...");
    isRestoring = true; 
    initialSeekDone = false; 
    
    let startSeconds = state.timestamp;
    
    if (state.config.mode === 'live') {
        const timeElapsed = (Date.now() - state.lastSaved) / 1000;
        startSeconds = state.timestamp + timeElapsed;
        if (state.duration > 0) startSeconds = startSeconds % state.duration;
    }
    
    state.config.startSeconds = startSeconds;
    state.config.playlistIndex = state.playlistIndex;
    state.config.startVolume = state.volume;
    state.config.startMuted = state.muted;
    
    const urlInput = document.getElementById('url-input');
    const modeIndicator = document.getElementById('mode-indicator');
    const qualitySelect = document.getElementById('initial-quality');
    
    if(urlInput) urlInput.value = ""; 
    if(modeIndicator) modeIndicator.innerText = state.config.mode || "RESUME";
    if(qualitySelect && state.config.quality) qualitySelect.value = state.config.quality;

    showToast("Resuming Track #" + (state.playlistIndex + 1));
    initPlayer(state.config);
    
    const centerOverlay = document.getElementById('center-overlay');
    if(centerOverlay) centerOverlay.classList.add('hidden');
}

function onYouTubeIframeAPIReady() {
    const state = loadSavedState();
    if (state) restoreSession(state);
}

function initPlayer(config) {
    if (player) {
        clearInterval(saveStateInterval);
        player.destroy();
    }
    activeConfig = config;
    targetPlaylistIndex = parseInt(config.playlistIndex || 0);
    lastKnownPlaylistIndex = targetPlaylistIndex;
    isRestoring = true;
    initialSeekDone = false;
    
    const modeEl = document.getElementById('mode-indicator');
    if(modeEl) modeEl.innerText = config.mode || "RESUME";

    const wrapper = document.getElementById('player-wrapper');
    wrapper.innerHTML = '<div id="video-placeholder"></div>';

    let playerVars = { 
        'autoplay': 1, 'controls': 0, 'showinfo': 0, 'rel': 0, 'fs': 0, 
        'iv_load_policy': 3, 'origin': window.location.origin, 
        'start': Math.floor(config.startSeconds || 0) 
    };
    
    if (config.quality && config.quality !== 'auto') playerVars['vq'] = config.quality;

    let apiConfig = {
        height: '100%', width: '100%', playerVars: playerVars,
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
        playerVars['index'] = targetPlaylistIndex; 
    } 
    else { isPlaylist = false; apiConfig.videoId = config.id; }

    player = new YT.Player('video-placeholder', apiConfig);
}

function onPlayerReady(event) {
    isPlayerReady = true;
    startProgressLoop();
    
    const startVol = (activeConfig.startVolume !== undefined) ? activeConfig.startVolume : 100;
    player.setVolume(startVol);
    const volSlider = document.getElementById('vol-slider');
    if(volSlider) volSlider.value = startVol;
    
    if (activeConfig.startMuted) { 
        player.mute(); 
        updateVolumeUI(true); 
    } else { 
        player.unMute(); 
        updateVolumeUI(false); 
    }

    if(activeConfig.quality && activeConfig.quality !== 'auto') player.setPlaybackQuality(activeConfig.quality);

    const plBtn = document.getElementById('playlist-btn');
    if (isPlaylist) { 
        if(plBtn) plBtn.style.display = 'block'; 
        setTimeout(fetchPlaylistData, 2000); 
    } else { 
        if(plBtn) plBtn.style.display = 'none'; 
        closeDrawer(); 
    }

    saveStateInterval = setInterval(() => {
        if (player && player.getPlayerState && !isRestoring && initialSeekDone) {
            const pState = player.getPlayerState();
            if (pState === 1 || pState === 2) saveState();
        }
    }, 1000);
}

function onPlayerStateChange(event) {
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const centerOverlay = document.getElementById('center-overlay');
    
    if (event.data == YT.PlayerState.PLAYING) { 
        if(iconPlay) iconPlay.style.display = 'none'; 
        if(iconPause) iconPause.style.display = 'block'; 
        if(centerOverlay) centerOverlay.classList.add('hidden'); 
        updateActiveTrack(); 
        
        if (isRestoring) {

            if (isPlaylist && player.getPlaylistIndex() !== targetPlaylistIndex) {
                console.log(`Fixing Index: ${player.getPlaylistIndex()} -> ${targetPlaylistIndex}`);
                player.playVideoAt(targetPlaylistIndex);
                return;
            }
            
            if (!initialSeekDone && activeConfig.startSeconds > 0) {
                if (Math.abs(player.getCurrentTime() - activeConfig.startSeconds) > 5) {
                    console.log("Fixing Time Seek");
                    player.seekTo(activeConfig.startSeconds);
                }
            }

            initialSeekDone = true;
            setTimeout(() => { 
                isRestoring = false; 
                saveState(); 
            }, 2000);
        } else {
            saveState();
        }
    } 
    else if (event.data == YT.PlayerState.PAUSED) { 
        if(iconPlay) iconPlay.style.display = 'block'; 
        if(iconPause) iconPause.style.display = 'none'; 
        if(!isRestoring) saveState(); 
    }
    else { 
        if(iconPlay) iconPlay.style.display = 'block'; 
        if(iconPause) iconPause.style.display = 'none'; 
    }
}

function startProgressLoop() {
    if(updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {

        const progressBar = document.getElementById('progress-bar');
        const currTimeEl = document.getElementById('curr-time');
        const totalTimeEl = document.getElementById('total-time');

        if (!player || !player.getCurrentTime) return;
        
        try {
            const current = player.getCurrentTime();
            const duration = player.getDuration();
            
            if (currTimeEl) currTimeEl.innerText = formatTime(current);
            if (totalTimeEl) totalTimeEl.innerText = formatTime(duration);

            if (progressBar && !document.activeElement.isEqualNode(progressBar)) {
                if (duration > 0) {
                    progressBar.value = (current / duration) * 100;
                } else {
                    progressBar.value = 0;
                }
            }
        } catch(e){}
    }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.addEventListener('input', () => { /* User dragging */ });
        progressBar.addEventListener('change', (e) => { 
            if(player && player.getDuration) {
                const seekTo = player.getDuration() * (e.target.value / 100);
                player.seekTo(seekTo, true);
                saveState();
            }
        });
    }
});

function formatTime(s) { 
    if (typeof s !== 'number' || isNaN(s) || s < 0) return "00:00"; 
    s = Math.floor(s); 
    const m = Math.floor(s/60);
    const sec = s % 60;
    return `${m < 10 ? '0'+m : m}:${sec < 10 ? '0'+sec : sec}`; 
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
    const key = e.key.toLowerCase();
    if (key === 'f') toggleFullscreen();
    if (key === 'k' || e.code === 'Space') { e.preventDefault(); if(player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo(); }
    if (key === 'm') { if(player.isMuted()) { player.unMute(); updateVolumeUI(false); showToast("Unmuted"); } else { player.mute(); updateVolumeUI(true); showToast("Muted"); } }
    if (e.code === 'ArrowRight') { player.seekTo(player.getCurrentTime() + 10); showToast("+10s"); saveState(); }
    if (e.code === 'ArrowLeft') { player.seekTo(player.getCurrentTime() - 10); showToast("-10s"); saveState(); }
});

const playBtn = document.getElementById('play-btn');
if(playBtn) playBtn.addEventListener('click', () => { if(player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo(); });

const prevBtn = document.getElementById('prev-btn');
if(prevBtn) prevBtn.addEventListener('click', () => { if(player.previousVideo) player.previousVideo(); else player.seekTo(0); saveState(); });

const nextBtn = document.getElementById('next-btn');
if(nextBtn) nextBtn.addEventListener('click', () => { if(player.nextVideo) player.nextVideo(); saveState(); });

const loadBtn = document.getElementById('load-btn');
if(loadBtn) loadBtn.addEventListener('click', () => {
    const url = document.getElementById('url-input').value;
    const quality = document.getElementById('initial-quality').value;
    const modeEl = document.querySelector('input[name="playmode"]:checked');
    const mode = modeEl ? modeEl.value : 'resume';
    
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
    document.getElementById('center-overlay').classList.add('hidden');
});

const resumeBtn = document.getElementById('resume-btn');
if(resumeBtn) resumeBtn.addEventListener('click', () => { const state = loadSavedState(); if(state) restoreSession(state); });

const openMenuBtn = document.getElementById('open-menu-btn');
if(openMenuBtn) openMenuBtn.addEventListener('click', () => { 
    document.getElementById('center-overlay').classList.remove('hidden'); 
    if(loadSavedState()) {
        const resCont = document.getElementById('resume-btn-container');
        if(resCont) resCont.style.display = 'block';
    }
});

const volSlider = document.getElementById('vol-slider');
const muteBtn = document.getElementById('mute-btn');
const iconVolHigh = document.getElementById('icon-vol-high');
const iconVolMute = document.getElementById('icon-vol-mute');

function updateVolumeUI(isMuted) {
    if (isMuted) { 
        if(iconVolHigh) iconVolHigh.style.display = 'none'; 
        if(iconVolMute) iconVolMute.style.display = 'block'; 
        if(volSlider) volSlider.value = 0; 
    } else { 
        if(iconVolHigh) iconVolHigh.style.display = 'block'; 
        if(iconVolMute) iconVolMute.style.display = 'none'; 
        if(volSlider && player) volSlider.value = player.getVolume(); 
    }
    saveState();
}

if(muteBtn) muteBtn.addEventListener('click', () => { if (player.isMuted()) { player.unMute(); updateVolumeUI(false); } else { player.mute(); updateVolumeUI(true); } });
if(volSlider) volSlider.addEventListener('input', (e) => { 
    const val = e.target.value; player.setVolume(val); 
    if(val > 0 && player.isMuted()) player.unMute();
    updateVolumeUI(player.isMuted()); 
});

const fsBtn = document.getElementById('fullscreen-btn');
function toggleFullscreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else if (document.exitFullscreen) document.exitFullscreen(); }
function updateFsIcon() { 
    const enter = document.getElementById('icon-fs-enter'); 
    const exit = document.getElementById('icon-fs-exit'); 
    if (document.fullscreenElement) { 
        if(enter) enter.style.display = 'none'; 
        if(exit) exit.style.display = 'block'; 
    } else { 
        if(enter) enter.style.display = 'block'; 
        if(exit) exit.style.display = 'none'; 
    } 
}
if(fsBtn) fsBtn.addEventListener('click', toggleFullscreen); 
document.addEventListener('fullscreenchange', updateFsIcon);

function fetchPlaylistData() {
    if (!player || !player.getPlaylist) return;
    const playlistIds = player.getPlaylist();
    const container = document.getElementById('playlist-items-container'); 
    if(!container) return;
    container.innerHTML = '';
    
    if (!playlistIds || playlistIds.length === 0) { container.innerHTML = '<div style="padding:20px; text-align:center;">Playlist info unavailable</div>'; return; }
    
    playlistIds.forEach((vidId, index) => {
        const div = document.createElement('div'); div.className = 'track-item'; div.id = 'track-' + index;
        div.onclick = () => { 
            targetPlaylistIndex = index;
            player.playVideoAt(index); 
            updateActiveTrack(index); 
            if(!isRestoring) saveState();
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
    if (activeEl) { 
        activeEl.classList.add('active'); 
        const drawer = document.getElementById('playlist-drawer');
        if(drawer && drawer.classList.contains('open')) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
    }
}

function closeDrawer() { 
    const drawer = document.getElementById('playlist-drawer'); 
    const btn = document.getElementById('playlist-btn'); 
    if(drawer) drawer.classList.remove('open'); 
    if(btn) btn.classList.remove('active'); 
}

const playlistBtn = document.getElementById('playlist-btn');
if(playlistBtn) playlistBtn.addEventListener('click', () => { 
    const drawer = document.getElementById('playlist-drawer'); 
    if (drawer.classList.contains('open')) { 
        closeDrawer(); 
    } else { 
        drawer.classList.add('open'); 
        playlistBtn.classList.add('active'); 
        updateActiveTrack(); 
    } 
});

const closeDrawerBtn = document.getElementById('close-drawer-btn');
if(closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);

function showToast(msg) { 
    const toast = document.getElementById('toast-msg'); 
    if(toast) {
        toast.innerText = msg; 
        toast.style.opacity = 1; 
        setTimeout(() => { toast.style.opacity = 0; }, 3000); 
    }
}

let idleTimer; document.onmousemove = function() { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000); };
window.addEventListener('pagehide', () => { saveState(); });