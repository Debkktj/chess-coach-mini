import React, { useMemo, useState, useCallback } from 'react'
import { chessService } from '../services/chessService'

const PIECE_SYMBOLS = {
  'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
  'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
}

const FILES = 'abcdefgh'
const RANKS = '87654321'

function ChessBoard({ 
  fen, 
  orientation = 'white', 
  selectedSquare, 
  onSquareClick,
  arrow,
  showArrows = true,
  interactive = true,
  showLabels = true,
  size = 'normal'
}) {
  const [boardState, setBoardState] = useState(() => chessService.getState())

  const squares = useMemo(() => {
    const result = []
    const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse()
    const files = orientation === 'white' ? FILES : [...FILES].reverse()

    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
        const file = files[fileIdx]
        const rank = ranks[rankIdx]
        const square = `${file}${rank}`
        const isLight = (fileIdx + rankIdx) % 2 === 0

        result.push({
          square,
          file,
          rank,
          isLight,
          fileIdx,
          rankIdx
        })
      }
    }
    return result
  }, [orientation])

  const getPieceAt = useCallback((square) => {
    const game = new (chessService.game.constructor)(fen)
    const board = game.board()
    const file = square.charCodeAt(0) - 97
    const rank = 8 - parseInt(square[1])

    if (rank < 0 || rank > 7 || file < 0 || file > 7) return null

    const piece = board[rank]?.[file]
    if (!piece) return null

    const color = piece.color === 'w' ? 'w' : 'b'
    const type = piece.type
    return `${color}${type}`
  }, [fen])

  const getSquareCoords = useCallback((square) => {
    const file = square.charCodeAt(0) - 97
    const rank = parseInt(square[1]) - 1

    const x = orientation === 'white' ? file : 7 - file
    const y = orientation === 'white' ? 7 - rank : rank

    return { x, y }
  }, [orientation])

  const arrowPath = useMemo(() => {
    if (!arrow || !showArrows) return null

    const from = getSquareCoords(arrow.from)
    const to = getSquareCoords(arrow.to)

    const cellSize = 100 / 8
    const padding = cellSize * 0.15

    const x1 = from.x * cellSize + cellSize / 2
    const y1 = from.y * cellSize + cellSize / 2
    const x2 = to.x * cellSize + cellSize / 2
    const y2 = to.y * cellSize + cellSize / 2

    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.sqrt(dx * dx + dy * dy)
    const unitX = dx / length
    const unitY = dy / length

    const startX = x1 + unitX * padding
    const startY = y1 + unitY * padding
    const endX = x2 - unitX * padding * 1.5
    const endY = y2 - unitY * padding * 1.5

    const headLength = cellSize * 0.35
    const headWidth = cellSize * 0.25

    const angle = Math.atan2(dy, dx)
    const headAngle1 = angle + Math.PI * 0.85
    const headAngle2 = angle - Math.PI * 0.85

    const headX1 = endX + Math.cos(headAngle1) * headLength
    const headY1 = endY + Math.sin(headAngle1) * headLength
    const headX2 = endX + Math.cos(headAngle2) * headLength
    const headY2 = endY + Math.sin(headAngle2) * headLength

    return {
      line: `M ${startX} ${startY} L ${endX} ${endY}`,
      head: `M ${endX} ${endY} L ${headX1} ${headY1} L ${headX2} ${headY2} Z`
    }
  }, [arrow, showArrows, getSquareCoords])

  const isHighlighted = useCallback((square) => {
    if (!arrow) return false
    return square === arrow.from || square === arrow.to
  }, [arrow])

  return (
    <div className={`chess-board-container ${size}`}>
      <div className="chess-board">
        {squares.map(({ square, isLight, file, rank, fileIdx, rankIdx }) => {
          const piece = getPieceAt(square)
          const pieceSymbol = piece ? PIECE_SYMBOLS[piece] : null
          const pieceColor = piece?.[0] === 'w' ? 'white' : 'black'

          return (
            <div
              key={square}
              className={`
                board-square 
                ${isLight ? 'light' : 'dark'}
                ${selectedSquare === square ? 'selected' : ''}
                ${isHighlighted(square) ? (square === arrow?.from ? 'highlight-from' : 'highlight-to') : ''}
              `}
              onClick={() => interactive && onSquareClick?.(square)}
              data-square={square}
            >
              {showLabels && fileIdx === 0 && (
                <span className="square-label rank">{rank}</span>
              )}
              {showLabels && rankIdx === 7 && (
                <span className="square-label file">{file}</span>
              )}
              {pieceSymbol && (
                <span className={`piece ${pieceColor}`}>{pieceSymbol}</span>
              )}
            </div>
          )
        })}
      </div>

      {arrowPath && showArrows && (
        <div className="arrow-overlay">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d={arrowPath.line}
              className="arrow-line"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={arrowPath.head}
              className="arrow-head"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

export default ChessBoard
