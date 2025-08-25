import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { authManager, getCurrentUser, AdminUser } from '../utils/auth';

// Types for analytics and performance tracking
interface AnalyticsDashboard {
  overview: OverviewMetrics;
  tierDistribution: TierDistributionData;
  performance: PerformanceMetrics;
  revenue: RevenueAnalytics;
  trends: TrendAnalysis;
  benchmarks: BenchmarkData;
  forecasting: ForecastData;
  lastUpdated: string;
}

interface OverviewMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  totalRevenue: number;
  monthlyGrowth: number;
  avgPerformanceScore: number;
  platformCommission: number;
  customerSatisfaction: number;
  complianceRate: number;
}

interface TierDistributionData {
  tier1: { count: number; revenue: number; percentage: number };
  tier2: { count: number; revenue: number; percentage: number };
  tier3: { count: number; revenue: number; percentage: number };
  movements: {
    upgrades: number;
    downgrades: number;
    newBusiness: number;
    churnedBusiness: number;
  };
}

interface PerformanceMetrics {
  topPerformers: BusinessPerformance[];
  underperformers: BusinessPerformance[];
  avgMetrics: {
    performanceScore: number;
    customerSatisfaction: number;
    monthlyRevenue: number;
    growthRate: number;
  };
  industryComparison: IndustryBenchmark[];
}

interface BusinessPerformance {
  businessId: string;
  businessName: string;
  currentTier: number;
  performanceScore: number;
  monthlyRevenue: number;
  growthRate: number;
  customerSatisfaction: number;
  trend: 'up' | 'down' | 'stable';
}

interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  commissionEarned: number;
  revenueByTier: { tier: number; revenue: number; commission: number }[];
  revenueGrowth: number;
  projectedRevenue: number;
  topRevenueGenerators: BusinessPerformance[];
}

interface TrendAnalysis {
  businessGrowth: TrendData[];
  revenueGrowth: TrendData[];
  performanceGrowth: TrendData[];
  tierMovements: TierMovementData[];
}

interface TrendData {
  date: string;
  value: number;
  change: number;
}

interface TierMovementData {
  date: string;
  upgrades: number;
  downgrades: number;
  newBusinesses: number;
}

interface BenchmarkData {
  industryAverages: {
    performanceScore: number;
    customerSatisfaction: number;
    growthRate: number;
    churnRate: number;
  };
  ourPlatform: {
    performanceScore: number;
    customerSatisfaction: number;
    growthRate: number;
    churnRate: number;
  };
  competitivePosition: 'leading' | 'competitive' | 'lagging';
}

interface ForecastData {
  nextQuarter: {
    expectedBusinesses: number;
    expectedRevenue: number;
    expectedGrowth: number;
  };
  trends: {
    businessAcquisition: 'accelerating' | 'stable' | 'declining';
    revenueGrowth: 'accelerating' | 'stable' | 'declining';
    marketExpansion: 'high' | 'medium' | 'low';
  };
  riskFactors: string[];
  opportunities: string[];
}

interface IndustryBenchmark {
  industry: string;
  avgPerformance: number;
  avgSatisfaction: number;
  ourPerformance: number;
  ourSatisfaction: number;
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedWidget, setSelectedWidget] = useState<string>('overview');
  const router = useRouter();

  useEffect(() => {
    // Check authentication and permissions
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    // Check if user has analytics permissions
    if (!currentUser.permissions.includes('analytics:read') && 
        !currentUser.permissions.includes('system:read')) {
      router.push('/dashboard');
      return;
    }
    
    setUser(currentUser);
    loadAnalytics();
    setLoading(false);
  }, [router, selectedTimeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/analytics?timeRange=${selectedTimeRange}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.data.analytics);
        }
      } else {
        console.error('Failed to load analytics');
      }
    } catch (err) {
      console.error('Load analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (score: number, threshold: { good: number; warning: number }): string => {
    if (score >= threshold.good) return '#22c55e';
    if (score >= threshold.warning) return '#f59e0b';
    return '#ef4444';
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
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
            <p style={{ color: '#64748b' }}>Laddar analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || !analytics) {
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
              Business Analytics
            </h1>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>
              Omfattande prestationsanalys och tier-insights för strategiska beslut
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#f0f9ff',
              color: '#0369a1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              📊 Uppdaterad: {new Date(analytics.lastUpdated).toLocaleString('sv-SE')}
            </div>
            
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="week">Senaste veckan</option>
              <option value="month">Senaste månaden</option>
              <option value="quarter">Senaste kvartalet</option>
              <option value="year">Senaste året</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overview KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '8px' }}>
            {analytics.overview.totalBusinesses}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Totalt företag</div>
          <div style={{ fontSize: '12px', color: '#22c55e' }}>
            {analytics.overview.activeBusinesses} aktiva ({Math.round(analytics.overview.activeBusinesses / analytics.overview.totalBusinesses * 100)}%)
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#22c55e', marginBottom: '8px' }}>
            {formatCurrency(analytics.overview.totalRevenue)}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Total intäkt</div>
          <div style={{ 
            fontSize: '12px', 
            color: analytics.overview.monthlyGrowth >= 0 ? '#22c55e' : '#ef4444'
          }}>
            {analytics.overview.monthlyGrowth >= 0 ? '📈' : '📉'} {formatPercentage(Math.abs(analytics.overview.monthlyGrowth))} månadstillväxt
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: getPerformanceColor(analytics.overview.avgPerformanceScore, { good: 80, warning: 60 }), 
            marginBottom: '8px' 
          }}>
            {analytics.overview.avgPerformanceScore}/100
          </div>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Genomsnittlig prestanda</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Compliance: {analytics.overview.complianceRate}/100
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '8px' }}>
            {formatCurrency(analytics.overview.platformCommission)}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Plattformsprovision</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {formatPercentage(analytics.overview.platformCommission / analytics.overview.totalRevenue)} av total intäkt
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: getPerformanceColor(analytics.overview.customerSatisfaction, { good: 8, warning: 6 }), 
            marginBottom: '8px' 
          }}>
            {analytics.overview.customerSatisfaction.toFixed(1)}/10
          </div>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Kundnöjdhet</div>
          <div style={{ fontSize: '12px', color: '#22c55e' }}>
            🎯 Branschledande nivå
          </div>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {/* Tier Distribution Widget */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 Tier-fördelning & Rörelser
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {[
              { tier: 1, name: 'Starter', data: analytics.tierDistribution.tier1, color: '#22c55e' },
              { tier: 2, name: 'Professional', data: analytics.tierDistribution.tier2, color: '#3b82f6' },
              { tier: 3, name: 'Enterprise', data: analytics.tierDistribution.tier3, color: '#8b5cf6' }
            ].map(({ tier, name, data, color }) => (
              <div key={tier} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: color + '20',
                  border: `3px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color
                }}>
                  T{tier}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                  {name}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color, marginBottom: '4px' }}>
                  {data.count}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>
                  {formatCurrency(data.revenue)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {data.percentage.toFixed(1)}% av totalt
                </div>
              </div>
            ))}
          </div>

          <div style={{
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
              Månadens rörelser:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22c55e' }}>
                  ⬆️ {analytics.tierDistribution.movements.upgrades}
                </div>
                <div style={{ color: '#64748b' }}>Uppgraderingar</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>
                  ⬇️ {analytics.tierDistribution.movements.downgrades}
                </div>
                <div style={{ color: '#64748b' }}>Nedgraderingar</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>
                  ➕ {analytics.tierDistribution.movements.newBusiness}
                </div>
                <div style={{ color: '#64748b' }}>Nya företag</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>
                  ➖ {analytics.tierDistribution.movements.churnedBusiness}
                </div>
                <div style={{ color: '#64748b' }}>Avhoppade</div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Summary Widget */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🏆 Prestandasammanfattning
          </h3>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#16a34a', marginBottom: '12px' }}>
              Top Performers:
            </h4>
            {analytics.performance.topPerformers.slice(0, 3).map((business, index) => (
              <div key={business.businessId} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: index === 0 ? '#f0fdf4' : '#f8fafc',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: index === 0 ? '#22c55e' : index === 1 ? '#f59e0b' : '#8b5cf6',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginRight: '8px'
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#1e293b' }}>
                    {business.businessName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {business.performanceScore}/100 • T{business.currentTier} • {getTrendIcon(business.trend)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
              ⚠️ Behöver uppmärksamhet:
            </h4>
            <div style={{ fontSize: '12px', color: '#dc2626' }}>
              {analytics.performance.underperformers.length} företag under 70 poäng
            </div>
          </div>

          <div style={{
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>
              Plattformsgenomsnitt:
            </h4>
            <div style={{ fontSize: '11px', color: '#0369a1', lineHeight: '1.4' }}>
              Performance: {analytics.performance.avgMetrics.performanceScore}/100<br/>
              Nöjdhet: {analytics.performance.avgMetrics.customerSatisfaction.toFixed(1)}/10<br/>
              Tillväxt: {formatPercentage(analytics.performance.avgMetrics.growthRate)}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Analytics & Benchmarks */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {/* Revenue Widget */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💰 Intäktsanalys
          </h3>

          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                  {formatCurrency(analytics.revenue.monthlyRevenue)}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Månadsintäkt</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold', 
                  color: analytics.revenue.revenueGrowth >= 0 ? '#22c55e' : '#ef4444'
                }}>
                  {analytics.revenue.revenueGrowth >= 0 ? '+' : ''}{formatPercentage(analytics.revenue.revenueGrowth)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>vs förra månaden</div>
              </div>
            </div>

            <div style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#8b5cf6',
              marginBottom: '8px'
            }}>
              {formatCurrency(analytics.revenue.commissionEarned)} provision
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Förväntad nästa månad: {formatCurrency(analytics.revenue.projectedRevenue)}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
              Intäkt per Tier:
            </h4>
            {analytics.revenue.revenueByTier.map(tier => {
              const tierNames = { 1: 'Starter', 2: 'Professional', 3: 'Enterprise' };
              const tierColors = { 1: '#22c55e', 2: '#3b82f6', 3: '#8b5cf6' };
              return (
                <div key={tier.tier} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: tierColors[tier.tier]
                    }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Tier {tier.tier} ({tierNames[tier.tier]})
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                      {formatCurrency(tier.revenue)}
                    </div>
                    <div style={{ fontSize: '11px', color: tierColors[tier.tier] }}>
                      {formatCurrency(tier.commission)} provision
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Industry Benchmarks Widget */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📈 Branschbenchmarks
          </h3>

          <div style={{
            backgroundColor: analytics.benchmarks.competitivePosition === 'leading' ? '#f0fdf4' :
                             analytics.benchmarks.competitivePosition === 'competitive' ? '#fef3c7' : '#fef2f2',
            border: `1px solid ${analytics.benchmarks.competitivePosition === 'leading' ? '#bbf7d0' :
                                  analytics.benchmarks.competitivePosition === 'competitive' ? '#fcd34d' : '#fecaca'}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: analytics.benchmarks.competitivePosition === 'leading' ? '#166534' :
                     analytics.benchmarks.competitivePosition === 'competitive' ? '#92400e' : '#dc2626',
              marginBottom: '8px'
            }}>
              {analytics.benchmarks.competitivePosition === 'leading' ? '🏆 Branschledande' :
               analytics.benchmarks.competitivePosition === 'competitive' ? '🎯 Konkurrenskraftig' : '⚠️ Under genomsnittet'}
            </div>
            <div style={{ 
              fontSize: '14px',
              color: analytics.benchmarks.competitivePosition === 'leading' ? '#166534' :
                     analytics.benchmarks.competitivePosition === 'competitive' ? '#92400e' : '#dc2626'
            }}>
              Plattformen presterar {analytics.benchmarks.competitivePosition === 'leading' ? 'över' :
                                    analytics.benchmarks.competitivePosition === 'competitive' ? 'i nivå med' : 'under'} branschgenomsnittet
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Performance Score', our: analytics.benchmarks.ourPlatform.performanceScore, industry: analytics.benchmarks.industryAverages.performanceScore, unit: '/100' },
              { label: 'Kundnöjdhet', our: analytics.benchmarks.ourPlatform.customerSatisfaction, industry: analytics.benchmarks.industryAverages.customerSatisfaction, unit: '/10' },
              { label: 'Tillväxttakt', our: analytics.benchmarks.ourPlatform.growthRate * 100, industry: analytics.benchmarks.industryAverages.growthRate * 100, unit: '%' },
              { label: 'Churn Rate', our: analytics.benchmarks.ourPlatform.churnRate * 100, industry: analytics.benchmarks.industryAverages.churnRate * 100, unit: '%', inverse: true }
            ].map(metric => {
              const isOurBetter = metric.inverse ? metric.our < metric.industry : metric.our > metric.industry;
              return (
                <div key={metric.label}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>{metric.label}</span>
                    <span style={{ 
                      fontSize: '12px', 
                      color: isOurBetter ? '#22c55e' : '#ef4444',
                      fontWeight: '500'
                    }}>
                      {isOurBetter ? '↑' : '↓'} {Math.abs(((metric.our - metric.industry) / metric.industry * 100)).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#3b82f6', fontWeight: '500' }}>Vi:</span>
                        <span style={{ color: '#3b82f6', fontWeight: '600' }}>
                          {metric.our.toFixed(1)}{metric.unit}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(metric.our / Math.max(metric.our, metric.industry)) * 100}%`,
                          height: '100%',
                          backgroundColor: '#3b82f6'
                        }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Bransch:</span>
                        <span style={{ color: '#6b7280', fontWeight: '600' }}>
                          {metric.industry.toFixed(1)}{metric.unit}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(metric.industry / Math.max(metric.our, metric.industry)) * 100}%`,
                          height: '100%',
                          backgroundColor: '#6b7280'
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Forecasting & Trends */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1e293b',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🔮 Prognoser & Strategiska Insights
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          {/* Next Quarter Forecast */}
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#0369a1', marginBottom: '12px' }}>
              Nästa kvartal:
            </h4>
            <div style={{ fontSize: '14px', color: '#0369a1', lineHeight: '1.6' }}>
              <div><strong>Företag:</strong> {analytics.forecasting.nextQuarter.expectedBusinesses}</div>
              <div><strong>Intäkt:</strong> {formatCurrency(analytics.forecasting.nextQuarter.expectedRevenue)}</div>
              <div><strong>Tillväxt:</strong> {formatPercentage(analytics.forecasting.nextQuarter.expectedGrowth)}</div>
            </div>
          </div>

          {/* Market Trends */}
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#166534', marginBottom: '12px' }}>
              Marknadstrender:
            </h4>
            <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.6' }}>
              <div>🏢 Kundanskaffning: <strong>{analytics.forecasting.trends.businessAcquisition}</strong></div>
              <div>💰 Intäktstillväxt: <strong>{analytics.forecasting.trends.revenueGrowth}</strong></div>
              <div>🌍 Marknadsexpansion: <strong>{analytics.forecasting.trends.marketExpansion}</strong></div>
            </div>
          </div>

          {/* Strategic Opportunities */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', marginBottom: '12px' }}>
              Möjligheter:
            </h4>
            <ul style={{ 
              fontSize: '12px', 
              color: '#92400e', 
              lineHeight: '1.4',
              margin: 0,
              paddingLeft: '16px'
            }}>
              {analytics.forecasting.opportunities.slice(0, 3).map((opportunity, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>{opportunity}</li>
              ))}
            </ul>
          </div>
        </div>

        {analytics.forecasting.riskFactors.length > 0 && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
              ⚠️ Strategiska risker att övervaka:
            </h4>
            <ul style={{ 
              fontSize: '12px', 
              color: '#dc2626', 
              lineHeight: '1.4',
              margin: 0,
              paddingLeft: '16px'
            }}>
              {analytics.forecasting.riskFactors.slice(0, 3).map((risk, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>{risk}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

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