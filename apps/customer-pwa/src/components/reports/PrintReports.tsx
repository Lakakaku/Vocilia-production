'use client';

import { useState, useEffect } from 'react';
import { Printer, Download, FileText, Calendar, BarChart3, Users, MapPin, Settings, Eye } from 'lucide-react';

interface ReportConfig {
  id: string;
  name: string;
  sections: {
    summary: boolean;
    feedbackAnalytics: boolean;
    locationComparison: boolean;
    qualityTrends: boolean;
    staffPerformance: boolean;
    customerInsights: boolean;
    recommendations: boolean;
  };
  dateRange: {
    from: string;
    to: string;
  };
  locations: string[];
  format: 'pdf' | 'html';
  layout: 'portrait' | 'landscape';
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
  recommended: boolean;
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive-summary',
    name: 'Verkställande sammanfattning',
    description: 'Kortfattad rapport för ledning med nyckeltal och rekommendationer',
    sections: ['Sammanfattning', 'Nyckeltal', 'Trender', 'Rekommendationer'],
    recommended: true
  },
  {
    id: 'detailed-analytics',
    name: 'Detaljerad analys',
    description: 'Omfattande rapport med djupanalys av feedback och prestanda',
    sections: ['Alla sektioner', 'Grafer', 'Tabeller', 'Detaljerad statistik'],
    recommended: false
  },
  {
    id: 'location-comparison',
    name: 'Platssjämförelse',
    description: 'Jämför prestanda mellan olika butiker och platser',
    sections: ['Platsdata', 'Jämförelsetabeller', 'Ranking', 'Förbättringsområden'],
    recommended: false
  },
  {
    id: 'monthly-report',
    name: 'Månadsrapport',
    description: 'Standardrapport för månatlig uppföljning',
    sections: ['Månatlig utveckling', 'Feedback-trender', 'Kvalitetsmått'],
    recommended: true
  }
];

// Helper function to get Swedish date string
const getSwedishDateString = (date: Date): string => {
  const swedenTime = new Intl.DateTimeFormat('sv-SE', { 
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = swedenTime.formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
};

export function PrintReports() {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    id: '',
    name: 'Min rapport',
    sections: {
      summary: true,
      feedbackAnalytics: true,
      locationComparison: false,
      qualityTrends: true,
      staffPerformance: false,
      customerInsights: true,
      recommendations: true
    },
    dateRange: {
      from: getSwedishDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // 30 days ago in Swedish timezone
      to: getSwedishDateString(new Date()) // today in Swedish timezone
    },
    locations: ['all'],
    format: 'pdf',
    layout: 'portrait'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Configure sections based on template
    switch (templateId) {
      case 'executive-summary':
        setReportConfig(prev => ({
          ...prev,
          name: 'Verkställande sammanfattning',
          sections: {
            summary: true,
            feedbackAnalytics: true,
            locationComparison: false,
            qualityTrends: true,
            staffPerformance: false,
            customerInsights: false,
            recommendations: true
          }
        }));
        break;
      case 'detailed-analytics':
        setReportConfig(prev => ({
          ...prev,
          name: 'Detaljerad analys',
          sections: {
            summary: true,
            feedbackAnalytics: true,
            locationComparison: true,
            qualityTrends: true,
            staffPerformance: true,
            customerInsights: true,
            recommendations: true
          }
        }));
        break;
      case 'location-comparison':
        setReportConfig(prev => ({
          ...prev,
          name: 'Platssjämförelse',
          sections: {
            summary: false,
            feedbackAnalytics: true,
            locationComparison: true,
            qualityTrends: false,
            staffPerformance: true,
            customerInsights: false,
            recommendations: true
          }
        }));
        break;
      case 'monthly-report':
        setReportConfig(prev => ({
          ...prev,
          name: 'Månadsrapport',
          sections: {
            summary: true,
            feedbackAnalytics: true,
            locationComparison: false,
            qualityTrends: true,
            staffPerformance: false,
            customerInsights: true,
            recommendations: false
          }
        }));
        break;
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real implementation, this would:
    // 1. Collect data based on config
    // 2. Generate PDF or HTML
    // 3. Trigger download
    
    console.log('Generating report with config:', reportConfig);
    alert('Rapport genererad! (Detta är en demo - i verkligheten skulle rapporten laddas ner)');
    
    setIsGenerating(false);
  };

  const handlePreviewReport = () => {
    setShowPreview(true);
  };

  const updateSection = (section: keyof ReportConfig['sections'], enabled: boolean) => {
    setReportConfig(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: enabled
      }
    }));
  };

  const getSectionCount = () => {
    return Object.values(reportConfig.sections).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="w-8 h-8 text-primary-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Utskriftsvänliga rapporter</h2>
            <p className="text-gray-600">Skapa och anpassa rapporter för utskrift och presentation</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handlePreviewReport}
            disabled={getSectionCount() === 0}
            className="flex items-center space-x-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            <span>Förhandsgranska</span>
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || getSectionCount() === 0}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isGenerating ? 'Genererar...' : 'Generera rapport'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Templates */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rapportmallar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary-300 ${
                    selectedTemplate === template.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    {template.recommended && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Rekommenderad
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.sections.map((section) => (
                      <span
                        key={section}
                        className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Configuration */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rapportinställningar</h3>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rapportnamn</label>
                  <input
                    type="text"
                    value={reportConfig.name}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select
                    value={reportConfig.format}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, format: e.target.value as 'pdf' | 'html' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="pdf">PDF</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Tidsperiod</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="date"
                      value={reportConfig.dateRange.from}
                      onChange={(e) => setReportConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, from: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={reportConfig.dateRange.to}
                      onChange={(e) => setReportConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, to: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Inkludera sektioner ({getSectionCount()} valda)
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.summary}
                      onChange={(e) => updateSection('summary', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Sammanfattning</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.feedbackAnalytics}
                      onChange={(e) => updateSection('feedbackAnalytics', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Feedback-analys</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.locationComparison}
                      onChange={(e) => updateSection('locationComparison', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Platssjämförelse</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.qualityTrends}
                      onChange={(e) => updateSection('qualityTrends', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Kvalitetstrender</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.staffPerformance}
                      onChange={(e) => updateSection('staffPerformance', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Personalprestanda</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.customerInsights}
                      onChange={(e) => updateSection('customerInsights', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Kundinsikter</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportConfig.sections.recommendations}
                      onChange={(e) => updateSection('recommendations', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Rekommendationer</span>
                  </label>
                </div>
              </div>

              {/* Layout Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Layout</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="portrait"
                      checked={reportConfig.layout === 'portrait'}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, layout: e.target.value as 'portrait' | 'landscape' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Stående</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="landscape"
                      checked={reportConfig.layout === 'landscape'}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, layout: e.target.value as 'portrait' | 'landscape' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Liggande</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Förhandsvisning</h3>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                Förhandsvisning av din rapport kommer att visas här
              </p>
              <button
                onClick={handlePreviewReport}
                disabled={getSectionCount() === 0}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Ladda förhandsvisning
              </button>
            </div>

            {/* Report Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Rapportsammanfattning</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Namn:</span>
                  <span>{reportConfig.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Period:</span>
                  <span>{reportConfig.dateRange.from} - {reportConfig.dateRange.to}</span>
                </div>
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span>{reportConfig.format.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Layout:</span>
                  <span>{reportConfig.layout === 'portrait' ? 'Stående' : 'Liggande'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sektioner:</span>
                  <span>{getSectionCount()}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={handlePreviewReport}
                disabled={getSectionCount() === 0}
                className="w-full flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                <span>Förhandsgranska</span>
              </button>
              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Skriv ut</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Rapportförhandsvisning</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Mock Report Preview */}
              <div className="bg-white border rounded-lg p-8 print-styles">
                <div className="mb-8 print-header">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{reportConfig.name}</h1>
                  <p className="text-gray-600">
                    Period: {reportConfig.dateRange.from} - {reportConfig.dateRange.to}
                  </p>
                </div>

                {reportConfig.sections.summary && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Sammanfattning</h2>
                    <div className="grid grid-cols-3 gap-6 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">847</div>
                        <div className="text-sm text-gray-600">Totalt feedback</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">4.2/5</div>
                        <div className="text-sm text-gray-600">Genomsnittlig kvalitet</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">+15%</div>
                        <div className="text-sm text-gray-600">Förbättring</div>
                      </div>
                    </div>
                  </div>
                )}

                {reportConfig.sections.feedbackAnalytics && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Feedback-analys</h2>
                    <div className="bg-gray-100 h-40 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-8 h-8 text-gray-400" />
                      <span className="ml-2 text-gray-500">Diagram över feedback-trender</span>
                    </div>
                  </div>
                )}

                {reportConfig.sections.recommendations && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Rekommendationer</h2>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3"></div>
                        <span>Förbättra kassaprocessen för att minska väntetider</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3"></div>
                        <span>Utöka personalutbildning inom kundservice</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3"></div>
                        <span>Optimera butikslayout baserat på kundfeedback</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}