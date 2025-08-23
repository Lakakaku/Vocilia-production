import { useEffect, useState } from 'react';

export default function Fraud() {
  const [flags, setFlags] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ADMIN_TOKEN') || '';
    fetch(process.env.NEXT_PUBLIC_API_URL + '/api/admin/fraud/flags', {
      headers: { 'x-admin-token': token }
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load fraud flags')))
      .then(d => setFlags(d.items || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Fraud Dashboard</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {flags.length === 0 ? <p>No fraud flags</p> : flags.map((f) => (
        <div key={f.id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 8 }}>
          <div>Type: {f.type}</div>
          <div>Score: {f.score}</div>
          <div>Confidence: {f.confidence}</div>
        </div>
      ))}
    </div>
  );
}

