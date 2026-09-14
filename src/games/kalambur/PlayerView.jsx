import { useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function PlayerView() {
  // --- STANY KOMPONENTU ---
  // Formularz logowania do pokoju
  const [inputCode, setInputCode] = useState('');
  const [nickname, setNickname] = useState('');
  
  // Stan gry dla danego gracza
  const [isJoined, setIsJoined] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  
  // Stany techniczne (ładowanie, błędy)
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- GŁÓWNA LOGIKA DOŁĄCZANIA ---
  const joinRoom = async (e) => {
    e.preventDefault(); 
    setIsLoading(true);
    setErrorMsg(null);

    const codeUpper = inputCode.toUpperCase();

    const { data: rooms, error: roomError } = await supabase
      .from('kalambur_rooms')
      .select('*')
      .eq('code', codeUpper);

    if (roomError) {
      setErrorMsg('Błąd połączenia z bazą: ' + roomError.message);
      setIsLoading(false);
      return;
    }

    if (!rooms || rooms.length === 0) {
      setErrorMsg('Nie znaleziono pokoju o takim kodzie.');
      setIsLoading(false);
      return;
    }

    const foundRoom = rooms[0];

    const { data: newPlayer, error: playerError } = await supabase
      .from('kalambur_players')
      .insert([
        {
          room_id: foundRoom.id, 
          nickname: nickname,
          is_host: false 
        }
      ])
      .select()
      .single();

    if (playerError) {
      setErrorMsg('Nie udało się dołączyć: ' + playerError.message);
      setIsLoading(false);
      return;
    }

    setRoomData(foundRoom);
    setPlayerData(newPlayer);
    setIsJoined(true);
    setIsLoading(false);
  };

  // --- WIDOK (HTML/JSX) ---
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Dołącz do gry - Kalambury</h1>

      {/* Ekran PRZED dołączeniem do pokoju (Formularz) */}
      {!isJoined && (
        <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '10px' }}>
          
          <label>Kod pokoju:</label>
          <input 
            type="text" 
            placeholder="np. ABCD" 
            maxLength={4}
            value={inputCode} 
            onChange={(e) => setInputCode(e.target.value)} 
            required 
            style={{ padding: '8px', fontSize: '16px', textTransform: 'uppercase' }}
          />

          <label>Twój Nick:</label>
          <input 
            type="text" 
            placeholder="np. Janek" 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)} 
            required 
            style={{ padding: '8px', fontSize: '16px' }}
          />

          {errorMsg && <p style={{ color: 'red', margin: '5px 0' }}>{errorMsg}</p>}

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ padding: '10px', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}
          >
            {isLoading ? 'Dołączanie...' : 'Wejdź do pokoju'}
          </button>
        </form>
      )}

      {/* Ekran PO dołączeniu do pokoju (Lobby Gracza) */}
      {isJoined && (
        <div style={{ border: '2px solid green', padding: '20px', marginTop: '20px' }}>
          <h2>Jesteś w pokoju: {roomData.code}</h2>
          <p>Witaj <strong>{playerData.nickname}</strong>!</p>
          <p>Czekaj, aż Host rozpocznie pierwszą rundę...</p>
        </div>
      )}

    </div>
  );
}