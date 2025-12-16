import { expect, test } from 'vitest'
import { Chess } from 'chess.js'

test('La partie commence avec les blancs', () => {
  const game = new Chess()
  expect(game.turn()).toBe('w')
})

test('Le mat du berger fonctionne (Logique)', () => {
  const game = new Chess()
  game.move('e4')
  game.move('e5')
  game.move('Qh5')
  game.move('Nc6')
  game.move('Bc4')
  game.move('Nf6')
  game.move('Qxf7') // Mat !
  expect(game.isCheckmate()).toBe(true)
})