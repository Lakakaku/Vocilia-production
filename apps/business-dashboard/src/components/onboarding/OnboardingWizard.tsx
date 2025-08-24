'use client';

import { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  MapPin, 
  Settings, 
  Users, 
  CheckCircle
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCompleted: boolean;
  isActive: boolean;
}

interface OnboardingData {
  businessInfo: {
    name: string;
    organizationNumber: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
    email: string;
    website: string;
    description: string;
  };
  locations: Array<{
    name: string;
    address: string;
    city: string;
    postalCode: string;
    phone?: string;
    email?: string;
  }>;
  businessContext: {
    type: string;
    departments: string[];
    staff: Array<{
      name: string;
      role: string;
      department: string;
    }>;
    strengths: string[];
    knownIssues: string[];
    currentPromotions: string[];
  };
  teamMembers: Array<{
    name: string;
    email: string;
    role: string;
    locationIds: string[];
  }>;
}

const INITIAL_DATA: OnboardingData = {
  businessInfo: {
    name: '',
    organizationNumber: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: '',
    website: '',
    description: ''
  },
  locations: [],
  businessContext: {
    type: '',
    departments: [],
    staff: [],
    strengths: [],
    knownIssues: [],
    currentPromotions: []
  },
  teamMembers: []
};

export function OnboardingWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [isCompleting, setIsCompleting] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'business-info',
      title: 'Företagsinformation',
      description: 'Grundläggande information om ditt företag',
      icon: Building2,
      isCompleted: isBusinessInfoComplete(),
      isActive: currentStepIndex === 0
    },
    {
      id: 'locations',
      title: 'Platser',
      description: 'Lägg till dina affärsplatser',
      icon: MapPin,
      isCompleted: data.locations.length > 0,
      isActive: currentStepIndex === 1
    },
    {
      id: 'business-context',
      title: 'Verksamhetskontext',
      description: 'Konfigurera AI-systemet för din bransch',
      icon: Settings,
      isCompleted: isBusinessContextComplete(),
      isActive: currentStepIndex === 2
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Lägg till teammedlemmar och roller',
      icon: Users,
      isCompleted: data.teamMembers.length > 0,
      isActive: currentStepIndex === 3
    }
  ];

  function isBusinessInfoComplete(): boolean {
    const { businessInfo } = data;
    return !!(businessInfo.name && businessInfo.organizationNumber && 
              businessInfo.address && businessInfo.city && 
              businessInfo.email && businessInfo.phone);
  }

  function isBusinessContextComplete(): boolean {
    const { businessContext } = data;
    return !!(businessContext.type && businessContext.departments.length > 0);
  }

  function canProceedToNext(): boolean {
    return steps[currentStepIndex].isCompleted;
  }

  function canComplete(): boolean {
    return steps.every(step => step.isCompleted);
  }

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1 && canProceedToNext()) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = async () => {
    if (!canComplete()) return;
    
    setIsCompleting(true);
    
    try {
      // Simulate API call to save onboarding data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to dashboard or show success message
      console.log('Onboarding completed:', data);
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Välkommen till AI Feedback</h1>
          <p className="text-gray-600">Låt oss konfigurera ditt konto i några enkla steg</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Steps sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className={`flex items-center p-3 rounded-lg transition-colors ${
                      step.isActive
                        ? 'bg-primary-50 border-2 border-primary-200'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      step.isCompleted
                        ? 'bg-green-500 text-white'
                        : step.isActive
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                    }`}>
                      {step.isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        step.isActive ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Step content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {currentStepIndex === 0 && (
                <BusinessInfoStep 
                  data={data.businessInfo} 
                  onChange={(businessInfo) => setData({...data, businessInfo})} 
                />
              )}
              {currentStepIndex === 1 && (
                <LocationsStep 
                  data={data.locations} 
                  onChange={(locations) => setData({...data, locations})} 
                />
              )}
              {currentStepIndex === 2 && (
                <BusinessContextStep 
                  data={data.businessContext} 
                  onChange={(businessContext) => setData({...data, businessContext})} 
                />
              )}
              {currentStepIndex === 3 && (
                <TeamStep 
                  data={data.teamMembers} 
                  locations={data.locations}
                  onChange={(teamMembers) => setData({...data, teamMembers})} 
                />
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleBack}
                  disabled={currentStepIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Tillbaka
                </button>

                {currentStepIndex === steps.length - 1 ? (
                  <button
                    onClick={handleComplete}
                    disabled={!canComplete() || isCompleting}
                    className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isCompleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Slutför...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Slutför konfiguration
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={!canProceedToNext()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Nästa
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step components
function BusinessInfoStep({ data, onChange }: { 
  data: OnboardingData['businessInfo']; 
  onChange: (data: OnboardingData['businessInfo']) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Företagsinformation</h2>
        <p className="text-gray-600">Fyll i grundläggande information om ditt företag.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Företagsnamn *
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({...data, name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="Café Aurora AB"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organisationsnummer *
          </label>
          <input
            type="text"
            value={data.organizationNumber}
            onChange={(e) => onChange({...data, organizationNumber: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="556123-4567"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adress *
          </label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => onChange({...data, address: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="Storgatan 15"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stad *
          </label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => onChange({...data, city: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="Stockholm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postnummer *
          </label>
          <input
            type="text"
            value={data.postalCode}
            onChange={(e) => onChange({...data, postalCode: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="111 29"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefon *
          </label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => onChange({...data, phone: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="+46 8 123 456"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-post *
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange({...data, email: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="info@cafearura.se"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hemsida
          </label>
          <input
            type="url"
            value={data.website}
            onChange={(e) => onChange({...data, website: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="https://cafearura.se"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beskrivning av verksamhet
          </label>
          <textarea
            value={data.description}
            onChange={(e) => onChange({...data, description: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            rows={3}
            placeholder="Beskriv kort vad ert företag gör..."
          />
        </div>
      </div>
    </div>
  );
}

function LocationsStep({ data, onChange }: { 
  data: OnboardingData['locations']; 
  onChange: (data: OnboardingData['locations']) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: ''
  });

  const handleAddLocation = () => {
    setFormData({ name: '', address: '', city: '', postalCode: '', phone: '', email: '' });
    setEditIndex(null);
    setShowForm(true);
  };

  const handleEditLocation = (index: number) => {
    setFormData(data[index]);
    setEditIndex(index);
    setShowForm(true);
  };

  const handleSaveLocation = () => {
    if (editIndex !== null) {
      const updated = [...data];
      updated[editIndex] = formData;
      onChange(updated);
    } else {
      onChange([...data, formData]);
    }
    setShowForm(false);
  };

  const handleDeleteLocation = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Platser</h2>
        <p className="text-gray-600">Lägg till dina affärsplatser där kunder kan lämna feedback.</p>
      </div>

      {/* Existing locations */}
      <div className="space-y-3">
        {data.map((location, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">{location.name}</h3>
              <p className="text-sm text-gray-600">
                {location.address}, {location.city} {location.postalCode}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEditLocation(index)}
                className="text-primary-600 hover:text-primary-800 text-sm"
              >
                Redigera
              </button>
              <button
                onClick={() => handleDeleteLocation(index)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Ta bort
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add location button */}
      <button
        onClick={handleAddLocation}
        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-300 hover:text-primary-600"
      >
        + Lägg till plats
      </button>

      {/* Location form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editIndex !== null ? 'Redigera plats' : 'Lägg till plats'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Platsnamn *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adress *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stad *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postnummer *
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={!formData.name || !formData.address || !formData.city}
                className="flex-1 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 rounded-md"
              >
                {editIndex !== null ? 'Uppdatera' : 'Lägg till'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessContextStep({ data, onChange }: { 
  data: OnboardingData['businessContext']; 
  onChange: (data: OnboardingData['businessContext']) => void;
}) {
  const businessTypes = [
    { value: 'cafe', label: 'Kafé' },
    { value: 'restaurant', label: 'Restaurang' },
    { value: 'retail', label: 'Detaljhandel' },
    { value: 'grocery', label: 'Livsmedelsbutik' },
    { value: 'other', label: 'Annat' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Verksamhetskontext</h2>
        <p className="text-gray-600">
          Hjälp AI-systemet att förstå din verksamhet för bättre feedback-analys.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Verksamhetstyp *
        </label>
        <select
          value={data.type}
          onChange={(e) => onChange({...data, type: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Välj verksamhetstyp</option>
          {businessTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Avdelningar/områden *
        </label>
        <input
          type="text"
          placeholder="T.ex: Kök, Bar, Servering (separera med komma)"
          onChange={(e) => {
            const departments = e.target.value.split(',').map(d => d.trim()).filter(d => d);
            onChange({...data, departments});
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="text-xs text-gray-500 mt-1">Separera med komma</p>
      </div>
    </div>
  );
}

function TeamStep({ data, locations, onChange }: { 
  data: OnboardingData['teamMembers']; 
  locations: OnboardingData['locations'];
  onChange: (data: OnboardingData['teamMembers']) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Teammedlemmar</h2>
        <p className="text-gray-600">
          Lägg till teammedlemmar och hantera deras åtkomstbehörigheter.
        </p>
      </div>

      <div className="text-center py-8 text-gray-500">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p>Teamhantering kommer att vara tillgänglig efter att kontot är konfigurerat.</p>
        <p className="text-sm mt-2">Du kan alltid lägga till teammedlemmar senare via Användarsidan.</p>
      </div>

      <button
        onClick={() => onChange([{
          name: 'Exempelanvändare',
          email: 'exempel@cafearura.se',
          role: 'store_manager',
          locationIds: ['1']
        }])}
        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-300 hover:text-primary-600"
      >
        Hoppa över detta steg för nu
      </button>
    </div>
  );
}