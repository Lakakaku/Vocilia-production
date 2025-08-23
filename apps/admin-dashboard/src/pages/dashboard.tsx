import { useEffect, useState } from 'react';
import VoiceAnalytics from '../components/VoiceAnalytics';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ADMIN_TOKEN') || '';
    fetch(process.env.NEXT_PUBLIC_API_URL + '/api/admin/metrics', {
      headers: { 'x-admin-token': token }
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load metrics')))
      .then(setMetrics)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>System Metrics</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!metrics && !error && <p>Loading...</p>}
      {metrics && (
        <ul>
          <li>Active Voice Sessions: {metrics.metrics?.activeVoiceSessions ?? '-'}</li>
          <li>Session IDs: {metrics.metrics?.activeSessionIds?.join(', ') || '-'}</li>
        </ul>
      )}
      <div style={{ marginTop: 24 }}>
        <VoiceAnalytics />
      </div>
    </div>
  );
}

