
import React from 'react' // Make sure React is explicitly imported
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Ensure the DOM is properly loaded before rendering
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find the root element');

// Use React.StrictMode to help catch common issues
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
