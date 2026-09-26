import { supabase } from './supabaseClient';

export default function Dashboard() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const apps = [
    { 
      id: 1, 
      name: 'Splanner.pl', 
      url: 'https://splanner.pl', 
      icon: '/splanner_icon.png' 
    },
    { 
      id: 2, 
      name: 'Kalambury (Host)', 
      url: '#/kalambur/start', 
      icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23d08181"/><text x="50" y="68" font-size="50" text-anchor="middle">🎭</text></svg>' 
    },
    { 
      id: 3, 
      name: 'MoneyCount', 
      url: '#/moneycount', 
      icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234CAF50"/><text x="50" y="68" font-size="50" text-anchor="middle">💰</text></svg>' 
    },
    { id: 4, name: 'App 4', url: '#', icon: null },
  ];

  return (
    <div style={{ 
      minHeight: '100dvh',
      backgroundColor: '#2c3139ff',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: 'sans-serif'
    }}>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        maxWidth: '900px',
        margin: '0 auto 30px auto',
        width: '100%'
      }}>
         <img src="/logo_przezroczyste_biale.png" alt="logo" style={{
            height: '50px',
            objectFit: 'contain',
            backgroundColor: 'transparent'
          }}/>

        <button 
          onClick={handleLogout} 
          style={{ 
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: 'transparent',
            border: '1px solid #ff4d4d',
            borderRadius: '8px',
            color: '#ff4d4d',
            cursor: 'pointer'
          }}
        >
          WYLOGUJ
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ color: '#e6dadaff', marginBottom: '30px', textAlign: 'center' }}>
          Wybierz aplikację
        </h2>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px' 
        }}>
          {apps.map(app => (
            <a 
              key={app.id} 
              href={app.url}
              target={app.url.startsWith('http') ? '_blank' : '_self'}
              rel="noopener noreferrer"
              style={{
                backgroundColor: 'rgba(219, 213, 213, 1)',
                padding: '20px',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(230, 171, 52, 0.3)',
                textDecoration: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                transition: 'transform 0.2s, boxShadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(230, 171, 52, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(230, 171, 52, 0.3)';
              }}
            >
              
              {app.icon ? (
                <img 
                  src={app.icon} 
                  alt={`${app.name} icon`} 
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    marginRight: '20px'
                  }}
                />
              ) : (
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '12px',
                  backgroundColor: '#c4c4c4',
                  marginRight: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  ?
                </div>
              )}
              
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#242424ff' }}>
                {app.name}
              </h3>
              
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}