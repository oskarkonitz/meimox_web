import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

export default function HistoryView() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Pobieramy strukturę pól, by wiedzieć przez co mnożyć
      const { data: items } = await supabase.from('items').select('*').eq('user_id', user.id);
      
      // 2. Pobieramy wszystkie wpisy
      const { data: adjustments } = await supabase
        .from('adjustments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 3. Pobieramy wszystkie zapisane wartości 
      const { data: entries } = await supabase.from('adjustment_entries').select('*').eq('user_id', user.id);

      // Budujemy listę z obliczonymi sumami
      if (adjustments && entries && items) {
        const historyData = adjustments.map(adj => {
          // Znajdź wartości należące tylko do tego konkretnego wpisu w historii
          const adjEntries = entries.filter(e => e.adjustment_id === adj.id);
          
          // Oblicz łączną kwotę dla tego wpisu
          const totalSum = adjEntries.reduce((sum, entry) => {
            const fieldDef = items.find(i => i.id === entry.item_id);
            const multiplier = fieldDef ? parseFloat(fieldDef.multiplier) : 1;
            return sum + (parseFloat(entry.entered_value) * multiplier);
          }, 0);

          return {
            id: adj.id,
            date: new Date(adj.created_at).toLocaleString('pl-PL'),
            comment: adj.comment,
            totalSum: totalSum
          };
        });
        setHistory(historyData);
      }
      setLoading(false);
    };
    
    fetchHistory();
  }, []);

  if (loading) return <div style={{ textAlign: 'center' }}>Ładowanie historii...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      <h2 style={{ color: '#e6dadaff', marginBottom: '20px' }}>Historia wpisów</h2>
      
      {history.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#aaa' }}>Brak zapisów w historii.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {history.map(record => (
            <div key={record.id} style={{ 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              padding: '20px', 
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderLeft: '4px solid #4CAF50'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '14px', color: '#aaa', fontWeight: 'bold' }}>{record.date}</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>{record.totalSum.toFixed(2)} PLN</span>
                {record.comment && (
                  <span style={{ fontStyle: 'italic', color: '#ccc', fontSize: '14px' }}>💬 {record.comment}</span>
                )}
              </div>
              
              <Link 
                to={`/moneycount/entry?edit=${record.id}`}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: 'transparent', 
                  border: '1px solid #d08181ff', 
                  color: '#e6dadaff', 
                  borderRadius: '6px', 
                  textDecoration: 'none', 
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Edytuj
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}