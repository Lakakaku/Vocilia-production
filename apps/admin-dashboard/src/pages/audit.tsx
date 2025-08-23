import { useEffect, useState } from 'react';

export default function Audit() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ADMIN_TOKEN') || '';
    fetch(process.env.NEXT_PUBLIC_API_URL + '/api/admin/audit/logs', {
      headers: { 'x-admin-token': token }
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load audit logs')))
      .then(d => setItems(d.items || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Audit Logs</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {items.length === 0 ? <p>No logs</p> : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i}>
                <td>{r.ts}</td>
                <td>{r.method}</td>
                <td>{r.path}</td>
                <td>{r.status}</td>
                <td>{r.durationMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

