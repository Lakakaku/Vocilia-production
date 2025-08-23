import { useEffect, useState } from 'react';

export default function Approvals() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('ADMIN_TOKEN') || '' : '';

  const load = () => {
    fetch(process.env.NEXT_PUBLIC_API_URL + '/api/admin/business/approvals', {
      headers: { 'x-admin-token': token }
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load approvals')))
      .then(d => setItems(d.items || []))
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const act = (id: string, action: 'approve' | 'reject') => {
    fetch(process.env.NEXT_PUBLIC_API_URL + `/api/admin/business/${id}/${action}`, {
      method: 'POST',
      headers: { 'x-admin-token': token }
    }).then(load);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Business Approval Queue</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {items.length === 0 && <p>No pending approvals</p>}
      {items.map((item) => (
        <div key={item.id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 8 }}>
          <div><strong>{item.name}</strong> (org: {item.orgNumber})</div>
          <button onClick={() => act(item.id, 'approve')} style={{ marginRight: 8 }}>Approve</button>
          <button onClick={() => act(item.id, 'reject')}>Reject</button>
        </div>
      ))}
    </div>
  );
}

