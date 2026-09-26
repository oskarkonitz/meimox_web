import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';

export default function SummaryView() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [values, setValues] = useState({});
  const [latestAdjustment, setLatestAdjustment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const receiptRef = useRef(null); // Ref do ukrytego paragonu

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [catRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id).order('sort_order'),
        supabase.from('items').select('*').eq('user_id', user.id)
      ]);
      
      if (catRes.data) setCategories(catRes.data);
      if (itemsRes.data) setItems(itemsRes.data);

      const { data: latestAdj } = await supabase
        .from('adjustments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestAdj) {
        setLatestAdjustment(latestAdj);
        
        const { data: entries } = await supabase
          .from('adjustment_entries')
          .select('item_id, entered_value')
          .eq('adjustment_id', latestAdj.id);

        if (entries) {
          const vals = {};
          entries.forEach(e => { vals[e.item_id] = parseFloat(e.entered_value); });
          setValues(vals);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const calculateCategorySum = (categoryId) => {
    const catItems = items.filter(i => i.category_id === categoryId);
    return catItems.reduce((sum, item) => {
      const enteredVal = values[item.id] || 0;
      return sum + (enteredVal * parseFloat(item.multiplier));
    }, 0);
  };

  const calculateTotalSum = () => {
    return categories.reduce((sum, cat) => sum + calculateCategorySum(cat.id), 0);
  };

  const generateReceipt = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    
    try {
      // Odkrywamy paragon na chwilę
      receiptRef.current.style.display = 'block';
      
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // Lepsza jakość na Retinie/smartfonach
        backgroundColor: '#ffffff'
      });
      
      // Chowamy go z powrotem
      receiptRef.current.style.display = 'none';

      // Pobieranie jako obraz
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Raport_${latestAdjustment ? new Date(latestAdjustment.created_at).toLocaleDateString('pl-PL') : 'Pusty'}.png`;
      link.click();
      
    } catch (err) {
      console.error("Błąd generowania paragonu", err);
      alert("Nie udało się wygenerować paragonu.");
      receiptRef.current.style.display = 'none';
    }
    
    setIsGenerating(false);
  };

  if (loading) return <div style={{ textAlign: 'center' }}>Ładowanie podsumowania...</div>;
  if (categories.length === 0) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Brak konfiguracji. Przejdź do zakładki Konfiguracja.</div>;

  const totalSum = calculateTotalSum();

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '30px',
        border: '2px solid #4CAF50',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '14px', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>
          Stan na: {latestAdjustment ? new Date(latestAdjustment.created_at).toLocaleString('pl-PL') : 'Brak'}
        </div>
        <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#4CAF50', marginBottom: '10px' }}>
          {totalSum.toFixed(2)} PLN
        </div>
        
        {latestAdjustment?.comment && (
          <div style={{ fontStyle: 'italic', color: '#ccc', marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            "{latestAdjustment.comment}"
          </div>
        )}

        {latestAdjustment && (
          <button 
            onClick={generateReceipt}
            disabled={isGenerating}
            style={{
              padding: '8px 16px',
              backgroundColor: '#fff',
              color: '#333',
              border: 'none',
              borderRadius: '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '10px',
              fontSize: '12px'
            }}
          >
            {isGenerating ? 'Generowanie...' : 'Generuj Paragon'}
          </button>
        )}
      </div>

      {categories.map(cat => {
        const catSum = calculateCategorySum(cat.id);
        
        return (
          <div key={cat.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#e6dadaff' }}>{cat.name}</h3>
              <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '18px' }}>
                {catSum.toFixed(2)}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.filter(i => i.category_id === cat.id).map(item => {
                const val = values[item.id] || 0;
                const multiplier = parseFloat(item.multiplier);
                const rowSum = val * multiplier;
                
                if (val === 0) return null; 

                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '14px' }}>
                    <span>{item.name} {multiplier !== 1 ? `(x${val})` : ''}</span>
                    <span style={{ color: '#e6dadaff' }}>{rowSum.toFixed(2)}</span>
                  </div>
                );
              })}
              {catSum === 0 && <span style={{ color: '#666', fontStyle: 'italic', fontSize: '14px' }}>Brak środków</span>}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '40px' }}>
          <Link to="/moneycount/history" style={{ 
            padding: '10px 20px', 
            backgroundColor: 'transparent', 
            border: '1px solid #d08181ff', 
            color: '#e6dadaff', 
            borderRadius: '8px', 
            textDecoration: 'none', 
            fontWeight: 'bold' 
          }}>
            Zobacz historię
          </Link>
          <Link to="/moneycount/entry" style={{ 
            padding: '10px 20px', 
            backgroundColor: '#4CAF50', 
            border: 'none', 
            color: '#fff', 
            borderRadius: '8px', 
            textDecoration: 'none', 
            fontWeight: 'bold' 
          }}>
            Dodaj nowy wpis
          </Link>
      </div>

      {/* --- UKRYTY PARAGON DO WYGENEROWANIA (Stylizowany na tabelę z obrazka) --- */}
      <div 
        ref={receiptRef} 
        style={{ 
          display: 'none', 
          width: '450px', 
          backgroundColor: '#fff', 
          color: '#000', 
          padding: '20px', 
          fontFamily: 'sans-serif',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ border: '1px solid #ccc' }}>
          
          <div style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #ccc', color: '#d08181', fontWeight: 'bold', fontSize: '20px' }}>
            ADJUSTMENT
          </div>
          
          <div style={{ textAlign: 'center', padding: '15px', borderBottom: '1px solid #ccc', fontWeight: 'bold', fontSize: '18px' }}>
            {latestAdjustment ? new Date(latestAdjustment.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : ''}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '10px', textAlign: 'left', width: '40%' }}>Type</th>
                <th style={{ padding: '10px', width: '30%' }}>Quantity</th>
                <th style={{ padding: '10px', width: '30%' }}>Sum</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catSum = calculateCategorySum(cat.id);
                return (
                  <React.Fragment key={cat.id}>
                    <tr>
                      <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic', borderBottom: '1px solid #eee' }}>
                        {cat.name.toUpperCase()}
                      </td>
                    </tr>
                    {items.filter(i => i.category_id === cat.id).map(item => {
                      const val = values[item.id] || 0;
                      if (val === 0) return null;
                      const multiplier = parseFloat(item.multiplier);
                      const rowSum = val * multiplier;

                      return (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.name}</td>
                          <td style={{ padding: '6px 10px' }}>{multiplier !== 1 ? val : ''}</td>
                          <td style={{ padding: '6px 10px' }}>{rowSum.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #ccc' }}>
                      <td style={{ padding: '8px 10px' }}></td>
                      <td style={{ padding: '8px 10px' }}>SUM</td>
                      <td style={{ padding: '8px 10px', fontWeight: 'bold', fontSize: '16px' }}>{catSum.toFixed(2)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <td style={{ padding: '15px 10px', textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic' }}>
                  SUMMARY
                </td>
                <td style={{ padding: '15px 10px' }}>SUM</td>
                <td style={{ padding: '15px 10px', fontWeight: 'bold', fontSize: '22px' }}>
                  {totalSum.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '15px', fontStyle: 'italic', fontSize: '14px', color: '#555' }}>
          {latestAdjustment?.comment ? `Info: ${latestAdjustment.comment}` : 'Brak uwag.'}
        </div>
      </div>

    </div>
  );
}