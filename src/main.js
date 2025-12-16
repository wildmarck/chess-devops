import '../style.css'
import * as THREE from 'three'
import { Chess } from 'chess.js'
import gsap from 'gsap'

// --- CONFIGURATION ---
const game = new Chess()
const config = {
    playerWhite: 'Joueur 1',
    playerBlack: 'Stockfish 16', 
    mode: 'bot-hard', 
    gameStarted: false,
    aiThinking: false,
    soundEnabled: true,
    stockfishLevel: 20,
    // TEMPS (en secondes)
    timeWhite: 600, // 10 minutes
    timeBlack: 600,
    timerInterval: null
}

// --- LOGIQUE PENDULE ---
function startClock() {
    if (config.timerInterval) clearInterval(config.timerInterval);
    
    config.timerInterval = setInterval(() => {
        if (!config.gameStarted || game.isGameOver()) {
            clearInterval(config.timerInterval);
            return;
        }

        // On décrémente le joueur dont c'est le tour
        if (game.turn() === 'w') {
            config.timeWhite--;
        } else {
            config.timeBlack--;
        }

        updateClockUI();
        checkTimeFlag();
    }, 1000);
}

function checkTimeFlag() {
    if (config.timeWhite <= 0 || config.timeBlack <= 0) {
        clearInterval(config.timerInterval);
        showVictory(config.timeWhite <= 0 ? 'b' : 'w', "au Temps");
        config.gameStarted = false;
    }
}

function formatTime(seconds) {
    if (seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateClockUI() {
    const elWhite = document.getElementById('timer-white');
    const elBlack = document.getElementById('timer-black');

    if(elWhite) elWhite.innerText = formatTime(config.timeWhite);
    if(elBlack) elBlack.innerText = formatTime(config.timeBlack);

    if(elWhite) elWhite.classList.toggle('active', game.turn() === 'w');
    if(elBlack) elBlack.classList.toggle('active', game.turn() === 'b');

    if(elWhite) elWhite.classList.toggle('low', config.timeWhite < 30);
    if(elBlack) elBlack.classList.toggle('low', config.timeBlack < 30);
}

// --- STOCKFISH WORKER ---
const stockfishUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js';
const blob = new Blob([`importScripts('${stockfishUrl}')`], { type: 'application/javascript' });
const stockfish = new Worker(URL.createObjectURL(blob));

stockfish.onmessage = function(event) {
    if (event.data.startsWith('bestmove')) {
        const bestMove = event.data.split(' ')[1];
        onStockfishMove(bestMove);
    }
};

function initStockfish() {
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
}
initStockfish();

function askStockfish() {
    config.aiThinking = true;
    updateUI(); 
    
    let depth = 5;
    let skill = 0;
    if (config.mode === 'bot-medium') { depth = 10; skill = 5; }
    if (config.mode === 'bot-hard') { depth = 15; skill = 20; } 

    stockfish.postMessage(`setoption name Skill Level value ${skill}`);
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage(`go depth ${depth}`);
}

function onStockfishMove(moveSan) {
    if (game.isGameOver()) return;

    const from = moveSan.substring(0, 2);
    const to = moveSan.substring(2, 4);
    const promotion = moveSan.length > 4 ? moveSan.substring(4, 5) : 'q';

    const move = game.move({ from, to, promotion });
    
    if (move) {
        playSound(move.captured ? 'capture' : 'move');
        syncBoard();
        highlightMove(move.from, move.to);
    }
    
    config.aiThinking = false;
    updateUI();
    updateClockUI();
}

// --- AUDIO MANAGER ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};

async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        sounds[name] = audioBuffer;
    } catch { 
        // Correction ESLint : plus de 'e' ici
        console.warn(`Erreur chargement son: ${name}`); 
    }
}

loadSound('move', '/sounds/move.mp3');
loadSound('capture', '/sounds/capture.mp3');
loadSound('check', '/sounds/check.mp3');
loadSound('win', '/sounds/win.mp3');

function playSound(type) {
    if (!config.soundEnabled || !sounds[type]) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const source = audioCtx.createBufferSource();
        source.buffer = sounds[type];
        source.connect(audioCtx.destination);
        source.start(0);
    } catch { 
        // Correction ESLint : on enlève (e) car on ne l'utilise pas
    }
}

// --- CHARGEMENT TEXTURES ---
const textureLoader = new THREE.TextureLoader()
const pieceURLs = {
    w: {
        p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
        r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
        n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
        b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
        q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
        k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg'
    },
    b: {
        p: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
        r: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
        n: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
        b: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
        q: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
        k: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
    }
}

const textures = { w: {}, b: {} };
['w', 'b'].forEach(c => {
    Object.keys(pieceURLs[c]).forEach(type => {
        textures[c][type] = textureLoader.load(pieceURLs[c][type]);
    });
});

// --- SCENE 3D ---
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 9, 8); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const container = document.getElementById('canvas-container');
if (container) container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// --- PLATEAU & PIÈCES ---
const boardGroup = new THREE.Group();
const piecesMap = new Map();
const highlights = []; 
let selectedSquare = null;

function createBoard() {
    const border = new THREE.Mesh(
        new THREE.BoxGeometry(8.4, 0.5, 8.4),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    border.position.y = -0.26;
    scene.add(border);

    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            const isWhite = (x + y) % 2 === 0;
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshLambertMaterial({ 
                color: isWhite ? 0xebecd0 : 0x739552, 
                side: THREE.DoubleSide
            });
            const square = new THREE.Mesh(geometry, material);
            square.rotation.x = -Math.PI / 2;
            square.position.set(x - 3.5, 0, y - 3.5);
            square.userData = { square: coordsToSquare(x, y) };
            boardGroup.add(square);
        }
    }
    scene.add(boardGroup);
}

function highlightMove(from, to) {
    highlights.forEach(h => scene.remove(h));
    highlights.length = 0;

    [from, to].forEach(sq => {
        if(!sq) return;
        const [cx, cy] = squareToCoords(sq);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, 0.01, cy);
        scene.add(mesh);
        highlights.push(mesh);
    });
}

function syncBoard() {
    piecesMap.forEach(mesh => scene.remove(mesh));
    piecesMap.clear();

    const board = game.board();
    board.forEach((row, z) => {
        row.forEach((piece, x) => {
            if (piece) {
                const geometry = new THREE.PlaneGeometry(0.85, 0.85);
                const texture = textures[piece.color][piece.type];
                
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    color: 0xffffff,
                    depthTest: false 
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(x - 3.5, 0.4, z - 3.5);
                mesh.rotation.x = -Math.PI / 4; 
                mesh.renderOrder = 1;
                
                mesh.userData = { square: coordsToSquare(x, z) };
                scene.add(mesh);
                piecesMap.set(coordsToSquare(x, z), mesh);
            }
        });
    });
    updateUI();
    updateClockUI();
}

// --- HELPERS UI ---
function coordsToSquare(x, z) { return String.fromCharCode(97 + x) + (8 - z); }
function squareToCoords(sq) {
    const col = sq.charCodeAt(0) - 97;
    const row = 8 - parseInt(sq[1]);
    return [col - 3.5, row - 3.5];
}

function updateUI() {
    let turnText = game.turn() === 'w' ? `Trait : ${config.playerWhite}` : `Trait : ${config.playerBlack}`;
    if (config.aiThinking) turnText = "🤖 Stockfish calcule...";
    
    const indicator = document.getElementById('turn-indicator');
    if (indicator) indicator.innerText = turnText;
    
    const checkAlert = document.getElementById('check-alert');
    if (checkAlert) checkAlert.style.display = game.inCheck() ? 'block' : 'none';
    
    if(game.isGameOver()) {
        const winnerColor = game.turn() === 'w' ? 'b' : 'w';
        let reason = "Inconnue";
        if (game.isCheckmate()) reason = "par Echec et Mat";
        else if (game.isDraw()) reason = "Nulle (Pat/Repetition)";
        
        showVictory(game.isCheckmate() ? winnerColor : 'draw', reason);
    }
}

function showVictory(winnerColor, reasonText) {
    clearInterval(config.timerInterval);
    playSound('win');
    const modal = document.getElementById('victory-screen');
    const winnerName = document.getElementById('winner-name');
    const reason = document.getElementById('win-reason');

    if (modal) {
        if (winnerColor === 'draw') {
            winnerName.innerText = "MATCH NUL";
            winnerName.style.color = "#fff";
        } else {
            const name = winnerColor === 'w' ? config.playerWhite : config.playerBlack;
            winnerName.innerText = name + " GAGNE !";
            winnerName.style.color = "#ffd700";
        }
        reason.innerText = reasonText;
        modal.style.display = 'flex';
    }
}

// --- INTERACTIONS ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    if (!config.gameStarted || config.aiThinking || game.isGameOver()) return;
    if (config.mode !== 'pvp' && game.turn() === 'b') return;

    if (audioCtx.state === 'suspended') audioCtx.resume();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const hit = intersects.find(obj => obj.object.userData.square);
        if (!hit) return;
        
        const square = hit.object.userData.square;

        if (!selectedSquare) {
            const moves = game.moves({ square: square, verbose: true });
            if (moves.length > 0) {
                selectedSquare = square;
                const mesh = piecesMap.get(square);
                if(mesh) gsap.to(mesh.position, { y: 0.6, duration: 0.15 });
            }
        } else {
            try {
                const moveDetails = game.move({ from: selectedSquare, to: square, promotion: 'q' });
                
                if (moveDetails) {
                    playSound(moveDetails.captured ? 'capture' : 'move');
                    syncBoard();
                    highlightMove(selectedSquare, square);
                    
                    if (config.mode !== 'pvp') {
                        setTimeout(askStockfish, 500);
                    }
                } else {
                    const mesh = piecesMap.get(selectedSquare);
                    if(mesh) gsap.to(mesh.position, { y: 0.4, duration: 0.15 });
                }
            } catch {
                const mesh = piecesMap.get(selectedSquare);
                if(mesh) gsap.to(mesh.position, { y: 0.4, duration: 0.15 });
            }
            selectedSquare = null;
        }
    }
});

// --- BOUTON DEMARRER ---
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const pWhite = document.getElementById('player-white');
            const pBlack = document.getElementById('player-black');
            const mode = document.getElementById('game-mode');
            const lWhite = document.getElementById('label-white');
            const lBlack = document.getElementById('label-black');

            config.playerWhite = pWhite ? pWhite.value : "Joueur 1";
            config.playerBlack = pBlack ? pBlack.value : "Stockfish";
            config.mode = mode ? mode.value : 'bot-hard';
            
            if(lWhite) lWhite.innerText = config.playerWhite;
            if(lBlack) lBlack.innerText = config.playerBlack;

            const overlay = document.getElementById('start-screen');
            gsap.to(overlay, { 
                opacity: 0, duration: 0.5, 
                onComplete: () => {
                    overlay.style.display = 'none';
                    config.gameStarted = true;
                    config.timeWhite = 600;
                    config.timeBlack = 600;
                    startClock();
                    updateUI();
                } 
            });
        });
    }
});

// --- BOUCLE ---
createBoard();
syncBoard();

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});