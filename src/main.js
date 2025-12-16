import './style.css'
import * as THREE from 'three'
import { Chess } from 'chess.js'
import gsap from 'gsap'

// --- CONFIGURATION ---
const game = new Chess()
const config = {
    playerWhite: 'Joueur 1',
    playerBlack: 'Joueur 2',
    mode: 'pvp',
    gameStarted: false,
    aiThinking: false,
    soundEnabled: true
}

// --- AUDIO MANAGER ---
// Assure-toi que les fichiers existent dans /public/sounds/
const sounds = {
    move: new Audio('/sounds/move.mp3'),
    capture: new Audio('/sounds/capture.mp3'),
    check: new Audio('/sounds/check.mp3'),
    win: new Audio('/sounds/win.mp3')
}
function playSound(type) {
    if (!config.soundEnabled) return
    try {
        if(sounds[type]) {
            sounds[type].currentTime = 0
            sounds[type].play().catch(e => {})
        }
    } catch(e) {}
}

// --- CHARGEMENT TEXTURES (CORRECTION COULEURS) ---
const textureLoader = new THREE.TextureLoader()

// URLS SEPARÉES : Blancs (lt) vs Noirs (dt)
const whitePieceURLs = {
    'p': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    'r': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'k': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg'
}

const blackPieceURLs = {
    'p': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'r': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'k': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
}

const whiteTextures = {}
const blackTextures = {}

Object.keys(whitePieceURLs).forEach(type => whiteTextures[type] = textureLoader.load(whitePieceURLs[type]))
Object.keys(blackPieceURLs).forEach(type => blackTextures[type] = textureLoader.load(blackPieceURLs[type]))

// --- SCENE ---
const scene = new THREE.Scene()
scene.background = null 

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 9, 8) 
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.getElementById('canvas-container').appendChild(renderer.domElement)

// --- LUMIÈRES ---
const ambient = new THREE.AmbientLight(0xffffff, 0.8) // Plus lumineux pour bien voir le noir
scene.add(ambient)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

// --- PLATEAU ---
const boardGroup = new THREE.Group()
const piecesMap = new Map()
let selectedSquare = null

function createBoard() {
    const border = new THREE.Mesh(
        new THREE.BoxGeometry(8.4, 0.5, 8.4),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
    )
    border.position.y = -0.26 
    scene.add(border)

    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            const isWhite = (x + y) % 2 === 0
            const geometry = new THREE.PlaneGeometry(1, 1)
            const material = new THREE.MeshLambertMaterial({ 
                color: isWhite ? 0xebecd0 : 0x739552, 
                side: THREE.DoubleSide
            })
            const square = new THREE.Mesh(geometry, material)
            square.rotation.x = -Math.PI / 2 
            square.position.set(x - 3.5, 0, y - 3.5)
            square.userData = { square: coordsToSquare(x, y) }
            boardGroup.add(square)
        }
    }
    scene.add(boardGroup)
}

function syncBoard() {
    piecesMap.forEach(mesh => scene.remove(mesh))
    piecesMap.clear()

    const board = game.board()
    board.forEach((row, z) => {
        row.forEach((piece, x) => {
            if (piece) {
                const geometry = new THREE.PlaneGeometry(0.85, 0.85)
                
                // CHOIX DE LA BONNE TEXTURE (BLANC OU NOIR)
                const texture = piece.color === 'w' ? whiteTextures[piece.type] : blackTextures[piece.type]
                
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    color: 0xffffff, // On laisse la couleur naturelle de l'image SVG
                    depthTest: false 
                })

                const mesh = new THREE.Mesh(geometry, material)
                mesh.position.set(x - 3.5, 0.4, z - 3.5)
                mesh.rotation.x = -Math.PI / 4 
                mesh.renderOrder = 1 
                
                mesh.userData = { type: 'piece', square: coordsToSquare(x, z) }
                scene.add(mesh)
                piecesMap.set(coordsToSquare(x, z), mesh)
            }
        })
    })
    updateUI()
}

// --- LOGIQUE & SON ---
function coordsToSquare(x, z) { return String.fromCharCode(97 + x) + (8 - z) }

function updateUI() {
    let turnText = game.turn() === 'w' ? `Trait : ${config.playerWhite}` : `Trait : ${config.playerBlack}`
    if (config.aiThinking) turnText = "L'IA réfléchit..."
    document.getElementById('turn-indicator').innerText = turnText
    
    // Check
    if(game.inCheck()) {
        document.getElementById('check-alert').style.display = 'block'
        if(!game.isGameOver()) playSound('check')
    } else {
        document.getElementById('check-alert').style.display = 'none'
    }

    // VICTOIRE (Glassmorphism Modal)
    if(game.isGameOver()) {
        playSound('win')
        const modal = document.getElementById('victory-screen')
        const winnerName = document.getElementById('winner-name')
        const reason = document.getElementById('win-reason')

        if (game.isCheckmate()) {
            // Le tour est inversé car c'est celui qui vient de jouer qui a gagné
            const winner = game.turn() === 'w' ? config.playerBlack : config.playerWhite
            winnerName.innerText = winner + " a gagné !"
            reason.innerText = "par Echec et Mat"
            winnerName.style.color = "#ffd700"
        } else if (game.isDraw()) {
            winnerName.innerText = "Match Nul"
            reason.innerText = "Pat / Répétition"
            winnerName.style.color = "#ffffff"
        }

        modal.style.display = 'flex' // Affiche le modal
    }
}

// IA MINIMAX (Gardée identique mais propre)
const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 }
function evaluateBoard(fen) {
    const tempGame = new Chess(fen)
    const board = tempGame.board()
    let totalEvaluation = 0
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j]
            if (piece) totalEvaluation += (piece.color === 'w' ? pieceValues[piece.type] : -pieceValues[piece.type])
        }
    }
    return totalEvaluation
}

function minimax(gameDepth, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || gameDepth.isGameOver()) return -evaluateBoard(gameDepth.fen())
    const moves = gameDepth.moves()
    if (isMaximizingPlayer) {
        let maxEval = -Infinity
        for (let i = 0; i < moves.length; i++) {
            gameDepth.move(moves[i])
            const ev = minimax(gameDepth, depth - 1, alpha, beta, false)
            gameDepth.undo()
            maxEval = Math.max(maxEval, ev)
            alpha = Math.max(alpha, ev)
            if (beta <= alpha) break
        }
        return maxEval
    } else {
        let minEval = Infinity
        for (let i = 0; i < moves.length; i++) {
            gameDepth.move(moves[i])
            const ev = minimax(gameDepth, depth - 1, alpha, beta, true)
            gameDepth.undo()
            minEval = Math.min(minEval, ev)
            beta = Math.min(beta, ev)
            if (beta <= alpha) break
        }
        return minEval
    }
}

function triggerBotMove() {
    if (game.isGameOver()) return
    config.aiThinking = true
    updateUI()
    setTimeout(() => {
        const depth = config.mode === 'bot-hard' ? 3 : 2
        const moves = game.moves()
        let bestMove = null
        let bestValue = -Infinity
        
        if (config.mode === 'bot-medium' && Math.random() < 0.3) {
            bestMove = moves[Math.floor(Math.random() * moves.length)]
        } else {
            for (let i = 0; i < moves.length; i++) {
                game.move(moves[i])
                const boardValue = minimax(game, depth - 1, -Infinity, Infinity, false)
                game.undo()
                if (boardValue > bestValue) {
                    bestValue = boardValue
                    bestMove = moves[i]
                }
            }
        }
        if (!bestMove) bestMove = moves[Math.floor(Math.random() * moves.length)]
        
        // Jouer le coup
        game.move(bestMove)
        if(bestMove.includes('x')) playSound('capture')
        else playSound('move')
        
        config.aiThinking = false
        syncBoard()
    }, 100)
}

// --- INTERACTIONS ---
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('click', (event) => {
    if (!config.gameStarted || config.aiThinking || game.isGameOver()) return;
    if (config.mode !== 'pvp' && game.turn() === 'b') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    
    const intersects = raycaster.intersectObjects(scene.children, true)
    
    if (intersects.length > 0) {
        const hit = intersects.find(obj => obj.object.userData.square)
        if (!hit) return
        
        const square = hit.object.userData.square

        if (!selectedSquare) {
            const moves = game.moves({ square: square, verbose: true })
            if (moves.length > 0) {
                selectedSquare = square
                const mesh = piecesMap.get(square)
                if(mesh) gsap.to(mesh.position, { y: 0.6, duration: 0.1 })
            }
        } else {
            try {
                // On vérifie si c'est une capture avant de jouer le coup pour le son
                const moveDetails = game.move({ from: selectedSquare, to: square, promotion: 'q' })
                if (moveDetails) {
                    // SON
                    if(moveDetails.captured) playSound('capture')
                    else playSound('move')

                    syncBoard()
                    if (config.mode !== 'pvp') triggerBotMove()
                } else {
                    const mesh = piecesMap.get(selectedSquare)
                    if(mesh) gsap.to(mesh.position, { y: 0.4, duration: 0.1 })
                }
            } catch (e) {
                const mesh = piecesMap.get(selectedSquare)
                if(mesh) gsap.to(mesh.position, { y: 0.4, duration: 0.1 })
            }
            selectedSquare = null
        }
    }
})

// --- START ---
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-start')
    btn.addEventListener('click', () => {
        config.playerWhite = document.getElementById('player-white').value || "Joueur 1"
        config.playerBlack = document.getElementById('player-black').value || "Joueur 2"
        config.mode = document.getElementById('game-mode').value
        
        const overlay = document.getElementById('start-screen')
        gsap.to(overlay, { 
            opacity: 0, duration: 0.5, 
            onComplete: () => {
                overlay.style.display = 'none'
                config.gameStarted = true
                updateUI()
            } 
        })
    })
})

// --- ANIMATION ---
createBoard()
syncBoard()
function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
}
animate()
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})