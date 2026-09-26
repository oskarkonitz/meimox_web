import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ConfigView() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  
  const [activeCatId, setActiveCatId] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemMultiplier, setNewItemMultiplier] = useState(1);

  // Stan dla edytowanego pola
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [catRes, itemsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('items').select('*').eq('user_id', user.id).order('name')
    ]);
    
    if (catRes.data) setCategories(catRes.data);
    if (itemsRes.data) setItems(itemsRes.data);
  };

  const addCategory = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('categories').insert([{ user_id: user.id, name: newCatName }]);
    setNewCatName('');
    fetchData();
  };

  const deleteCategory = async (catId) => {
    if (!window.confirm('Na pewno chcesz usunąć tę kategorię wraz ze wszystkimi polami?')) return;
    await supabase.from('categories').delete().eq('id', catId);
    fetchData();
  };

  const addItem = async (e, categoryId) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    // Konwersja mnożnika na float, aby ułamki typu 0.20 działały poprawnie
    const multiplier = parseFloat(newItemMultiplier) || 1; 

    await supabase.from('items').insert([{ 
      user_id: user.id, 
      category_id: categoryId, 
      name: newItemName, 
      multiplier: multiplier 
    }]);
    setNewItemName('');
    setNewItemMultiplier(1);
    setActiveCatId(null);
    fetchData();
  };

  const saveEditedItem = async (e) => {
    e.preventDefault();
    const multiplier = parseFloat(editingItem.multiplier) || 1;

    await supabase.from('items')
      .update({ name: editingItem.name, multiplier: multiplier })
      .eq('id', editingItem.id);
      
    setEditingItem(null);
    fetchData();
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm('Usunąć to pole?')) return;
    await supabase.from('items').delete().eq('id', itemId);
    fetchData();
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ color: '#e6dadaff', marginBottom: '20px' }}>Struktura Twojego arkusza</h2>
      
      <form onSubmit={addCategory} style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <input 
          value={newCatName} 
          onChange={(e) => setNewCatName(e.target.value)} 
          placeholder="Nowa kategoria (np. Gotówka, mBank)" 
          required
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none' }}
        />
        <button style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#4CAF50', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
          Dodaj
        </button>
      </form>

      {categories.map(cat => (
        <div key={cat.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#4CAF50' }}>{cat.name}</h3>
            <button onClick={() => deleteCategory(cat.id)} style={{ padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', borderRadius: '6px', cursor: 'pointer' }}>
              Usuń kat.
            </button>
          </div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0' }}>
            {items.filter(i => i.category_id === cat.id).map(item => (
              <li key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                
                {editingItem?.id === item.id ? (
                  <form onSubmit={saveEditedItem} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input 
                      value={editingItem.name} 
                      onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} 
                      required style={{ flex: 2, padding: '6px', borderRadius: '6px', border: 'none' }} 
                    />
                    <input 
                      type="number" step="any" 
                      value={editingItem.multiplier} 
                      onChange={(e) => setEditingItem({...editingItem, multiplier: e.target.value})} 
                      required style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none' }} 
                    />
                    <button type="submit" style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#4CAF50', border: 'none', color: '#fff', cursor: 'pointer' }}>OK</button>
                    <button type="button" onClick={() => setEditingItem(null)} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid #aaa', color: '#aaa', cursor: 'pointer' }}>X</button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.name}</span>
                      <span style={{ color: '#aaa', fontSize: '12px' }}>Mnożnik: {item.multiplier}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingItem(item)} style={{ padding: '4px 8px', backgroundColor: '#4a4a4a', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Edytuj</button>
                      <button onClick={() => deleteItem(item.id)} style={{ padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Usuń</button>
                    </div>
                  </div>
                )}

              </li>
            ))}
          </ul>

          {activeCatId === cat.id ? (
            <form onSubmit={(e) => addItem(e, cat.id)} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nazwa pola (np. 100 zł)" required style={{ flex: 2, padding: '8px', borderRadius: '6px', border: 'none' }} />
              <input type="number" step="any" value={newItemMultiplier} onChange={(e) => setNewItemMultiplier(e.target.value)} placeholder="Mnożnik" required style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none' }} />
              <button style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: '#d08181ff', border: 'none', color: '#fff', cursor: 'pointer' }}>Zapisz</button>
              <button type="button" onClick={() => setActiveCatId(null)} style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid #aaa', color: '#aaa', cursor: 'pointer' }}>Anuluj</button>
            </form>
          ) : (
            <button onClick={() => setActiveCatId(cat.id)} style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px dashed #4CAF50', color: '#4CAF50', cursor: 'pointer', width: '100%' }}>
              + Dodaj pole do kategorii
            </button>
          )}
        </div>
      ))}
    </div>
  );
}