import React, { useState, useEffect, useCallback, useRef } from 'react'
import { chessService } from './services/chessService'
import { ollamaService } from './services/ollamaService'
import { usePWA } from './hooks/usePWA'
import FloatingPopup from './components/FloatingPopup'
import ChessBoard from './components/ChessBoard'
import SettingsPanel from './components/SettingsPanel'

function App() {
  const [gameState, setGameState] = useState(() => chessService.getState())
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [arrow, setArrow] = useState(null)
  const [showArrows, setShowArrows] = useState(true)
  const [orientation, setOrientation] = useState('white')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [previewFen, setPreviewFen] = useState(null)
  const [previewMove, setPreviewMove] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showFloatPrompt, setShowFloatPrompt] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const {
    installPrompt,
    isInstalled,
    floatingPermission,
    installApp,
    requestFloatingPermission,
    checkAutoFloat
  } = usePWA()

  // Subscribe to chess state
  useEffect(() => {
    const unsubscribe = chessService.subscribe((state) => {
      setGameState(state)
    })
    return unsubscribe
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check for auto-float on mount
  useEffect(() => {
    if (checkAutoFloat()) {
      setShowFloatPrompt(true)
    }

    // Show install prompt after delay if not installed
    if (!isInstalled) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [checkAutoFloat, isInstalled])

  const addMessage = useCallback((type, text) => {
    setMessages(prev => [...prev, { type, text, id: Date.now() }])
  }, [])

  const clearArrow = useCallback(() => {
    setArrow(null)
    setSuggestion(null)
    setPreviewFen(null)
    setPreviewMove(null)
  }, [])

  const handleSquareClick = useCallback((square) => {
    if (isThinking) return

    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    if (selectedSquare) {
      // Try to make move
      const uci = selectedSquare + square
      const result = chessService.makeMoveUci(uci)

      if (result.success) {
        addMessage('system', `Played: ${result.move.san}`)
        setSelectedSquare(null)
        clearArrow()

        // Get suggestion after move
        requestSuggestion()
      } else {
        // Check if clicking another own piece
        const piece = gameState.board[8 - parseInt(square[1])]?.[square.charCodeAt(0) - 97]
        if (piece && piece.color === gameState.turn) {
          setSelectedSquare(square)
        } else {
          setSelectedSquare(null)
        }
      }
    } else {
      // Select piece
      const piece = gameState.board[8 - parseInt(square[1])]?.[square.charCodeAt(0) - 97]
      if (piece && piece.color === gameState.turn) {
        setSelectedSquare(square)
      }
    }
  }, [selectedSquare, gameState, isThinking, addMessage, clearArrow])

  const requestSuggestion = useCallback(async () => {
    setIsThinking(true)
    addMessage('system', 'Analyzing position...')

    const state = chessService.getState()
    const result = await ollamaService.getMoveRecommendation(
      state.fen,
      state.moveHistory,
      state.moveHistory[state.moveHistory.length - 1]
    )

    setIsThinking(false)

    if (!result.success) {
      addMessage('error', result.error || 'Failed to get suggestion')
      return
    }

    // Validate move
    const validation = chessService.validateUci(result.move)
    if (!validation.valid) {
      addMessage('error', `Invalid suggestion: ${result.move}`)
      return
    }

    // Apply human error if enabled
    const finalMove = ollamaService.applyHumanError(result.move)
    const finalValidation = chessService.validateUci(finalMove)

    if (!finalValidation.valid) {
      addMessage('error', 'Suggestion failed validation')
      return
    }

    const san = chessService.getSanForUci(finalMove)
    const preview = chessService.getPositionForMove(finalMove)

    setSuggestion({
      uci: finalMove,
      san: san,
      from: finalMove.slice(0, 2),
      to: finalMove.slice(2, 4),
      explanation: result.explanation
    })

    setArrow({
      from: finalMove.slice(0, 2),
      to: finalMove.slice(2, 4)
    })

    addMessage('system', `Suggested: ${san}`)
  }, [addMessage])

  const handleInputSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text) {
      addMessage('error', 'Please enter a move')
      return
    }

    setInput('')
    addMessage('user', text)

    // Parse move
    const moveText = chessService.parseMoveInput(text)
    if (!moveText) {
      addMessage('error', 'Could not understand move. Try "e2e4" or "Nf3"')
      return
    }

    // Detect intent
    const intent = chessService.detectMoveIntent(text)

    // Check if it's a played move or suggestion request
    if (intent.isPlayed || intent.isSelf || /^[a-h][1-8][a-h][1-8]$/i.test(moveText)) {
      // Try UCI first
      let result = chessService.makeMoveUci(moveText.toLowerCase())

      // Try SAN if UCI fails
      if (!result.success) {
        result = chessService.makeMove(moveText)
      }

      if (result.success) {
        addMessage('system', `Move played: ${result.move.san}`)
        clearArrow()
        requestSuggestion()
      } else {
        addMessage('error', `Illegal move: ${moveText}`)
      }
    } else if (intent.isSuggestion) {
      requestSuggestion()
    } else {
      // Default: treat as move attempt
      let result = chessService.makeMoveUci(moveText.toLowerCase())
      if (!result.success) {
        result = chessService.makeMove(moveText)
      }

      if (result.success) {
        addMessage('system', `Move played: ${result.move.san}`)
        clearArrow()
        requestSuggestion()
      } else {
        addMessage('error', `Invalid move: ${moveText}`)
      }
    }
  }, [input, addMessage, clearArrow, requestSuggestion])

  const handlePreviewMove = useCallback(() => {
    if (!suggestion) return

    const preview = chessService.getPositionForMove(suggestion.uci)
    if (preview) {
      setPreviewFen(preview)
      setPreviewMove(suggestion)
    }
  }, [suggestion])

  const handleApplyMove = useCallback(() => {
    if (!suggestion) return

    const result = chessService.makeMoveUci(suggestion.uci)
    if (result.success) {
      addMessage('system', `Applied: ${result.move.san}`)
      clearArrow()
    } else {
      addMessage('error', 'Failed to apply move')
    }
  }, [suggestion, addMessage, clearArrow])

  const handleCancelPreview = useCallback(() => {
    setPreviewFen(null)
    setPreviewMove(null)
  }, [])

  const handleNextCandidate = useCallback(() => {
    clearArrow()
    requestSuggestion()
  }, [clearArrow, requestSuggestion])

  const handleUndo = useCallback(() => {
    const result = chessService.undo()
    if (result.success) {
      addMessage('system', `Undone: ${result.move.san}`)
      clearArrow()
    } else {
      addMessage('error', 'Nothing to undo')
    }
  }, [addMessage, clearArrow])

  const handleReset = useCallback(() => {
    chessService.reset()
    clearArrow()
    addMessage('system', 'Game reset')
  }, [addMessage, clearArrow])

  const handleInstall = useCallback(async () => {
    const result = await installApp()
    if (result.success) {
      setShowInstallPrompt(false)
      addMessage('system', 'App installed!')
    } else if (result.message) {
      addMessage('system', result.message)
    }
  }, [installApp, addMessage])

  const handleFloatPermission = useCallback(async () => {
    const result = await requestFloatingPermission()
    if (result.granted) {
      setShowFloatPrompt(false)
      addMessage('system', 'Floating window enabled!')
    }
  }, [requestFloatingPermission, addMessage])

  const getStatusText = () => {
    if (gameState.isCheckmate) return 'Checkmate!'
    if (gameState.isStalemate) return 'Stalemate'
    if (gameState.isDraw) return 'Draw'
    if (gameState.isCheck) return 'Check!'
    return gameState.turn === 'w' ? 'White to move' : 'Black to move'
  }

  return (
    <div className="app-container">
      {/* Background hint */}
      <div className="background-hint">
        <h1>♞ Chess Coach Mini</h1>
        <p>Drag the floating window • Type moves in chat</p>
      </div>

      {/* Install Prompt */}
      {showInstallPrompt && !isInstalled && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid var(--popup-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 1000,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          <span>📲 Install Chess Coach for quick access?</span>
          <button 
            onClick={handleInstall}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Install
          </button>
          <button 
            onClick={() => setShowInstallPrompt(false)}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Floating Permission Prompt */}
      {showFloatPrompt && !floatingPermission && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: 16,
          border: '1px solid var(--popup-border)',
          zIndex: 1000,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          maxWidth: 320,
          textAlign: 'center'
        }}>
          <h3 style={{ marginBottom: 12 }}>🪟 Floating Window</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            Allow Chess Coach to open in a floating window that stays on screen while you browse?
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button 
              onClick={handleFloatPermission}
              style={{
                padding: '10px 20px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Allow
            </button>
            <button 
              onClick={() => setShowFloatPrompt(false)}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--popup-border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Popup */}
      <FloatingPopup
        title="Chess Coach Mini"
        status={isThinking ? 'thinking' : 'ready'}
        defaultPosition={{ x: 20, y: 20 }}
        defaultSize={{ width: 380, height: 600 }}
        autoOpen={true}
      >
        {/* Game Status */}
        <div className={`game-status ${gameState.isCheck ? 'check' : ''}`}>
          <span className={`turn-indicator ${gameState.turn === 'w' ? 'white' : 'black'}`}></span>
          {getStatusText()}
          <div className="orientation-toggle" style={{ marginLeft: 'auto' }}>
            <button 
              className={`orientation-btn ${orientation === 'white' ? 'active' : ''}`}
              onClick={() => setOrientation('white')}
            >
              White
            </button>
            <button 
              className={`orientation-btn ${orientation === 'black' ? 'active' : ''}`}
              onClick={() => setOrientation('black')}
            >
              Black
            </button>
          </div>
        </div>

        {/* Chess Board */}
        <div className="board-section">
          <ChessBoard
            fen={gameState.fen}
            orientation={orientation}
            selectedSquare={selectedSquare}
            onSquareClick={handleSquareClick}
            arrow={showArrows ? arrow : null}
            showArrows={showArrows}
            interactive={!isThinking}
          />
        </div>

        {/* Preview Section */}
        {suggestion && (
          <div className="preview-section">
            <div className="suggestion-badge">
              <div className="suggestion-info">
                <span className="suggestion-label">Suggested:</span>
                <span className="suggestion-move">{suggestion.san}</span>
              </div>
              <div className="suggestion-actions">
                {!previewFen ? (
                  <button className="action-btn primary" onClick={handlePreviewMove}>
                    Preview
                  </button>
                ) : (
                  <>
                    <button className="action-btn primary" onClick={handleApplyMove}>
                      Apply
                    </button>
                    <button className="action-btn secondary" onClick={handleCancelPreview}>
                      Cancel
                    </button>
                  </>
                )}
                <button className="action-btn secondary" onClick={handleNextCandidate}>
                  Next
                </button>
              </div>
            </div>

            {previewFen && (
              <div className="preview-board">
                <div className="preview-label">Preview Position</div>
                <ChessBoard
                  fen={previewFen}
                  orientation={orientation}
                  interactive={false}
                  showLabels={false}
                  size="small"
                />
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <div className="chat-section">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-message system">
                Type moves like "e2e4" or "Nf3" • Opponent moves like "Opponent: e5"
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.type}`}>
                {msg.text}
              </div>
            ))}
            {isThinking && (
              <div className="chat-message system">
                <span className="loading-spinner" style={{ width: 16, height: 16, display: 'inline-block', marginRight: 8 }}></span>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
              placeholder="Enter move (e.g., e2e4, Nf3, Opponent: e5)"
              disabled={isThinking}
            />
            <button 
              className="send-btn"
              onClick={handleInputSubmit}
              disabled={isThinking || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <button className="control-btn" onClick={handleUndo}>
            ↩ Undo
          </button>
          <button className="control-btn" onClick={handleReset}>
            ⟳ Reset
          </button>
          <button 
            className={`control-btn ${showArrows ? 'active' : ''}`}
            onClick={() => setShowArrows(!showArrows)}
          >
            ➤ Arrows
          </button>
          <button 
            className={`control-btn ${isSettingsOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          >
            ⚙ Settings
          </button>
        </div>

        {/* Settings Panel */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSettingsChange={() => {}}
        />
      </FloatingPopup>
    </div>
  )
}

export default App
