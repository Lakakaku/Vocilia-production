'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Database, 
  Save, 
  CheckCircle, 
  AlertCircle,
  Info,
  Loader2
} from 'lucide-react';
import { ContextManager } from '../../../business-components/context/ContextManager';
import { ContextImportExport } from '../../../business-components/context/ContextImportExport';
import { BusinessContextData } from '../../../business-types/context';
import { contextService } from '../../../business-services/context-service';

export default function ContextPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contextData, setContextData] = useState<BusinessContextData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const accessToken = localStorage.getItem('ai-feedback-access-token');
        if (!accessToken) {
          router.push('/business/login');
          return;
        }

        // Verify authentication and load context data
        await loadContextData();
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/business/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadContextData = async () => {
    try {
      const result = await contextService.getContext();
      
      if (result.success && result.data) {
        setContextData(result.data);
        setLastSaved(result.data?.lastUpdated ? new Date(result.data.lastUpdated) : null);
      } else {
        console.error('Failed to load context data:', result.error);
        // Initialize empty context data
        initializeEmptyContext();
      }
    } catch (error) {
      console.error('Error loading context data:', error);
      initializeEmptyContext();
    }
  };

  const initializeEmptyContext = () => {
    setContextData({
      layout: {
        departments: [],
        checkouts: 1,
        selfCheckout: false,
        specialAreas: []
      },
      staff: {
        employees: []
      },
      products: {
        categories: [],
        seasonal: [],
        notOffered: [],
        popularItems: []
      },
      operations: {
        hours: {
          monday: { open: '', close: '', closed: false },
          tuesday: { open: '', close: '', closed: false },
          wednesday: { open: '', close: '', closed: false },
          thursday: { open: '', close: '', closed: false },
          friday: { open: '', close: '', closed: false },
          saturday: { open: '', close: '', closed: false },
          sunday: { open: '', close: '', closed: true }
        },
        peakTimes: [],
        challenges: [],
        improvements: [],
        commonProcedures: []
      },
      customerPatterns: {
        commonQuestions: [],
        frequentComplaints: [],
        seasonalPatterns: [],
        positivePatterns: [],
        customerDemographics: []
      }
    });
  };

  const handleContextChange = (newContextData: BusinessContextData) => {
    setContextData(newContextData);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!contextData) return;

    setSaving(true);
    try {
      const result = await contextService.saveContext(contextData);
      
      if (result.success) {
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        // Show success toast or notification
      } else {
        throw new Error(result.error || 'Failed to save context data');
      }
    } catch (error) {
      console.error('Error saving context data:', error);
      // Show error toast or notification
    } finally {
      setSaving(false);
    }
  };

  const handleImportComplete = (importedData: BusinessContextData) => {
    setContextData(importedData);
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  };

  const getCompletionScore = (): number => {
    if (!contextData) return 0;

    let totalFields = 0;
    let completedFields = 0;

    // Count layout fields
    totalFields += 4;
    if (contextData.layout.departments.length > 0) completedFields++;
    if (contextData.layout.checkouts > 0) completedFields++;
    if (contextData.layout.specialAreas.length > 0) completedFields++;
    completedFields++; // selfCheckout is always set

    // Count staff fields
    totalFields += 1;
    if (contextData.staff.employees.length > 0) completedFields++;

    // Count products fields
    totalFields += 3;
    if (contextData.products.categories.length > 0) completedFields++;
    if (contextData.products.popularItems.length > 0) completedFields++;
    if (contextData.products.notOffered.length > 0) completedFields++;

    // Count operations fields
    totalFields += 3;
    const hasHours = Object.values(contextData.operations.hours).some(h => h.open || h.close);
    if (hasHours) completedFields++;
    if (contextData.operations.peakTimes.length > 0) completedFields++;
    if (contextData.operations.challenges.length > 0) completedFields++;

    // Count customer patterns fields
    totalFields += 2;
    if (contextData.customerPatterns.commonQuestions.length > 0) completedFields++;
    if (contextData.customerPatterns.frequentComplaints.length > 0) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Laddar kontextdata...</p>
        </div>
      </div>
    );
  }

  const completionScore = getCompletionScore();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Database className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Företagskontext</h1>
          </div>
          <p className="text-gray-600">
            Konfigurera detaljerad information om ditt företag för bättre AI-analys
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Completion indicator */}
          <div className="flex items-center space-x-2">
            {completionScore >= 80 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : completionScore >= 50 ? (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            ) : (
              <Info className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm text-gray-600">
              {completionScore}% komplett
            </span>
          </div>

          {/* Import/Export buttons */}
          <ContextImportExport
            contextData={contextData}
            businessName="Min Butik" // TODO: Get from user data
            onImportComplete={handleImportComplete}
          />

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              hasUnsavedChanges && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Sparar...' : 'Spara'}</span>
          </button>
        </div>
      </div>

      {/* Status indicator */}
      {lastSaved && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-sm text-green-800">
            Senast sparad: {lastSaved.toLocaleString('sv-SE')}
          </p>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            Du har osparade ändringar. Glöm inte att spara!
          </p>
        </div>
      )}

      {/* Context management interface */}
      {contextData && (
        <ContextManager
          contextData={contextData}
          onChange={handleContextChange}
          completionScore={completionScore}
        />
      )}
    </div>
  );
}