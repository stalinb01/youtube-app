// YouTube IFrame API
let player;
let playerReady = false;

// IndexedDB
let db;
const DB_NAME = 'YouTubeAppDB';
const DB_VERSION = 1;

// WebSocket para actualizaciones (opcional)
let ws = null;

// Inicializar IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('history')) {
                const objectStore = database.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('videoId', 'videoId', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Guardar en historial
async function saveToHistory(videoId) {
    if (!db) await initDB();
    
    const transaction = db.transaction(['history'], 'readwrite');
    const objectStore = transaction.objectStore('history');
    
    const entry = {
        videoId: videoId,
        timestamp: new Date().toISOString()
    };
    
    objectStore.add(entry);
    loadHistory();
}

// Cargar historial
async function loadHistory() {
    if (!db) await initDB();
    
    const transaction = db.transaction(['history'], 'readonly');
    const objectStore = transaction.objectStore('history');
    const index = objectStore.index('timestamp');
    
    const request = index.openCursor(null, 'prev');
    const historyContainer = document.getElementById('history');
    const items = [];
    
    request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && items.length < 10) {
            items.push(cursor.value);
            cursor.continue();
        } else {
            renderHistory(items);
        }
    };
}

// Renderizar historial
function renderHistory(items) {
    const historyContainer = document.getElementById('history');
    
    if (items.length === 0) {
        historyContainer.innerHTML = '';
        return;
    }
    
    let html = '<div class="history-title">HISTORIAL RECIENTE</div>';
    items.forEach(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        html += `
            <div class="history-item" data-video-id="${item.videoId}">
                <div class="history-icon">🎬</div>
                <div class="history-info">
                    <div class="history-id">${item.videoId}</div>
                    <div class="history-time">${timeStr}</div>
                </div>
            </div>
        `;
    });
    
    historyContainer.innerHTML = html;
    
    // Eventos para items del historial
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const videoId = item.getAttribute('data-video-id');
            document.getElementById('videoIdInput').value = videoId;
            loadVideo(videoId);
        });
    });
}

// Mostrar mensaje de estado
function showStatus(message, duration = 2000) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.classList.add('show');
    
    setTimeout(() => {
        status.classList.remove('show');
    }, duration);
}

// Cargar API de YouTube
function loadYouTubeAPI() {
    return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
            resolve();
            return;
        }
        
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        
        window.onYouTubeIframeAPIReady = () => {
            resolve();
        };
        
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
}

// Crear reproductor
async function createPlayer(videoId) {
    await loadYouTubeAPI();
    
    if (player) {
        player.loadVideoById(videoId);
        return;
    }
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            playsinline: 0
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });
}

// Player listo
function onPlayerReady(event) {
    playerReady = true;
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('controls').style.display = 'flex';
    showStatus('✓ Video cargado');
}

// Cambio de estado del player
function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    
    if (event.data === YT.PlayerState.PLAYING) {
        playPauseBtn.textContent = '⏸';
    } else {
        playPauseBtn.textContent = '▶️';
    }
}

// Cargar video
async function loadVideo(videoId) {
    if (!videoId || videoId.trim() === '') {
        showStatus('⚠️ Ingresa un ID de video válido');
        return;
    }
    
    try {
        showStatus('⏳ Cargando video...');
        await createPlayer(videoId);
        await saveToHistory(videoId);
    } catch (error) {
        console.error('Error cargando video:', error);
        showStatus('❌ Error al cargar el video');
    }
}

// Controles
function setupControls() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const loadBtn = document.getElementById('loadBtn');
    const videoIdInput = document.getElementById('videoIdInput');
    
    playPauseBtn.addEventListener('click', () => {
        if (!playerReady) return;
        
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });
    
    fullscreenBtn.addEventListener('click', () => {
        const playerContainer = document.getElementById('playerContainer');
        
        if (!document.fullscreenElement) {
            if (playerContainer.requestFullscreen) {
                playerContainer.requestFullscreen();
            } else if (playerContainer.webkitRequestFullscreen) {
                playerContainer.webkitRequestFullscreen();
            } else if (playerContainer.msRequestFullscreen) {
                playerContainer.msRequestFullscreen();
            }
            document.body.classList.add('fullscreen');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            document.body.classList.remove('fullscreen');
        }
    });
    
    loadBtn.addEventListener('click', () => {
        const videoId = videoIdInput.value.trim();
        loadVideo(videoId);
    });
    
    videoIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const videoId = videoIdInput.value.trim();
            loadVideo(videoId);
        }
    });
    
    // Detectar salida de pantalla completa
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen');
        }
    });
}

// WebSocket (opcional para actualizaciones en vivo)
function initWebSocket() {
    // Ejemplo de WebSocket - ajustar URL según tu servidor
    // ws = new WebSocket('wss://tu-servidor.com/ws');
    
    // ws.onopen = () => {
    //     console.log('WebSocket conectado');
    //     showStatus('🔗 Conectado al servidor');
    // };
    
    // ws.onmessage = (event) => {
    //     const data = JSON.parse(event.data);
    //     if (data.type === 'new_video') {
    //         showStatus('🆕 Nuevo video disponible');
    //     }
    // };
    
    // ws.onerror = (error) => {
    //     console.error('WebSocket error:', error);
    // };
    
    // ws.onclose = () => {
    //     console.log('WebSocket desconectado');
    //     setTimeout(initWebSocket, 5000); // Reintentar conexión
    // };
}

// Inicializar app
async function init() {
    await initDB();
    await loadHistory();
    setupControls();
    // initWebSocket(); // Descomentar si usas WebSocket
    
    // Detectar orientación para pantalla completa automática
    if (screen.orientation) {
        screen.orientation.addEventListener('change', () => {
            if (screen.orientation.type.includes('landscape') && playerReady) {
                const playerContainer = document.getElementById('playerContainer');
                if (!document.fullscreenElement && playerContainer.requestFullscreen) {
                    playerContainer.requestFullscreen();
                }
            }
        });
    }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}