import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { I18nProvider } from './i18n/index.jsx'
import { ToastProvider } from './lib/ctx.jsx'
import { LightboxProvider } from './components/ui.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <LightboxProvider>
          <App />
        </LightboxProvider>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
)
