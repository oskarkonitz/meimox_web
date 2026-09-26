import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function EntryView() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit'); // Sprawdzamy czy edytujemy historię
  
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [values, setValues] = useState({});
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

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

      // Pobieramy wpis - albo ten konkretny z Historii, albo najnowszy by skopiować wartości
      let targetAdj = null;
      
      if (editId) {
        // Tryb edycji historycznej
        const { data } = await supabase.from('adjustments').select('*').eq('id', editId).single();
        targetAdj = data;
      } else {
        // Tryb tworzenia nowego wpisu - ładujemy najnowszy by formularz nie był pusty
        const { data } = await supabase.from('adjustments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
        targetAdj = data;
      }

      if (targetAdj) {
        if (editId) setComment(targetAdj.comment || ''); // Wczytaj komentarz tylko przy edycji starego
        
        const { data: entries } = await supabase.from('adjustment_entries').select('item_id, entered_value').eq('adjustment_id', targetAdj.id);
        if (entries) {
          const vals = {};
          entries.forEach(e => { vals[e.item_id] = parseFloat(e.entered_value); });
          setValues(vals);
        }
      }
    };
    fetchData();
  }, [editId]);

  const handleInputChange = (itemId, val) => {
    const parsedVal = parseFloat(val.replace(',', '.')) || 0;
    setValues(prev => ({ ...prev, [itemId]: parsedVal }));
  };

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

  const handleSave = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    let adjId = editId;

    if (!adjId) {
      // TWORZENIE NOWEGO WPISU W HISTORII
      const { data: newAdj } = await supabase
        .from('adjustments')
        .insert([{ user_id: user.id, comment: comment }])
        .select()
        .single();
      adjId = newAdj.id;
    } else {
      // AKTUALIZACJA HISTORYCZNEGO WPISU
      await supabase.from('adjustments').update({ comment: comment }).eq('id', adjId);
    }

    const entriesToUpsert = items.map(item => ({
      adjustment_id: adjId,
      item_id: item.id,
      user_id: user.id,
      entered_value: values[item.id] || 0
    }));

    await supabase.from('adjustment_entries').delete().eq('adjustment_id', adjId);
    await supabase.from('adjustment_entries').insert(entriesToUpsert);

    alert('Zapisano pomyślnie!');
    navigate('/moneycount'); 
    setIsSaving(false);
  };

  if (categories.length === 0) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Najpierw dodaj kategorie w zakładce Konfiguracja.</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        border: `2px solid ${editId ? '#d08181ff' : '#4CAF50'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {editId ? 'Edytujesz historyczny wpis' : 'Nowy wpis (skopiowano poprzedni)'}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4CAF50' }}>
              {calculateTotalSum().toFixed(2)} PLN
            </div>
          </div>
          
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            style={{ 
              padding: '12px 25px', 
              borderRadius: '8px', 
              backgroundColor: isSaving ? '#999' : (editId ? '#d08181ff' : '#4CAF50'), 
              border: 'none', 
              color: '#fff', 
              fontWeight: 'bold', 
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {isSaving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
        
        <textarea 
          placeholder="Dodaj opcjonalny komentarz (np. 'Wypłata z bankomatu')" 
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#fff', fontFamily: 'inherit', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' }}
        />
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
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px' }}>
              {items.filter(i => i.category_id === cat.id).map(item => (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>{item.name}</label>
                  <input 
                    type="number" 
                    min="0"
                    step="any"
                    value={values[item.id] !== undefined && values[item.id] !== 0 ? values[item.id] : ''}
                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                    placeholder="0"
                    style={{ padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#fff', fontSize: '16px', color: '#000' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  );
}