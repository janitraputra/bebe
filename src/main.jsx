import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Polyfill for older Safari (pre-17.4) which doesn't have Promise.withResolvers
// yet - pdfjs-dist relies on it, and its absence throws "undefined is not a
// function" the moment a PDF is parsed.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Polyfill for older Safari (pre-17.4) which doesn't have the static
// URL.parse() method yet - pdfjs-dist relies on it, and its absence throws
// "URL.parse is not a function" the moment a PDF is parsed.
if (typeof URL.parse !== 'function') {
  URL.parse = function (url, base) {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url)
    } catch {
      return null
    }
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
