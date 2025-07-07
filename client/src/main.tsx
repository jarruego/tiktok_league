import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Suprimir warnings de compatibilidad de Ant Design con React 19
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('antd: compatible') || args[0]?.includes?.('antd v5 support React is 16 ~ 18')) {
    return;
  }
  originalWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
