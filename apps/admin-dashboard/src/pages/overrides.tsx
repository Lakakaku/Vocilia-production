import { useState } from 'react';

export default function Overrides() {
  const [feedbackId, setFeedbackId] = useState('');
  const [score, setScore] = useState('');
  const [message, setMessage] = useState('');

  const submit = () => {
    const token = localStorage.getItem('ADMIN_TOKEN') || '';
    fetch(process.env.NEXT_PUBLIC_API_URL + `/api/admin/feedback/${feedbackId}/override-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ total: Number(score) })
    }).then(r => r.json()).then(() => setMessage('Override saved')).catch(() => setMessage('Failed'));
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Manual Score Overrides</h1>
      <div>
        <input placeholder="Feedback ID" value={feedbackId} onChange={e => setFeedbackId(e.target.value)} />
        <input placeholder="Total Score" value={score} onChange={e => setScore(e.target.value)} style={{ marginLeft: 8 }} />
        <button onClick={submit} style={{ marginLeft: 8 }}>Save</button>
      </div>
      {message && <p>{message}</p>}
    </div>
  );
}

