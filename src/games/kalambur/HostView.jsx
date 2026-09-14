import { useState } from 'react';
import { supabase } from '../../supabaseClient.js';

const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function HostView() {
  // --- STANY KOMPONENTU ---
  const [roomCode, setRoomCode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- GŁÓWNA LOGIKA ---
  const createRoom = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    const newCode = generateRoomCode();

    const { data: roomData, error: roomError } = await supabase
      .from('kalambur_rooms')
      .insert([
        { 
          code: newCode, 
          status: 'waiting', 
          round: 1 
        }
      ])
      .select()
      .single();

    if (roomError) {
      setErrorMsg('Nie udało się utworzyć pokoju: ' + roomError.message);
      setIsLoading(false);
      return;
    }

    const { error: playerError } = await supabase
      .from('kalambur_players')
      .insert([
        {
          room_id: roomData.id,
          nickname: 'Host',
          is_host: true
        }
      ]);

    if (playerError) {
      setErrorMsg('Nie udało się dodać hosta: ' + playerError.message);
      setIsLoading(false);
      return;
    }

    setRoomCode(newCode);
    setIsLoading(false);
  };

  // --- WIDOK (HTML/JSX) ---
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Panel Hosta - Kalambury</h1>
      
      {/* Wyświetlanie błędu, jeśli jakiś wystąpi */}
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {/* Ekran PRZED utworzeniem pokoju */}
      {!roomCode && (
        <div>
          <p>Rozpocznij nową grę, aby wygenerować kod dla innych graczy.</p>
          <button 
            onClick={createRoom} 
            disabled={isLoading}
            style={{ padding: '10px 20px', fontSize: '18px', cursor: 'pointer' }}
          >
            {isLoading ? 'Tworzenie pokoju...' : 'Załóż nowy pokój'}
          </button>
        </div>
      )}

      {/* Ekran PO utworzeniu pokoju */}
      {roomCode && (
        <div style={{ border: '2px solid black', padding: '20px', marginTop: '20px' }}>
          <h2>Kod Twojego pokoju:</h2>
          <h1 style={{ fontSize: '48px', letterSpacing: '5px', margin: '10px 0' }}>
            {roomCode}
          </h1>
          <p>Oczekujemy na graczy... (Niech wejdą na stronę i wpiszą ten kod)</p>
        </div>
      )}
    </div>
  );
}