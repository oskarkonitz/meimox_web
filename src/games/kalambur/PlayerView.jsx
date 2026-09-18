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
    <div style={{ 
      minHeight: '100dvh',       // 100vh (Viewport Height) sprawia, że div zajmuje całą wysokość ekranu.
      backgroundColor: '#2c3139ff', // Delikatne, jasnoszare/niebieskawe tło, żeby nie było ostro biało.
      display: 'flex',          // Uruchamiamy Flexboxa...
      flexDirection: 'column',  // ...i mówimy mu, żeby układał elementy jeden pod drugim (w kolumnie).
      padding: '20px',          // Margines wewnętrzny, żeby tekst nie przyklejał się do krawędzi telefonu.
      boxSizing: 'border-box',  // Ważne! Sprawia, że padding wlicza się do rozmiaru, więc strona nie wyjdzie poza ekran (nie będzie paska przewijania).
      fontFamily: 'sans-serif'  // Prosta czcionka bezszeryfowa.
    }}>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{
            margin: 0,
            fontSize: 24,
            color: '#e6dadaff'
        }}>
            {!isJoined ? (
              <h1 style={{ margin: 0, fontSize: 24, color: '#e6dadaff' }}>
                {lang.player.title}
              </h1>
            ) : (
              <img src="/logo_przezroczyste_biale.png" alt="logo" style={{
                height: '50px',
                objectFit: 'contain',
                backgroundColor: 'transparent'
              }}/>
            )}
        </h1>
        <div style={{ fontSize: '28px', cursor: 'pointer' }}>
          <span 
            onClick={() => setLangCode('pl')} 
            style={{ 
              opacity: langCode === 'pl' ? 1 : 0.4,
              marginRight: '15px',
              transition: 'opacity 0.2s' 
            }}
          >
            🇵🇱
          </span>
          <span 
            onClick={() => setLangCode('en')} 
            style={{ 
              opacity: langCode === 'en' ? 1 : 0.4, 
              transition: 'opacity 0.2s' 
            }}
          >
            🇬🇧
          </span>
        </div>
      </div>

    {errorMsg && (
        <div style={{ 
          backgroundColor: '#fee', 
          color: '#c00', 
          padding: '12px', 
          borderRadius: '8px', 
          textAlign: 'center',
          marginBottom: '10px'
        }}>
            {errorMsg}
        </div>
    )}

    {!isJoined && (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingBottom: '40px'
        }}>
            <form onSubmit={joinRoom} style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: '320px',
                gap: '16px'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}>
                    <label style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#fee'
                    }}>
                        {lang.player.codeLabel}
                    </label>
                    <input
                        type="text"
                        placeholder={lang.player.codePlaceholder}
                        maxLength={4}
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        required
                        style={{
                          padding: '10px',
                          fontSize: '20px',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          borderRadius: '10px',
                          border: '2px solid #d08181ff',
                          outline: 'none'
                        }}
                    />
                </div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}>
                    <label style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#fee'
                    }}>
                        {lang.player.nickLabel}
                    </label>
                    <input
                        type="text"
                        placeholder={lang.player.nickPlaceholder}
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        required
                        style={{
                          padding: '10px',
                          fontSize: '20px',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          borderRadius: '10px',
                          border: '2px solid #d08181ff',
                          outline: 'none'
                        }}
                    />
                </div>
                <button
                type='submit'
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: isLoading ? '#999' : '#4CAF50',
                  border: '2px solid white',
                  borderRadius: '10px',
                  color: 'white',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}>
                  {isLoading ? lang.player.joiningBtn : lang.player.joinBtn}
                </button>
            </form>
        </div>
    )}

    {isJoined && roomData.status === 'waiting' && (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: '40px'
      }}>
        <div style={{
          backgroundColor: 'rgba(219, 213, 213, 1)',
          padding: '30px 20px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(230, 171, 52, 0.54)',
          textAlign: 'center',
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <h2 style={{margin: 0, color: '#333', fontSize: '20px'}}>
            {lang.player.inRoom} <br />
            <span style={{ color: '#4CAF50', fontSize: '32px', letterSpacing: '2px' }}>
              {roomData.code}
            </span>
          </h2>

          <p style={{ margin: 0, fontSize: '18px', color: '#242424ff' }}>
            {lang.player.welcome} <strong>{playerData.nickname}</strong>
          </p>

          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '10px',
            borderRadius: '10px',
            border: '1px dashed #ccc'
          }}>
            <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
              {lang.player.waitHost}
            </p>
          </div>

          <button
            onClick={() => leaveRoom(false)} 
            disabled={isLoading} 
            style={{ 
              marginTop: '10px', 
              padding: '10px', 
              fontSize: '16px', 
              backgroundColor: '#ff4d4d', // Czerwony kolor sygnalizuje akcję destrukcyjną (wyjście)
              color: 'white', 
              border: 'none', 
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}>
            {lang.player.leaveRoomBtn}
          </button>

        </div>
      </div>
    )}

    {isJoined && roomData.status === 'in_progress' && (
      <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: '40px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '40px 20px',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(76, 175, 80, 0.2)', 
            border: '2px solid #4CAF50', 
            textAlign: 'center',
            width: '100%',
            maxWidth: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '30px'        
          }}>
            <h2 style={{ margin: 0, color: '#555', fontSize: '20px' }}>
              {lang.player.yourWord}
            </h2>
            <h1 style={{ 
              fontSize: '48px',
              margin: 0, 
              color: '#4CAF50',
              textTransform: 'uppercase',
              wordBreak: 'break-word',
              lineHeight: 1.1 
            }}>
              {playerData.current_word || '...'}
            </h1>
            <button 
              onClick={() => leaveRoom(false)} 
              disabled={isLoading} 
              style={{ 
                marginTop: '50px', 
                padding: '10px', 
                fontSize: '14px',
                fontWeight: 'bold', 
                backgroundColor: 'transparent', 
                color: '#ff4d4d', 
                border: '1px solid #ff4d4d', 
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {lang.player.leaveRoomBtn}
            </button>
          </div>
      </div>
    )}

    </div>
  );
}