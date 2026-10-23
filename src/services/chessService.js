import { Chess } from 'chess.js'

class ChessService {
  constructor() {
    this.game = new Chess()
    this.moveHistory = []
    this.listeners = []
  }

  subscribe(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  notify() {
    const state = this.getState()
    this.listeners.forEach(cb => cb(state))
  }

  getState() {
    return {
      fen: this.game.fen(),
      board: this.game.board(),
      turn: this.game.turn(),
      isCheck: this.game.inCheck(),
      isCheckmate: this.game.isCheckmate(),
      isStalemate: this.game.isStalemate(),
      isDraw: this.game.isDraw(),
      isGameOver: this.game.isGameOver(),
      moveHistory: [...this.moveHistory],
      legalMoves: this.game.moves({ verbose: true })
    }
  }

  parseMoveInput(input) {
    const text = input.trim()
    if (!text) return null

    const patterns = [
      /(?:opponent|enemy|black|white)?\s*(?:played|moved|move)?\s*:?\s*([a-h][1-8][a-h][1-8][qrbn]?)/i,
      /(?:i|my)?\s*(?:played|moved|move)?\s*:?\s*([a-h][1-8][a-h][1-8][qrbn]?)/i,
      /(?:opponent|enemy)?\s*(?:played|moved)?\s*:?\s*([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/i,
      /(?:i|my)?\s*(?:played|moved|move)?\s*:?\s*([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/i,
      /^([a-h][1-8][a-h][1-8][qrbn]?)$/i,
      /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)$/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  detectMoveIntent(input) {
    const text = input.toLowerCase()
    const isOpponent = /opponent|enemy|black/.test(text)
    const isSelf = /^(i|my)/.test(text) || /i played|my move/.test(text)
    const isPlayed = /played|moved/.test(text)

    return {
      isOpponent,
      isSelf,
      isPlayed: isPlayed || isSelf,
      isSuggestion: /suggest|recommend|best|what should/.test(text)
    }
  }

  makeMove(moveInput) {
    try {
      const move = this.game.move(moveInput)
      if (move) {
        this.moveHistory.push(move.san)
        this.notify()
        return { success: true, move }
      }
    } catch (e) {
      return { success: false, error: 'Illegal move' }
    }
    return { success: false, error: 'Invalid move' }
  }

  makeMoveUci(uci) {
    try {
      const move = this.game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || undefined
      })
      if (move) {
        this.moveHistory.push(move.san)
        this.notify()
        return { success: true, move }
      }
    } catch (e) {
      return { success: false, error: 'Illegal move' }
    }
    return { success: false, error: 'Invalid move' }
  }

  validateMove(moveInput) {
    try {
      const testGame = new Chess(this.game.fen())
      const move = testGame.move(moveInput)
      return move ? { valid: true, move } : { valid: false }
    } catch (e) {
      return { valid: false }
    }
  }

  validateUci(uci) {
    try {
      const testGame = new Chess(this.game.fen())
      const move = testGame.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || undefined
      })
      return move ? { valid: true, move } : { valid: false }
    } catch (e) {
      return { valid: false }
    }
  }

  undo() {
    const move = this.game.undo()
    if (move) {
      this.moveHistory.pop()
      this.notify()
      return { success: true, move }
    }
    return { success: false, error: 'Nothing to undo' }
  }

  reset() {
    this.game = new Chess()
    this.moveHistory = []
    this.notify()
  }

  loadFen(fen) {
    try {
      this.game = new Chess(fen)
      this.moveHistory = []
      this.notify()
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Invalid FEN' }
    }
  }

  getFen() {
    return this.game.fen()
  }

  getPgn() {
    return this.game.pgn()
  }

  loadPgn(pgn) {
    try {
      this.game.loadPgn(pgn)
      this.moveHistory = this.game.history()
      this.notify()
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Invalid PGN' }
    }
  }

  getPositionForMove(uci) {
    try {
      const testGame = new Chess(this.game.fen())
      testGame.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || undefined
      })
      return testGame.fen()
    } catch (e) {
      return null
    }
  }

  getSanForUci(uci) {
    try {
      const testGame = new Chess(this.game.fen())
      const move = testGame.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || undefined
      })
      return move ? move.san : null
    } catch (e) {
      return null
    }
  }
}

export const chessService = new ChessService()
