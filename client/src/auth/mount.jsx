import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root.jsx';

const node = document.getElementById('auth-root');
if (node) {
  createRoot(node).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
} else {
  console.warn('[auth] #auth-root mount node not found');
}
