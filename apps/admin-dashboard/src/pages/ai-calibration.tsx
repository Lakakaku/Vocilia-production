import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { requireAuth } from '../utils/auth';

interface ModelPerformance {
  modelId: string;
  modelName: string;
  version: string;
  status: 'active' | 'testing' | 'deprecated';
  metrics: {
    accuracy: number;
    avgProcessingTime: number;
    swedishAccuracy: number;
    bias: number;
    calibrationScore: number;
  };
  lastUpdated: string;
  totalEvaluations: number;
  expertAgreementRate: number;
}

interface CalibrationSample {
  id: string;
  feedbackText: string;
  businessContext: string;
  aiScore: number;
  expertScore?: number;
  discrepancy: number;
  status: 'pending' | 'reviewed' | 'disputed';
  expertNotes?: string;
  swedishLanguageComplexity: number;
  createdAt: string;
  reviewedAt?: string;
  category: 'authenticity' | 'concreteness' | 'depth';
}

interface ABTest {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'paused';
  modelA: string;
  modelB: string;
  startDate: string;
  endDate?: string;
  metrics: {
    samplesA: number;
    samplesB: number;
    accuracyA: number;
    accuracyB: number;
    expertPreference: number; // -1 to 1, negative prefers A, positive prefers B
  };
  statisticalSignificance: number;
}

export default function AICalibration() {
  const router = useRouter();
  const [models, setModels] = useState<ModelPerformance[]>([]);
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSample[]>([]);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [selectedSample, setSelectedSample] = useState<CalibrationSample | null>(null);
  const [expertScore, setExpertScore] = useState('');
  const [expertNotes, setExpertNotes] = useState('');

  useEffect(() => {
    loadAICalibrationData();
  }, []);

  const loadAICalibrationData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ADMIN_TOKEN');
      
      const [modelsResponse, samplesResponse, testsResponse] = await Promise.all([
        fetch('/api/admin/ai-calibration/models', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/ai-calibration/samples', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/ai-calibration/ab-tests', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        setModels(modelsData.models);
      }

      if (samplesResponse.ok) {
        const samplesData = await samplesResponse.json();
        setCalibrationSamples(samplesData.samples);
      }

      if (testsResponse.ok) {
        const testsData = await testsResponse.json();
        setAbTests(testsData.tests);
      }

    } catch (error) {
      console.error('Error loading AI calibration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitExpertReview = async (sampleId: string) => {
    try {
      const token = localStorage.getItem('ADMIN_TOKEN');
      const response = await fetch(`/api/admin/ai-calibration/samples/${sampleId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expertScore: parseFloat(expertScore),
          notes: expertNotes
        })
      });

      if (response.ok) {
        setSelectedSample(null);
        setExpertScore('');
        setExpertNotes('');
        loadAICalibrationData(); // Reload data
      }
    } catch (error) {
      console.error('Error submitting expert review:', error);
    }
  };

  const createABTest = async (testName: string, modelA: string, modelB: string) => {
    try {
      const token = localStorage.getItem('ADMIN_TOKEN');
      const response = await fetch('/api/admin/ai-calibration/ab-tests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: testName,
          modelA,
          modelB
        })
      });

      if (response.ok) {
        loadAICalibrationData(); // Reload data
      }
    } catch (error) {
      console.error('Error creating A/B test:', error);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'active': '#10b981',
      'testing': '#f59e0b',
      'deprecated': '#ef4444',
      'running': '#3b82f6',
      'completed': '#10b981',
      'paused': '#6b7280',
      'pending': '#f59e0b',
      'reviewed': '#10b981',
      'disputed': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toLocaleString('sv-SE', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        fontSize: '16px',
        color: '#64748b'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
          Laddar AI-kalibrering...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#1e293b',
          margin: 0,
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center'
        }}>
          🤖 AI-kalibrering & Prestandaövervakning
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          margin: 0
        }}>
          Övervaka och kalibrera AI-modellers prestanda för optimal poängsättning
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {[
          { id: 'overview', label: 'Översikt', icon: '📊' },
          { id: 'calibration', label: 'Kalibrering', icon: '🎯' },
          { id: 'abtesting', label: 'A/B-testning', icon: '⚖️' },
          { id: 'swedish', label: 'Svenska-specifikt', icon: '🇸🇪' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              backgroundColor: selectedTab === tab.id ? '#eff6ff' : 'transparent',
              color: selectedTab === tab.id ? '#3b82f6' : '#64748b',
              borderBottom: selectedTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div>
          {/* Model Performance Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {models.map(model => (
              <div key={model.modelId} style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '4px' }}>
                      {model.modelName}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      v{model.version} • {model.totalEvaluations.toLocaleString('sv-SE')} utvärderingar
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: getStatusColor(model.status),
                    color: 'white'
                  }}>
                    {model.status === 'active' ? 'Aktiv' : model.status === 'testing' ? 'Testning' : 'Föråldrad'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                      {formatNumber(model.metrics.accuracy * 100)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Noggrannhet</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                      {formatNumber(model.metrics.swedishAccuracy * 100)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Svenska</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                      {formatNumber(model.metrics.avgProcessingTime * 1000)}ms
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Svarstid</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                      {formatNumber(model.expertAgreementRate * 100)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Expert-enighet</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* System-wide Metrics */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              📈 Systemövergripande Prestanda
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>
                  {formatNumber(models.reduce((sum, m) => sum + m.metrics.accuracy, 0) / models.length * 100)}%
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Genomsnittlig Noggrannhet</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
                  {formatNumber(models.reduce((sum, m) => sum + m.metrics.swedishAccuracy, 0) / models.length * 100)}%
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Svenska Noggrannhet</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '4px' }}>
                  {formatNumber(models.reduce((sum, m) => sum + m.totalEvaluations, 0))}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Totalt Utvärderingar</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '4px' }}>
                  {calibrationSamples.filter(s => s.status === 'pending').length}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Väntande Kalibrering</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calibration Tab */}
      {selectedTab === 'calibration' && (
        <div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              🎯 Expert-kalibrering av AI-poängsättning
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>
                  {calibrationSamples.filter(s => s.status === 'pending').length}
                </div>
                <div style={{ fontSize: '14px', color: '#92400e' }}>Väntande Granskning</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#d1fae5', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#065f46' }}>
                  {calibrationSamples.filter(s => s.status === 'reviewed').length}
                </div>
                <div style={{ fontSize: '14px', color: '#065f46' }}>Granskade</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#991b1b' }}>
                  {calibrationSamples.filter(s => s.status === 'disputed').length}
                </div>
                <div style={{ fontSize: '14px', color: '#991b1b' }}>Omtvistade</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#ede9fe', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#5b21b6' }}>
                  {formatNumber(calibrationSamples.reduce((sum, s) => sum + Math.abs(s.discrepancy), 0) / calibrationSamples.length)}
                </div>
                <div style={{ fontSize: '14px', color: '#5b21b6' }}>Genomsnittlig Avvikelse</div>
              </div>
            </div>

            {/* Calibration Samples List */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {calibrationSamples.slice(0, 10).map(sample => (
                <div key={sample.id} style={{
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  backgroundColor: sample.status === 'pending' ? '#fefce8' : '#ffffff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: '#1e293b', marginBottom: '8px', lineHeight: '1.4' }}>
                        "{sample.feedbackText.substring(0, 100)}..."
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                        <span>AI: {formatNumber(sample.aiScore)}/100</span>
                        {sample.expertScore && <span>Expert: {formatNumber(sample.expertScore)}/100</span>}
                        <span>Avvikelse: {formatNumber(sample.discrepancy)}</span>
                        <span>Kategori: {sample.category}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        backgroundColor: getStatusColor(sample.status),
                        color: 'white'
                      }}>
                        {sample.status === 'pending' ? 'Väntande' : sample.status === 'reviewed' ? 'Granskad' : 'Omtvistad'}
                      </span>
                      {sample.status === 'pending' && (
                        <button
                          onClick={() => setSelectedSample(sample)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Granska
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* A/B Testing Tab */}
      {selectedTab === 'abtesting' && (
        <div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                ⚖️ A/B-testning av AI-modeller
              </h3>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}>
                + Nytt A/B-test
              </button>
            </div>

            {abTests.map(test => (
              <div key={test.id} style={{
                padding: '20px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '16px',
                backgroundColor: '#ffffff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '4px' }}>
                      {test.name}
                    </h4>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {test.modelA} vs {test.modelB} • Sedan {new Date(test.startDate).toLocaleDateString('sv-SE')}
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    backgroundColor: getStatusColor(test.status),
                    color: 'white'
                  }}>
                    {test.status === 'running' ? 'Pågående' : test.status === 'completed' ? 'Avslutad' : 'Pausad'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {test.metrics.samplesA}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Stickprov A</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
                      {test.metrics.samplesB}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Stickprov B</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                      {formatNumber(test.metrics.accuracyA * 100)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Noggrannhet A</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
                      {formatNumber(test.metrics.accuracyB * 100)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Noggrannhet B</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8b5cf6' }}>
                      {formatNumber(test.statisticalSignificance * 100)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Signifikans</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swedish-specific Tab */}
      {selectedTab === 'swedish' && (
        <div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              🇸🇪 Svenska språk-specifik analys
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0369a1' }}>94.2%</div>
                <div style={{ fontSize: '12px', color: '#0369a1' }}>Svenska Noggrannhet</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}>8.7</div>
                <div style={{ fontSize: '12px', color: '#166534' }}>Genomsnittlig Komplexitet</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fef7cd', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a16207' }}>2.3s</div>
                <div style={{ fontSize: '12px', color: '#a16207' }}>Processtid Svenska</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fdf2f8', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#be185d' }}>97.1%</div>
                <div style={{ fontSize: '12px', color: '#be185d' }}>Dialekt Kännedom</div>
              </div>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                📈 Svenska Språkprestanda över Tid
              </h4>
              <div style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px dashed #cbd5e1'
              }}>
                Prestandadiagram för svenska språket kommer här
                <br />
                (Integration med Chart.js eller liknande)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expert Review Modal */}
      {selectedSample && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
              Expert-granskning av AI-poängsättning
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#1e293b', marginBottom: '8px', fontWeight: '500' }}>
                Feedback-text:
              </div>
              <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5', marginBottom: '12px' }}>
                "{selectedSample.feedbackText}"
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                <span>AI-poäng: {formatNumber(selectedSample.aiScore)}/100</span>
                <span>Kategori: {selectedSample.category}</span>
                <span>Komplexitet: {formatNumber(selectedSample.swedishLanguageComplexity)}/10</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Din expertbedömning (0-100):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={expertScore}
                onChange={(e) => setExpertScore(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Ange poäng 0-100"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Kommentarer och motivering:
              </label>
              <textarea
                value={expertNotes}
                onChange={(e) => setExpertNotes(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
                placeholder="Förklara din bedömning och eventuella avvikelser från AI:s poäng..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setSelectedSample(null);
                  setExpertScore('');
                  setExpertNotes('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Avbryt
              </button>
              <button
                onClick={() => submitExpertReview(selectedSample.id)}
                disabled={!expertScore || parseFloat(expertScore) < 0 || parseFloat(expertScore) > 100}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: (!expertScore || parseFloat(expertScore) < 0 || parseFloat(expertScore) > 100) ? 0.5 : 1
                }}
              >
                Skicka Granskning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: any) {
  return requireAuth(context, ['admin', 'super_admin']);
}