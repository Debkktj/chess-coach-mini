import React, { useState, useRef, useCallback, useEffect } from 'react'

function FloatingPopup({ 
  children, 
  title = 'Chess Coach',
  status = 'ready',
  defaultPosition = { x: 20, y: 20 },
  defaultSize = { width: 380, height: 560 },
  onClose,
  autoOpen = false,
  storageKey = 'floatingPopupState'
}) {
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isVisible, setIsVisible] = useState(autoOpen)

  const popupRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Load saved state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const state = JSON.parse(saved)
        if (state.position) setPosition(state.position)
        if (state.size) setSize(state.size)
        if (state.isMinimized !== undefined) setIsMinimized(state.isMinimized)
        if (state.isVisible !== undefined) setIsVisible(state.isVisible)
      }
    } catch (e) {}
  }, [storageKey])

  // Save state
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        position, size, isMinimized, isVisible
      }))
    } catch (e) {}
  }, [position, size, isMinimized, isVisible, storageKey])

  // Auto-open on mount if enabled
  useEffect(() => {
    if (autoOpen) {
      setIsVisible(true)
    }
  }, [autoOpen])

  // Constrain to viewport
  useEffect(() => {
    const constrain = () => {
      const popup = popupRef.current
      if (!popup) return

      const rect = popup.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      let newX = position.x
      let newY = position.y

      if (newX + rect.width > vw) newX = Math.max(0, vw - rect.width)
      if (newY + rect.height > vh) newY = Math.max(0, vh - rect.height)
      if (newX < 0) newX = 0
      if (newY < 0) newY = 0

      if (newX !== position.x || newY !== position.y) {
        setPosition({ x: newX, y: newY })
      }
    }

    constrain()
    window.addEventListener('resize', constrain)
    return () => window.removeEventListener('resize', constrain)
  }, [position, size])

  const handleDragStart = useCallback((e) => {
    if (e.target.closest('.popup-btn') || e.target.closest('.settings-panel')) return

    setIsDragging(true)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y
    }

    e.preventDefault()
  }, [position])

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return

    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    const dx = clientX - dragStartRef.current.x
    const dy = clientY - dragStartRef.current.y

    let newX = dragStartRef.current.posX + dx
    let newY = dragStartRef.current.posY + dy

    // Constrain
    const popup = popupRef.current
    if (popup) {
      const rect = popup.getBoundingClientRect()
      newX = Math.max(0, Math.min(window.innerWidth - rect.width, newX))
      newY = Math.max(0, Math.min(window.innerHeight - rect.height, newY))
    }

    setPosition({ x: newX, y: newY })
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleResizeStart = useCallback((e) => {
    setIsResizing(true)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height
    }

    e.preventDefault()
    e.stopPropagation()
  }, [size])

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return

    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    const dx = clientX - resizeStartRef.current.x
    const dy = clientY - resizeStartRef.current.y

    const newWidth = Math.max(300, Math.min(window.innerWidth - position.x, resizeStartRef.current.width + dx))
    const newHeight = Math.max(400, Math.min(window.innerHeight - position.y, resizeStartRef.current.height + dy))

    setSize({ width: newWidth, height: newHeight })
  }, [isResizing, position])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Global listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove)
      window.addEventListener('touchend', handleDragEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
      window.removeEventListener('touchmove', handleDragMove)
      window.removeEventListener('touchend', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      window.addEventListener('touchmove', handleResizeMove)
      window.addEventListener('touchend', handleResizeEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove)
      window.removeEventListener('mouseup', handleResizeEnd)
      window.removeEventListener('touchmove', handleResizeMove)
      window.removeEventListener('touchend', handleResizeEnd)
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  if (!isVisible) return null

  return (
    <div
      ref={popupRef}
      className={`floating-popup ${isDragging ? 'dragging' : ''} ${isMinimized ? 'minimized' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 'auto' : size.height
      }}
    >
      <div 
        className="popup-header"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="popup-title">
          <span className={`status-dot ${status === 'thinking' ? 'thinking' : ''}`}></span>
          {title}
        </div>
        <div className="popup-controls">
          <button 
            className="popup-btn minimize"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Restore' : 'Minimize'}
          >
            {isMinimized ? '□' : '—'}
          </button>
          <button 
            className="popup-btn close"
            onClick={() => {
              setIsVisible(false)
              onClose?.()
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="popup-content">
            {children}
          </div>
          <div 
            className="resize-handle"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
        </>
      )}
    </div>
  )
}

export default FloatingPopup
