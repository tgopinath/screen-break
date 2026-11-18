import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { TrayView } from './pages/TrayView'
import { isTrayWindow } from './lib/platform'

createRoot(document.getElementById('root')!).render(<StrictMode>{isTrayWindow ? <TrayView /> : <App />}</StrictMode>)
