import { useState } from 'react';

export default function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Enter admin token');
      return;
    }
    localStorage.setItem('ADMIN_TOKEN', token);
    window.location.href = '/dashboard';
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Login</h1>
      <form onSubmit={onSubmit}>
        <input
          placeholder="x-admin-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        />
        <button type="submit" style={{ marginLeft: 8 }}>Login</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

