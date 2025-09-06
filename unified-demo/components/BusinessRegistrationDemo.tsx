import { useState } from 'react';

interface BusinessRegistrationDemoProps {
  onBack: () => void;
  onComplete: (businessData: any) => void;
}

interface BusinessData {
  name: string;
  organizationNumber: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  businessType: string;
  description: string;
}

const INITIAL_DATA: BusinessData = {
  name: '',
  organizationNumber: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  businessType: '',
  description: ''
};

export default function BusinessRegistrationDemo({ onBack, onComplete }: BusinessRegistrationDemoProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<BusinessData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const businessTypes = [
    { value: 'cafe', label: 'Kafé' },
    { value: 'restaurant', label: 'Restaurang' },
    { value: 'retail', label: 'Detaljhandel' },
    { value: 'grocery', label: 'Livsmedelsbutik' },
    { value: 'other', label: 'Annat' }
  ];

  const isStep1Complete = () => {
    return !!(data.name && data.organizationNumber && data.email && data.phone);
  };

  const isStep2Complete = () => {
    return !!(data.address && data.city && data.postalCode && data.businessType);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock successful registration
    const businessResult = {
      id: `business_${Date.now()}`,
      ...data,
      tier: 1,
      status: 'trial',
      trialDaysRemaining: 30,
      createdAt: new Date(),
      stripeAccountId: `acct_test_${Math.random().toString(36).substr(2, 9)}`,
      onboardingUrl: 'https://connect.stripe.com/setup/test_account'
    };

    console.log('✅ Business registered successfully:', businessResult);
    
    setIsSubmitting(false);
    onComplete(businessResult);
  };

  const fillSampleData = () => {
    setData({
      name: 'Café Aurora Stockholm',
      organizationNumber: '556123-4567',
      address: 'Storgatan 15',
      city: 'Stockholm',
      postalCode: '111 29',
      phone: '+46 8 123 456',
      email: 'info@cafearura.se',
      website: 'https://cafearura.se',
      businessType: 'cafe',
      description: 'Mysigt kafé i hjärtat av Stockholm med fokus på hållbarhet och kvalitet'
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <button 
          onClick={onBack}
          style={{ 
            position: 'absolute', 
            top: '20px', 
            left: '20px',
            padding: '8px 16px',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Tillbaka
        </button>
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>
          🏪 Registrera ditt företag
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b' }}>
          Kom igång med AI Feedback Platform på några minuter
        </p>

        <button
          onClick={fillSampleData}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          🎯 Fyll i exempeldata
        </button>
      </div>

      {/* Progress indicator */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            backgroundColor: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: currentStep >= 1 ? '#10b981' : '#e5e7eb',
              color: currentStep >= 1 ? 'white' : '#64748b',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              marginRight: '12px'
            }}>
              {currentStep > 1 ? '✓' : '1'}
            </div>
            <span style={{ marginRight: '24px', color: currentStep === 1 ? '#1e293b' : '#64748b' }}>
              Företagsinformation
            </span>

            <div style={{ width: '40px', height: '2px', backgroundColor: '#e5e7eb', marginRight: '24px' }} />

            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: currentStep >= 2 ? '#10b981' : '#e5e7eb',
              color: currentStep >= 2 ? 'white' : '#64748b',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              marginRight: '12px'
            }}>
              {currentStep > 2 ? '✓' : '2'}
            </div>
            <span style={{ marginRight: '24px', color: currentStep === 2 ? '#1e293b' : '#64748b' }}>
              Adress & Bransch
            </span>

            <div style={{ width: '40px', height: '2px', backgroundColor: '#e5e7eb', marginRight: '24px' }} />

            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: currentStep >= 3 ? '#10b981' : '#e5e7eb',
              color: currentStep >= 3 ? 'white' : '#64748b',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              marginRight: '12px'
            }}>
              3
            </div>
            <span style={{ color: currentStep === 3 ? '#1e293b' : '#64748b' }}>
              Granska & Slutför
            </span>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '32px', 
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {currentStep === 1 && (
          <div>
            <h2 style={{ color: '#1e293b', marginBottom: '24px', fontSize: '1.5rem' }}>
              Företagsinformation
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Företagsnamn *
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => setData({...data, name: e.target.value})}
                  placeholder="Café Aurora AB"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Organisationsnummer *
                </label>
                <input
                  type="text"
                  value={data.organizationNumber}
                  onChange={(e) => setData({...data, organizationNumber: e.target.value})}
                  placeholder="556123-4567"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  E-postadress *
                </label>
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => setData({...data, email: e.target.value})}
                  placeholder="info@cafearura.se"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Telefonnummer *
                </label>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => setData({...data, phone: e.target.value})}
                  placeholder="+46 8 123 456"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Hemsida
                </label>
                <input
                  type="url"
                  value={data.website}
                  onChange={(e) => setData({...data, website: e.target.value})}
                  placeholder="https://cafearura.se"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!isStep1Complete()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: isStep1Complete() ? '#10b981' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isStep1Complete() ? 'pointer' : 'not-allowed'
                }}
              >
                Nästa steg →
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h2 style={{ color: '#1e293b', marginBottom: '24px', fontSize: '1.5rem' }}>
              Adress & Branschinformation
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Gatuadress *
                </label>
                <input
                  type="text"
                  value={data.address}
                  onChange={(e) => setData({...data, address: e.target.value})}
                  placeholder="Storgatan 15"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Stad *
                </label>
                <input
                  type="text"
                  value={data.city}
                  onChange={(e) => setData({...data, city: e.target.value})}
                  placeholder="Stockholm"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Postnummer *
                </label>
                <input
                  type="text"
                  value={data.postalCode}
                  onChange={(e) => setData({...data, postalCode: e.target.value})}
                  placeholder="111 29"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Verksamhetstyp *
                </label>
                <select
                  value={data.businessType}
                  onChange={(e) => setData({...data, businessType: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                >
                  <option value="">Välj verksamhetstyp</option>
                  {businessTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Beskrivning av verksamhet
                </label>
                <textarea
                  value={data.description}
                  onChange={(e) => setData({...data, description: e.target.value})}
                  placeholder="Beskriv kort vad ert företag gör..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ← Tillbaka
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!isStep2Complete()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: isStep2Complete() ? '#10b981' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isStep2Complete() ? 'pointer' : 'not-allowed'
                }}
              >
                Granska →
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 style={{ color: '#1e293b', marginBottom: '24px', fontSize: '1.5rem' }}>
              Granska din registrering
            </h2>

            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: '24px', 
              borderRadius: '8px',
              marginBottom: '32px'
            }}>
              <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>Företagsinformation</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div><strong>Namn:</strong> {data.name}</div>
                <div><strong>Org.nr:</strong> {data.organizationNumber}</div>
                <div><strong>E-post:</strong> {data.email}</div>
                <div><strong>Telefon:</strong> {data.phone}</div>
                <div><strong>Adress:</strong> {data.address}, {data.city} {data.postalCode}</div>
                <div><strong>Bransch:</strong> {businessTypes.find(t => t.value === data.businessType)?.label}</div>
                {data.website && <div><strong>Hemsida:</strong> {data.website}</div>}
              </div>
              {data.description && (
                <div style={{ marginTop: '16px' }}>
                  <strong>Beskrivning:</strong> {data.description}
                </div>
              )}
            </div>

            <div style={{ 
              backgroundColor: '#ecfdf5', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              marginBottom: '24px'
            }}>
              <h4 style={{ color: '#059669', margin: '0 0 12px 0', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>🎉</span>
                Vad händer efter registrering:
              </h4>
              <ul style={{ color: '#047857', paddingLeft: '20px', margin: 0 }}>
                <li>Du får 30 dagars gratis testperiod</li>
                <li>Stripe Connect-konto skapas automatiskt</li>
                <li>Tillgång till dashboard och QR-kodsgenerering</li>
                <li>Möjlighet att integrera med POS-system</li>
                <li>Support för svenska betalningar (Swish, Bankgiro)</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                ← Ändra
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  padding: '12px 32px',
                  backgroundColor: isSubmitting ? '#d1d5db' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid #ffffff40',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Registrerar...
                  </>
                ) : (
                  <>
                    🚀 Registrera företag
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}