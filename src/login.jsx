import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setIsLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      alert('Zarejestrowano pomyślnie! (Jeśli masz włączone potwierdzanie e-mail, sprawdź skrzynkę)');
    }
    setIsLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100dvh',
      backgroundColor: '#2c3139ff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: 'sans-serif'
    }}>
      
      {/* Logo / Nagłówek */}
      <div style={{ marginBottom: '40px' }}>
         <img src="/logo_przezroczyste_biale.png" alt="logo" style={{
            height: '70px',
            objectFit: 'contain',
            backgroundColor: 'transparent'
          }}/>
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          color: '#c00', 
          padding: '12px', 
          borderRadius: '8px', 
          textAlign: 'center',
          marginBottom: '20px',
          width: '100%',
          maxWidth: '320px'
        }}>
          {error}
        </div>
      )}

      <form style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '320px',
        gap: '16px'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#fee' }}>
            E-MAIL
          </label>
          <input 
            type="email" 
            placeholder="Wpisz e-mail" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
            style={{
              padding: '10px',
              fontSize: '18px',
              textAlign: 'center',
              borderRadius: '10px',
              border: '2px solid #d08181ff',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#fee' }}>
            HASŁO
          </label>
          <input 
            type="password" 
            placeholder="Wpisz hasło" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
            style={{
              padding: '10px',
              fontSize: '18px',
              textAlign: 'center',
              borderRadius: '10px',
              border: '2px solid #d08181ff',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={handleLogin} 
            disabled={isLoading}
            style={{ 
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: isLoading ? '#999' : '#4CAF50',
              border: '2px solid white',
              borderRadius: '10px',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? 'Logowanie...' : 'ZALOGUJ SIĘ'}
          </button>

          <button 
            onClick={handleSignUp} 
            disabled={isLoading}
            style={{ 
              padding: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: 'transparent',
              border: '2px solid #d08181ff',
              borderRadius: '10px',
              color: '#fee',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            ZAREJESTRUJ SIĘ
          </button>
        </div>
      </form>
    </div>
  );
}