import { useState, useEffect } from 'react';

interface CustomerDemoProps {
  onBack: () => void;
  demoData: any;
}

type CustomerStep = 'qr-scan' | 'verification' | 'voice-recording' | 'ai-processing' | 'results' | 'payment';

export default function CustomerDemo({ onBack, demoData }: CustomerDemoProps) {
  const [currentStep, setCurrentStep] = useState<CustomerStep>('qr-scan');
  const [isRecording, setIsRecording] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [qualityScore, setQualityScore] = useState<any>(null);
  const [reward, setReward] = useState<any>(null);
  const [selectedCafe] = useState('Café Aurora Stockholm');
  const [purchaseAmount] = useState(250);

  // Simulate AI processing
  useEffect(() => {
    if (currentStep === 'ai-processing') {
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            generateResults();
            setCurrentStep('results');
            return 100;
          }
          return prev + 10;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [currentStep]);

  const generateResults = () => {
    // Generate realistic quality scores
    const authenticity = Math.floor(Math.random() * 25 + 75); // 75-100
    const concreteness = Math.floor(Math.random() * 20 + 65); // 65-85
    const depth = Math.floor(Math.random() * 30 + 60); // 60-90
    
    const total = Math.round((authenticity * 0.4) + (concreteness * 0.3) + (depth * 0.3));
    
    setQualityScore({
      authenticity,
      concreteness,
      depth,
      total
    });

    // Calculate reward
    let rewardPercentage;
    if (total >= 90) rewardPercentage = 12;
    else if (total >= 80) rewardPercentage = 10;
    else if (total >= 70) rewardPercentage = 8;
    else if (total >= 60) rewardPercentage = 6;
    else rewardPercentage = 4;

    const rewardAmount = (purchaseAmount * rewardPercentage) / 100;
    const platformFee = rewardAmount * 0.20;
    const businessCost = rewardAmount + platformFee;

    setReward({
      qualityScore: total,
      rewardPercentage,
      purchaseAmount,
      rewardAmount,
      platformFee,
      businessCost
    });
  };

  const handleVoiceRecording = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setFeedback("Jag gillade verkligen den nya kaffesorten ni har. Personalen var mycket hjälpsam och lokalen kändes ren och välkomnande. Det enda som kunde vara bättre är att ha fler veganska alternativ.");
      setCurrentStep('ai-processing');
    }, 3000);
  };

  const renderQRStep = () => (
    <div className="fade-in">
      <div className="text-center mb-6">
        <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '16px' }}>
          📱 Skanna QR-koden
        </h2>
        <p style={{ color: '#64748b', marginBottom: '32px' }}>
          Du är nu på {selectedCafe} och har precis köpt kaffe för {purchaseAmount} SEK
        </p>
      </div>

      <div className="card text-center" style={{ maxWidth: '400px', margin: '0 auto 32px' }}>
        <div style={{
          width: '200px',
          height: '200px',
          backgroundColor: '#000',
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          borderRadius: '8px'
        }}>
          ⬛⬜⬛⬜<br/>
          ⬜⬛⬜⬛<br/>
          ⬛⬜⬛⬜<br/>
          ⬜⬛⬜⬛
        </div>
        <p style={{ color: '#64748b' }}>QR-kod för feedback-session</p>
      </div>

      <div className="text-center">
        <button
          className="btn btn-primary"
          onClick={() => setCurrentStep('verification')}
        >
          📷 Skanna QR-kod (Simulerad)
        </button>
      </div>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="fade-in">
      <div className="text-center mb-6">
        <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '16px' }}>
          ✅ Verifiera din transaktion
        </h2>
        <p style={{ color: '#64748b' }}>
          Bekräfta dina köpdetaljer för att fortsätta
        </p>
      </div>

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="grid grid-2 mb-4">
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Restaurang
            </label>
            <input
              type="text"
              value={selectedCafe}
              disabled
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#f9fafb'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Belopp (SEK)
            </label>
            <input
              type="text"
              value={`${purchaseAmount} SEK`}
              disabled
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#f9fafb'
              }}
            />
          </div>
        </div>

        <div className="mb-4">
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Tid för köp
          </label>
          <input
            type="text"
            value={new Date().toLocaleString('sv-SE')}
            disabled
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#f9fafb'
            }}
          />
        </div>

        <div className="success-bg p-4 rounded mb-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <div>
              <h4 style={{ margin: 0, color: '#065f46' }}>Transaktion verifierad!</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#047857' }}>
                Du kan nu lämna feedback och tjäna cashback
              </p>
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => setCurrentStep('voice-recording')}
        >
          🎤 Fortsätt till röst-feedback
        </button>
      </div>
    </div>
  );

  const renderVoiceRecordingStep = () => (
    <div className="fade-in">
      <div className="text-center mb-6">
        <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '16px' }}>
          🎤 Berätta om din upplevelse
        </h2>
        <p style={{ color: '#64748b' }}>
          AI:n lyssnar på svenska och kommer att bedöma kvaliteten på din feedback
        </p>
      </div>

      <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {!isRecording && !feedback && (
          <div>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎤</div>
            <p style={{ marginBottom: '20px', color: '#64748b' }}>
              Tryck på knappen nedan och berätta vad du tyckte om besöket. 
              Var specifik och ärlig för högre belöning!
            </p>
            <button
              className="btn btn-primary"
              onClick={handleVoiceRecording}
            >
              🔴 Starta inspelning
            </button>
          </div>
        )}

        {isRecording && (
          <div>
            <div className="voice-animation" style={{ margin: '0 auto 20px' }}></div>
            <p style={{ color: '#3b82f6', fontWeight: '600' }}>
              🔴 Spelar in... Prata naturligt på svenska
            </p>
            <div className="pulse" style={{ 
              backgroundColor: '#fef3c7', 
              padding: '16px', 
              borderRadius: '8px',
              margin: '20px 0',
              border: '1px solid #fcd34d'
            }}>
              <p style={{ color: '#92400e', margin: 0 }}>
                💡 Tips: Beskriv specifika detaljer om service, produkter, atmosfär
              </p>
            </div>
          </div>
        )}

        {feedback && (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>✅</div>
            <h3 style={{ color: '#059669', marginBottom: '16px' }}>
              Inspelning klar!
            </h3>
            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'left',
              border: '1px solid #d1d5db'
            }}>
              <strong>Din feedback:</strong><br/>
              "{feedback}"
            </div>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>
              AI:n analyserar nu din feedback för kvalitetspoäng...
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setCurrentStep('ai-processing')}
            >
              🤖 Starta AI-analys
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAIProcessingStep = () => (
    <div className="fade-in">
      <div className="text-center mb-6">
        <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '16px' }}>
          🤖 AI analyserar din feedback
        </h2>
        <p style={{ color: '#64748b' }}>
          Ollama qwen2:0.5b modellen bedömer authentitet, konkrethet och djup
        </p>
      </div>

      <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚡</div>
        
        <div className="progress-bar mb-4">
          <div 
            className="progress-fill"
            style={{ width: `${processingProgress}%` }}
          ></div>
        </div>
        
        <p style={{ fontWeight: '600', marginBottom: '20px' }}>
          {processingProgress}% klar
        </p>

        <div style={{ textAlign: 'left', color: '#64748b', fontSize: '0.9rem' }}>
          {processingProgress >= 20 && <div>✅ Språkanalys (Svenska detekterad)</div>}
          {processingProgress >= 40 && <div>✅ Sentimentanalys (Positiv ton)</div>}
          {processingProgress >= 60 && <div>✅ Autenticitetspoäng beräknad</div>}
          {processingProgress >= 80 && <div>✅ Konkrethetsanalys slutförd</div>}
          {processingProgress >= 100 && <div>✅ Final kvalitetspoäng genererad</div>}
        </div>
      </div>
    </div>
  );

  const renderResultsStep = () => (
    <div className="fade-in">
      <div className="text-center mb-6">
        <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '16px' }}>
          🎉 Din belöning är redo!
        </h2>
        <p style={{ color: '#64748b' }}>
          AI-analysen är klar och din cashback har beräknats
        </p>
      </div>

      <div className="grid grid-2" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card warning-bg">
          <h3 style={{ color: '#92400e', marginTop: 0 }}>🧠 AI Kvalitetsanalys</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#ca8a04', textAlign: 'center', margin: '20px 0' }}>
            {qualityScore?.total}/100
          </div>
          <div style={{ color: '#92400e' }}>
            <div>Äkthet: {qualityScore?.authenticity}/100 (40% vikt)</div>
            <div>Konkrethet: {qualityScore?.concreteness}/100 (30% vikt)</div>
            <div>Djup: {qualityScore?.depth}/100 (30% vikt)</div>
          </div>
        </div>

        <div className="card success-bg">
          <h3 style={{ color: '#065f46', marginTop: 0 }}>💰 Din Cashback</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#047857', textAlign: 'center', margin: '20px 0' }}>
            {reward?.rewardAmount?.toFixed(2)} SEK
          </div>
          <div style={{ color: '#047857' }}>
            <div>{reward?.rewardPercentage}% av {reward?.purchaseAmount} SEK köp</div>
            <div>Plattformsavgift: {reward?.platformFee?.toFixed(2)} SEK</div>
            <div>Totalkostnad för café: {reward?.businessCost?.toFixed(2)} SEK</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '800px', margin: '32px auto 0' }}>
        <h3 style={{ color: '#334155', marginTop: 0 }}>📊 Vad företaget får tillbaka</h3>
        <div className="grid grid-3">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
            <strong>Specifik feedback</strong>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Konkret information om kaffesorter och service
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>👥</div>
            <strong>Personal insights</strong>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Beröm för hjälpsam personal
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🌱</div>
            <strong>Förbättringsförslag</strong>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Fler veganska alternativ efterfrågas
            </p>
          </div>
        </div>
      </div>

      <div className="text-center mt-6">
        <button
          className="btn btn-success"
          style={{ fontSize: '1.2rem', padding: '16px 32px' }}
          onClick={() => setCurrentStep('payment')}
        >
          💳 Få din utbetalning nu
        </button>
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="fade-in">
      <div className="text-center mb-6">
        <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '16px' }}>
          💳 Stripe utbetalning
        </h2>
        <p style={{ color: '#64748b' }}>
          Din belöning betalas ut omedelbart via Stripe Connect
        </p>
      </div>

      <div className="card success-bg" style={{ maxWidth: '500px', margin: '0 auto 32px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
          <h3 style={{ color: '#065f46', marginBottom: '16px' }}>
            Betalning genomförd!
          </h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#047857', marginBottom: '16px' }}>
            {reward?.rewardAmount?.toFixed(2)} SEK
          </div>
          <p style={{ color: '#047857' }}>
            Pengarna är nu på väg till ditt bankkonto via Stripe
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h3 style={{ color: '#334155', marginTop: 0, textAlign: 'center' }}>
          📱 Nästa steg
        </h3>
        <div className="grid grid-2">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📧</div>
            <h4 style={{ color: '#3b82f6' }}>E-post bekräftelse</h4>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Du får ett kvitto via e-post inom 2 minuter
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏦</div>
            <h4 style={{ color: '#10b981' }}>Banköverföring</h4>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Pengarna når ditt konto inom 1-2 arbetsdagar
            </p>
          </div>
        </div>
      </div>

      <div className="text-center mt-6">
        <button
          className="btn btn-primary"
          onClick={() => {
            setCurrentStep('qr-scan');
            setFeedback('');
            setQualityScore(null);
            setReward(null);
            setProcessingProgress(0);
          }}
        >
          🔄 Testa igen
        </button>
        <button
          className="btn btn-secondary"
          style={{ marginLeft: '16px' }}
          onClick={onBack}
        >
          ← Tillbaka till huvudmeny
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh' }}>
      {/* Progress Indicator */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Tillbaka
          </button>
          <h1 style={{ color: '#1e293b', margin: 0 }}>👤 Kund Demo</h1>
          <div></div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {['qr-scan', 'verification', 'voice-recording', 'ai-processing', 'results', 'payment'].map((step, index) => (
            <div
              key={step}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: currentStep === step ? '#3b82f6' : 
                  ['qr-scan', 'verification', 'voice-recording', 'ai-processing', 'results', 'payment'].indexOf(currentStep) > index ? 
                    '#10b981' : '#d1d5db'
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'qr-scan' && renderQRStep()}
      {currentStep === 'verification' && renderVerificationStep()}
      {currentStep === 'voice-recording' && renderVoiceRecordingStep()}
      {currentStep === 'ai-processing' && renderAIProcessingStep()}
      {currentStep === 'results' && renderResultsStep()}
      {currentStep === 'payment' && renderPaymentStep()}
    </div>
  );
}