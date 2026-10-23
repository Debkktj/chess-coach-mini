import React, { useState, useEffect } from 'react'
import { ollamaService, DEFAULT_SETTINGS } from '../services/ollamaService'

function SettingsPanel({ isOpen, onClose, onSettingsChange }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [connectionMessage, setConnectionMessage] = useState('')
  const [models, setModels] = useState([])
  const [validation, setValidation] = useState({})

  useEffect(() => {
    const current = ollamaService.getSettings()
    setSettings(current)
  }, [isOpen])

  const validate = (newSettings) => {
    const errors = {}

    if (newSettings.minDelay < 0) {
      errors.minDelay = 'Min delay cannot be negative'
    }

    if (newSettings.maxDelay < newSettings.minDelay) {
      errors.maxDelay = 'Max delay must be >= min delay'
    }

    if (newSettings.humanError < 0 || newSettings.humanError > 100) {
      errors.humanError = 'Must be between 0-100%'
    }

    setValidation(errors)
    return Object.keys(errors).length === 0
  }

  const handleChange = (field, value) => {
    const newSettings = { ...settings, [field]: value }
    setSettings(newSettings)
    validate(newSettings)
  }

  const handleTestConnection = async () => {
    setConnectionStatus('testing')
    setConnectionMessage('Testing connection...')

    ollamaService.saveSettings(settings)
    const result = await ollamaService.testConnection()

    if (result.success) {
      setConnectionStatus('success')
      setConnectionMessage(`Connected! ${result.models.length} models found.`)
      setModels(result.models.map(m => m.name || m.model))
    } else {
      setConnectionStatus('error')
      setConnectionMessage(result.message)
      setModels([])
    }
  }

  const handleSave = () => {
    if (!validate(settings)) return

    ollamaService.saveSettings(settings)
    onSettingsChange?.(settings)

    // Show saved feedback
    setConnectionStatus('success')
    setConnectionMessage('Settings saved!')
    setTimeout(() => {
      setConnectionStatus('idle')
      setConnectionMessage('')
    }, 2000)
  }

  const handleReset = () => {
    const defaults = ollamaService.resetSettings()
    setSettings(defaults)
    setValidation({})
    setConnectionStatus('idle')
    setConnectionMessage('')
    setModels([])
    onSettingsChange?.(defaults)
  }

  if (!isOpen) return null

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span className="settings-title">Ollama Settings</span>
        <button className="settings-close" onClick={onClose}>×</button>
      </div>

      <div className="settings-content">
        <div className="setting-group">
          <label className="setting-label">API Base URL</label>
          <input
            type="text"
            className="setting-input"
            value={settings.apiUrl}
            onChange={(e) => handleChange('apiUrl', e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>

        <div className="setting-group">
          <button 
            className="settings-btn save"
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
          >
            {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>

          {connectionStatus !== 'idle' && (
            <div className={`connection-status ${connectionStatus}`}>
              <span>{connectionStatus === 'testing' ? '⏳' : connectionStatus === 'success' ? '✓' : '✗'}</span>
              {connectionMessage}
            </div>
          )}
        </div>

        {models.length > 0 && (
          <div className="setting-group">
            <label className="setting-label">Installed Models</label>
            <div className="model-list">
              {models.map((model) => (
                <div
                  key={model}
                  className={`model-item ${settings.model === model ? 'selected' : ''}`}
                  onClick={() => handleChange('model', model)}
                >
                  {model}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="setting-group">
          <label className="setting-label">Model Name</label>
          <input
            type="text"
            className="setting-input"
            value={settings.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="gemma4:31b"
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Min Delay (seconds)
            <span className="value">{settings.minDelay}s</span>
          </label>
          <input
            type="range"
            className="setting-slider"
            min="0"
            max="30"
            step="0.5"
            value={settings.minDelay}
            onChange={(e) => handleChange('minDelay', parseFloat(e.target.value))}
          />
          {validation.minDelay && <span className="validation-message">{validation.minDelay}</span>}
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Max Delay (seconds)
            <span className="value">{settings.maxDelay}s</span>
          </label>
          <input
            type="range"
            className="setting-slider"
            min="0"
            max="60"
            step="0.5"
            value={settings.maxDelay}
            onChange={(e) => handleChange('maxDelay', parseFloat(e.target.value))}
          />
          {validation.maxDelay && <span className="validation-message">{validation.maxDelay}</span>}
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Human Error
            <span className="value">{settings.humanError}%</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              className="setting-slider"
              min="0"
              max="100"
              step="1"
              value={settings.humanError}
              onChange={(e) => handleChange('humanError', parseInt(e.target.value))}
              style={{ flex: 1 }}
            />
            <div 
              className={`toggle-switch ${settings.humanErrorEnabled ? 'on' : ''}`}
              onClick={() => handleChange('humanErrorEnabled', !settings.humanErrorEnabled)}
              title="Enable human error"
            />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {settings.humanErrorEnabled ? 'Enabled' : 'Disabled'} - only affects suggestions
          </span>
          {validation.humanError && <span className="validation-message">{validation.humanError}</span>}
        </div>

        <div className="settings-actions">
          <button className="settings-btn save" onClick={handleSave}>
            Save Settings
          </button>
          <button className="settings-btn reset" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
