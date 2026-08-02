/**
 * Root of the SPA: routing and the toast host.
 *
 * Screens are placeholders until step 8. What matters here is that the public paths —
 * especially `/join` — already exist, and that every screen can call `useToast()`.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { HostPage } from './pages/HostPage';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { PlayPage } from './pages/PlayPage';
import { ROUTE_PATHS } from './routes';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTE_PATHS.home} element={<HomePage />} />
          <Route path={ROUTE_PATHS.join} element={<JoinPage />} />
          <Route path={ROUTE_PATHS.host} element={<HostPage />} />
          <Route path={ROUTE_PATHS.play} element={<PlayPage />} />
          <Route path="*" element={<Navigate to={ROUTE_PATHS.home} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
