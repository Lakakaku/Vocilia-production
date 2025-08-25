import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
    };
    accessToken: string;
    refreshToken: string;
  };
  code?: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('E-post och lösenord krävs');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse = await response.json();

      if (response.ok && data.success && data.data) {
        // Store tokens
        localStorage.setItem('admin_access_token', data.data.accessToken);
        if (rememberMe) {
          localStorage.setItem('admin_refresh_token', data.data.refreshToken);
        } else {
          sessionStorage.setItem('admin_refresh_token', data.data.refreshToken);
        }
        
        // Store user info
        localStorage.setItem('admin_user', JSON.stringify(data.data.user));
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setError(data.message || 'Inloggning misslyckades');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Nätverksfel. Försök igen senare.');
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholderCredentials = () => {
    return {
      admin: { email: 'admin@feedbackplatform.se', password: 'password' },
      moderator: { email: 'moderator@feedbackplatform.se', password: 'password' }
    };
  };

  const fillCredentials = (type: 'admin' | 'moderator') => {
    const creds = getPlaceholderCredentials();
    setEmail(creds[type].email);
    setPassword(creds[type].password);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: '#1e293b', 
            marginBottom: '8px' 
          }}>
            Admin Inloggning
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            AI Feedback Platform - Administratörspanel
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151' 
            }}>
              E-postadress
            </label>
            <input
              type="email"
              placeholder="admin@feedbackplatform.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{ 
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: loading ? '#f9fafb' : 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151' 
            }}>
              Lösenord
            </label>
            <input
              type="password"
              placeholder="Ange ditt lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{ 
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: loading ? '#f9fafb' : 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              fontSize: '14px',
              color: '#374151',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                style={{ 
                  marginRight: '8px',
                  width: '16px',
                  height: '16px'
                }}
              />
              Kom ihåg mig
            </label>
          </div>

          {error && (
            <div style={{ 
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '500',
              color: 'white',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>

        {/* Development helper buttons */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <p style={{ 
              fontSize: '12px', 
              color: '#6c757d', 
              marginBottom: '12px',
              fontWeight: '500'
            }}>
              Utvecklingsläge - Testinloggningar:
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fillCredentials('admin')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#e7f3ff',
                  color: '#0066cc',
                  border: '1px solid #b3d9ff',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('moderator')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#fff2e5',
                  color: '#cc6600',
                  border: '1px solid #ffcc99',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Moderator
              </button>
            </div>
          </div>
        )}

        <div style={{ 
          marginTop: '24px', 
          textAlign: 'center',
          fontSize: '12px',
          color: '#64748b'
        }}>
          © 2024 AI Feedback Platform
        </div>
      </div>
    </div>
  );
}