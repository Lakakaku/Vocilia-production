'use client';

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, MapPin, Users, Tag, AlertCircle, CheckCircle } from 'lucide-react';

// Types for business context
interface BusinessContext {
  id: string;
  type: 'grocery_store' | 'cafe' | 'restaurant' | 'retail';
  layout: {
    departments: string[];
    checkouts: number;
    selfCheckout: boolean;
  };
  staff: Array<{
    id: string;
    name: string;
    role: string;
    department: string;
    schedule?: string;
  }>;
  currentPromotions: string[];
  knownIssues: string[];
  strengths: string[];
  businessHours: {
    [key: string]: { open: string; close: string; closed?: boolean };
  };
  specialInfo: {
    paymentMethods: string[];
    languages: string[];
    specialFeatures: string[];
  };
}

const businessTypes = [
  { value: 'grocery_store', label: 'Livsmedelsbutik' },
  { value: 'cafe', label: 'Café' },
  { value: 'restaurant', label: 'Restaurang' },
  { value: 'retail', label: 'Detaljhandel' }
] as const;

const weekDays = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

const weekDayLabels: Record<string, string> = {
  monday: 'Måndag',
  tuesday: 'Tisdag', 
  wednesday: 'Onsdag',
  thursday: 'Torsdag',
  friday: 'Fredag',
  saturday: 'Lördag',
  sunday: 'Söndag'
};

export function BusinessContextManager() {
  const [context, setContext] = useState<BusinessContext>({
    id: '',
    type: 'cafe',
    layout: {
      departments: ['counter', 'seating'],
      checkouts: 1,
      selfCheckout: false
    },
    staff: [],
    currentPromotions: [],
    knownIssues: [],
    strengths: [],
    businessHours: {
      monday: { open: '07:00', close: '18:00' },
      tuesday: { open: '07:00', close: '18:00' },
      wednesday: { open: '07:00', close: '18:00' },
      thursday: { open: '07:00', close: '18:00' },
      friday: { open: '07:00', close: '18:00' },
      saturday: { open: '09:00', close: '17:00' },
      sunday: { closed: true, open: '', close: '' }
    },
    specialInfo: {
      paymentMethods: ['cash', 'card', 'mobile'],
      languages: ['svenska'],
      specialFeatures: []
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'staff' | 'operations' | 'advanced'>('basic');

  useEffect(() => {
    loadBusinessContext();
  }, []);

  const loadBusinessContext = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/business/context');
      // const data = await response.json();
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
    } catch (error) {
      console.error('Failed to load business context:', error);
      setLoading(false);
    }
  };

  const saveBusinessContext = async () => {
    try {
      setSaving(true);
      // TODO: Replace with actual API call  
      // const response = await fetch('/api/business/context', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(context)
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save business context:', error);
    } finally {
      setSaving(false);
    }
  };

  const addListItem = (field: keyof Pick<BusinessContext, 'currentPromotions' | 'knownIssues' | 'strengths'>) => {
    if (!newItem.trim()) return;
    
    setContext(prev => ({
      ...prev,
      [field]: [...prev[field], newItem.trim()]
    }));
    setNewItem('');
  };

  const removeListItem = (field: keyof Pick<BusinessContext, 'currentPromotions' | 'knownIssues' | 'strengths'>, index: number) => {
    setContext(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const addStaffMember = () => {
    const newStaff = {
      id: Date.now().toString(),
      name: '',
      role: '',
      department: '',
      schedule: ''
    };
    
    setContext(prev => ({
      ...prev,
      staff: [...prev.staff, newStaff]
    }));
  };

  const updateStaffMember = (index: number, field: keyof BusinessContext['staff'][0], value: string) => {
    setContext(prev => ({
      ...prev,
      staff: prev.staff.map((member, i) => 
        i === index ? { ...member, [field]: value } : member
      )
    }));
  };

  const removeStaffMember = (index: number) => {
    setContext(prev => ({
      ...prev,
      staff: prev.staff.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Verksamhetskontext</h2>
          <p className="text-gray-600">Konfigurera din verksamhet för mer precis AI-analys</p>
        </div>
        
        <button
          onClick={saveBusinessContext}
          disabled={saving}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            saved
              ? 'bg-green-100 text-green-700'
              : saving
              ? 'bg-gray-100 text-gray-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saved ? (
            <><CheckCircle className="w-4 h-4" /><span>Sparat!</span></>
          ) : saving ? (
            <><div className="w-4 h-4 animate-spin border-2 border-gray-300 border-t-gray-600 rounded-full"></div><span>Sparar...</span></>
          ) : (
            <><Save className="w-4 h-4" /><span>Spara</span></>
          )}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'basic', label: 'Grundläggande', icon: MapPin },
          { key: 'staff', label: 'Personal', icon: Users },
          { key: 'operations', label: 'Verksamhet', icon: Tag },
          { key: 'advanced', label: 'Avancerat', icon: AlertCircle }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verksamhetstyp
              </label>
              <select
                value={context.type}
                onChange={(e) => setContext(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {businessTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Antal kassor
                </label>
                <input
                  type="number"
                  min="1"
                  value={context.layout.checkouts}
                  onChange={(e) => setContext(prev => ({
                    ...prev,
                    layout: { ...prev.layout, checkouts: parseInt(e.target.value) || 1 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={context.layout.selfCheckout}
                    onChange={(e) => setContext(prev => ({
                      ...prev,
                      layout: { ...prev.layout, selfCheckout: e.target.checked }
                    }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Har självutcheckning</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avdelningar/Områden
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {context.layout.departments.map((dept, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {dept}
                    <button
                      onClick={() => setContext(prev => ({
                        ...prev,
                        layout: {
                          ...prev.layout,
                          departments: prev.layout.departments.filter((_, i) => i !== index)
                        }
                      }))}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ny avdelning..."
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    if (newItem.trim()) {
                      setContext(prev => ({
                        ...prev,
                        layout: {
                          ...prev.layout,
                          departments: [...prev.layout.departments, newItem.trim()]
                        }
                      }));
                      setNewItem('');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Personal</h3>
              <button
                onClick={addStaffMember}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Lägg till personal</span>
              </button>
            </div>

            {context.staff.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Ingen personal tillagd än</p>
              </div>
            ) : (
              <div className="space-y-4">
                {context.staff.map((member, index) => (
                  <div key={member.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Namn
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateStaffMember(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Namn"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Roll
                        </label>
                        <input
                          type="text"
                          value={member.role}
                          onChange={(e) => updateStaffMember(index, 'role', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="T.ex. Kassör, Kock"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Avdelning
                        </label>
                        <select
                          value={member.department}
                          onChange={(e) => updateStaffMember(index, 'department', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Välj avdelning</option>
                          {context.layout.departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeStaffMember(index)}
                          className="w-full px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Business Hours */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Öppettider</h3>
              <div className="space-y-3">
                {weekDays.map(day => (
                  <div key={day} className="flex items-center space-x-4">
                    <div className="w-24">
                      <label className="text-sm font-medium text-gray-700">
                        {weekDayLabels[day]}
                      </label>
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={!context.businessHours[day]?.closed}
                        onChange={(e) => setContext(prev => ({
                          ...prev,
                          businessHours: {
                            ...prev.businessHours,
                            [day]: {
                              ...prev.businessHours[day],
                              closed: !e.target.checked
                            }
                          }
                        }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-600">Öppet</span>
                    </label>
                    {!context.businessHours[day]?.closed && (
                      <>
                        <input
                          type="time"
                          value={context.businessHours[day]?.open || ''}
                          onChange={(e) => setContext(prev => ({
                            ...prev,
                            businessHours: {
                              ...prev.businessHours,
                              [day]: {
                                ...prev.businessHours[day],
                                open: e.target.value
                              }
                            }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                          type="time"
                          value={context.businessHours[day]?.close || ''}
                          onChange={(e) => setContext(prev => ({
                            ...prev,
                            businessHours: {
                              ...prev.businessHours,
                              [day]: {
                                ...prev.businessHours[day],
                                close: e.target.value
                              }
                            }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Promotions */}
            <ListSection
              title="Aktuella kampanjer"
              items={context.currentPromotions}
              onAdd={(item) => addListItem('currentPromotions')}
              onRemove={(index) => removeListItem('currentPromotions', index)}
              placeholder="T.ex. 20% på kaffe hela veckan"
              newItem={newItem}
              setNewItem={setNewItem}
            />

            {/* Known Issues */}
            <ListSection
              title="Kända problem/begränsningar"
              items={context.knownIssues}
              onAdd={(item) => addListItem('knownIssues')}
              onRemove={(index) => removeListItem('knownIssues', index)}
              placeholder="T.ex. Långsam WiFi, Stökig miljö"
              newItem={newItem}
              setNewItem={setNewItem}
            />

            {/* Strengths */}
            <ListSection
              title="Styrkor/Speciella funktioner"
              items={context.strengths}
              onAdd={(item) => addListItem('strengths')}
              onRemove={(index) => removeListItem('strengths', index)}
              placeholder="T.ex. Utmärkt service, Lokalproducerat"
              newItem={newItem}
              setNewItem={setNewItem}
            />
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Avancerade inställningar</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Dessa inställningar påverkar AI:ns förståelse av din verksamhet. Ändra bara om du vet vad du gör.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accepterade betalningsmetoder
              </label>
              <div className="space-y-2">
                {['cash', 'card', 'mobile', 'voucher'].map(method => (
                  <label key={method} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={context.specialInfo.paymentMethods.includes(method)}
                      onChange={(e) => {
                        setContext(prev => ({
                          ...prev,
                          specialInfo: {
                            ...prev.specialInfo,
                            paymentMethods: e.target.checked
                              ? [...prev.specialInfo.paymentMethods, method]
                              : prev.specialInfo.paymentMethods.filter(m => m !== method)
                          }
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      {method === 'cash' ? 'Kontant' :
                       method === 'card' ? 'Kort' :
                       method === 'mobile' ? 'Mobil (Swish etc)' : 'Kupong/Voucher'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Språk som talas av personal
              </label>
              <div className="space-y-2">
                {['svenska', 'engelska', 'arabiska', 'somaliska'].map(language => (
                  <label key={language} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={context.specialInfo.languages.includes(language)}
                      onChange={(e) => {
                        setContext(prev => ({
                          ...prev,
                          specialInfo: {
                            ...prev.specialInfo,
                            languages: e.target.checked
                              ? [...prev.specialInfo.languages, language]
                              : prev.specialInfo.languages.filter(l => l !== language)
                          }
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm text-gray-700 capitalize">{language}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for list sections
interface ListSectionProps {
  title: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  newItem: string;
  setNewItem: (item: string) => void;
}

function ListSection({ title, items, onAdd, onRemove, placeholder, newItem, setNewItem }: ListSectionProps) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-3">{title}</h4>
      <div className="space-y-2 mb-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
            <span className="text-sm text-gray-800">{item}</span>
            <button
              onClick={() => onRemove(index)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-gray-500 italic">Inget tillagt än</p>
        )}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <button
          onClick={() => {
            onAdd(newItem);
          }}
          disabled={!newItem.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}