import { useEffect, useMemo, useState } from 'react';

type AnalyticsResponse = {
  counters: { opened: number; closed: number; errors: number; reconnects: number };
  close_codes: Record<string, number>;
  histograms: {
    session_duration_ms: { p50: number | null; p90: number | null; p99: number | null };
    bytes_received_total: { avg: number };
  };
  recent_events: { ts: number; type: 'open' | 'close' | 'error'; code?: number }[];
};

export default function VoiceAnalytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('ADMIN_TOKEN') || '') : '';
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

    const fetchData = () => {
      fetch(`${apiBase}/api/admin/voice/analytics`, {
        headers: { 'x-admin-token': token }
      })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('Failed to load voice analytics'))))
        .then((json) => {
          if (!isMounted) return;
          setData(json);
          setError(null);
        })
        .catch((e) => {
          if (!isMounted) return;
          setError(e.message);
        });
    };

    fetchData();
    const id = setInterval(fetchData, 15000); // refresh every 15s
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  const closeCodes = useMemo(() => {
    if (!data) return [] as { code: string; count: number }[];
    return Object.entries(data.close_codes || {}).map(([code, count]) => ({ code, count: Number(count) }));
  }, [data]);

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>Voice Analytics</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!data && !error && <p>Loading...</p>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, color: '#555' }}>Counters</h3>
            <ul style={{ marginTop: 8 }}>
              <li>Opened: {data.counters.opened}</li>
              <li>Closed: {data.counters.closed}</li>
              <li>Errors: {data.counters.errors}</li>
              <li>Reconnects: {data.counters.reconnects}</li>
            </ul>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, color: '#555' }}>Session Duration (ms)</h3>
            <ul style={{ marginTop: 8 }}>
              <li>p50: {data.histograms.session_duration_ms.p50 ?? '-'}</li>
              <li>p90: {data.histograms.session_duration_ms.p90 ?? '-'}</li>
              <li>p99: {data.histograms.session_duration_ms.p99 ?? '-'}</li>
            </ul>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, color: '#555' }}>Bytes Received</h3>
            <ul style={{ marginTop: 8 }}>
              <li>Avg (total): {data.histograms.bytes_received_total.avg}</li>
            </ul>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, color: '#555' }}>Close Codes</h3>
            {closeCodes.length === 0 && <p style={{ marginTop: 8 }}>None</p>}
            {closeCodes.length > 0 && (
              <ul style={{ marginTop: 8 }}>
                {closeCodes.map((c) => (
                  <li key={c.code}>
                    {c.code}: {c.count}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


