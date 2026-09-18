import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { pl } from './locales/pl';
import { en } from './locales/en';
import { family_pl } from './words/family_pl';
import { family_en } from './words/family_en';
import { adult_pl } from './words/adult_pl';
import { adult_en } from './words/adult_en';


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
  // --- JĘZYK I PACZKA ---
  const [langCode, setLangCode] = useState('pl');
  const lang = langCode === 'pl' ? pl : en;
  
  //Stan przechowujący wybraną kategorię
  const [packType, setPackType] = useState('family'); 

  //Dynamiczne dobieranie paczki na podstawie języka ORAZ kategorii
  let currentWordPack;
  if (langCode === 'pl') {
    currentWordPack = packType === 'family' ? family_pl : adult_pl;
  } else {
    currentWordPack = packType === 'family' ? family_en : adult_en;
  }

  // --- STANY ---
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hostPlayer, setHostPlayer] = useState(null);
  const [hostNickname, setHostNickname] = useState('Host');
  const [isWordVisible, setIsWordVisible] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- ODZYSKIWANIE SESJI ---
  useEffect(() => {
    const checkSession = async () => {
      const savedSession = localStorage.getItem('kalambur_host_session');
      if (savedSession) {
        const { roomId, hostPlayerId } = JSON.parse(savedSession);
        
        const { data: room } = await supabase.from('kalambur_rooms').select('*').eq('id', roomId).single();
        
        if (room) {
          setRoomData(room);
          const { data: currentPlayers } = await supabase.from('kalambur_players').select('*').eq('room_id', roomId);
          if (currentPlayers) {
            setPlayers(currentPlayers);
            if (hostPlayerId) {
              const hp = currentPlayers.find(p => p.id === hostPlayerId);
              if (hp) setHostPlayer(hp);
            }
          }
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

    localStorage.setItem('kalambur_host_session', JSON.stringify({ roomId: newRoom.id, hostPlayerId: null }));
    
    setRoomData(newRoom);
    setPlayers([]);
    setHostPlayer(null);
    setIsLoading(false);
  };

  // --- DOŁĄCZANIE HOSTA JAKO GRACZ ---
  const joinGameAsHost = async () => {
    if (!roomData) return;
    setIsLoading(true);
    setErrorMsg(null);

    const nicknameToUse = hostNickname.trim() || 'Host';

    const { data: newPlayer, error: playerError } = await supabase
      .from('kalambur_players')
      .insert([{ room_id: roomData.id, nickname: nicknameToUse, is_host: true }])
      .select()
      .single();

    if (playerError) {
      setErrorMsg(`${lang.host.errAddHost} ${playerError.message}`);
      setIsLoading(false);
      return;
    }

    setHostPlayer(newPlayer);
    setPlayers((prev) => [...prev, newPlayer]);

    localStorage.setItem('kalambur_host_session', JSON.stringify({ roomId: roomData.id, hostPlayerId: newPlayer.id }));
    setIsLoading(false);
  };

  // --- REZYGNACJA HOSTA Z BYCIA GRACZEM ---
  const leaveGameAsHost = async () => {
    if (!hostPlayer) return;
    setIsLoading(true);

    await supabase.from('kalambur_players').delete().eq('id', hostPlayer.id);

    setPlayers((prev) => prev.filter(p => p.id !== hostPlayer.id));
    setHostPlayer(null);

    localStorage.setItem('kalambur_host_session', JSON.stringify({ roomId: roomData.id, hostPlayerId: null }));
    setIsLoading(false);
  };

  // --- ZAKOŃCZENIE GRY ---
  const endGame = async () => {
    setIsLoading(true);
    await supabase.from('kalambur_rooms').delete().eq('id', roomData.id);
    
    localStorage.removeItem('kalambur_host_session');
    setRoomData(null);
    setPlayers([]);
    setHostPlayer(null);
    setIsLoading(false);
  };

  // --- NASŁUCHIWANIE NA ŻYWO (INSERT, DELETE, UPDATE) ---
  useEffect(() => {
    if (!roomData) return;

    const channel = supabase.channel(`room_${roomData.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kalambur_players', filter: `room_id=eq.${roomData.id}` },
        (payload) => setPlayers((prev) => prev.some(p => p.id === payload.new.id) ? prev : [...prev, payload.new])
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'kalambur_players', filter: `room_id=eq.${roomData.id}` },
        (payload) => {
          setPlayers((prev) => prev.filter(p => p.id !== payload.old.id));
          if (hostPlayer && payload.old.id === hostPlayer.id) setHostPlayer(null);
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kalambur_players', filter: `room_id=eq.${roomData.id}` },
        (payload) => {
          setPlayers((prev) => prev.map(p => p.id === payload.new.id ? payload.new : p));
          if (hostPlayer && payload.new.id === hostPlayer.id) setHostPlayer(payload.new);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomData, hostPlayer]);

  // --- ROZPOCZĘCIE GRY ---
  const startGame = async () => {
    setIsLoading(true);
    const shuffledWords = shuffleArray(currentWordPack);
    
    if (players.length > shuffledWords.length) { 
      setErrorMsg(lang.host.errNotEnoughWords); 
      setIsLoading(false); 
      return; 
    }

    for (let i = 0; i < players.length; i++) {
      const assignedWord = shuffledWords[i];
      await supabase.from('kalambur_players').update({ current_word: assignedWord }).eq('id', players[i].id);
      
      if (hostPlayer && players[i].id === hostPlayer.id) {
        setHostPlayer(prev => ({ ...prev, current_word: assignedWord }));
      }
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

    const nextRoundNumber = roomData.round + 1;
    const { data: updatedRoom, error: roomError } = await supabase
      .from('kalambur_rooms').update({ round: nextRoundNumber }).eq('id', roomData.id).select().single();

    if (roomError) {
      setErrorMsg(lang.common.error + " " + roomError.message);
      setIsLoading(false);
      return;
    }

    for (let i = 0; i < players.length; i++) {
      const assignedWord = shuffledWords[i];
      await supabase.from('kalambur_players').update({ current_word: assignedWord }).eq('id', players[i].id);
      
      if (hostPlayer && players[i].id === hostPlayer.id) {
        setHostPlayer(prev => ({ ...prev, current_word: assignedWord }));
      }
    }

    setRoomData(updatedRoom);
    setIsLoading(false);
  };

  // --- WIDOK ---
  if (isRestoring) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', margin: 0 }}>
      <p style={{ fontSize: '18px', color: '#a1a1aa' }}>{lang.host.restoring}</p>
    </div>
  );

  return (
    <>
      {/* STYLE: Dodano globalny reset marginesów dla html i body */}
      <style>{`
        /* Reset domyślnych marginesów i ustawienie ciemnego tła globalnie */
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background-color: #0f172a; /* Ten sam granat, który ma tło */
        }
        
        * {
          box-sizing: border-box; /* Zabezpieczenie przed rozpychaniem układu przez padding */
        }

        .desktop-background {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: #0f172a;
          font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        .app-simulator {
          width: 100%;
          background-color: #1e293b;
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        @media (min-width: 600px) {
          .desktop-background {
            padding: 20px;
          }
          .app-simulator {
            max-width: 400px;
            height: 90vh;
            border-radius: 24px;
            border: 1px solid #334155;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
            overflow: hidden;
          }
          .main-content {
            overflow-y: auto;
          }
        }

        @media (max-width: 599px) {
          .desktop-background {
            padding: 0;
            background-color: #1e293b;
          }
          .app-simulator {
            min-height: 100vh;
            border-radius: 0;
            border: none;
            box-shadow: none;
          }
          .main-content {
            flex: 1;
          }
        }
        
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background-color: #475569;
          border-radius: 4px;
        }
      `}</style>

      <div className="desktop-background">
        <div className="app-simulator">
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: '20px', 
            borderBottom: '1px solid #334155',
            backgroundColor: '#1e293b',
            zIndex: 10
          }}>
            <h1 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>{lang.host.title}</h1>
            <div style={{ position: 'absolute', right: '20px', fontSize: '24px', cursor: 'pointer', display: 'flex', gap: '8px' }}>
              <span onClick={() => setLangCode('pl')} style={{ opacity: langCode === 'pl' ? 1 : 0.3, transition: '0.2s' }}>🇵🇱</span>
              <span onClick={() => setLangCode('en')} style={{ opacity: langCode === 'en' ? 1 : 0.3, transition: '0.2s' }}>🇬🇧</span>
            </div>
          </div>

          <div className="main-content custom-scroll" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {errorMsg && (
              <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', border: '1px solid #991b1b' }}>
                {errorMsg}
              </div>
            )}

            {!roomData && (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button 
                  onClick={createRoom} 
                  disabled={isLoading} 
                  style={{ 
                    padding: '16px 32px', 
                    fontSize: '18px', 
                    backgroundColor: '#6366f1',
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                    transition: '0.2s',
                    width: '100%'
                  }}
                >
                  {isLoading ? lang.host.creatingRoomBtn : lang.host.createRoomBtn}
                </button>
              </div>
            )}

            {roomData && (
              <>
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {lang.host.roomCodeLabel}
                  </h2>
                  <h1 style={{ fontSize: '46px', margin: '0 0 10px 0', letterSpacing: '8px', color: '#ffffff' }}>
                    {roomData.code}
                  </h1>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '13px', color: '#94a3b8' }}>
                    <span>{lang.host.statusLabel} <strong style={{ color: '#cbd5e1' }}>{lang.status[roomData.status]}</strong></span>
                    <span>{lang.host.roundLabel} <strong style={{ color: '#cbd5e1' }}>{roomData.round}</strong></span>
                  </div>
                </div>

                {roomData.status === 'in_progress' && hostPlayer && (
                  <div style={{ backgroundColor: '#064e3b', border: '1px solid #047857', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#34d399' }}>{lang.host.yourWord}</p>
                    <h2 style={{ fontSize: '28px', margin: '10px 0', color: '#a7f3d0', letterSpacing: '1px' }}>
                      {isWordVisible ? (hostPlayer.current_word || '...') : '••••••••'}
                    </h2>
                    <button 
                      onClick={() => setIsWordVisible(!isWordVisible)}
                      style={{ background: 'transparent', border: '1px solid #34d399', color: '#34d399', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      {isWordVisible ? lang.host.hideWord : lang.host.showWord}
                    </button>
                  </div>
                )}

                {/* --- NOWE: WYBÓR PACZKI SŁÓW --- */}
                {roomData.status === 'waiting' && (
                  <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>
                      {langCode === 'pl' ? 'Kategoria haseł:' : 'Word Category:'}
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setPackType('family')}
                        style={{ 
                          flex: 1, padding: '12px', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: '0.2s',
                          backgroundColor: packType === 'family' ? '#3b82f6' : '#1e293b', 
                          color: packType === 'family' ? 'white' : '#94a3b8' 
                        }}
                      >
                        👨‍👩‍👧‍👦 Family
                      </button>
                      <button
                        onClick={() => setPackType('adult')}
                        style={{ 
                          flex: 1, padding: '12px', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: '0.2s',
                          backgroundColor: packType === 'adult' ? '#ef4444' : '#1e293b', 
                          color: packType === 'adult' ? 'white' : '#94a3b8' 
                        }}
                      >
                        🌶️ 18+
                      </button>
                    </div>
                  </div>
                )}

                {roomData.status === 'waiting' && (
                  <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '16px' }}>
                    {!hostPlayer ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input 
                          type="text" 
                          value={hostNickname} 
                          onChange={(e) => setHostNickname(e.target.value)} 
                          placeholder={lang.host.hostNickPlaceholder}
                          style={{ 
                            padding: '12px', 
                            borderRadius: '8px', 
                            border: '1px solid #475569', 
                            backgroundColor: '#1e293b', 
                            color: '#ffffff',
                            fontSize: '16px', 
                            outline: 'none' 
                          }}
                        />
                        <button 
                          onClick={joinGameAsHost} 
                          disabled={isLoading}
                          style={{ padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                        >
                          {lang.host.joinGameBtn}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>{lang.host.playingAs}</p>
                          <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', fontSize: '16px', color: '#ffffff' }}>{hostPlayer.nickname}</p>
                        </div>
                        <button 
                          onClick={leaveGameAsHost} 
                          disabled={isLoading}
                          style={{ padding: '8px 12px', fontSize: '13px', backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          {lang.host.leaveGameBtn}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {roomData.status === 'waiting' ? (
                  <button 
                    onClick={startGame} 
                    disabled={isLoading || players.length === 0} 
                    style={{ 
                      padding: '16px', 
                      backgroundColor: players.length === 0 ? '#334155' : '#10b981',
                      color: players.length === 0 ? '#94a3b8' : 'white', 
                      border: 'none', 
                      borderRadius: '12px', 
                      cursor: players.length === 0 ? 'not-allowed' : 'pointer', 
                      fontSize: '18px',
                      fontWeight: 'bold',
                      boxShadow: players.length > 0 ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none'
                    }}
                  >
                    {isLoading ? lang.host.startingGameBtn : lang.host.startGameBtn}
                  </button>
                ) : (
                  <button 
                    onClick={nextRound} 
                    disabled={isLoading} 
                    style={{ 
                      padding: '16px', 
                      backgroundColor: '#6366f1', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '12px', 
                      cursor: 'pointer', 
                      fontSize: '18px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    {isLoading ? lang.common.loading : lang.host.nextRoundBtn}
                  </button>
                )}

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#cbd5e1' }}>
                    {lang.host.playersListLabel} ({players.length}):
                  </h3>
                  
                  <ul className="custom-scroll" style={{ listStyleType: 'none', padding: 0, margin: 0, overflowY: 'auto', flex: 1 }}>
                    {players.length === 0 && (
                      <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                        Brak graczy w pokoju.
                      </p>
                    )}
                    {players.map((p) => (
                      <li key={p.id} style={{ 
                        fontSize: '16px', 
                        padding: '10px 12px', 
                        borderBottom: '1px solid #1e293b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        backgroundColor: p.is_host ? '#1e293b' : 'transparent',
                        borderRadius: '6px' 
                      }}>
                        <span style={{ fontWeight: p.is_host ? 'bold' : 'normal', color: p.is_host ? '#ffffff' : '#f8fafc' }}>
                          {p.nickname}
                        </span>
                        {p.is_host && (
                          <span style={{ fontSize: '11px', backgroundColor: '#334155', color: '#cbd5e1', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {lang.host.hostSuffix}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={endGame} 
                  disabled={isLoading} 
                  style={{ 
                    marginTop: '10px', 
                    padding: '12px', 
                    backgroundColor: 'transparent', 
                    color: '#f87171', 
                    border: '1px solid #991b1b', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    transition: '0.2s'
                  }}
                >
                  {lang.host.endGameBtn}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}