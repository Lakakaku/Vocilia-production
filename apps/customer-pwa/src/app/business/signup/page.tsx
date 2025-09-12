'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Building2, UserPlus } from 'lucide-react';

interface SignupFormData {
  businessName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

const initialFormData: SignupFormData = {
  businessName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false
};

export default function SignupPage() {
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const updateFormData = (field: keyof SignupFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!formData.acceptTerms) {
      setError('Please accept terms and conditions');
      setIsLoading(false);
      return;
    }

    try {
      // Use real Railway API for business registration
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.businessName,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Business created successfully, now log them in
        const loginResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const loginData = await loginResponse.json();

        if (loginResponse.ok && loginData.success) {
          // Save tokens and user data
          if (typeof window !== 'undefined') {
            localStorage.setItem('ai-feedback-access-token', loginData.data.tokens.access_token);
            localStorage.setItem('ai-feedback-refresh-token', loginData.data.tokens.refresh_token);
            localStorage.setItem('ai-feedback-user', JSON.stringify(loginData.data.user));
          }
          router.push('/business/onboarding');
        } else {
          // Business created but login failed - redirect to login page
          router.push('/business/login?message=Account created successfully, please log in');
        }
      } else {
        setError(data.error?.message || 'Ett fel uppstod vid registrering');
      }
    } catch (error) {
      setError('Ett fel uppstod vid registrering. Kontrollera din anslutning.');
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
        
        @keyframes input-breathe {
          0%, 100% { 
            transform: scaleX(1);
            border-color: rgba(209, 213, 219, 0.8);
          }
          50% { 
            transform: scaleX(1.01);
            border-color: rgba(209, 213, 219, 1);
          }
        }
        
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(4);
            opacity: 0;
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
          top: 15%;
          animation: sound-flow 8s linear infinite;
          height: 60px;
          opacity: 0.25;
          filter: blur(1px);
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(123,31,162,0.3) 10%, 
            transparent 20%, 
            rgba(63,81,181,0.3) 30%, 
            transparent 40%,
            rgba(156,39,176,0.3) 50%,
            transparent 60%,
            rgba(26,35,126,0.3) 70%,
            transparent 80%,
            rgba(123,31,162,0.3) 90%,
            transparent 100%
          );
        }
        
        .sound-wave:nth-child(2) {
          top: 35%;
          animation: sound-flow 6s linear infinite reverse;
          height: 80px;
          opacity: 0.2;
          filter: blur(2px);
        }
        
        .sound-wave:nth-child(3) {
          top: 55%;
          animation: sound-flow 10s linear infinite;
          height: 100px;
          opacity: 0.15;
          filter: blur(1.5px);
        }
        
        .sound-wave:nth-child(4) {
          top: 75%;
          animation: sound-flow 7s linear infinite reverse;
          height: 70px;
          opacity: 0.2;
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
          transform-style: preserve-3d;
        }
        
        .btn-wave::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: translateY(-50%);
          transition: left 0.5s ease;
        }
        
        .btn-wave::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 24px;
          background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .btn-wave:hover::before {
          left: 100%;
        }
        
        .btn-wave:hover::after {
          opacity: 1;
        }
        
        .btn-wave:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 
            0 25px 50px -12px rgba(123, 31, 162, 0.4),
            0 15px 30px -8px rgba(26, 35, 126, 0.3);
        }
        
        .btn-wave:active {
          transform: scale(0.98);
          transition: transform 0.1s ease;
        }
        
        .input-wave {
          position: relative;
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          background: white;
          border-color: #d1d5db;
          animation: input-breathe 4s ease-in-out infinite;
        }
        
        .input-wave:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(26, 35, 126, 0.1);
        }
        
        .input-wave:focus {
          border-color: #1a237e;
          box-shadow: 0 0 0 4px rgba(26, 35, 126, 0.15);
          background: linear-gradient(to right, white 0%, rgba(248, 250, 255, 1) 100%);
          animation: none;
          transform: scale(1.02);
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
          animation: wave-flow 2s linear infinite paused;
        }
        
        .input-wave:focus ~ .wave-indicator {
          transform: scaleX(1);
          animation-play-state: running;
        }
        
        .signup-pulse {
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
          animation: breathe 8s ease-in-out infinite;
          position: relative;
          overflow: visible;
        }
        
        .card-acoustic::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: var(--gradient-waveform);
          border-radius: 18px;
          opacity: 0;
          z-index: -1;
          transition: opacity 0.3s ease;
        }
        
        .card-acoustic:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 
            0 30px 60px -15px rgba(0, 0, 0, 0.6),
            0 15px 30px -7px rgba(26, 35, 126, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          animation-play-state: paused;
        }
        
        .card-acoustic:hover::before {
          opacity: 0.3;
        }
        
        .checkbox-wave {
          position: relative;
          appearance: none;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .checkbox-wave:checked {
          background: white;
          border-color: white;
        }
        
        .checkbox-wave:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #7b1fa2;
          font-size: 14px;
          font-weight: bold;
        }
        
        .checkbox-wave:focus {
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
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
              <UserPlus className="h-8 w-8 text-[#1a237e] relative z-10" />
              <div className="absolute inset-0 rounded-2xl signup-pulse bg-white/20"></div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-white drop-shadow-lg">
              Skapa företagskonto
            </h2>
            <p className="mt-2 text-center text-sm text-white/90 font-medium">
              Börja samla kundåsikter idag
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="card-acoustic py-8 px-4 sm:rounded-2xl sm:px-10">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-[#5c6bc0]" />
                    </div>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      required
                      className="input-wave pl-10 appearance-none block w-full px-3 py-3 border-2 border-gray-200 placeholder-gray-400 focus:outline-none"
                      placeholder="Företagsnamn"
                      value={formData.businessName}
                      onChange={(e) => updateFormData('businessName', e.target.value)}
                    />
                    <div className="wave-indicator"></div>
                  </div>
                </div>

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
                      placeholder="kontakt@dittforetag.se"
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
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
                      required
                      className="input-wave pl-10 pr-10 appearance-none block w-full px-3 py-3 border-2 border-gray-200 placeholder-gray-400 focus:outline-none"
                      placeholder="Välj ett starkt lösenord"
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
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
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[#5c6bc0]" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      className="input-wave pl-10 pr-10 appearance-none block w-full px-3 py-3 border-2 border-gray-200 placeholder-gray-400 focus:outline-none"
                      placeholder="Bekräfta lösenord"
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-[#5c6bc0] hover:text-[#3f51b5] transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-[#5c6bc0] hover:text-[#3f51b5] transition-colors" />
                      )}
                    </button>
                    <div className="wave-indicator"></div>
                  </div>
                </div>

                <div className="flex items-center bg-gradient-to-r from-[#1a237e] to-[#7b1fa2] p-3 rounded-xl">
                  <input
                    id="acceptTerms"
                    name="acceptTerms"
                    type="checkbox"
                    className="checkbox-wave"
                    checked={formData.acceptTerms}
                    onChange={(e) => updateFormData('acceptTerms', e.target.checked)}
                  />
                  <label htmlFor="acceptTerms" className="ml-3 block text-sm text-white font-medium">
                    Jag accepterar{' '}
                    <a href="#" className="text-cyan-300 hover:text-cyan-200 font-semibold transition-colors underline">
                      användarvillkor
                    </a>{' '}
                    och{' '}
                    <a href="#" className="text-cyan-300 hover:text-cyan-200 font-semibold transition-colors underline">
                      integritetspolicy
                    </a>
                  </label>
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
                    className="btn-wave w-full flex justify-center py-3 px-4 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Skapar konto...' : 'Skapa konto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <span className="text-white/80 text-sm">Har redan konto?</span>
            <a
              href="/business/login"
              className="ml-2 inline-block font-semibold text-white hover:text-cyan-300 transition-all hover:transform hover:scale-105 text-lg drop-shadow-lg"
            >
              Logga in här
            </a>
          </div>
        </div>
      </div>
    </>
  );
}