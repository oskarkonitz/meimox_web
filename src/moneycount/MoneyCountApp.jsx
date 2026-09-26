import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ConfigView from './ConfigView';
import EntryView from './EntryView';
import SummaryView from './SummaryView';
import HistoryView from './HistoryView';

export default function MoneyCountApp() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div style={{ 
      minHeight: '100dvh', 
      backgroundColor: '#2c3139ff', 
      color: '#fee', 
      padding: '20px', 
      boxSizing: 'border-box',
      fontFamily: 'sans-serif'
    }}>
      <header style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '30px', 
        borderBottom: '2px solid #d08181ff', 
        paddingBottom: '15px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <Link to="/moneycount" style={{ 
          color: path === '/moneycount' || path === '/moneycount/' ? '#4CAF50' : '#aaa', 
          textDecoration: 'none', 
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          Podsumowanie
        </Link>
        <Link to="/moneycount/config" style={{ 
          color: path.includes('/config') ? '#4CAF50' : '#aaa', 
          textDecoration: 'none', 
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          Konfiguracja
        </Link>
        
        <Link to="/" style={{ color: '#ff4d4d', textDecoration: 'none', marginLeft: 'auto', fontWeight: 'bold' }}>
          Wyjdź
        </Link>
      </header>

      <Routes>
        <Route path="/" element={<SummaryView />} />
        <Route path="/entry" element={<EntryView />} />
        <Route path="/history" element={<HistoryView />} />
        <Route path="/config" element={<ConfigView />} />
      </Routes>
    </div>
  );
}