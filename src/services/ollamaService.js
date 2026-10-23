const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:11434',
  model: 'gemma4:31b',
  minDelay: 2,
  maxDelay: 8,
  humanError: 10,
  humanErrorEnabled: false
}

class OllamaService {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS }
    this.abortController = null
    this.loadSettings()
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('chessCoachSettings')
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings }
    try {
      localStorage.setItem('chessCoachSettings', JSON.stringify(this.settings))
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS }
    try {
      localStorage.removeItem('chessCoachSettings')
    } catch (e) {
      console.error('Failed to reset settings:', e)
    }
    return { ...this.settings }
  }

  getSettings() {
    return { ...this.settings }
  }

  async testConnection() {
    const url = this.settings.apiUrl.replace(/\/$/, '')
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        success: true,
        models: data.models || [],
        message: 'Connected successfully'
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          models: [],
          message: 'Connection timeout. Check if Ollama is running.'
        }
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return {
          success: false,
          models: [],
          message: 'Cannot reach Ollama. Check: 1) Ollama running 2) CORS enabled 3) Correct URL'
        }
      }
      return {
        success: false,
        models: [],
        message: error.message
      }
    }
  }

  async getModels() {
    const result = await this.testConnection()
    if (result.success) {
      return result.models.map(m => m.name || m.model || 'unknown')
    }
    return []
  }

  async getMoveRecommendation(fen, moveHistory, lastMove) {
    const url = this.settings.apiUrl.replace(/\/$/, '')

    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    const prompt = this.buildPrompt(fen, moveHistory, lastMove)

    try {
      const delay = this.getRandomDelay()
      await this.sleep(delay * 1000)

      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.settings.model,
          prompt: prompt,
          stream: false,
          format: 'json'
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Model '${this.settings.model}' not found. Install it first.`)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const parsed = this.parseResponse(data.response)

      if (!parsed) {
        throw new Error('Invalid response format from model')
      }

      return {
        success: true,
        move: parsed.move,
        explanation: parsed.explanation || '',
        confidence: parsed.confidence || 'medium'
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request cancelled'
        }
      }
      return {
        success: false,
        error: error.message
      }
    }
  }

  buildPrompt(fen, moveHistory, lastMove) {
    const historyText = moveHistory.length > 0 
      ? moveHistory.join(' ') 
      : 'Starting position'

    return `You are a chess coach. Analyze this position and recommend the best move.

Current FEN: ${fen}
Move history: ${historyText}
${lastMove ? `Last move: ${lastMove}` : ''}

Respond in JSON format only:
{
  "move": "e2e4",
  "explanation": "brief reason",
  "confidence": "high|medium|low"
}

Move must be in UCI format (e.g., e2e4, g1f3, e7e8q for promotion).`
  }

  parseResponse(responseText) {
    try {
      const cleaned = responseText.trim()
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0])

      if (!parsed.move || typeof parsed.move !== 'string') {
        return null
      }

      const move = parsed.move.trim().toLowerCase()
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
        return null
      }

      return {
        move: move,
        explanation: parsed.explanation || '',
        confidence: parsed.confidence || 'medium'
      }
    } catch (e) {
      return null
    }
  }

  getRandomDelay() {
    const { minDelay, maxDelay } = this.settings
    return minDelay + Math.random() * (maxDelay - minDelay)
  }

  applyHumanError(move) {
    if (!this.settings.humanErrorEnabled) {
      return move
    }

    const errorChance = this.settings.humanError / 100
    if (Math.random() > errorChance) {
      return move
    }

    const files = 'abcdefgh'
    const fromFile = move.charCodeAt(0) - 97
    const fromRank = parseInt(move[1]) - 1
    const toFile = move.charCodeAt(2) - 97
    const toRank = parseInt(move[3]) - 1

    const mutate = Math.random() > 0.5 ? 'from' : 'to'

    if (mutate === 'from') {
      const newFile = Math.max(0, Math.min(7, fromFile + (Math.random() > 0.5 ? 1 : -1)))
      return `${files[newFile]}${fromRank + 1}${move.slice(2)}`
    } else {
      const newFile = Math.max(0, Math.min(7, toFile + (Math.random() > 0.5 ? 1 : -1)))
      return `${move.slice(0, 2)}${files[newFile]}${toRank + 1}${move.slice(4)}`
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}

export const ollamaService = new OllamaService()
export { DEFAULT_SETTINGS }
