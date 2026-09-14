import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { pl } from './locales/pl';
import { en } from './locales/en';

export default function PlayerView() {
  const [langCode, setLangCode] = useState('pl');
  const lang = langCode === 'pl' ? pl : en;

  const [inputCode, setInputCode] = useState('');
  const [nickname, setNickname] = useState('');
  
  const [isJoined, setIsJoined] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true); // NOWE
  const [errorMsg, setErrorMsg] = useState(null);

  // --- ODZYSKIWANIE SESJI PO ODŚWIEŻENIU ---
  useEffect(() => {
    const checkSession = async () => {
      const savedSession = localStorage.getItem('kalambur_player_session');
      if (savedSession) {
        const { roomId, playerId } = JSON.parse(savedSession);
        
        const { data: room } = await supabase.from('kalambur_rooms').select('*').eq('id', roomId).single();
        const { data: player } = await supabase.from('kalambur_players').select('*').eq('id', playerId).single();
        
        if (room && player) {
          setRoomData(room);
          setPlayerData(player);
          setIsJoined(true);
        } else {
          localStorage.removeItem('kalambur_player_session');
        }
      }
      setIsRestoring(false);
    };
    checkSession();
  }, []);

  // --- DOŁĄCZANIE DO GRY ---
  const joinRoom = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg(null);
    const codeUpper = inputCode.toUpperCase();

    const { data: rooms, error: roomError } = await supabase.from('kalambur_rooms').select('*').eq('code', codeUpper);

    if (roomError) { setErrorMsg(`${lang.common.error} ${roomError.message}`); setIsLoading(false); return; }
    if (!rooms || rooms.length === 0) { setErrorMsg(lang.player.roomNotFound); setIsLoading(false); return; }

    const foundRoom = rooms[0];

    const { data: newPlayer, error: playerError } = await supabase
      .from('kalambur_players').insert([{ room_id: foundRoom.id, nickname: nickname, is_host: false }]).select().single();

    if (playerError) { setErrorMsg(`${lang.common.error} ${playerError.message}`); setIsLoading(false); return; }

    // Zapisujemy sesję do localStorage
    localStorage.setItem('kalambur_player_session', JSON.stringify({ roomId: foundRoom.id, playerId: newPlayer.id }));

    setRoomData(foundRoom);
    setPlayerData(newPlayer);
    setIsJoined(true);
    setIsLoading(false);
  };

  // --- OPUSZCZANIE POKOJU (PRZEZ GRACZA) ---
  const leaveRoom = async (wasKicked = false) => {
    setIsLoading(true);
    
    // Jeśli gracz sam wychodzi, usuwamy go z bazy
    if (!wasKicked && playerData) {
      await supabase.from('kalambur_players').delete().eq('id', playerData.id);
    }
    
    localStorage.removeItem('kalambur_player_session');
    setIsJoined(false);
    setRoomData(null);
    setPlayerData(null);
    setInputCode(''); // Czyścimy kod w formularzu
    setIsLoading(false);
    
    if (wasKicked) setErrorMsg(lang.player.hostEnded);
  };

  // --- NASŁUCHIWANIE NA ZMIANY ---
  useEffect(() => {
    if (!isJoined || !roomData || !playerData) return;

    const channel = supabase.channel(`sync_player_${playerData.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kalambur_rooms', filter: `id=eq.${roomData.id}` },
        (payload) => setRoomData(payload.new)
      )
      // Nasłuchiwanie usunięcia pokoju (Host zakończył grę)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'kalambur_rooms', filter: `id=eq.${roomData.id}` },
        () => leaveRoom(true) // Wyrzucamy gracza z dopiskiem wasKicked = true
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kalambur_players', filter: `id=eq.${playerData.id}` },
        (payload) => setPlayerData(payload.new)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isJoined, roomData?.id, playerData?.id]);

  // --- WIDOK ---
  if (isRestoring) return <p style={{ padding: '20px' }}>{lang.player.restoring}</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{lang.player.title}</h1>
        <div style={{ fontSize: '24px', cursor: 'pointer' }}>
          <span onClick={() => setLangCode('pl')} style={{ opacity: langCode === 'pl' ? 1 : 0.4, marginRight: '10px' }}>🇵🇱</span>
          <span onClick={() => setLangCode('en')} style={{ opacity: langCode === 'en' ? 1 : 0.4 }}>🇬🇧</span>
        </div>
      </div>

      {errorMsg && <p style={{ color: 'red', marginTop: '10px', padding: '10px', backgroundColor: '#fee' }}>{errorMsg}</p>}

      {!isJoined && (
        <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '10px', marginTop: '20px' }}>
          <label>{lang.player.codeLabel}</label>
          <input type="text" placeholder={lang.player.codePlaceholder} maxLength={4} value={inputCode} onChange={(e) => setInputCode(e.target.value)} required style={{ padding: '8px', fontSize: '16px', textTransform: 'uppercase' }} />
          <label>{lang.player.nickLabel}</label>
          <input type="text" placeholder={lang.player.nickPlaceholder} value={nickname} onChange={(e) => setNickname(e.target.value)} required style={{ padding: '8px', fontSize: '16px' }} />
          <button type="submit" disabled={isLoading} style={{ padding: '10px', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}>
            {isLoading ? lang.player.joiningBtn : lang.player.joinBtn}
          </button>
        </form>
      )}

      {isJoined && roomData.status === 'waiting' && (
        <div style={{ border: '2px solid gray', padding: '20px', marginTop: '20px' }}>
          <h2>{lang.player.inRoom} {roomData.code}</h2>
          <p>{lang.player.welcome} <strong>{playerData.nickname}</strong>!</p>
          <p style={{ fontStyle: 'italic', color: '#555' }}>{lang.player.waitHost}</p>
          
          <button onClick={() => leaveRoom(false)} disabled={isLoading} style={{ marginTop: '20px', padding: '8px 16px', backgroundColor: '#666', color: 'white', border: 'none', cursor: 'pointer' }}>
            {lang.player.leaveRoomBtn}
          </button>
        </div>
      )}

      {isJoined && roomData.status === 'in_progress' && (
        <div style={{ border: '4px solid green', padding: '40px 20px', marginTop: '20px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '20px' }}>{lang.player.yourWord}</h2>
          <h1 style={{ fontSize: '64px', margin: '0', color: 'green', textTransform: 'uppercase' }}>
            {playerData.current_word || '...'}
          </h1>
          
          <button onClick={() => leaveRoom(false)} disabled={isLoading} style={{ marginTop: '40px', padding: '8px 16px', backgroundColor: '#666', color: 'white', border: 'none', cursor: 'pointer' }}>
            {lang.player.leaveRoomBtn}
          </button>
        </div>
      )}

    </div>
  );
}