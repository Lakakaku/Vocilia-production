'use client';

import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Building2, 
  Users, 
  Package, 
  Clock, 
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { BusinessContextData } from '../../business-types/context';
import '../../styles/sonic-theme.css';

interface SonicContextManagerProps {
  contextData: BusinessContextData;
  onChange: (data: BusinessContextData) => void;
  completionScore: number;
}

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: string[];
}

export function SonicContextManager({ 
  contextData, 
  onChange, 
  completionScore 
}: SonicContextManagerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['layout']));

  const sections: SectionConfig[] = [
    {
      id: 'layout',
      title: 'Butikslayout & Avdelningar',
      description: 'Fysisk layout, avdelningar och specialområden',
      icon: <Building2 className="w-5 h-5" />,
      fields: ['departments', 'checkouts', 'selfCheckout', 'specialAreas']
    },
    {
      id: 'staff',
      title: 'Personal',
      description: 'Personalinformation och roller',
      icon: <Users className="w-5 h-5" />,
      fields: ['employees']
    },
    {
      id: 'products',
      title: 'Produkter & Tjänster',
      description: 'Produktkategorier och specialerbjudanden',
      icon: <Package className="w-5 h-5" />,
      fields: ['categories', 'seasonal', 'notOffered', 'popularItems']
    },
    {
      id: 'operations',
      title: 'Drift & Öppettider',
      description: 'Öppettider, topptider och utmaningar',
      icon: <Clock className="w-5 h-5" />,
      fields: ['hours', 'peakTimes', 'challenges', 'improvements']
    },
    {
      id: 'customerPatterns',
      title: 'Kundmönster',
      description: 'Vanliga frågor och beteendemönster',
      icon: <MessageSquare className="w-5 h-5" />,
      fields: ['commonQuestions', 'frequentComplaints', 'seasonalPatterns']
    }
  ];

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getSectionCompletion = (section: SectionConfig): number => {
    const sectionData = contextData[section.id as keyof BusinessContextData] as any;
    if (!sectionData) return 0;
    
    let completed = 0;
    let total = 0;
    
    section.fields.forEach(field => {
      total++;
      const value = sectionData[field];
      if (Array.isArray(value) && value.length > 0) {
        completed++;
      } else if (typeof value === 'boolean') {
        completed++;
      } else if (value && typeof value === 'object') {
        if (Object.values(value).some((v: any) => v)) {
          completed++;
        }
      } else if (value) {
        completed++;
      }
    });
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getCompletionIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (score >= 50) return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <Info className="w-5 h-5 text-red-600" />;
  };

  const addArrayItem = (section: string, field: string) => {
    const value = prompt(`Lägg till ${field === 'departments' ? 'avdelning' : field === 'employees' ? 'anställd' : 'värde'}:`);
    if (value) {
      const newData = { ...contextData };
      const sectionData = { ...(newData[section as keyof BusinessContextData] as any) };
      if (!Array.isArray(sectionData[field])) {
        sectionData[field] = [];
      }
      if (field === 'employees') {
        const role = prompt('Roll:');
        const department = prompt('Avdelning:');
        sectionData[field] = [...sectionData[field], { name: value, role, department }];
      } else {
        sectionData[field] = [...sectionData[field], value];
      }
      (newData as any)[section] = sectionData;
      onChange(newData);
    }
  };

  const removeArrayItem = (section: string, field: string, index: number) => {
    const newData = { ...contextData };
    const sectionData = { ...(newData[section as keyof BusinessContextData] as any) };
    sectionData[field] = sectionData[field].filter((_: any, i: number) => i !== index);
    (newData as any)[section] = sectionData;
    onChange(newData);
  };

  const updateField = (section: string, field: string, value: any) => {
    const newData = { ...contextData };
    const sectionData = { ...(newData[section as keyof BusinessContextData] as any) };
    sectionData[field] = value;
    (newData as any)[section] = sectionData;
    onChange(newData);
  };

  return (
    <div className="space-y-4">
      {/* Wave background pattern */}
      <div className="fixed inset-0 z-[-100] opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'var(--gradient-sonic-mesh)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        const sectionCompletion = getSectionCompletion(section);
        const sectionData = contextData[section.id as keyof BusinessContextData] as any;

        return (
          <div key={section.id} className="sonic-card sonic-breathing">
            <button
              onClick={() => toggleSection(section.id)}
              className="sonic-section-header w-full"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--gradient-low-freq)' }}>
                    {section.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ocean-primary)' }}>
                      {section.title}
                    </h3>
                    <p className="text-sm opacity-75">{section.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {getCompletionIcon(sectionCompletion)}
                    <div className="sonic-progress" style={{ width: '100px' }}>
                      <div 
                        className="sonic-progress-fill" 
                        style={{ width: `${sectionCompletion}%` }}
                      >
                        <div className="sonic-progress-pulse" />
                      </div>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-ocean-primary)' }}>
                      {sectionCompletion}%
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 sonic-oscillating" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="mt-6 space-y-4 animate-in slide-in-from-top">
                <hr className="border-t" style={{ borderColor: 'var(--color-border)' }} />
                
                {section.id === 'layout' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-ocean-primary)' }}>
                        Avdelningar
                      </label>
                      <div className="space-y-2">
                        {sectionData.departments?.map((dept: string, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg sonic-modulating" style={{ background: 'var(--elevation-1)' }}>
                            <span className="text-sm">{dept}</span>
                            <button
                              onClick={() => removeArrayItem('layout', 'departments', index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addArrayItem('layout', 'departments')}
                          className="sonic-btn-secondary flex items-center space-x-2 text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Lägg till</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-ocean-primary)' }}>
                        Antal kassor
                      </label>
                      <input
                        type="number"
                        value={sectionData.checkouts || 1}
                        onChange={(e) => updateField('layout', 'checkouts', parseInt(e.target.value))}
                        className="sonic-input"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sectionData.selfCheckout || false}
                          onChange={(e) => updateField('layout', 'selfCheckout', e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-ocean-primary)' }}>
                          Självscanning/Självkassa
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-ocean-primary)' }}>
                        Specialområden
                      </label>
                      <div className="space-y-2">
                        {sectionData.specialAreas?.map((area: string, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg sonic-modulating" style={{ background: 'var(--elevation-1)' }}>
                            <span className="text-sm">{area}</span>
                            <button
                              onClick={() => removeArrayItem('layout', 'specialAreas', index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addArrayItem('layout', 'specialAreas')}
                          className="sonic-btn-secondary flex items-center space-x-2 text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Lägg till</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {section.id === 'staff' && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-ocean-primary)' }}>
                      Anställda
                    </label>
                    <div className="space-y-2">
                      {sectionData.employees?.map((emp: any, index: number) => (
                        <div key={index} className="p-3 rounded-lg sonic-modulating" style={{ background: 'var(--elevation-1)' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{emp.name}</p>
                              <p className="text-sm opacity-75">{emp.role} - {emp.department}</p>
                            </div>
                            <button
                              onClick={() => removeArrayItem('staff', 'employees', index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('staff', 'employees')}
                        className="sonic-btn-secondary flex items-center space-x-2 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Lägg till anställd</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Add more section content as needed */}
              </div>
            )}
          </div>
        );
      })}

      {/* Waveform decoration at the bottom */}
      <div className="waveform-visualizer justify-center mt-8 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
    </div>
  );
}