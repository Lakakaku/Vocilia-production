import { useState, useEffect } from 'react';
import Widget, { WidgetConfig } from '../Widget';

// Swedish café performance metrics
interface CafeMetrics {
  totalCafes: number;
  activeCafes: number;
  avgFeedbackScore: number;
  topPerformingCafes: Array<{
    name: string;
    location: string;
    score: number;
    feedbackCount: number;
    avgTransactionAmount: number;
  }>;
  regionalPerformance: Array<{
    region: string;
    cafeCount: number;
    avgScore: number;
    totalFeedback: number;
  }>;
  feedbackTrends: {
    thisWeek: number;
    lastWeek: number;
    growth: number;
  };
  customerSatisfaction: {
    excellent: number; // 80-100
    good: number; // 60-79
    acceptable: number; // 40-59
    poor: number; // 0-39
  };
}

// Mock data generator for Swedish cafés
const generateMockCafeData = (): CafeMetrics => {
  const swedishCities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro'];
  const cafeNames = ['Café Lagom', 'Fika & Co', 'Kaffebaren', 'Espresso Huset', 'Café Mysig', 'Bryggaren'];
  
  const topPerformingCafes = Array.from({ length: 5 }, (_, i) => ({
    name: cafeNames[i],
    location: swedishCities[Math.floor(Math.random() * swedishCities.length)],
    score: 85 + Math.random() * 15, // 85-100 for top performers
    feedbackCount: 20 + Math.floor(Math.random() * 80),
    avgTransactionAmount: 45 + Math.random() * 35 // 45-80 SEK average
  }));

  const regionalPerformance = swedishCities.slice(0, 4).map(city => ({
    region: city,
    cafeCount: 3 + Math.floor(Math.random() * 8),
    avgScore: 65 + Math.random() * 25,
    totalFeedback: 50 + Math.floor(Math.random() * 150)
  }));

  return {
    totalCafes: 42,
    activeCafes: 38,
    avgFeedbackScore: 73.5,
    topPerformingCafes,
    regionalPerformance,
    feedbackTrends: {
      thisWeek: 156,
      lastWeek: 142,
      growth: 9.9
    },
    customerSatisfaction: {
      excellent: 28,
      good: 45,
      acceptable: 22,
      poor: 5
    }
  };
};

interface SwedishCafePerformanceProps {
  config: WidgetConfig;
  onConfigChange?: (config: WidgetConfig) => void;
}

export default function SwedishCafePerformance({ config, onConfigChange }: SwedishCafePerformanceProps) {
  const [metrics, setMetrics] = useState<CafeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, this would fetch from API
      const data = generateMockCafeData();
      setMetrics(data);
    } catch (err: any) {
      setError('Kunde inte ladda café-prestanda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#f59e0b';
    if (score >= 50) return '#ef4444';
    return '#dc2626';
  };

  return (
    <Widget
      config={config}
      onConfigChange={onConfigChange}
      onRefresh={loadMetrics}
      loading={loading}
      error={error}
    >
      {metrics && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                {metrics.activeCafes}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Aktiva Caféer
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: getScoreColor(metrics.avgFeedbackScore)
              }}>
                {metrics.avgFeedbackScore.toFixed(1)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Genomsnitt Betyg
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: metrics.feedbackTrends.growth > 0 ? '#22c55e' : '#ef4444'
              }}>
                +{metrics.feedbackTrends.growth}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Tillväxt denna vecka
              </div>
            </div>
          </div>

          {/* Top Performing Cafés */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              margin: '0 0 12px 0'
            }}>
              Toppresterade Caféer
            </h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {metrics.topPerformingCafes.map((cafe, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white',
                  borderRadius: '6px',
                  marginBottom: '4px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
                      {cafe.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {cafe.location} • {cafe.feedbackCount} feedback • {cafe.avgTransactionAmount.toFixed(0)} SEK snitt
                    </div>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: getScoreColor(cafe.score),
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: `${getScoreColor(cafe.score)}20`
                  }}>
                    {cafe.score.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regional Performance */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              margin: '0 0 12px 0'
            }}>
              Regional Prestanda
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px'
            }}>
              {metrics.regionalPerformance.map((region) => (
                <div key={region.region} style={{
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                    {region.region}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    {region.cafeCount} caféer • {region.totalFeedback} feedback
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: getScoreColor(region.avgScore)
                  }}>
                    {region.avgScore.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Satisfaction Breakdown */}
          <div>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              margin: '0 0 12px 0'
            }}>
              Kundnöjdhet Fördelning
            </h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                  Utmärkt (80-100)
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.customerSatisfaction.excellent}%`,
                    height: '100%',
                    backgroundColor: '#22c55e'
                  }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#22c55e', marginTop: '2px' }}>
                  {metrics.customerSatisfaction.excellent}%
                </div>
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                  Bra (60-79)
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.customerSatisfaction.good}%`,
                    height: '100%',
                    backgroundColor: '#3b82f6'
                  }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#3b82f6', marginTop: '2px' }}>
                  {metrics.customerSatisfaction.good}%
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                  Acceptabel (40-59)
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.customerSatisfaction.acceptable}%`,
                    height: '100%',
                    backgroundColor: '#f59e0b'
                  }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#f59e0b', marginTop: '2px' }}>
                  {metrics.customerSatisfaction.acceptable}%
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                  Dålig (0-39)
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.customerSatisfaction.poor}%`,
                    height: '100%',
                    backgroundColor: '#ef4444'
                  }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#ef4444', marginTop: '2px' }}>
                  {metrics.customerSatisfaction.poor}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Widget>
  );
}