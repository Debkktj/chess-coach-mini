import { useState, useEffect, useCallback } from 'react'

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [floatingPermission, setFloatingPermission] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const perm = localStorage.getItem('floatingPermission')
    if (perm === 'granted') {
      setFloatingPermission(true)
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('SW registered:', reg.scope))
        .catch((err) => console.log('SW registration failed:', err))
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const installApp = useCallback(async () => {
    if (!installPrompt) {
      return { success: false, message: 'Use browser menu: Add to Home Screen' }
    }

    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
      setInstallPrompt(null)
      return { success: true }
    }

    return { success: false, message: 'Install dismissed' }
  }, [installPrompt])

  const requestFloatingPermission = useCallback(async () => {
    return new Promise((resolve) => {
      const granted = window.confirm(
        'Allow Chess Coach to display floating window?

' +
        'This will show the chess board in a floating popup that stays on screen.'
      )

      if (granted) {
        localStorage.setItem('floatingPermission', 'granted')
        setFloatingPermission(true)
        resolve({ granted: true })
      } else {
        localStorage.setItem('floatingPermission', 'denied')
        setFloatingPermission(false)
        resolve({ granted: false })
      }
    })
  }, [])

  const checkAutoFloat = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('float') === 'true'
  }, [])

  return {
    installPrompt,
    isInstalled,
    floatingPermission,
    installApp,
    requestFloatingPermission,
    checkAutoFloat
  }
}
