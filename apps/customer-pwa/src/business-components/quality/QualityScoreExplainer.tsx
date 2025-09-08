'use client';

import { useState } from 'react';
import { HelpCircle, TrendingUp, Target, BookOpen, Lightbulb, Star, AlertCircle, CheckCircle } from 'lucide-react';

// Types for quality explanation
interface QualityBreakdown {
  authenticity: {
    score: number;
    weight: number;
    explanation: string;
    factors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      description: string;
    }>;
    improvements: string[];
  };
  concreteness: {
    score: number;
    weight: number;
    explanation: string;
    factors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      description: string;
    }>;
    improvements: string[];
  };
  depth: {
    score: number;
    weight: number;
    explanation: string;
    factors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      description: string;
    }>;
    improvements: string[];
  };
}

interface QualityTip {
  category: 'authenticity' | 'concreteness' | 'depth';
  title: string;
  description: string;
  example: string;
  impact: 'high' | 'medium' | 'low';
}

const qualityTips: QualityTip[] = [
  {
    category: 'authenticity',
    title: 'Uppmuntra specifika detaljer',
    description: 'Ställ följdfrågor som hjälper kunder att ge mer specifik feedback',
    example: '"Vad var det specifikt med servicen som gjorde intryck?"',
    impact: 'high'
  },
  {
    category: 'authenticity',
    title: 'Fråga om förbättringar',
    description: 'Be kunder om konkreta förslag på förbättringar',
    example: '"Finns det något vi kunde gjort annorlunda idag?"',
    impact: 'high'
  },
  {
    category: 'concreteness',
    title: 'Efterfråga exempel',
    description: 'Uppmuntra kunder att ge specifika exempel på sin upplevelse',
    example: '"Kan du berätta mer om situationen med personalen?"',
    impact: 'high'
  },
  {
    category: 'concreteness',
    title: 'Fokusera på detaljer',
    description: 'Hjälp kunder att beskriva specifika aspekter av besöket',
    example: '"Vad tyckte du om atmosfären och miljön?"',
    impact: 'medium'
  },
  {
    category: 'depth',
    title: 'Utforska känslor',
    description: 'Be kunder beskriva hur upplevelsen påverkade dem',
    example: '"Hur kändes det att handla hos oss idag?"',
    impact: 'medium'
  },
  {
    category: 'depth',
    title: 'Fråga om återbesök',
    description: 'Utforska kundens framtida intentioner och varför',
    example: '"Skulle du rekommendera oss till vänner? Varför?"',
    impact: 'high'
  }
];

export function QualityScoreExplainer() {
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'tips' | 'examples'>('overview');

  // Mock data - would come from API in real implementation
  const mockBreakdown: QualityBreakdown = {
    authenticity: {
      score: 75.2,
      weight: 40,
      explanation: 'Feedback verkar äkta och stämmer överens med din verksamhetskontext. Kunder nämner specifika detaljer som visar de verkligen varit hos dig.',
      factors: [
        {
          factor: 'Verksamhetsdetaljer',
          impact: 'positive',
          description: 'Kunder nämner specifika produkter och avdelningar'
        },
        {
          factor: 'Personalnamn',
          impact: 'positive',
          description: 'Feedback inkluderar namn på personal'
        },
        {
          factor: 'Tidpunkt stämmer',
          impact: 'positive',
          description: 'Feedback matchar öppettider och verksamhet'
        },
        {
          factor: 'Generiska kommentarer',
          impact: 'negative',
          description: 'Vissa kommentarer är för allmänna'
        }
      ],
      improvements: [
        'Uppmuntra kunder att nämna specifika produkter eller personal',
        'Ställ följdfrågor om konkreta detaljer från besöket',
        'Be kunder beskriva vad som gjorde besöket unikt'
      ]
    },
    concreteness: {
      score: 71.8,
      weight: 30,
      explanation: 'Feedback innehåller bra specifik information, men kunde vara mer detaljerad inom vissa områden.',
      factors: [
        {
          factor: 'Specifika exempel',
          impact: 'positive',
          description: 'Kunder ger konkreta exempel på upplevelser'
        },
        {
          factor: 'Actionable feedback',
          impact: 'positive',
          description: 'Feedback innehåller användbar information'
        },
        {
          factor: 'Vaga beskrivningar',
          impact: 'negative',
          description: 'Vissa kommentarer saknar konkreta detaljer'
        }
      ],
      improvements: [
        'Be kunder att ge specifika exempel på vad som fungerade bra/dåligt',
        'Fråga efter förslag på konkreta förbättringar',
        'Uppmuntra beskrivningar av specifika situationer'
      ]
    },
    depth: {
      score: 73.5,
      weight: 30,
      explanation: 'Feedback visar reflektion och genomtänkta åsikter, men kunde gå djupare i analys och förslag.',
      factors: [
        {
          factor: 'Reflekterade svar',
          impact: 'positive',
          description: 'Kunder visar att de tänkt igenom sin upplevelse'
        },
        {
          factor: 'Känslomässig koppling',
          impact: 'positive',
          description: 'Feedback visar hur upplevelsen påverkade kunden'
        },
        {
          factor: 'Ytliga kommentarer',
          impact: 'negative',
          description: 'Vissa svar saknar djup och reflektion'
        }
      ],
      improvements: [
        'Ställ öppna frågor som kräver reflektion',
        'Uppmuntra kunder att förklara sina känslor och reaktioner',
        'Be om fördjupade förklaringar till varför något var bra/dåligt'
      ]
    }
  };

  const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-orange-600 bg-orange-100';
  };

  const exampleFeedback = {
    low: {
      score: 45,
      text: "Okej kaffe. Service var okej. Ganska bra.",
      issues: ["För generisk", "Inga specifika detaljer", "Ingen djupare reflektion"]
    },
    medium: {
      score: 65,
      text: "Bra kaffe och trevlig personal. Anna vid kassan var hjälpsam. Lokalen var ren och trivsam.",
      strengths: ["Nämner personal", "Specifika observationer"],
      issues: ["Kunde varit mer detaljerat", "Saknar förbättringsförslag"]
    },
    high: {
      score: 85,
      text: "Fantastisk upplevelse idag! Beställde cappuccino och kanelbulle - båda var perfekta. Maria bakom baren var otroligt kunnig och rekommenderade den lokala bönvarianten. Miljön var lugn trots lunch-rushen. Enda förbättringen skulle vara fler sittplatser vid fönstret. Kommer definitivt tillbaka och rekommendera till kollegor!",
      strengths: ["Mycket specifik", "Nämner personal och produkter", "Ger förbättringsförslag", "Visar reflektion och framtidsplaner"]
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <BookOpen className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kvalitetspoäng Förklaring</h2>
          <p className="text-gray-600">Förstå hur kvalitetspoängen beräknas och hur du kan förbättra dem</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'overview', label: 'Översikt', icon: Target },
          { key: 'breakdown', label: 'Detaljerat', icon: Star },
          { key: 'tips', label: 'Förbättringstips', icon: Lightbulb },
          { key: 'examples', label: 'Exempel', icon: BookOpen }
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
      <div className="bg-white">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Summary */}
            <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Så fungerar kvalitetspoängen</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-blue-600 font-bold text-lg">40%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Äkthet</h4>
                  <p className="text-sm text-gray-600 mt-1">Stämmer feedbacken med din verksamhet?</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-600 font-bold text-lg">30%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Konkrethet</h4>
                  <p className="text-sm text-gray-600 mt-1">Innehåller feedbacken specifika detaljer?</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-purple-600 font-bold text-lg">30%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Djup</h4>
                  <p className="text-sm text-gray-600 mt-1">Visar feedbacken reflektion och insikt?</p>
                </div>
              </div>
            </div>

            {/* Current Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(mockBreakdown).map(([key, data]) => (
                <div key={key} className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900 capitalize">
                      {key === 'authenticity' ? 'Äkthet' : key === 'concreteness' ? 'Konkrethet' : 'Djup'}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(data.score)}`}>
                      {data.score.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{data.explanation}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${data.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div className="space-y-8">
            {Object.entries(mockBreakdown).map(([key, data]) => (
              <div key={key} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 capitalize">
                    {key === 'authenticity' ? 'Äkthet' : key === 'concreteness' ? 'Konkrethet' : 'Djup'} ({data.weight}% av totala poängen)
                  </h3>
                  <span className={`px-4 py-2 rounded-full text-lg font-bold ${getScoreColor(data.score)}`}>
                    {data.score.toFixed(1)}
                  </span>
                </div>

                <p className="text-gray-700 mb-6">{data.explanation}</p>

                {/* Factors */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-semibold text-gray-900">Påverkande faktorer:</h4>
                  {data.factors.map((factor, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      {getImpactIcon(factor.impact)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">{factor.factor}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            factor.impact === 'positive' ? 'bg-green-100 text-green-800' :
                            factor.impact === 'negative' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {factor.impact === 'positive' ? 'Positiv' : factor.impact === 'negative' ? 'Negativ' : 'Neutral'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{factor.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Improvements */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                    Förbättringsförslag:
                  </h4>
                  <ul className="space-y-2">
                    {data.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span className="text-gray-700">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="space-y-6">
            <div className="card p-6 bg-yellow-50 border-yellow-200">
              <div className="flex items-center space-x-2 mb-2">
                <Lightbulb className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">Pro Tips för Högre Kvalitet</h3>
              </div>
              <p className="text-yellow-800">
                Dessa tips kan hjälpa dig att få mer värdefull feedback från dina kunder och höja kvalitetspoängen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {qualityTips.map((tip, index) => (
                <div key={index} className="card p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{tip.title}</h4>
                      <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                        tip.category === 'authenticity' ? 'bg-blue-100 text-blue-800' :
                        tip.category === 'concreteness' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {tip.category === 'authenticity' ? 'Äkthet' : 
                         tip.category === 'concreteness' ? 'Konkrethet' : 'Djup'}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      tip.impact === 'high' ? 'bg-red-100 text-red-800' :
                      tip.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tip.impact === 'high' ? 'Hög påverkan' : 
                       tip.impact === 'medium' ? 'Medel påverkan' : 'Låg påverkan'}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3">{tip.description}</p>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Exempel:</p>
                    <p className="text-sm italic text-gray-600">"{tip.example}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Feedback Exempel</h3>
              <p className="text-gray-600">Se skillnaden mellan låg, medium och hög kvalitetsfeedback</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Low Quality Example */}
              <div className="card p-6 border-red-200">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-600 font-bold text-xl">{exampleFeedback.low.score}</span>
                  </div>
                  <h4 className="font-semibold text-red-800">Låg Kvalitet</h4>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg mb-4">
                  <p className="text-sm italic text-gray-800">"{exampleFeedback.low.text}"</p>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Problem:</h5>
                  <ul className="space-y-1">
                    {exampleFeedback.low.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-2" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Medium Quality Example */}
              <div className="card p-6 border-yellow-200">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-yellow-600 font-bold text-xl">{exampleFeedback.medium.score}</span>
                  </div>
                  <h4 className="font-semibold text-yellow-800">Medium Kvalitet</h4>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                  <p className="text-sm italic text-gray-800">"{exampleFeedback.medium.text}"</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">Styrkor:</h5>
                    <ul className="space-y-1">
                      {exampleFeedback.medium.strengths.map((strength, index) => (
                        <li key={index} className="text-sm text-green-700 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-2" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-orange-700 mb-2">Kan förbättras:</h5>
                    <ul className="space-y-1">
                      {exampleFeedback.medium.issues.map((issue, index) => (
                        <li key={index} className="text-sm text-orange-700 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-2" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* High Quality Example */}
              <div className="card p-6 border-green-200">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-green-600 font-bold text-xl">{exampleFeedback.high.score}</span>
                  </div>
                  <h4 className="font-semibold text-green-800">Hög Kvalitet</h4>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg mb-4">
                  <p className="text-sm italic text-gray-800">"{exampleFeedback.high.text}"</p>
                </div>

                <div>
                  <h5 className="font-medium text-green-700 mb-2">Excellenta aspekter:</h5>
                  <ul className="space-y-1">
                    {exampleFeedback.high.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-green-700 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-2" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}