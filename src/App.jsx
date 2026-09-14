import { HashRouter, Routes, Route } from 'react-router-dom';
import HostView from './games/kalambur/HostView';
import PlayerView from './games/kalambur/PlayerView';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Pusta strona główna */}
        <Route path="/" element={null} />

        {/* Podstrony gry */}
        <Route path="/kalambur" element={<PlayerView />} />
        <Route path="/kalambur/start" element={<HostView />} />

        {/* 404 */}
        <Route path="*" element={<h2>Nie ma takiej strony!</h2>} />
      </Routes>
    </HashRouter>
  );
}