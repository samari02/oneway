import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/features/auth'
import { App } from '@/app/App'
import { AppV2 } from '@/app/v2/AppV2'
import { getUiVariant } from '@/lib/ui-variant'
import '@/styles/global.css'

const RootApp = getUiVariant() === 'v2' ? AppV2 : App

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  </React.StrictMode>,
)
