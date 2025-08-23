'use client';

import { useState } from 'react';
import { Download, FileText, BarChart3, Calendar, Filter, Mail } from 'lucide-react';

interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  dateRange: {
    from: string;
    to: string;
  };
  dataType: 'feedback' | 'analytics' | 'staff' | 'complete';
  filters: {
    minQualityScore?: number;
    maxQualityScore?: number;
    categories?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative' | 'all';
    includePersonalData?: boolean;
  };
  email?: {
    enabled: boolean;
    recipients: string[];
    schedule?: 'once' | 'daily' | 'weekly' | 'monthly';
  };
}

const exportFormats = [
  { value: 'csv', label: 'CSV (Excel)', icon: FileText, description: 'Kommaseparerade värden för Excel' },
  { value: 'xlsx', label: 'Excel', icon: BarChart3, description: 'Microsoft Excel arbetsbok' },
  { value: 'pdf', label: 'PDF Rapport', icon: FileText, description: 'Formaterad rapport för presentation' },
  { value: 'json', label: 'JSON', icon: FileText, description: 'Strukturerad data för utvecklare' }
] as const;

const dataTypes = [
  { value: 'feedback', label: 'Feedback Data', description: 'All kundåterkoppling och betyg' },
  { value: 'analytics', label: 'Analytics', description: 'Trender, insikter och statistik' },
  { value: 'staff', label: 'Personaldata', description: 'Personalrelaterad feedback' },
  { value: 'complete', label: 'Komplett Rapport', description: 'All data kombinerad' }
] as const;

const availableCategories = [
  'Service', 'Produkter', 'Atmosfär', 'Priser', 'Renlighet', 'Tillgänglighet'
];

export function ExportManager() {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    },
    dataType: 'feedback',
    filters: {
      sentiment: 'all',
      includePersonalData: false
    },
    email: {
      enabled: false,
      recipients: []
    }
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [emailRecipient, setEmailRecipient] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate export progress
      const progressSteps = [
        'Hämtar feedback data...',
        'Bearbetar kvalitetspoäng...',
        'Genererar insikter...',
        'Skapar fil...',
        'Slutför export...'
      ];

      for (let i = 0; i < progressSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setExportProgress((i + 1) * 20);
      }

      // TODO: Replace with actual API call
      // const response = await fetch('/api/business/export', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(options)
      // });

      // Simulate file download
      const filename = `feedback-export-${options.dataType}-${new Date().toISOString().split('T')[0]}.${options.format}`;
      
      // Create a mock file blob
      let content: string;
      let mimeType: string;
      
      switch (options.format) {
        case 'csv':
          content = generateCSVContent();
          mimeType = 'text/csv';
          break;
        case 'json':
          content = generateJSONContent();
          mimeType = 'application/json';
          break;
        default:
          content = 'Mock export content';
          mimeType = 'text/plain';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Send email if configured
      if (options.email?.enabled) {
        // TODO: API call to send email
        console.log('Sending export via email to:', options.email.recipients);
      }

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export misslyckades. Försök igen.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const generateCSVContent = () => {
    const headers = [
      'Datum', 'Tid', 'Kvalitetspoäng', 'Äkthet', 'Konkrethet', 'Djup',
      'Kategori', 'Sentiment', 'Belöning (SEK)', 'Kommentar'
    ];
    
    const sampleData = [
      ['2024-12-19', '14:30', '76', '75', '78', '75', 'Service', 'Positiv', '23.50', 'Mycket bra service idag'],
      ['2024-12-19', '13:15', '82', '80', '85', '81', 'Produkter', 'Positiv', '31.20', 'Fantastiska bagels'],
      ['2024-12-18', '16:45', '65', '70', '60', '65', 'Atmosfär', 'Neutral', '15.75', 'Lite stökigt men okej kaffe']
    ];

    return [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
  };

  const generateJSONContent = () => {
    const sampleData = {
      exportInfo: {
        generatedAt: new Date().toISOString(),
        dateRange: options.dateRange,
        format: options.format,
        dataType: options.dataType,
        totalRecords: 247
      },
      summary: {
        averageQualityScore: 73.5,
        totalFeedback: 247,
        totalRewards: 2847,
        sentimentBreakdown: {
          positive: 168,
          neutral: 57,
          negative: 22
        }
      },
      feedback: [
        {
          id: 1,
          timestamp: '2024-12-19T14:30:00Z',
          qualityScore: { total: 76, authenticity: 75, concreteness: 78, depth: 75 },
          category: 'Service',
          sentiment: 'positive',
          rewardAmount: 23.50,
          transcription: 'Mycket bra service idag'
        }
      ]
    };

    return JSON.stringify(sampleData, null, 2);
  };

  const addEmailRecipient = () => {
    if (emailRecipient && emailRecipient.includes('@')) {
      setOptions(prev => ({
        ...prev,
        email: {
          ...prev.email!,
          recipients: [...(prev.email?.recipients || []), emailRecipient]
        }
      }));
      setEmailRecipient('');
    }
  };

  const removeEmailRecipient = (index: number) => {
    setOptions(prev => ({
      ...prev,
      email: {
        ...prev.email!,
        recipients: prev.email!.recipients.filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Exportera Data</h2>
        <p className="text-gray-600">Ladda ner dina feedback-data i valfritt format</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Export Format */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exportformat</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exportFormats.map(format => (
                <label key={format.value} className="relative">
                  <input
                    type="radio"
                    name="format"
                    value={format.value}
                    checked={options.format === format.value}
                    onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value as any }))}
                    className="sr-only peer"
                  />
                  <div className="border border-gray-200 rounded-lg p-4 cursor-pointer transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:border-gray-300">
                    <div className="flex items-center space-x-3">
                      <format.icon className="w-5 h-5 text-gray-400 peer-checked:text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-900">{format.label}</div>
                        <div className="text-sm text-gray-500">{format.description}</div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Data Type */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datatyp</h3>
            <div className="space-y-3">
              {dataTypes.map(type => (
                <label key={type.value} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="dataType"
                    value={type.value}
                    checked={options.dataType === type.value}
                    onChange={(e) => setOptions(prev => ({ ...prev, dataType: e.target.value as any }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-sm text-gray-500">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tidsperiod</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Från datum
                </label>
                <input
                  type="date"
                  value={options.dateRange.from}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, from: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Till datum
                </label>
                <input
                  type="date"
                  value={options.dateRange.to}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, to: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filter
            </h3>
            
            <div className="space-y-4">
              {/* Quality Score Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kvalitetspoäng (0-100)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={options.filters.minQualityScore || ''}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      filters: { ...prev.filters, minQualityScore: parseInt(e.target.value) || undefined }
                    }))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={options.filters.maxQualityScore || ''}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      filters: { ...prev.filters, maxQualityScore: parseInt(e.target.value) || undefined }
                    }))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sentiment
                </label>
                <select
                  value={options.filters.sentiment}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    filters: { ...prev.filters, sentiment: e.target.value as any }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Alla sentiment</option>
                  <option value="positive">Endast positiva</option>
                  <option value="neutral">Endast neutrala</option>
                  <option value="negative">Endast negativa</option>
                </select>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategorier
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {availableCategories.map(category => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.filters.categories?.includes(category) || false}
                        onChange={(e) => {
                          const categories = options.filters.categories || [];
                          setOptions(prev => ({
                            ...prev,
                            filters: {
                              ...prev.filters,
                              categories: e.target.checked
                                ? [...categories, category]
                                : categories.filter(c => c !== category)
                            }
                          }));
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Privacy Option */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.filters.includePersonalData || false}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      filters: { ...prev.filters, includePersonalData: e.target.checked }
                    }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Inkludera känslig data (kräver speciell behörighet)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Export Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Översikt</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Format:</span>
                <span className="font-medium">{exportFormats.find(f => f.value === options.format)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data:</span>
                <span className="font-medium">{dataTypes.find(d => d.value === options.dataType)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Period:</span>
                <span className="font-medium text-xs">
                  {options.dateRange.from} till {options.dateRange.to}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Uppskattat:</span>
                <span className="font-medium">~247 poster</span>
              </div>
            </div>

            {/* Export Button */}
            <div className="mt-6">
              {isExporting ? (
                <div className="space-y-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    Exporterar... {exportProgress}%
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Download className="w-5 h-5" />
                  <span>Exportera Nu</span>
                </button>
              )}
            </div>
          </div>

          {/* Email Options */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Email Rapport
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.email?.enabled || false}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    email: { ...prev.email!, enabled: e.target.checked }
                  }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Skicka via email</span>
              </label>

              {options.email?.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mottagare
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        placeholder="email@exempel.se"
                        value={emailRecipient}
                        onChange={(e) => setEmailRecipient(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={addEmailRecipient}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {options.email?.recipients && options.email.recipients.length > 0 && (
                    <div className="space-y-1">
                      {options.email.recipients.map((email, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                          <span>{email}</span>
                          <button
                            onClick={() => removeEmailRecipient(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Schema
                    </label>
                    <select
                      value={options.email?.schedule || 'once'}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        email: { ...prev.email!, schedule: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="once">En gång</option>
                      <option value="daily">Dagligen</option>
                      <option value="weekly">Veckovis</option>
                      <option value="monthly">Månadsvis</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}