import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/features/auth'
import { App } from '@/app/App'
import '@/styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
