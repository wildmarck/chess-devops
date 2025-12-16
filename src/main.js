import './style.css'
import * as THREE from 'three'
import { Chess } from 'chess.js' // La librairie pro
import gsap from 'gsap'

// --- CONFIGURATION ---
const game = new Chess() // Logique complète immédiate
let selectedSquare = null
const boardGroup = new THREE.Group()
const piecesMap = new Map() // Lien entre Case (e.g. "e2") et Mesh 3D

// --- SCENE SETUP ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a0000)
scene.fog = new THREE.FogExp2(0x1a0000, 0.03)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 10, 10)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.getElementById('canvas-container').appendChild(renderer.domElement)

// Lumières "Enfer"
const ambient = new THREE.AmbientLight(0xff4400, 0.5)
const light = new THREE.PointLight(0xffaa00, 1, 20)
light.position.set(5, 10, 5)
light.castShadow = true
scene.add(ambient, light)

// --- FONCTIONS 3D ---
function createBoard() {
    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            const isWhite = (x + y) % 2 === 0
            const geometry = new THREE.BoxGeometry(1, 0.2, 1)
            const material = new THREE.MeshStandardMaterial({ 
                color: isWhite ? 0xcc6633 : 0x330000,
                roughness: 0.8
            })
            const cube = new THREE.Mesh(geometry, material)
            cube.position.set(x - 3.5, -0.1, y - 3.5)
            cube.receiveShadow = true
            cube.userData = { square: coordsToSquare(x, y) }
            boardGroup.add(cube)
        }
    }
    scene.add(boardGroup)
}

function coordsToSquare(x, z) {
    const file = String.fromCharCode(97 + x) // 0 -> 'a'
    const rank = 8 - z                       // 0 -> 8
    return file + rank
}

function squareToPos(square) {
    const col = square.charCodeAt(0) - 97
    const row = 8 - parseInt(square[1])
    return { x: col - 3.5, z: row - 3.5 }
}

function createPieceGeometry(type) {
    // Formes simples mais abstraites "Design"
    switch(type) {
        case 'p': return new THREE.CylinderGeometry(0.2, 0.3, 0.6, 16); // Pion
        case 'r': return new THREE.BoxGeometry(0.6, 0.8, 0.6);         // Tour
        case 'n': return new THREE.ConeGeometry(0.3, 0.9, 16);         // Cavalier (Cone)
        case 'b': return new THREE.CapsuleGeometry(0.2, 0.5, 4, 8);    // Fou
        case 'q': return new THREE.TorusKnotGeometry(0.2, 0.05, 64, 8); // Reine (Cool shape)
        case 'k': return new THREE.OctahedronGeometry(0.4);            // Roi
        default: return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }
}

function syncBoard() {
    // 1. Supprimer les anciennes pièces visuelles
    piecesMap.forEach(mesh => scene.remove(mesh))
    piecesMap.clear()

    // 2. Lire l'état du jeu et recréer les pièces
    const board = game.board()
    board.forEach((row, z) => {
        row.forEach((piece, x) => {
            if (piece) {
                const geometry = createPieceGeometry(piece.type)
                const material = new THREE.MeshStandardMaterial({
                    color: piece.color === 'w' ? 0xffffff : 0x111111,
                    emissive: piece.color === 'w' ? 0xaaaaaa : 0x550000,
                    emissiveIntensity: 0.4
                })
                const mesh = new THREE.Mesh(geometry, material)
                mesh.position.set(x - 3.5, 0.5, z - 3.5)
                mesh.castShadow = true
                mesh.userData = { type: 'piece', square: coordsToSquare(x, z) }
                
                scene.add(mesh)
                piecesMap.set(coordsToSquare(x, z), mesh)
            }
        })
    })
    updateStatus()
}

function updateStatus() {
    let status = ''
    if (game.isCheckmate()) status = 'Echec et Mat !'
    else if (game.isDraw()) status = 'Match Nul'
    else status = 'Tour : ' + (game.turn() === 'w' ? 'Blancs' : 'Noirs')
    
    if (game.inCheck()) status += ' (ECHEC !)'
    document.getElementById('status').innerText = status
}

// --- INTERACTION ---
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    
    const intersects = raycaster.intersectObjects(scene.children, true)
    if (intersects.length > 0) {
        // On cherche si on a cliqué sur une case ou une pièce
        let target = intersects[0].object
        let square = target.userData.square
        
        // Si clic sur pièce, récupérer sa case
        if (target.userData.type === 'piece') square = target.userData.square
        
        if (!square) return

        if (!selectedSquare) {
            // Premier clic : Sélection
            const moves = game.moves({ square: square, verbose: true })
            if (moves.length > 0) {
                selectedSquare = square
                // Petit effet visuel
                const mesh = piecesMap.get(square)
                if(mesh) gsap.to(mesh.position, { y: 1, duration: 0.2 })
            }
        } else {
            // Deuxième clic : Mouvement
            try {
                const move = game.move({
                    from: selectedSquare,
                    to: square,
                    promotion: 'q' // Toujours Reine pour simplifier
                })
                
                if (move) {
                    syncBoard() // Met à jour le plateau
                    // IA aléatoire stupide pour démo
                    setTimeout(makeRandomMove, 500)
                }
            } catch (e) {
                // Mouvement illégal
                const mesh = piecesMap.get(selectedSquare)
                if(mesh) gsap.to(mesh.position, { y: 0.5, duration: 0.2 })
            }
            selectedSquare = null
        }
    }
})

function makeRandomMove() {
    if (game.isGameOver()) return
    const moves = game.moves()
    const move = moves[Math.floor(Math.random() * moves.length)]
    game.move(move)
    syncBoard()
}

document.getElementById('btn-reset').onclick = () => {
    game.reset()
    syncBoard()
}

// --- BOUCLE ---
createBoard()
syncBoard()
function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
}
animate()

// Export pour les tests unitaires (IMPORTANT pour le DevOps)
export function getGameStatus() { return game.isGameOver() }