'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Use real Railway API for authentication
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Save tokens and user data
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai-feedback-access-token', data.data.accessToken);
          localStorage.setItem('ai-feedback-refresh-token', data.data.refreshToken);
          localStorage.setItem('ai-feedback-user', JSON.stringify(data.data.user));
        }
        router.push('/business/dashboard');
      } else {
        setError(data.error?.message || 'Invalid credentials');
      }
    } catch (error) {
      setError('Ett fel uppstod vid inloggning. Kontrollera din anslutning.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        :root {
          /* Sonic Palette */
          --color-ocean-primary: #1a237e;
          --color-ocean-secondary: #303f9f;
          --color-ocean-accent: #3f51b5;
          --color-resonant-primary: #4a148c;
          --color-resonant-secondary: #7b1fa2;
          --color-resonant-accent: #9c27b0;
          
          /* Gradients */
          --gradient-low-freq: linear-gradient(90deg, #1a237e 0%, #283593 100%);
          --gradient-mid-freq: linear-gradient(90deg, #7b1fa2 0%, #8e24aa 100%);
          --gradient-waveform: linear-gradient(90deg, #1a237e 0%, #7b1fa2 50%, #3f51b5 100%);
          --gradient-radial-wave: radial-gradient(circle, #4a148c 0%, #1a237e 70%);
          
          /* Shadows */
          --color-shadow: rgba(26, 35, 126, 0.1);
          --shadow-md: 0 4px 6px -1px var(--color-shadow);
          --shadow-lg: 0 10px 15px -3px var(--color-shadow);
          --shadow-xl: 0 20px 25px -5px var(--color-shadow);
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        @keyframes breathe {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 
              0 20px 40px -10px rgba(0, 0, 0, 0.5),
              0 10px 20px -5px rgba(26, 35, 126, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 
              0 25px 50px -12px rgba(0, 0, 0, 0.6),
              0 12px 25px -7px rgba(26, 35, 126, 0.4),
              inset 0 1px 0 rgba(255, 255, 255, 0.95);
          }
        }
        
        @keyframes wave-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes pulse-wave {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        
        @keyframes wave-slide {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        
        /* Removed breathing-card animation */
        
        .wave-background {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 25%, #1e40af 50%, #1e3a8a 75%, #0f172a 100%);
          background-size: 400% 400%;
          animation: wave-flow 20s ease infinite;
          position: relative;
        }
        
        .wave-background::before {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(147, 51, 234, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(34, 211, 238, 0.1) 0%, transparent 50%);
          animation: wave-morph 25s ease-in-out infinite;
          pointer-events: none;
        }
        
        @keyframes wave-morph {
          0%, 100% {
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          33% {
            transform: translate(-20px, -20px) scale(1.1) rotate(120deg);
          }
          66% {
            transform: translate(20px, -10px) scale(0.9) rotate(240deg);
          }
        }
        
        .sound-wave-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }
        
        .sound-wave {
          position: absolute;
          left: 0;
          width: 200%;
          height: 2px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255,255,255,0.2) 10%, 
            transparent 20%, 
            rgba(123,31,162,0.2) 30%, 
            transparent 40%,
            rgba(63,81,181,0.2) 50%,
            transparent 60%,
            rgba(156,39,176,0.2) 70%,
            transparent 80%,
            rgba(255,255,255,0.2) 90%,
            transparent 100%
          );
        }
        
        .sound-wave:nth-child(1) {
          top: 20%;
          animation: sound-flow 8s linear infinite;
          height: 40px;
          opacity: 0.1;
          filter: blur(1px);
        }
        
        .sound-wave:nth-child(2) {
          top: 40%;
          animation: sound-flow 6s linear infinite reverse;
          height: 60px;
          opacity: 0.15;
          filter: blur(2px);
        }
        
        .sound-wave:nth-child(3) {
          top: 60%;
          animation: sound-flow 10s linear infinite;
          height: 80px;
          opacity: 0.1;
          filter: blur(1px);
        }
        
        .sound-wave:nth-child(4) {
          top: 80%;
          animation: sound-flow 7s linear infinite reverse;
          height: 50px;
          opacity: 0.15;
          filter: blur(2px);
        }
        
        @keyframes sound-flow {
          from { transform: translateX(0) scaleY(1); }
          25% { transform: translateX(-25%) scaleY(1.5); }
          50% { transform: translateX(-50%) scaleY(0.8); }
          75% { transform: translateX(-75%) scaleY(1.2); }
          to { transform: translateX(-100%) scaleY(1); }
        }
        
        .frequency-bars {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100px;
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          padding: 0 10px;
          pointer-events: none;
          z-index: 1;
          opacity: 0.3;
        }
        
        .frequency-bar {
          width: 2px;
          background: linear-gradient(to top, 
            rgba(123, 31, 162, 0.6), 
            rgba(63, 81, 181, 0.3),
            transparent
          );
          animation: pulse-bar 2s ease-in-out infinite;
        }
        
        .frequency-bar:nth-child(odd) {
          animation-delay: 0.1s;
          height: 30px;
        }
        
        .frequency-bar:nth-child(even) {
          animation-delay: 0.3s;
          height: 50px;
        }
        
        .frequency-bar:nth-child(3n) {
          animation-delay: 0.5s;
          height: 40px;
        }
        
        @keyframes pulse-bar {
          0%, 100% { 
            transform: scaleY(0.3);
            opacity: 0.3;
          }
          50% { 
            transform: scaleY(1);
            opacity: 0.6;
          }
        }
        
        .btn-wave {
          background: var(--gradient-mid-freq);
          border-radius: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        .btn-wave::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateY(-50%);
          transition: left 0.5s ease;
        }
        
        .btn-wave:hover::before {
          left: 100%;
        }
        
        .btn-wave:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-xl);
        }
        
        .btn-wave:active {
          transform: scale(0.98);
        }
        
        .input-wave {
          position: relative;
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          background: white;
          border-color: #d1d5db;
        }
        
        .input-wave:focus {
          border-color: #1a237e;
          box-shadow: 0 0 0 4px rgba(26, 35, 126, 0.15);
          background: white;
        }
        
        .wave-indicator {
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--gradient-waveform);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }
        
        .input-wave:focus ~ .wave-indicator {
          transform: scaleX(1);
        }
        
        .lock-pulse {
          animation: pulse-wave 2s ease-in-out infinite;
        }
        
        .card-acoustic {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px) saturate(180%);
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 
            0 20px 40px -10px rgba(0, 0, 0, 0.5),
            0 10px 20px -5px rgba(26, 35, 126, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        .card-acoustic:hover {
          transform: translateY(-4px);
          box-shadow: 
            0 30px 60px -15px rgba(0, 0, 0, 0.6),
            0 15px 30px -7px rgba(26, 35, 126, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
      `}</style>
      
      <div className="min-h-screen wave-background relative overflow-hidden flex items-center justify-center">
        {/* Sound wave animations */}
        <div className="sound-wave-container">
          <div className="sound-wave"></div>
          <div className="sound-wave"></div>
          <div className="sound-wave"></div>
          <div className="sound-wave"></div>
        </div>
        
        {/* Frequency bars at bottom */}
        <div className="frequency-bars">
          {[...Array(30)].map((_, i) => (
            <div key={i} className="frequency-bar" style={{ animationDelay: `${i * 0.05}s` }}></div>
          ))}
        </div>
        
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="mx-auto h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl relative border-2 border-white/30">
              <Lock className="h-8 w-8 text-[#1a237e] relative z-10" />
              <div className="absolute inset-0 rounded-2xl lock-pulse bg-white/20"></div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-white drop-shadow-lg">
              Logga in på ditt konto
            </h2>
            <p className="mt-2 text-center text-sm text-white/90 font-medium">
              AI Feedback Business Dashboard
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="card-acoustic py-8 px-4 sm:rounded-2xl sm:px-10">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-[#5c6bc0]" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="input-wave pl-10 appearance-none block w-full px-3 py-3 border-2 border-gray-200 placeholder-gray-400 focus:outline-none"
                      placeholder="din@epost.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="wave-indicator"></div>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[#5c6bc0]" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="input-wave pl-10 pr-10 appearance-none block w-full px-3 py-3 border-2 border-gray-200 placeholder-gray-400 focus:outline-none"
                      placeholder="Ditt lösenord"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-[#5c6bc0] hover:text-[#3f51b5] transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-[#5c6bc0] hover:text-[#3f51b5] transition-colors" />
                      )}
                    </button>
                    <div className="wave-indicator"></div>
                  </div>
                </div>

                <div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-wave w-full flex justify-center py-3 px-4 text-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loggar in...' : 'Logga in'}
                  </button>
                </div>
              </form>


            </div>
          </div>
          
          <div className="mt-8 text-center">
            <a
              href="/business/signup"
              className="inline-block font-medium text-white hover:text-cyan-300 transition-all hover:transform hover:scale-105 text-sm drop-shadow-lg"
            >
              Skapa företagskonto
            </a>
          </div>
        </div>
      </div>
    </>
  );
}