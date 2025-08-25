import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { requireAuth } from '../utils/auth';

interface FeedbackOverride {
  id: string;
  feedbackId: string;
  originalScore: number;
  newScore: number;
  scoreDifference: number;
  reason: string;
  justification: string;
  category: 'quality_assurance' | 'customer_complaint' | 'business_request' | 'ai_error' | 'systematic_correction';
  overriddenBy: {
    id: string;
    name: string;
    role: string;
  };
  overriddenAt: string;
  businessContext: {
    businessName: string;
    businessId: string;
    locationName: string;
  };
  feedbackData: {
    text: string;
    originalCategories: string[];
    customerHash: string;
    sessionId: string;
  };
  impactData: {
    rewardChange: number;
    commissionChange: number;
    customerNotified: boolean;
    businessNotified: boolean;
  };
  status: 'pending' | 'approved' | 'applied' | 'rejected';
  reviewedBy?: {
    id: string;
    name: string;
    role: string;
  };
  reviewedAt?: string;
  reviewNotes?: string;
}

interface BulkOperation {
  id: string;
  name: string;
  description: string;
  filters: {
    scoreRange: [number, number];
    businessIds?: string[];
    dateRange: [string, string];
    categories?: string[];
    aiModel?: string;
  };
  adjustment: {
    type: 'absolute' | 'relative';
    value: number;
    reason: string;
  };
  status: 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed';
  createdBy: string;
  createdAt: string;
  affectedCount: number;
  executedCount?: number;
  estimatedImpact: {
    totalRewardChange: number;
    totalCommissionChange: number;
    businessesAffected: number;
  };
}

interface OverrideAnalytics {
  summary: {
    totalOverrides: number;
    pendingApproval: number;
    averageScoreChange: number;
    totalRewardImpact: number;
  };
  trends: {
    overridesByCategory: Record<string, number>;
    overridesByReason: Record<string, number>;
    monthlyOverrides: Array<{ month: string; count: number; avgChange: number }>;
  };
  patterns: {
    frequentOverriders: Array<{ name: string; count: number; avgChange: number }>;
    businessesWithMostOverrides: Array<{ name: string; count: number; avgChange: number }>;
    commonJustifications: Array<{ text: string; frequency: number; avgChange: number }>;
  };
}

export default function ScoreOverrides() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState('individual');
  const [overrides, setOverrides] = useState<FeedbackOverride[]>([]);
  const [bulkOperations, setBulkOperations] = useState<BulkOperation[]>([]);
  const [analytics, setAnalytics] = useState<OverrideAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Individual override state
  const [selectedFeedback, setSelectedFeedback] = useState<string>('');
  const [newScore, setNewScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [justification, setJustification] = useState('');
  const [category, setCategory] = useState('quality_assurance');

  useEffect(() => {
    loadOverrideData();
  }, []);

  const loadOverrideData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ADMIN_TOKEN');
      
      const [overridesResponse, bulkResponse, analyticsResponse] = await Promise.all([
        fetch('/api/admin/score-overrides', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/score-overrides/bulk', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/score-overrides/analytics', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (overridesResponse.ok) {
        const overridesData = await overridesResponse.json();
        setOverrides(overridesData.overrides || []);
      }

      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        setBulkOperations(bulkData.operations || []);
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData.analytics);
      }

    } catch (error) {
      console.error('Error loading override data:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitIndividualOverride = async () => {
    if (!selectedFeedback || !newScore || !overrideReason || !justification) {
      return;
    }

    try {
      const token = localStorage.getItem('ADMIN_TOKEN');
      const response = await fetch('/api/admin/score-overrides', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedbackId: selectedFeedback,
          newScore: parseFloat(newScore),
          reason: overrideReason,
          justification,
          category
        })
      });

      if (response.ok) {
        setSelectedFeedback('');
        setNewScore('');
        setOverrideReason('');
        setJustification('');
        setCategory('quality_assurance');
        loadOverrideData(); // Reload data
      }
    } catch (error) {
      console.error('Error submitting override:', error);
    }
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      'quality_assurance': 'Kvalitetssäkring',
      'customer_complaint': 'Kundklagomål',
      'business_request': 'Företagsbegäran',
      'ai_error': 'AI-fel',
      'systematic_correction': 'Systematisk korrigering'
    };
    return labels[category] || category;
  };

  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toLocaleString('sv-SE', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  const formatCurrency = (amount: number): string => {
    return `${formatNumber(amount, 2)} SEK`;
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
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>✏️</div>
          Laddar poängändringar...
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
          ✏️ Manuella Poängändringar
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          margin: 0
        }}>
          Åsidosätt AI-poängsättning för kvalitetssäkring och korrigeringar
        </p>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
              {analytics.summary.totalOverrides.toLocaleString('sv-SE')}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Totalt Ändringar</div>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '4px' }}>
              {analytics.summary.pendingApproval}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Väntar Godkännande</div>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>
              {formatNumber(analytics.summary.averageScoreChange, 1)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Genomsnittlig Förändring</div>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '4px' }}>
              {formatCurrency(analytics.summary.totalRewardImpact)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Total Belöningspåverkan</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {[
          { id: 'individual', label: 'Individuell Ändring', icon: '🎯' },
          { id: 'bulk', label: 'Massändringar', icon: '📊' },
          { id: 'history', label: 'Historik', icon: '📋' },
          { id: 'analytics', label: 'Analys', icon: '📈' }
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

      {/* Individual Override Tab */}
      {selectedTab === 'individual' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
            🎯 Individuell Poängändring
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Feedback ID eller Sök:
              </label>
              <input
                type="text"
                value={selectedFeedback}
                onChange={(e) => setSelectedFeedback(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Ange feedback ID eller sökterm..."
              />
            </div>

            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Ny Poäng (0-100):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Ange ny poäng..."
              />
            </div>

            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Kategori:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="quality_assurance">Kvalitetssäkring</option>
                <option value="customer_complaint">Kundklagomål</option>
                <option value="business_request">Företagsbegäran</option>
                <option value="ai_error">AI-fel</option>
                <option value="systematic_correction">Systematisk korrigering</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Kort Anledning:
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="T.ex. 'AI missade emotionell koppling' eller 'Kunde rapporterade fel poäng'..."
              />
            </div>

            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Detaljerad Motivering (krävs för granskning):
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
                placeholder="Förklara detaljerat varför denna poängändring är nödvändig, vad AI missade, och hur den nya poängen är mer rättvisande..."
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setSelectedFeedback('');
                setNewScore('');
                setOverrideReason('');
                setJustification('');
                setCategory('quality_assurance');
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
              Återställ
            </button>
            <button
              onClick={submitIndividualOverride}
              disabled={!selectedFeedback || !newScore || !overrideReason || !justification}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: (!selectedFeedback || !newScore || !overrideReason || !justification) ? 0.5 : 1
              }}
            >
              Skicka för Granskning
            </button>
          </div>
        </div>
      )}

      {/* Other tabs */}
      {selectedTab !== 'individual' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '18px', color: '#64748b', marginBottom: '8px' }}>
            🚧
          </div>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            {selectedTab === 'bulk' && 'Massändringar kommer snart...'}
            {selectedTab === 'history' && 'Historik kommer snart...'}
            {selectedTab === 'analytics' && 'Analys kommer snart...'}
          </p>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: any) {
  return requireAuth(context, ['admin', 'super_admin']);
}

