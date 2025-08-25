import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { authManager, getCurrentUser, AdminUser } from '../utils/auth';

// Types for performance-based recommendations
interface BusinessPerformance {
  businessId: string;
  businessName: string;
  organizationNumber: string;
  currentTier: 1 | 2 | 3;
  metrics: {
    performanceScore: number;
    complianceScore: number;
    customerSatisfaction: number;
    monthlyRevenue: number;
    transactionVolume: number;
    customerRetention: number;
    averageOrderValue: number;
    growthRate: number;
    stabilityIndex: number;
  };
  recommendation: TierRecommendation;
  riskFactors: RiskFactor[];
  historicalData: HistoricalMetric[];
  lastUpdated: string;
}

interface TierRecommendation {
  action: 'upgrade' | 'maintain' | 'downgrade' | 'review';
  recommendedTier: 1 | 2 | 3;
  confidence: number; // 0-1
  reasoning: string[];
  expectedBenefits: string[];
  potentialRisks: string[];
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  priority: 'low' | 'medium' | 'high' | 'critical';
  aiInsights: {
    model: string;
    version: string;
    processedAt: string;
    dataPoints: number;
    trends: string[];
  };
}

interface RiskFactor {
  type: 'financial' | 'operational' | 'compliance' | 'market';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  mitigation?: string;
}

interface HistoricalMetric {
  date: string;
  tier: number;
  revenue: number;
  transactions: number;
  satisfaction: number;
}

interface RecommendationFilters {
  action: string;
  confidence: number;
  priority: string;
  tier: number | 'all';
}

export default function RecommendationsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessRecommendations, setBusinessRecommendations] = useState<BusinessPerformance[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessPerformance | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState<RecommendationFilters>({
    action: 'all',
    confidence: 0,
    priority: 'all',
    tier: 'all'
  });
  const [sortBy, setSortBy] = useState<'confidence' | 'priority' | 'performance' | 'revenue'>('confidence');
  const router = useRouter();

  useEffect(() => {
    // Check authentication and permissions
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    // Check if user has tier management permissions
    if (!currentUser.permissions.includes('analytics:read') && 
        !currentUser.permissions.includes('business:approve')) {
      router.push('/dashboard');
      return;
    }
    
    setUser(currentUser);
    loadRecommendations();
    setLoading(false);
  }, [router]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      
      const response = await authManager.makeAuthenticatedRequest('/api/admin/business/recommendations');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBusinessRecommendations(data.data.recommendations);
        }
      } else {
        console.error('Failed to load recommendations');
      }
    } catch (err) {
      console.error('Load recommendations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'upgrade': return '#22c55e';
      case 'maintain': return '#3b82f6';
      case 'downgrade': return '#f59e0b';
      case 'review': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getActionIcon = (action: string): string => {
    switch (action) {
      case 'upgrade': return '⬆️';
      case 'maintain': return '➡️';
      case 'downgrade': return '⬇️';
      case 'review': return '🔍';
      default: return '📊';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getFilteredRecommendations = (): BusinessPerformance[] => {
    let filtered = businessRecommendations;
    
    if (filters.action !== 'all') {
      filtered = filtered.filter(b => b.recommendation.action === filters.action);
    }
    
    if (filters.confidence > 0) {
      filtered = filtered.filter(b => b.recommendation.confidence >= filters.confidence / 100);
    }
    
    if (filters.priority !== 'all') {
      filtered = filtered.filter(b => b.recommendation.priority === filters.priority);
    }
    
    if (filters.tier !== 'all') {
      filtered = filtered.filter(b => b.currentTier === filters.tier);
    }
    
    // Sort by selected criteria
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.recommendation.confidence - a.recommendation.confidence;
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.recommendation.priority] - priorityOrder[a.recommendation.priority];
        case 'performance':
          return b.metrics.performanceScore - a.metrics.performanceScore;
        case 'revenue':
          return b.metrics.monthlyRevenue - a.metrics.monthlyRevenue;
        default:
          return 0;
      }
    });
  };

  const handleApplyRecommendation = async (business: BusinessPerformance) => {
    const confirmAction = confirm(`Är du säker på att du vill tillämpa rekommendationen för ${business.businessName}?

Åtgärd: ${business.recommendation.action === 'upgrade' ? 'Uppgradera' : 
           business.recommendation.action === 'downgrade' ? 'Nedgradera' : 
           business.recommendation.action === 'maintain' ? 'Bibehåll' : 'Granska'} till Tier ${business.recommendation.recommendedTier}

Säkerhet: ${Math.round(business.recommendation.confidence * 100)}%

Detta kommer att:
${business.recommendation.expectedBenefits.map(b => `• ${b}`).join('\n')}`);

    if (!confirmAction) {
      return;
    }

    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${business.businessId}/apply-recommendation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recommendationAction: business.recommendation.action,
            recommendedTier: business.recommendation.recommendedTier,
            confidence: business.recommendation.confidence,
            reasoning: business.recommendation.reasoning
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`Rekommendation tillämpades framgångsrikt!

${business.businessName} har ${business.recommendation.action === 'upgrade' ? 'uppgraderats' : 
  business.recommendation.action === 'downgrade' ? 'nedgraderats' : 'uppdaterats'} till Tier ${business.recommendation.recommendedTier}.

AI-rekommendations-ID: ${result.data.recommendationId}`);

          await loadRecommendations(); // Refresh data
        }
      } else {
        throw new Error('Failed to apply recommendation');
      }
    } catch (err: any) {
      console.error('Apply recommendation error:', err);
      alert('Kunde inte tillämpa rekommendation: ' + err.message);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#64748b' }}>Laddar AI-rekommendationer...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: '#1e293b',
              margin: '0 0 8px 0'
            }}>
              AI-rekommendationer
            </h1>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>
              Performance-baserade tier-rekommendationer med AI-analys
            </p>
          </div>
          
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f0f9ff',
            color: '#0369a1',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            🤖 AI-modell: GPT-4 Performance Analyzer v2.1
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
            {businessRecommendations.filter(b => b.recommendation.action === 'upgrade').length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Uppgraderingar</div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
            {businessRecommendations.filter(b => b.recommendation.action === 'maintain').length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Bibehåll</div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
            {businessRecommendations.filter(b => b.recommendation.priority === 'critical').length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Kritiska</div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
            {Math.round(businessRecommendations.reduce((sum, b) => sum + b.recommendation.confidence, 0) / businessRecommendations.length * 100)}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Genomsnittlig säkerhet</div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#1e293b',
          margin: '0 0 16px 0'
        }}>
          Filter och Sortering
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: '16px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Åtgärd:
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="all">Alla åtgärder</option>
              <option value="upgrade">Uppgradera</option>
              <option value="maintain">Bibehåll</option>
              <option value="downgrade">Nedgradera</option>
              <option value="review">Granska</option>
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Min. säkerhet: {filters.confidence}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={filters.confidence}
              onChange={(e) => setFilters(prev => ({ ...prev, confidence: parseInt(e.target.value) }))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Prioritet:
            </label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="all">Alla prioriteter</option>
              <option value="critical">Kritisk</option>
              <option value="high">Hög</option>
              <option value="medium">Medium</option>
              <option value="low">Låg</option>
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Sortera efter:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="confidence">Säkerhet</option>
              <option value="priority">Prioritet</option>
              <option value="performance">Performance</option>
              <option value="revenue">Intäkter</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div style={{ 
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            margin: '0 0 8px 0'
          }}>
            AI-rekommendationer ({getFilteredRecommendations().length})
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: '#64748b',
            margin: 0
          }}>
            Klicka på en rekommendation för detaljerad analys och åtgärder
          </p>
        </div>

        <div style={{ maxHeight: '800px', overflowY: 'auto' }}>
          {getFilteredRecommendations().map(business => (
            <div
              key={business.businessId}
              style={{
                padding: '20px',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                setSelectedBusiness(business);
                setShowDetailModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1e293b',
                      margin: 0
                    }}>
                      {business.businessName}
                    </h4>
                    
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: `Tier ${business.currentTier}` === 'Tier 1' ? '#22c55e20' : 
                                        `Tier ${business.currentTier}` === 'Tier 2' ? '#3b82f620' : '#8b5cf620',
                      color: `Tier ${business.currentTier}` === 'Tier 1' ? '#22c55e' : 
                             `Tier ${business.currentTier}` === 'Tier 2' ? '#3b82f6' : '#8b5cf6',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      Tier {business.currentTier}
                    </div>
                    
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: getActionColor(business.recommendation.action) + '20',
                      color: getActionColor(business.recommendation.action),
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {getActionIcon(business.recommendation.action)} {business.recommendation.action === 'upgrade' ? 'Uppgradera' :
                       business.recommendation.action === 'maintain' ? 'Bibehåll' :
                       business.recommendation.action === 'downgrade' ? 'Nedgradera' : 'Granska'}
                    </div>

                    <div style={{
                      padding: '2px 6px',
                      backgroundColor: getPriorityColor(business.recommendation.priority),
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}>
                      {business.recommendation.priority.toUpperCase()}
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '16px',
                    fontSize: '13px',
                    color: '#64748b',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <strong>Performance:</strong> {business.metrics.performanceScore}/100<br/>
                      <strong>Säkerhet:</strong> {Math.round(business.recommendation.confidence * 100)}%
                    </div>
                    <div>
                      <strong>Intäkter:</strong> {business.metrics.monthlyRevenue.toLocaleString('sv-SE')} SEK/månad<br/>
                      <strong>Tillväxt:</strong> {(business.metrics.growthRate * 100).toFixed(1)}%
                    </div>
                    <div>
                      <strong>Kundnöjdhet:</strong> {business.metrics.customerSatisfaction.toFixed(1)}/10<br/>
                      <strong>Stabilitet:</strong> {business.metrics.stabilityIndex.toFixed(1)}/10
                    </div>
                  </div>

                  {/* AI Reasoning Preview */}
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '12px',
                    marginTop: '8px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', marginBottom: '4px' }}>
                      🤖 AI-analys: Rekommendation till Tier {business.recommendation.recommendedTier}
                    </div>
                    <div style={{ fontSize: '12px', color: '#0369a1', lineHeight: '1.4' }}>
                      {business.recommendation.reasoning.slice(0, 2).join(' • ')}
                      {business.recommendation.reasoning.length > 2 && '...'}
                    </div>
                  </div>

                  {/* Risk Indicators */}
                  {business.riskFactors.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: '#dc2626'
                    }}>
                      ⚠️ {business.riskFactors.length} riskfaktor(er) identifierad(e)
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBusiness(business);
                      setShowDetailModal(true);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    📊 Detaljanalys
                  </button>
                  
                  {user.permissions.includes('tier:manage') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyRecommendation(business);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: getActionColor(business.recommendation.action),
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      ✨ Tillämpa
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {getFilteredRecommendations().length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#64748b',
            backgroundColor: '#f8fafc'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Inga rekommendationer att visa</h3>
            <p style={{ fontSize: '14px' }}>Det finns inga AI-rekommendationer som matchar de valda filtren.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedBusiness && (
        <RecommendationDetailModal
          business={selectedBusiness}
          onApply={user.permissions.includes('tier:manage') ? handleApplyRecommendation : undefined}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBusiness(null);
          }}
        />
      )}

      {/* CSS for loading animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}

// Recommendation Detail Modal Component
interface RecommendationDetailModalProps {
  business: BusinessPerformance;
  onApply?: (business: BusinessPerformance) => void;
  onClose: () => void;
}

function RecommendationDetailModal({ business, onApply, onClose }: RecommendationDetailModalProps) {
  const getMetricColor = (value: number, max: number = 100): string => {
    const percentage = (value / max) * 100;
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getRiskSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '900px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
          <div>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              marginBottom: '8px',
              color: '#1e293b'
            }}>
              {business.businessName}
            </h3>
            <p style={{ 
              color: '#64748b', 
              fontSize: '14px',
              margin: 0
            }}>
              Detaljerad AI-rekommendation och performance-analys
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Recommendation Summary */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '32px' }}>
              {business.recommendation.action === 'upgrade' ? '⬆️' :
               business.recommendation.action === 'maintain' ? '➡️' :
               business.recommendation.action === 'downgrade' ? '⬇️' : '🔍'}
            </div>
            <div>
              <h4 style={{ fontSize: '20px', fontWeight: '600', color: '#1e40af', margin: '0 0 4px 0' }}>
                {business.recommendation.action === 'upgrade' ? 'Uppgradera' :
                 business.recommendation.action === 'maintain' ? 'Bibehåll' :
                 business.recommendation.action === 'downgrade' ? 'Nedgradera' : 'Granska'} till Tier {business.recommendation.recommendedTier}
              </h4>
              <div style={{ fontSize: '14px', color: '#1e40af' }}>
                Säkerhet: {Math.round(business.recommendation.confidence * 100)}% • 
                Prioritet: {business.recommendation.priority} • 
                Tidsram: {business.recommendation.timeframe}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
              AI-resonemang:
            </h5>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#1e40af', lineHeight: '1.5' }}>
              {business.recommendation.reasoning.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#16a34a', marginBottom: '8px' }}>
                Förväntade fördelar:
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#16a34a', lineHeight: '1.4' }}>
                {business.recommendation.expectedBenefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>

            <div>
              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
                Potentiella risker:
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#dc2626', lineHeight: '1.4' }}>
                {business.recommendation.potentialRisks.map((risk, index) => (
                  <li key={index}>{risk}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
            Performance-mått
          </h4>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px'
          }}>
            {Object.entries({
              'Performance Score': { value: business.metrics.performanceScore, max: 100, unit: '/100' },
              'Compliance Score': { value: business.metrics.complianceScore, max: 100, unit: '/100' },
              'Kundnöjdhet': { value: business.metrics.customerSatisfaction, max: 10, unit: '/10' },
              'Månadsintäkter': { value: business.metrics.monthlyRevenue, max: 1000000, unit: ' SEK' },
              'Tillväxttakt': { value: business.metrics.growthRate * 100, max: 50, unit: '%' },
              'Stabilitet': { value: business.metrics.stabilityIndex, max: 10, unit: '/10' }
            }).map(([label, metric]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: getMetricColor(metric.value, metric.max),
                  marginBottom: '4px'
                }}>
                  {metric.value.toLocaleString('sv-SE')}{metric.unit}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {label}
                </div>
                <div style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '2px',
                  marginTop: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min((metric.value / metric.max) * 100, 100)}%`,
                    height: '100%',
                    backgroundColor: getMetricColor(metric.value, metric.max),
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Factors */}
        {business.riskFactors.length > 0 && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', marginBottom: '16px' }}>
              ⚠️ Identifierade riskfaktorer
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {business.riskFactors.map((risk, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      padding: '2px 6px',
                      backgroundColor: getRiskSeverityColor(risk.severity),
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}>
                      {risk.severity.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      {risk.type.charAt(0).toUpperCase() + risk.type.slice(1)} Risk
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                    <strong>Beskrivning:</strong> {risk.description}
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                    <strong>Påverkan:</strong> {risk.impact}
                  </div>
                  
                  {risk.mitigation && (
                    <div style={{ fontSize: '13px', color: '#16a34a' }}>
                      <strong>Åtgärd:</strong> {risk.mitigation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Model Information */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
            🤖 AI-modell information
          </h4>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
            <strong>Modell:</strong> {business.recommendation.aiInsights.model} v{business.recommendation.aiInsights.version}<br/>
            <strong>Analys utförd:</strong> {new Date(business.recommendation.aiInsights.processedAt).toLocaleString('sv-SE')}<br/>
            <strong>Datapunkter:</strong> {business.recommendation.aiInsights.dataPoints.toLocaleString('sv-SE')}<br/>
            <strong>Identifierade trender:</strong> {business.recommendation.aiInsights.trends.join(', ')}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Stäng
          </button>
          
          {onApply && (
            <button
              onClick={() => {
                onApply(business);
                onClose();
              }}
              style={{
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              ✨ Tillämpa rekommendation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}