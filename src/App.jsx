import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import HostView from './games/kalambur/HostView';
import PlayerView from './games/kalambur/PlayerView';
import Login from './login';
import Dashboard from './dashboard';
import MoneyCountApp from './moneycount/MoneyCountApp';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pobierz aktualną sesję przy starcie aplikacji
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Nasłuchuj zmian stanu logowania (np. gdy użytkownik się zaloguje/wyloguje)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Czyszczenie nasłuchiwacza po odmontowaniu komponentu
    return () => subscription.unsubscribe();
  }, []);

  // Pokazuj to, zanim aplikacja sprawdzi w Supabase, czy ktoś jest zalogowany
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Ładowanie ekranu...</div>;
  }

  return (
    <HashRouter>
      <Routes>
        {/* Ekran główny - jeśli jest sesja, pokaż Dashboard, jeśli nie - pokaż Login */}
        <Route path="/" element={session ? <Dashboard /> : <Login />} />

        {/* Podstrony gry pozostają publiczne (każdy ma do nich dostęp) */}
        <Route path="/kalambur" element={<PlayerView />} />
        <Route path="/kalambur/start" element={<HostView />} />
        <Route path="/moneycount/*" element={<MoneyCountApp />} />

        {/* 404 - Gdy ktoś wpisze zły adres */}
        <Route path="*" element={<h2 style={{textAlign: 'center', marginTop: '20px'}}>Nie ma takiej strony!</h2>} />
      </Routes>
    </HashRouter>
  );
}