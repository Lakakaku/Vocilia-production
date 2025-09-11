'use client';

import { useState } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  X,
  Copy
} from 'lucide-react';
import { BusinessContextData, ContextImport } from '../../business-types/context';
import { contextService } from '../../business-services/context-service';

interface ContextImportExportProps {
  contextData: BusinessContextData;
  businessName?: string;
  onImportComplete?: (importedData: BusinessContextData) => void;
}

interface ImportPreview {
  data: BusinessContextData;
  metadata: {
    businessName: string;
    exportedAt: string;
    version: string;
  };
}

export function ContextImportExport({ 
  contextData, 
  businessName = 'Min Butik',
  onImportComplete 
}: ContextImportExportProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    contextService.downloadContextAsFile(contextData, businessName);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = contextService.parseImportFile(content);
      
      if (parsed) {
        setImportPreview(parsed);
        setSelectedCategories(['layout', 'staff', 'products', 'operations', 'customerPatterns']);
        setImportError(null);
      } else {
        setImportError('Ogiltigt filformat. Kontrollera att filen är en giltig JSON-export.');
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview) return;

    setImporting(true);
    setImportError(null);

    try {
      const importData: ContextImport = {
        contextData: importPreview.data,
        overwriteExisting,
        selectedCategories
      };

      const result = await contextService.importContext(importData);
      
      if (result.success && result.data) {
        onImportComplete?.(result.data);
        setShowImportDialog(false);
        setImportPreview(null);
        setSelectedCategories([]);
      } else {
        setImportError(result.error || 'Import misslyckades');
      }
    } catch (error) {
      setImportError('Ett oväntat fel inträffade under importen');
    } finally {
      setImporting(false);
    }
  };

  const getCategoryPreview = (category: string, data: any) => {
    switch (category) {
      case 'layout':
        return `${data?.departments?.length || 0} avdelningar, ${data?.specialAreas?.length || 0} specialområden`;
      case 'staff':
        return `${data?.employees?.length || 0} anställda`;
      case 'products':
        return `${data?.categories?.length || 0} kategorier, ${data?.popularItems?.length || 0} populära produkter`;
      case 'operations':
        const hasHours = data?.hours && Object.values(data.hours).some((h: any) => h?.open || h?.close);
        return `${hasHours ? 'Öppettider' : 'Inga öppettider'}, ${data?.peakTimes?.length || 0} topptider`;
      case 'customerPatterns':
        return `${data?.commonQuestions?.length || 0} vanliga frågor, ${data?.frequentComplaints?.length || 0} klagomål`;
      default:
        return 'Okänd kategori';
    }
  };

  const getCategoryTitle = (category: string) => {
    const titles: Record<string, string> = {
      layout: 'Butikslayout & Avdelningar',
      staff: 'Personal',
      products: 'Produkter & Tjänster',
      operations: 'Drift & Öppettider',
      customerPatterns: 'Kundmönster'
    };
    return titles[category] || category;
  };

  return (
    <div>
      {/* Export/Import buttons */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleExport}
          className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Exportera kontext</span>
        </button>

        <button
          onClick={() => setShowImportDialog(true)}
          className="flex items-center space-x-2 px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>Importera kontext</span>
        </button>
      </div>

      {/* Import dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Importera kontextdata</h3>
              <button
                onClick={() => {
                  setShowImportDialog(false);
                  setImportPreview(null);
                  setImportError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* File upload */}
              {!importPreview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Välj en kontextfil att importera
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileText className="w-10 h-10 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Klicka för att ladda upp</span> eller dra och släpp
                        </p>
                        <p className="text-xs text-gray-500">JSON-filer (MAX 1MB)</p>
                      </div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Import error */}
              {importError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <AlertTriangle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-800">{importError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Import preview */}
              {importPreview && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Import förhandsgranskning</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>Företag:</strong> {importPreview.metadata.businessName}</p>
                      <p><strong>Exporterad:</strong> {new Date(importPreview.metadata.exportedAt).toLocaleDateString('sv-SE')}</p>
                      <p><strong>Version:</strong> {importPreview.metadata.version}</p>
                    </div>
                  </div>

                  {/* Category selection */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Välj kategorier att importera</h4>
                    <div className="space-y-3">
                      {Object.keys(importPreview.data).map(category => (
                        <label key={category} className="flex items-start">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([...selectedCategories, category]);
                              } else {
                                setSelectedCategories(selectedCategories.filter(c => c !== category));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {getCategoryTitle(category)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {getCategoryPreview(category, importPreview.data[category as keyof BusinessContextData])}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Import options */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Importinställningar</h4>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Skriv över befintlig data (annars slås data ihop)
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Dialog actions */}
            {importPreview && (
              <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setImportPreview(null);
                    setImportError(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Välj annan fil
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCategories.length === 0}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    importing || selectedCategories.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {importing ? 'Importerar...' : 'Importera'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}