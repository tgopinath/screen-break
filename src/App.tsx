import { useCallback, useEffect, useState } from 'react'
import { getEngine, useSnapshot, useTheme } from './hooks/useEngine'
import { Header } from './components/Header'
import { Dashboard } from './pages/Dashboard'
import { Statistics } from './pages/Statistics'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { BreakOverlay } from './components/BreakOverlay'
import { PromptToast } from './components/PromptToast'

function readRoute() {
  return location.hash.replace(/^#\/?/, '') || 'dashboard'
}

export function App() {
  const s = useSnapshot()
  useTheme(s.settings.theme)
  const [route, setRoute] = useState(readRoute)
  const [onboarding, setOnboarding] = useState(!s.settings.onboarded)

  const navigate = useCallback((r: string) => {
    location.hash = '/' + r
  }, [])

  useEffect(() => {
    const on = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    const e = getEngine()
    e.onNavigate = navigate
    e.start()
    return () => {
      window.removeEventListener('hashchange', on)
      e.stop()
    }
  }, [navigate])

  const [page, sub] = route.split('/')
  const name = s.settings.userName.trim().split(' ')[0]
  const hour = new Date(s.now).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-full pb-24 md:pb-10">
      <Header route={page} navigate={navigate} />
      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {page === 'stats' ? (
          <Statistics />
        ) : page === 'settings' ? (
          <Settings section={sub} navigate={navigate} onReplayOnboarding={() => setOnboarding(true)} />
        ) : (
          <>
            <div className="anim-fade-up mb-5">
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting}
                {name ? `, ${name}` : ''}
              </h1>
              <p className="text-sm text-muted">Work better. Rest your eyes. Move your body.</p>
            </div>
            <Dashboard navigate={navigate} />
          </>
        )}
      </main>
      <PromptToast />
      <BreakOverlay />
      {onboarding && <Onboarding onDone={() => setOnboarding(false)} />}
    </div>
  )
}
