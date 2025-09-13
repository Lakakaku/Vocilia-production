'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Copy, Check, BookOpen } from 'lucide-react';

interface ContextTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  isDefault: boolean;
  context: {
    businessType: string;
    products: string[];
    services: string[];
    targetAudience: string;
    strengths: string[];
    knownIssues: string[];
    priorities: string[];
    staffStructure: string;
    physicalLayout: string;
    specialOffers: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

const defaultTemplates: ContextTemplate[] = [
  {
    id: '1',
    name: 'Café & Restaurang',
    type: 'cafe_restaurant',
    description: 'Mall för kaféer och restauranger med fokus på mat, service och atmosfär',
    isDefault: true,
    context: {
      businessType: 'Café & Restaurang',
      products: ['Kaffe', 'Bageri', 'Lunch', 'Snacks', 'Drycker'],
      services: ['Bordservice', 'Beställning i disk', 'Take away', 'Catering'],
      targetAudience: 'Lokala företagsanställda, studenter, och turister som söker kvalitetskaffe och färska måltider',
      strengths: ['Hemlagad mat', 'Mysig atmosfär', 'Lokala ingredienser', 'Vänlig personal'],
      knownIssues: ['Långa köer vid lunchtid', 'Begränsat antal sittplatser', 'WiFi-hastighet'],
      priorities: ['Snabb service', 'Matkvalitet', 'Kundtillfredsställelse', 'Atmosfär'],
      staffStructure: 'Kaféchefen, 2 baristas, 1 kökspersonal, 1 deltidsanställd',
      physicalLayout: 'Öppen planlösning med diskområde, 15 sittplatser, utomhusterrass sommartid',
      specialOffers: ['Lunchmenyer', 'Studentrabatt', 'Lojalitetskort', 'Säsongsspecialiteter']
    },
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date('2024-08-15'),
    usageCount: 23
  },
  {
    id: '2',
    name: 'Livsmedelsbutik',
    type: 'grocery_store',
    description: 'Mall för livsmedelsbutiker med fokus på produktsortiment och kundbetjäning',
    isDefault: true,
    context: {
      businessType: 'Livsmedelsbutik',
      products: ['Färsk mat', 'Mejeri', 'Bröd', 'Kött & fisk', 'Frukt & grönt', 'Hushållsartiklar'],
      services: ['Kassakvitton', 'Plastbärkassar', 'Hemkörning', 'Beställning online'],
      targetAudience: 'Lokala familjer och individer som handlar dagligvaror',
      strengths: ['Brett sortiment', 'Konkurrenskraftiga priser', 'Lokala leverantörer', 'Erfaren personal'],
      knownIssues: ['Köer vid kassan', 'Svårigheter att hitta produkter', 'Parkeringstillgänglighet'],
      priorities: ['Produktfräschhet', 'Prisnivå', 'Kassaeffektivitet', 'Butikslayout'],
      staffStructure: 'Butiksansvarig, 3 kassörer, 2 butikspersonal, 1 delikatessdisk',
      physicalLayout: 'Traditionell butikslayout med gångar, 4 kassor, kundservicedisk',
      specialOffers: ['Veckans erbjudanden', 'Medlemsrabatter', 'Kvantitetsrabatter']
    },
    createdAt: new Date('2024-07-15'),
    updatedAt: new Date('2024-08-10'),
    usageCount: 18
  },
  {
    id: '3',
    name: 'Klädbutik',
    type: 'clothing_store',
    description: 'Mall för klädbutiker med fokus på mode, stil och kundupplevelse',
    isDefault: true,
    context: {
      businessType: 'Klädbutik',
      products: ['Damkläder', 'Herrkläder', 'Accessoarer', 'Skor', 'Underkläder'],
      services: ['Provrum', 'Storleksrådgivning', 'Ändringar', 'Personlig styling', 'Returer'],
      targetAudience: 'Mode-medvetna personer i åldern 25-45 som värdesätter kvalitet och stil',
      strengths: ['Unikt sortiment', 'Personlig service', 'Trendmedvetenhet', 'Kvalitetsvarumärken'],
      knownIssues: ['Begränsat sortiment i vissa storlekar', 'Prisnivå', 'Säsongsrelaterade variationer'],
      priorities: ['Produktkvalitet', 'Modemedvetenhet', 'Kundservice', 'Butiksmiljö'],
      staffStructure: 'Butiksansvarig, 2 säljare med modekompetens, 1 kassör',
      physicalLayout: 'Öppen butik med tydlig merchandising, 3 provrum, kassakvitton vid ingång',
      specialOffers: ['Säsongsrea', 'Medlemsrabatter', 'Stylingkonsultationer', 'Lojalitetsprogram']
    },
    createdAt: new Date('2024-07-20'),
    updatedAt: new Date('2024-08-05'),
    usageCount: 12
  }
];

export function ContextTemplates() {
  const [templates, setTemplates] = useState<ContextTemplate[]>(defaultTemplates);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContextTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [newTemplate, setNewTemplate] = useState<Partial<ContextTemplate>>({
    name: '',
    description: '',
    type: 'custom',
    context: {
      businessType: '',
      products: [],
      services: [],
      targetAudience: '',
      strengths: [],
      knownIssues: [],
      priorities: [],
      staffStructure: '',
      physicalLayout: '',
      specialOffers: []
    }
  });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'default' && template.isDefault) ||
                         (filterType === 'custom' && !template.isDefault) ||
                         (filterType === template.type);
    
    return matchesSearch && matchesFilter;
  });

  const handleCreateTemplate = () => {
    const template: ContextTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name || 'Ny mall',
      type: newTemplate.type || 'custom',
      description: newTemplate.description || '',
      isDefault: false,
      context: newTemplate.context!,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };

    setTemplates(prev => [...prev, template]);
    setShowCreateModal(false);
    resetNewTemplate();
  };

  const handleUpdateTemplate = () => {
    if (!selectedTemplate) return;

    setTemplates(prev => prev.map(template => 
      template.id === selectedTemplate.id 
        ? { ...selectedTemplate, updatedAt: new Date() }
        : template
    ));
    setShowEditModal(false);
    setSelectedTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna mall?')) {
      setTemplates(prev => prev.filter(template => template.id !== id));
    }
  };

  const handleDuplicateTemplate = (template: ContextTemplate) => {
    const duplicated: ContextTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (kopia)`,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };

    setTemplates(prev => [...prev, duplicated]);
  };

  const resetNewTemplate = () => {
    setNewTemplate({
      name: '',
      description: '',
      type: 'custom',
      context: {
        businessType: '',
        products: [],
        services: [],
        targetAudience: '',
        strengths: [],
        knownIssues: [],
        priorities: [],
        staffStructure: '',
        physicalLayout: '',
        specialOffers: []
      }
    });
  };

  const updateArrayField = (
    field: keyof ContextTemplate['context'], 
    value: string[], 
    target: 'new' | 'edit'
  ) => {
    if (target === 'new') {
      setNewTemplate(prev => ({
        ...prev,
        context: {
          ...prev.context!,
          [field]: value
        }
      }));
    } else if (selectedTemplate) {
      setSelectedTemplate(prev => prev ? {
        ...prev,
        context: {
          ...prev.context,
          [field]: value
        }
      } : null);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-primary-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Kontext-mallar</h2>
            <p className="text-gray-600">Hantera och använd mallar för företagskontext</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Skapa ny mall</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Sök mallar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex space-x-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Alla mallar</option>
              <option value="default">Standardmallar</option>
              <option value="custom">Egna mallar</option>
              <option value="cafe_restaurant">Café & Restaurang</option>
              <option value="grocery_store">Livsmedelsbutik</option>
              <option value="clothing_store">Klädbutik</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.name}</h3>
                  <div className="flex items-center space-x-2 mb-2">
                    {template.isDefault ? (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        Standard
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                        Egen
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      Använd {template.usageCount} gånger
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowEditModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicateTemplate(template)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{template.description}</p>

              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-gray-700">Företagstyp:</span>
                  <p className="text-xs text-gray-600">{template.context.businessType}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-700">Produkter:</span>
                  <p className="text-xs text-gray-600">
                    {template.context.products.slice(0, 3).join(', ')}
                    {template.context.products.length > 3 && '...'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-700">Styrkor:</span>
                  <p className="text-xs text-gray-600">
                    {template.context.strengths.slice(0, 2).join(', ')}
                    {template.context.strengths.length > 2 && '...'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Uppdaterad {formatDate(template.updatedAt)}
                </span>
                <button className="bg-primary-600 text-white text-xs px-3 py-1 rounded hover:bg-primary-700 transition-colors">
                  Använd mall
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Inga mallar hittades som matchar dina kriterier</p>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Skapa ny mall</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mallnamn</label>
                  <input
                    type="text"
                    value={newTemplate.name || ''}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="t.ex. Min restaurang"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                  <select
                    value={newTemplate.type || 'custom'}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="custom">Anpassad</option>
                    <option value="cafe_restaurant">Café & Restaurang</option>
                    <option value="grocery_store">Livsmedelsbutik</option>
                    <option value="clothing_store">Klädbutik</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
                <textarea
                  value={newTemplate.description || ''}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Beskriv vad denna mall är avsedd för..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Företagstyp</label>
                  <input
                    type="text"
                    value={newTemplate.context?.businessType || ''}
                    onChange={(e) => setNewTemplate(prev => ({
                      ...prev,
                      context: { ...prev.context!, businessType: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="t.ex. Café & Restaurang"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Målgrupp</label>
                  <input
                    type="text"
                    value={newTemplate.context?.targetAudience || ''}
                    onChange={(e) => setNewTemplate(prev => ({
                      ...prev,
                      context: { ...prev.context!, targetAudience: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Beskriv er målgrupp..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetNewTemplate();
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Skapa mall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal - Similar structure but with selectedTemplate data */}
      {showEditModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Redigera mall: {selectedTemplate.name}</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mallnamn</label>
                  <input
                    type="text"
                    value={selectedTemplate.name}
                    onChange={(e) => setSelectedTemplate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={selectedTemplate.isDefault}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                  <select
                    value={selectedTemplate.type}
                    onChange={(e) => setSelectedTemplate(prev => prev ? ({ ...prev, type: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={selectedTemplate.isDefault}
                  >
                    <option value="custom">Anpassad</option>
                    <option value="cafe_restaurant">Café & Restaurang</option>
                    <option value="grocery_store">Livsmedelsbutik</option>
                    <option value="clothing_store">Klädbutik</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
                <textarea
                  value={selectedTemplate.description}
                  onChange={(e) => setSelectedTemplate(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Företagstyp</label>
                  <input
                    type="text"
                    value={selectedTemplate.context.businessType}
                    onChange={(e) => setSelectedTemplate(prev => prev ? ({
                      ...prev,
                      context: { ...prev.context, businessType: e.target.value }
                    }) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Målgrupp</label>
                  <input
                    type="text"
                    value={selectedTemplate.context.targetAudience}
                    onChange={(e) => setSelectedTemplate(prev => prev ? ({
                      ...prev,
                      context: { ...prev.context, targetAudience: e.target.value }
                    }) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleUpdateTemplate}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Spara ändringar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}