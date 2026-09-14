import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { pl } from './locales/pl';
import { en } from './locales/en';
import { family_pl } from './words/family_pl';
import { family_en } from './words/family_en';

// --- FUNKCJE POMOCNICZE ---
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function HostView() {
  // --- ZARZĄDZANIE JĘZYKIEM I SŁOWAMI ---
  const [langCode, setLangCode] = useState('pl');
  const lang = langCode === 'pl' ? pl : en;
  const currentWordPack = langCode === 'pl' ? family_pl : family_en;

  // --- STANY KOMPONENTU ---
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- ODZYSKIWANIE SESJI PO ODŚWIEŻENIU ---
  useEffect(() => {
    const checkSession = async () => {
      const savedSession = localStorage.getItem('kalambur_host_session');
      if (savedSession) {
        const { roomId } = JSON.parse(savedSession);
        
        const { data: room } = await supabase.from('kalambur_rooms').select('*').eq('id', roomId).single();
        
        if (room) {
          setRoomData(room);
          const { data: currentPlayers } = await supabase.from('kalambur_players').select('*').eq('room_id', roomId);
          if (currentPlayers) setPlayers(currentPlayers);
        } else {
          localStorage.removeItem('kalambur_host_session');
        }
      }
      setIsRestoring(false);
    };
    checkSession();
  }, []);

  // --- TWORZENIE POKOJU ---
  const createRoom = async () => {
    setIsLoading(true); setErrorMsg(null);
    const newCode = generateRoomCode();

    const { data: newRoom, error: roomError } = await supabase
      .from('kalambur_rooms').insert([{ code: newCode, status: 'waiting', round: 1 }]).select().single();

    if (roomError) { setErrorMsg(`${lang.host.errCreateRoom} ${roomError.message}`); setIsLoading(false); return; }

    const { data: hostPlayer, error: playerError } = await supabase
      .from('kalambur_players').insert([{ room_id: newRoom.id, nickname: 'Host', is_host: true }]).select().single();

    if (playerError) { setErrorMsg(`${lang.host.errAddHost} ${playerError.message}`); setIsLoading(false); return; }

    localStorage.setItem('kalambur_host_session', JSON.stringify({ roomId: newRoom.id, hostId: hostPlayer.id }));
    
    setRoomData(newRoom);
    setPlayers([hostPlayer]);
    setIsLoading(false);
  };

  // --- ZAKOŃCZENIE GRY ---
  const endGame = async () => {
    setIsLoading(true);
    await supabase.from('kalambur_rooms').delete().eq('id', roomData.id);
    
    localStorage.removeItem('kalambur_host_session');
    setRoomData(null);
    setPlayers([]);
    setIsLoading(false);
  };

  // --- NASŁUCHIWANIE GRACZY ---
  useEffect(() => {
    if (!roomData) return;

    const channel = supabase.channel(`room_${roomData.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kalambur_players', filter: `room_id=eq.${roomData.id}` },
        (payload) => setPlayers((prev) => [...prev, payload.new])
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'kalambur_players', filter: `room_id=eq.${roomData.id}` },
        (payload) => setPlayers((prev) => prev.filter(p => p.id !== payload.old.id))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomData]);

  // --- ROZPOCZĘCIE GRY (Runda 1) ---
  const startGame = async () => {
    setIsLoading(true);
    const shuffledWords = shuffleArray(currentWordPack);
    if (players.length > shuffledWords.length) { setErrorMsg(lang.host.errNotEnoughWords); setIsLoading(false); return; }

    for (let i = 0; i < players.length; i++) {
      await supabase.from('kalambur_players').update({ current_word: shuffledWords[i] }).eq('id', players[i].id);
    }

    const { data: updatedRoom } = await supabase.from('kalambur_rooms').update({ status: 'in_progress' }).eq('id', roomData.id).select().single();
    setRoomData(updatedRoom);
    setIsLoading(false);
  };

  // --- NASTĘPNA RUNDA ---
  const nextRound = async () => {
    setIsLoading(true);
    const shuffledWords = shuffleArray(currentWordPack);
    
    if (players.length > shuffledWords.length) { 
      setErrorMsg(lang.host.errNotEnoughWords); 
      setIsLoading(false); 
      return; 
    }

    // Zwiększamy numer rundy o 1
    const nextRoundNumber = roomData.round + 1;
    
    const { data: updatedRoom, error: roomError } = await supabase
      .from('kalambur_rooms')
      .update({ round: nextRoundNumber })
      .eq('id', roomData.id)
      .select()
      .single();

    if (roomError) {
      setErrorMsg(lang.common.error + " " + roomError.message);
      setIsLoading(false);
      return;
    }

    // Losujemy i przypisujemy nowe hasła
    for (let i = 0; i < players.length; i++) {
      await supabase
        .from('kalambur_players')
        .update({ current_word: shuffledWords[i] })
        .eq('id', players[i].id);
    }

    setRoomData(updatedRoom);
    setIsLoading(false);
  };

  // --- WIDOK ---
  if (isRestoring) return <p style={{ padding: '20px' }}>{lang.host.restoring}</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Pasek nawigacyjny i wybór języka */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{lang.host.title}</h1>
        <div style={{ fontSize: '24px', cursor: 'pointer' }}>
          <span onClick={() => setLangCode('pl')} style={{ opacity: langCode === 'pl' ? 1 : 0.4, marginRight: '10px' }}>🇵🇱</span>
          <span onClick={() => setLangCode('en')} style={{ opacity: langCode === 'en' ? 1 : 0.4 }}>🇬🇧</span>
        </div>
      </div>
      
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {!roomData && (
        <button onClick={createRoom} disabled={isLoading} style={{ padding: '10px 20px', fontSize: '18px' }}>
          {isLoading ? lang.host.creatingRoomBtn : lang.host.createRoomBtn}
        </button>
      )}

      {roomData && (
        <div style={{ display: 'flex', gap: '30px', marginTop: '20px', flexWrap: 'wrap' }}>
          
          {/* Lewy panel - Sterowanie grą */}
          <div style={{ border: '2px solid black', padding: '20px', minWidth: '250px', flex: 1 }}>
            <h2>{lang.host.roomCodeLabel}</h2>
            <h1 style={{ fontSize: '48px', margin: '10px 0', letterSpacing: '4px' }}>{roomData.code}</h1>
            <p>{lang.host.statusLabel} <strong>{lang.status[roomData.status]}</strong></p>
            <p>{lang.host.roundLabel} <strong>{roomData.round}</strong></p>
            
            {/* Przycisk START */}
            {roomData.status === 'waiting' && (
              <button 
                onClick={startGame} 
                disabled={isLoading} 
                style={{ marginTop: '20px', padding: '10px', width: '100%', backgroundColor: 'green', color: 'white', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                {isLoading ? lang.host.startingGameBtn : lang.host.startGameBtn}
              </button>
            )}

            {/* Przycisk NASTĘPNA RUNDA */}
            {roomData.status === 'in_progress' && (
              <button 
                onClick={nextRound} 
                disabled={isLoading} 
                style={{ marginTop: '20px', padding: '10px', width: '100%', backgroundColor: 'blue', color: 'white', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                {isLoading ? lang.common.loading : lang.host.nextRoundBtn}
              </button>
            )}

            {/* Przycisk ZAKOŃCZ GRĘ */}
            <button 
              onClick={endGame} 
              disabled={isLoading} 
              style={{ marginTop: '40px', padding: '10px', width: '100%', backgroundColor: 'red', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}
            >
              {lang.host.endGameBtn}
            </button>
          </div>

          {/* Prawy panel - Lista graczy */}
          <div style={{ border: '1px solid gray', padding: '20px', flex: 1, minWidth: '250px' }}>
            <h3>{lang.host.playersListLabel} ({players.length}):</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {players.map((p) => (
                <li key={p.id} style={{ fontSize: '18px', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  {p.nickname} {p.is_host && <span style={{ fontSize: '14px', color: 'gray' }}>{lang.host.hostSuffix}</span>}
                </li>
              ))}
            </ul>
          </div>
          
        </div>
      )}
    </div>
  );
}