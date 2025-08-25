import { useState, useEffect } from 'react';
import Widget, { WidgetConfig } from '../Widget';

// Swedish regional analytics data
interface RegionalData {
  region: string;
  population: number;
  activeCafes: number;
  totalFeedback: number;
  avgScore: number;
  topCategories: string[];
  rewardsPaid: number; // In SEK
  avgRewardPerFeedback: number;
  marketPenetration: number; // Percentage
  seasonalTrend: 'up' | 'down' | 'stable';
}

interface RegionalAnalytics {
  totalRegions: number;
  topPerformingRegion: string;
  totalRewardsPaid: number;
  avgMarketPenetration: number;
  regions: RegionalData[];
  insights: {
    bestPerforming: string;
    fastestGrowing: string;
    highestRewards: string;
    improvement: string;
  };
}

// Mock data for Swedish regions
const generateRegionalData = (): RegionalAnalytics => {
  const swedishRegions = [
    { name: 'Stockholm', population: 975551 },
    { name: 'Göteborg', population: 579281 },
    { name: 'Malmö', population: 316588 },
    { name: 'Uppsala', population: 230767 },
    { name: 'Linköping', population: 164616 },
    { name: 'Örebro', population: 156381 },
    { name: 'Västerås', population: 127799 },
    { name: 'Norrköping', population: 143171 }
  ];

  const regions = swedishRegions.slice(0, 6).map(city => {
    const baseCafes = Math.floor(city.population / 25000);
    const activeCafes = Math.max(1, baseCafes + Math.floor(Math.random() * 3) - 1);
    const totalFeedback = activeCafes * (20 + Math.floor(Math.random() * 40));
    const avgScore = 60 + Math.random() * 30;
    const rewardsPaid = totalFeedback * (15 + Math.random() * 25); // 15-40 SEK per feedback
    
    return {
      region: city.name,
      population: city.population,
      activeCafes,
      totalFeedback,
      avgScore,
      topCategories: ['Kaffe kvalitet', 'Service', 'Atmosfär'].slice(0, 2 + Math.floor(Math.random() * 2)),
      rewardsPaid,
      avgRewardPerFeedback: rewardsPaid / totalFeedback,
      marketPenetration: Math.min(95, (activeCafes / baseCafes) * 100),
      seasonalTrend: (['up', 'down', 'stable'] as const)[Math.floor(Math.random() * 3)]
    };
  });

  const sortedByScore = [...regions].sort((a, b) => b.avgScore - a.avgScore);
  const sortedByGrowth = [...regions].sort((a, b) => b.marketPenetration - a.marketPenetration);
  const sortedByRewards = [...regions].sort((a, b) => b.rewardsPaid - a.rewardsPaid);
  const needsImprovement = [...regions].sort((a, b) => a.avgScore - b.avgScore);

  return {
    totalRegions: regions.length,
    topPerformingRegion: sortedByScore[0].region,
    totalRewardsPaid: regions.reduce((sum, r) => sum + r.rewardsPaid, 0),
    avgMarketPenetration: regions.reduce((sum, r) => sum + r.marketPenetration, 0) / regions.length,
    regions: regions.sort((a, b) => b.avgScore - a.avgScore),
    insights: {
      bestPerforming: sortedByScore[0].region,
      fastestGrowing: sortedByGrowth[0].region,
      highestRewards: sortedByRewards[0].region,
      improvement: needsImprovement[0].region
    }
  };
};

interface SwedishRegionalAnalyticsProps {
  config: WidgetConfig;
  onConfigChange?: (config: WidgetConfig) => void;
}

export default function SwedishRegionalAnalytics({ config, onConfigChange }: SwedishRegionalAnalyticsProps) {
  const [analytics, setAnalytics] = useState<RegionalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const data = generateRegionalData();
      setAnalytics(data);
    } catch (err: any) {
      setError('Kunde inte ladda regional analys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const formatSEK = (amount: number): string => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('sv-SE').format(Math.round(num));
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up': return '#22c55e';
      case 'down': return '#ef4444';
      case 'stable': return '#64748b';
    }
  };

  return (
    <Widget
      config={config}
      onConfigChange={onConfigChange}
      onRefresh={loadAnalytics}
      loading={loading}
      error={error}
    >
      {analytics && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Summary Overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0369a1' }}>
                {analytics.totalRegions}
              </div>
              <div style={{ fontSize: '11px', color: '#0369a1' }}>
                Aktiva Regioner
              </div>
            </div>
            
            <div style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid '#bbf7d0'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#15803d' }}>
                {formatSEK(analytics.totalRewardsPaid)}
              </div>
              <div style={{ fontSize: '11px', color: '#15803d' }}>
                Total Belöningar
              </div>
            </div>
            
            <div style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#fefce8',
              borderRadius: '8px',
              border: '1px solid '#fde047'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a16207' }}>
                {analytics.avgMarketPenetration.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#a16207' }}>
                Snitt Marknadspenetration
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              margin: '0 0 12px 0'
            }}>
              Regionala Insikter
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '8px'
            }}>
              <div style={{
                fontSize: '12px',
                padding: '8px 10px',
                backgroundColor: '#ecfdf5',
                borderRadius: '6px',
                border: '1px solid #d1fae5'
              }}>
                <div style={{ color: '#065f46', fontWeight: '500' }}>🏆 Bästa Prestanda</div>
                <div style={{ color: '#047857' }}>{analytics.insights.bestPerforming}</div>
              </div>
              
              <div style={{
                fontSize: '12px',
                padding: '8px 10px',
                backgroundColor: '#eff6ff',
                borderRadius: '6px',
                border: '1px solid #dbeafe'
              }}>
                <div style={{ color: '#1e40af', fontWeight: '500' }}>🚀 Snabbast Växande</div>
                <div style={{ color: '#2563eb' }}>{analytics.insights.fastestGrowing}</div>
              </div>
              
              <div style={{
                fontSize: '12px',
                padding: '8px 10px',
                backgroundColor: '#fef3c7',
                borderRadius: '6px',
                border: '1px solid #fcd34d'
              }}>
                <div style={{ color: '#92400e', fontWeight: '500' }}>💰 Högsta Belöningar</div>
                <div style={{ color: '#d97706' }}>{analytics.insights.highestRewards}</div>
              </div>
              
              <div style={{
                fontSize: '12px',
                padding: '8px 10px',
                backgroundColor: '#fef2f2',
                borderRadius: '6px',
                border: '1px solid #fecaca'
              }}>
                <div style={{ color: '#b91c1c', fontWeight: '500' }}>⚠️ Behöver Förbättring</div>
                <div style={{ color: '#dc2626' }}>{analytics.insights.improvement}</div>
              </div>
            </div>
          </div>

          {/* Regional Performance Table */}
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              margin: '0 0 12px 0'
            }}>
              Regional Performance Detaljer
            </h4>
            
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#374151' }}>Region</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#374151' }}>Caféer</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#374151' }}>Betyg</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#374151' }}>Feedback</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#374151' }}>Belöningar</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#374151' }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.regions.map((region, index) => (
                    <tr 
                      key={region.region}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: selectedRegion === region.region ? '#f8fafc' : 'white',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedRegion(
                        selectedRegion === region.region ? null : region.region
                      )}
                    >
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {region.region}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {formatNumber(region.population)} inv • {region.marketPenetration.toFixed(1)}% penetration
                        </div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {region.activeCafes}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '10px',
                          backgroundColor: region.avgScore >= 75 ? '#dcfce7' : 
                                          region.avgScore >= 60 ? '#fef3c7' : '#fee2e2',
                          color: region.avgScore >= 75 ? '#166534' : 
                                region.avgScore >= 60 ? '#92400e' : '#b91c1c'
                        }}>
                          {region.avgScore.toFixed(1)}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {formatNumber(region.totalFeedback)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{formatSEK(region.rewardsPaid)}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {formatSEK(region.avgRewardPerFeedback)}/st
                        </div>
                      </td>
                      <td style={{ 
                        padding: '8px', 
                        textAlign: 'center',
                        color: getTrendColor(region.seasonalTrend)
                      }}>
                        {getTrendIcon(region.seasonalTrend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Selected Region Details */}
            {selectedRegion && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {(() => {
                  const region = analytics.regions.find(r => r.region === selectedRegion)!;
                  return (
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                        {region.region} - Detaljer
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        <div>Population: {formatNumber(region.population)} invånare</div>
                        <div>Marknadspenetration: {region.marketPenetration.toFixed(1)}%</div>
                        <div>Genomsnittlig belöning: {formatSEK(region.avgRewardPerFeedback)} per feedback</div>
                        <div>Populära kategorier: {region.topCategories.join(', ')}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </Widget>
  );
}