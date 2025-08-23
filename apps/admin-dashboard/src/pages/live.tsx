import { useEffect, useState } from 'react';

export default function Live() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ADMIN_TOKEN') || '';
    const load = () => {
      fetch(process.env.NEXT_PUBLIC_API_URL + '/api/admin/live/sessions', {
        headers: { 'x-admin-token': token }
      })
        .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load sessions')))
        .then(setStats)
        .catch((e) => setError(e.message));
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Live Monitoring</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!stats && !error && <p>Loading...</p>}
      {stats && (
        <ul>
          <li>Active sessions: {stats.activeCount}</li>
          <li>Session IDs: {stats.activeSessionIds?.join(', ') || '-'}</li>
        </ul>
      )}
    </div>
  );
}

