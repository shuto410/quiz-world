/**
 * Browser entry point.
 *
 * Mounts the app into `#root`. Side-effect imports stay here so feature modules do not pull
 * global CSS in through deep paths.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('root element #root was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
