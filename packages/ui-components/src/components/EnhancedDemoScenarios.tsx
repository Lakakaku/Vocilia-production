/**
 * Enhanced Demo Scenarios - Advanced Phase B Demo Environment
 * Additional scenarios and enhanced demo capabilities for Swedish Café Pilot
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { Switch } from './Switch';
import { ProgressBar } from './ProgressBar';
import { Select } from './Select';

// Enhanced scenario types
export interface EnhancedTourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'type' | 'wait' | 'scroll' | 'animate';
  duration?: number;
  content?: React.ReactNode;
  skipable?: boolean;
  prerequisites?: string[];
  data?: any; // Demo data for this step
  validation?: (element: Element) => boolean;
  onComplete?: () => void;
}

// New enhanced scenarios
export const ENHANCED_GUIDED_TOURS = {
  'swedish-cafe-owner': {
    id: 'swedish-cafe-owner',
    title: 'Svensk Café-ägare Upplevelse',
    description: 'Steg-för-steg guide för svenska café-ägare som vill förstå plattformen',
    duration: 15, // minutes
    difficulty: 'beginner',
    persona: 'cafe-owner',
    steps: [
      {
        id: 'welcome-swedish-business',
        title: 'Välkommen till AI Feedback Platform',
        description: 'En plattform designad för svenska små företag',
        target: '[data-tour="welcome-banner"]',
        position: 'center',
        content: (
          <div className="text-center max-w-md">
            <h3 className="text-xl font-bold mb-4 text-blue-600">🇸🇪 Välkommen!</h3>
            <p className="mb-4">Som svensk café-ägare kan du nu:</p>
            <ul className="text-left list-disc list-inside space-y-2">
              <li>Få betald kundåterföring i realtid</li>
              <li>Förstå vad kunderna verkligen tycker</li>
              <li>Förbättra din verksamhet med AI-insikter</li>
              <li>Belöna kunder för värdefull feedback</li>
            </ul>
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <strong>Pilotprogram:</strong> 3 caféer i Stockholm, Malmö och Göteborg
            </div>
          </div>
        )
      },
      {
        id: 'business-registration-flow',
        title: 'Företagsregistrering',
        description: 'Hur du registrerar ditt café på plattformen',
        target: '[data-tour="business-registration"]',
        position: 'right',
        action: 'click',
        data: {
          orgNumber: '556789-1234',
          businessName: 'Café Aurora',
          address: 'Storgatan 15, Stockholm',
          tier: 'Tier 1 (Små företag)'
        },
        content: (
          <div>
            <h4 className="font-bold mb-2">Registreringsprocess</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Organisationsnummer verifieras via Bolagsverket</li>
              <li>Stripe Connect-konto skapas automatiskt</li>
              <li>Affärsnivå väljs (Tier 1-3)</li>
              <li>POS-system integrering (Square, Shopify, Zettle)</li>
            </ol>
            <div className="mt-3 p-3 bg-blue-50 rounded">
              <strong>Demo data:</strong><br/>
              Org.nr: 556789-1234<br/>
              Namn: Café Aurora<br/>
              Plats: Stockholm
            </div>
          </div>
        )
      },
      {
        id: 'pos-integration-demo',
        title: 'Kassasystem Integration',
        description: 'Koppla din kassa (Zettle mest populärt i Sverige)',
        target: '[data-tour="pos-integration"]',
        position: 'bottom',
        action: 'click',
        content: (
          <div>
            <h4 className="font-bold mb-2">🔌 POS-system stöd</h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-yellow-50 rounded">
                <div className="font-bold">Zettle</div>
                <div className="text-xs text-green-600">Mest populärt i Sverige</div>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded">
                <div className="font-bold">Square</div>
                <div className="text-xs">International</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded">
                <div className="font-bold">Shopify</div>
                <div className="text-xs">E-handel + POS</div>
              </div>
            </div>
            <p className="text-sm">Systemet hittar automatiskt dina transaktioner och verifierar kundköp.</p>
          </div>
        )
      },
      {
        id: 'qr-code-placement',
        title: 'QR-kod Placering',
        description: 'Strategisk placering för maximal kunddeltagande',
        target: '[data-tour="qr-placement"]',
        position: 'left',
        content: (
          <div>
            <h4 className="font-bold mb-2">📱 Optimal QR-kod placering</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span><strong>Kassabord:</strong> Efter betalning</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span><strong>Kvitto:</strong> QR-kod på kvittot</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span><strong>Bord:</strong> Diskret bordstält</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                <span><strong>Vägg:</strong> Undvik för påträngande</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-green-50 rounded text-xs">
              💡 <strong>Tips:</strong> 3-5% av kunder ger feedback när QR-koden är väl placerad
            </div>
          </div>
        )
      },
      {
        id: 'customer-journey-walkthrough',
        title: 'Kundresan Genomgång',
        description: 'Förstå hela processen från kundens perspektiv',
        target: '[data-tour="customer-journey"]',
        position: 'center',
        action: 'animate',
        duration: 10,
        content: (
          <div className="max-w-lg">
            <h4 className="font-bold mb-3">🚶‍♀️ Kundresan (2-3 minuter)</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold mr-3">1</div>
                <div>
                  <strong>QR Skanning</strong>
                  <p className="text-sm text-gray-600">Kund skannar kod efter köp</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</div>
                <div>
                  <strong>Köpverifiering</strong>
                  <p className="text-sm text-gray-600">Belopp och tid verifieras mot POS</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold mr-3">3</div>
                <div>
                  <strong>Röstfeedback</strong>
                  <p className="text-sm text-gray-600">30-60 sekunder naturligt tal</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold mr-3">4</div>
                <div>
                  <strong>Direkt Belöning</strong>
                  <p className="text-sm text-gray-600">1-12% av köpet via Swish</p>
                </div>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'analytics-deep-dive',
        title: 'Analysverktyg för Företag',
        description: 'Hur du använder insikter för att förbättra verksamheten',
        target: '[data-tour="business-analytics"]',
        position: 'bottom',
        content: (
          <div>
            <h4 className="font-bold mb-2">📊 Affärsinsikter</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 p-2 rounded">
                <strong>Idag</strong><br/>
                <span className="text-2xl font-bold">23</span> feedback<br/>
                <span className="text-sm text-blue-600">↗️ +18% vs igår</span>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong>Kvalitet</strong><br/>
                <span className="text-2xl font-bold">76.4</span>/100<br/>
                <span className="text-sm text-green-600">🎯 Mål: >70</span>
              </div>
            </div>
            <p className="text-sm">AI kategoriserar feedback automatiskt: service, kvalitet, miljö, personal.</p>
          </div>
        )
      }
    ]
  },

  'peak-hour-simulation': {
    id: 'peak-hour-simulation',
    title: 'Rusningsperiod Simulation',
    description: 'Se hur systemet hanterar hög belastning under morgonrushen',
    duration: 8,
    difficulty: 'intermediate',
    persona: 'system-admin',
    steps: [
      {
        id: 'load-test-setup',
        title: 'Belastningstest Setup',
        description: 'Simulerar 50+ samtidiga feedback-sessioner',
        target: '[data-tour="load-simulator"]',
        position: 'top',
        action: 'click',
        content: (
          <div>
            <h4 className="font-bold mb-2">⚡ Belastningstest</h4>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>🏢 <strong>Scenario:</strong> Morgonrush Stockholm Central</div>
              <div>👥 <strong>Kunder:</strong> 50 samtidiga sessioner</div>
              <div>⏱️ <strong>Varaktighet:</strong> 5 minuter</div>
              <div>🤖 <strong>AI Model:</strong> qwen2:0.5b</div>
            </div>
            <div className="bg-yellow-50 p-2 rounded text-xs">
              <strong>Förväntade resultat:</strong> &lt;2s svarstid, 99.9% tillgänglighet
            </div>
          </div>
        )
      },
      {
        id: 'real-time-metrics',
        title: 'Realtidsstatistik',
        description: 'Följ systemets prestanda under belastning',
        target: '[data-tour="performance-metrics"]',
        position: 'right',
        action: 'wait',
        duration: 30,
        content: (
          <div>
            <h4 className="font-bold mb-2">📈 Prestanda Övervakning</h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span>Aktiva sessioner:</span>
                <span className="text-blue-600 font-bold" id="active-sessions">47</span>
              </div>
              <div className="flex justify-between">
                <span>Genomsnittlig svarstid:</span>
                <span className="text-green-600 font-bold" id="response-time">1.8s</span>
              </div>
              <div className="flex justify-between">
                <span>AI-bearbetningar/sek:</span>
                <span className="text-purple-600 font-bold" id="ai-processing">12.3</span>
              </div>
              <div className="flex justify-between">
                <span>Felfrekvens:</span>
                <span className="text-red-600 font-bold" id="error-rate">0.2%</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-green-50 rounded text-xs">
              ✅ Alla SLA-mål uppnådda under testet
            </div>
          </div>
        )
      },
      {
        id: 'capacity-analysis',
        title: 'Kapacitetsanalys',
        description: 'Resultaten visar systemets skalbarhet',
        target: '[data-tour="capacity-results"]',
        position: 'left',
        content: (
          <div>
            <h4 className="font-bold mb-2">🎯 Testresultat</h4>
            <div className="space-y-3">
              <div className="bg-green-50 p-3 rounded">
                <div className="font-bold text-green-700">✅ Framgångsrikt Test</div>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• 98.7% av sessioner slutförda</li>
                  <li>• Genomsnittlig kvalitetspoäng: 74.2</li>
                  <li>• Total belöningar: 2,847 SEK</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-2 rounded text-sm">
                <strong>Skalbarhet:</strong> Systemet kan hantera 100+ caféer samtidigt
              </div>
            </div>
          </div>
        )
      }
    ]
  },

  'fraud-detection-showcase': {
    id: 'fraud-detection-showcase',
    title: 'Bedrägeriskydd Demonstration',
    description: 'Se hur AI upptäcker och förhindrar bedrägeri',
    duration: 10,
    difficulty: 'advanced',
    persona: 'security-admin',
    steps: [
      {
        id: 'fraud-scenarios',
        title: 'Bedrägeri Scenarion',
        description: 'Olika typer av bedrägeri som systemet upptäcker',
        target: '[data-tour="fraud-types"]',
        position: 'center',
        content: (
          <div className="max-w-md">
            <h4 className="font-bold mb-3">🔒 Upptäckta Bedrägerier</h4>
            <div className="space-y-3">
              <div className="flex items-center p-2 bg-red-50 rounded">
                <span className="text-red-500 mr-2">⚠️</span>
                <div>
                  <strong>Duplicerat Innehåll</strong>
                  <p className="text-xs text-gray-600">Samma feedback från olika enheter</p>
                </div>
              </div>
              <div className="flex items-center p-2 bg-orange-50 rounded">
                <span className="text-orange-500 mr-2">🤖</span>
                <div>
                  <strong>AI-Genererad Text</strong>
                  <p className="text-xs text-gray-600">Upptäckt via språkanalys</p>
                </div>
              </div>
              <div className="flex items-center p-2 bg-yellow-50 rounded">
                <span className="text-yellow-500 mr-2">📍</span>
                <div>
                  <strong>Geografisk Anomali</strong>
                  <p className="text-xs text-gray-600">Omöjlig förflyttning</p>
                </div>
              </div>
              <div className="flex items-center p-2 bg-purple-50 rounded">
                <span className="text-purple-500 mr-2">📱</span>
                <div>
                  <strong>Enhetsfingeravtryck</strong>
                  <p className="text-xs text-gray-600">Misstänkt enhetsaktivitet</p>
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-sm text-gray-600">
              Bedrägeriskydd: 99.7% noggrannhet
            </div>
          </div>
        )
      },
      {
        id: 'ml-analysis',
        title: 'Maskininlärning Analys',
        description: 'Hur AI-modeller identifierar misstänkt beteende',
        target: '[data-tour="ml-fraud-detection"]',
        position: 'right',
        content: (
          <div>
            <h4 className="font-bold mb-2">🧠 AI Bedrägeriskydd</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-blue-50 p-2 rounded">
                <strong>Språkanalys:</strong> Upptäcker onaturliga formuleringar och ChatGPT-liknande text
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong>Röstanalys:</strong> Röstautenticitet och känsloanalys
              </div>
              <div className="bg-purple-50 p-2 rounded">
                <strong>Beteendemönster:</strong> Tidsmönster och interaktionsanalys
              </div>
              <div className="bg-orange-50 p-2 rounded">
                <strong>Kontextkontroll:</strong> Överensstämmer feedback med affärskontext
              </div>
            </div>
            <div className="mt-3 font-mono text-xs bg-gray-100 p-2 rounded">
              Riskpoäng: 0.12/1.00 (Låg risk)<br/>
              Autenticitet: 94.7%<br/>
              Åtgärd: Godkänn
            </div>
          </div>
        )
      }
    ]
  },

  'investor-presentation': {
    id: 'investor-presentation',
    title: 'Investerarpresentation',
    description: 'Professionell genomgång för potentiella investerare',
    duration: 20,
    difficulty: 'executive',
    persona: 'investor',
    steps: [
      {
        id: 'market-opportunity',
        title: 'Marknadsanalys',
        description: 'Svenska marknaden för kundåterföring',
        target: '[data-tour="market-analysis"]',
        position: 'center',
        content: (
          <div className="max-w-lg">
            <h4 className="font-bold text-xl mb-3">🇸🇪 Svensk Marknadsmöjlighet</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">127,000</div>
                <div className="text-sm">Små företag i Sverige</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">€18.2B</div>
                <div className="text-sm">Årlig omsättning HoReCa</div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-600">92%</div>
                <div className="text-sm">Företag utan feedback-system</div>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <div className="text-2xl font-bold text-orange-600">3.2x</div>
                <div className="text-sm">ROI från kundinsikter</div>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              <strong>Positionering:</strong> Första AI-drivna plattformen som kombinerar 
              röstfeedback med direkta belöningar på den svenska marknaden.
            </p>
          </div>
        )
      },
      {
        id: 'revenue-model',
        title: 'Intäktsmodell',
        description: 'Skalbar och lönsam affärsmodell',
        target: '[data-tour="revenue-model"]',
        position: 'bottom',
        content: (
          <div>
            <h4 className="font-bold mb-3">💰 Intäktsmodell</h4>
            <div className="space-y-3">
              <div className="bg-green-50 p-3 rounded">
                <strong>Provisionssystem (20%)</strong>
                <ul className="text-sm mt-1 list-disc list-inside">
                  <li>Tier 1: 20% av utbetalda belöningar</li>
                  <li>Tier 2: 18% för medelstora företag</li>
                  <li>Tier 3: 15% för stora kedjan</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <strong>Projektioner (År 3)</strong>
                <ul className="text-sm mt-1 list-disc list-inside">
                  <li>500 aktiva företag</li>
                  <li>50,000 månadsaktiva kunder</li>
                  <li>2.8M SEK månatlig ARR</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-3 rounded text-center">
                <strong>Break-even: Månad 18</strong><br/>
                <span className="text-sm">Baserat på konservativa uppskattningar</span>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'competitive-advantage',
        title: 'Konkurrensfördel',
        description: 'Unika värderingar och tekniska fördelar',
        target: '[data-tour="competitive-advantages"]',
        position: 'left',
        content: (
          <div>
            <h4 className="font-bold mb-3">🏆 Konkurrensfördel</h4>
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✅</span>
                <div>
                  <strong>AI-Driven Kvalitetsbedömning</strong>
                  <p className="text-sm text-gray-600">Första plattformen som använder AI för att bedöma feedbackkvalitet</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✅</span>
                <div>
                  <strong>Svensk Marknadsfokus</strong>
                  <p className="text-sm text-gray-600">Optimerad för svenska språket, GDPR och lokala betalningar</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✅</span>
                <div>
                  <strong>Omedelbar Belöning</strong>
                  <p className="text-sm text-gray-600">Swish-integration för direkta utbetalningar</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✅</span>
                <div>
                  <strong>POS-Integration</strong>
                  <p className="text-sm text-gray-600">Seamless integration med Zettle, Square, Shopify</p>
                </div>
              </div>
            </div>
          </div>
        )
      }
    ]
  },

  'technical-deep-dive': {
    id: 'technical-deep-dive',
    title: 'Teknisk Djupdykning',
    description: 'Avancerad teknisk genomgång för utvecklare och CTO:er',
    duration: 25,
    difficulty: 'expert',
    persona: 'technical-lead',
    steps: [
      {
        id: 'architecture-overview',
        title: 'Systemarkitektur',
        description: 'Mikrotjänster, AI-pipeline och skalbarhet',
        target: '[data-tour="system-architecture"]',
        position: 'center',
        content: (
          <div className="max-w-2xl">
            <h4 className="font-bold mb-3">🏗️ Systemarkitektur</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded text-center">
                <strong>Frontend</strong><br/>
                <span className="text-sm">Next.js PWA<br/>React + TypeScript</span>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <strong>Backend</strong><br/>
                <span className="text-sm">Node.js API<br/>PostgreSQL + Redis</span>
              </div>
              <div className="bg-purple-50 p-3 rounded text-center">
                <strong>AI Services</strong><br/>
                <span className="text-sm">Ollama + qwen2:0.5b<br/>WhisperX STT</span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <h5 className="font-bold mb-2">Teknisk Stack</h5>
              <ul className="text-sm space-y-1">
                <li><strong>AI:</strong> Local Ollama + OpenAI fallback</li>
                <li><strong>Voice:</strong> WhisperX STT + Multi-TTS</li>
                <li><strong>Database:</strong> Supabase (PostgreSQL)</li>
                <li><strong>Monitoring:</strong> Prometheus + Grafana</li>
                <li><strong>Deployment:</strong> Docker + Kubernetes</li>
              </ul>
            </div>
          </div>
        )
      },
      {
        id: 'ai-pipeline-detail',
        title: 'AI-Pipeline Detaljer',
        description: 'Steg-för-steg genomgång av AI-bearbetning',
        target: '[data-tour="ai-pipeline"]',
        position: 'right',
        action: 'animate',
        duration: 15,
        content: (
          <div>
            <h4 className="font-bold mb-3">🤖 AI-Pipeline</h4>
            <div className="space-y-3">
              <div className="border-l-4 border-blue-400 pl-3">
                <strong>1. Ljudbearbetning</strong>
                <ul className="text-sm mt-1 list-disc list-inside">
                  <li>WhisperX Swedish STT (99.2% noggrannhet)</li>
                  <li>Brusreducering och normalisering</li>
                  <li>Voice Activity Detection (VAD)</li>
                </ul>
              </div>
              <div className="border-l-4 border-green-400 pl-3">
                <strong>2. Språkanalys</strong>
                <ul className="text-sm mt-1 list-disc list-inside">
                  <li>qwen2:0.5b för kvalitetsbedömning</li>
                  <li>Sentiment analysis (VADER + custom)</li>
                  <li>Kategoriindelning (NER + klassificering)</li>
                </ul>
              </div>
              <div className="border-l-4 border-purple-400 pl-3">
                <strong>3. Bedrägeriskydd</strong>
                <ul className="text-sm mt-1 list-disc list-inside">
                  <li>ML-baserad autenticitetsanalys</li>
                  <li>Geografisk och temporal validering</li>
                  <li>Enhetsfingeravtryck</li>
                </ul>
              </div>
              <div className="border-l-4 border-orange-400 pl-3">
                <strong>4. Belöningsberäkning</strong>
                <ul className="text-sm mt-1 list-disc list-inside">
                  <li>3-komponent kvalitetspoäng</li>
                  <li>Tier-baserade belöningsgränser</li>
                  <li>Riskjusterad utbetalning</li>
                </ul>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'scalability-metrics',
        title: 'Skalbarhet & Prestanda',
        description: 'Tekniska mått och skalningsstrategi',
        target: '[data-tour="performance-metrics"]',
        position: 'bottom',
        content: (
          <div>
            <h4 className="font-bold mb-3">📊 Prestandamått</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 p-3 rounded">
                <strong>Nuvarande Prestanda</strong>
                <ul className="text-sm mt-2 space-y-1 font-mono">
                  <li>Voice latency: &lt;2s (95th percentile)</li>
                  <li>API response: &lt;500ms average</li>
                  <li>Concurrent users: 50+ tested</li>
                  <li>Uptime: 99.9% SLA</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <strong>Skalningsstrategi</strong>
                <ul className="text-sm mt-2 space-y-1">
                  <li>Horisontell AI-service scaling</li>
                  <li>Redis caching layer</li>
                  <li>Database connection pooling</li>
                  <li>CDN för statiska assets</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <strong>Projekterad Kapacitet (År 2)</strong><br/>
              <span className="text-sm">1000+ samtidiga användare, 50+ caféer, 500K månadsaktiva kunder</span>
            </div>
          </div>
        )
      }
    ]
  }
};

// Enhanced demo configuration
export interface EnhancedDemoConfig {
  enabled: boolean;
  autoReset: boolean;
  resetInterval: number;
  showMetrics: boolean;
  simulateLatency: boolean;
  dataMode: 'live' | 'demo' | 'mixed';
  persona?: keyof typeof PERSONAS;
  language?: 'sv' | 'en';
  customData?: any;
  onAnalytics?: (event: string, data: any) => void;
}

// Persona definitions for different user types
export const PERSONAS = {
  'cafe-owner': {
    name: 'Café Ägare',
    description: 'Svensk småföretagare som vill förstå kundåterföring',
    interests: ['customer-satisfaction', 'revenue', 'operations'],
    language: 'sv',
    experienceLevel: 'beginner'
  },
  'system-admin': {
    name: 'Systemadministratör',
    description: 'Teknisk personal som övervakar plattformen',
    interests: ['performance', 'monitoring', 'troubleshooting'],
    language: 'en',
    experienceLevel: 'advanced'
  },
  'security-admin': {
    name: 'Säkerhetsadministratör',
    description: 'Säkerhetsexpert som övervakar bedrägeriskydd',
    interests: ['fraud-prevention', 'security', 'compliance'],
    language: 'en',
    experienceLevel: 'expert'
  },
  'investor': {
    name: 'Investerare',
    description: 'Potentiell investerare som utvärderar möjligheter',
    interests: ['market-size', 'revenue-model', 'growth'],
    language: 'en',
    experienceLevel: 'executive'
  },
  'technical-lead': {
    name: 'Tech Lead',
    description: 'CTO/Lead Developer som utvärderar teknisk implementation',
    interests: ['architecture', 'scalability', 'technology-stack'],
    language: 'en',
    experienceLevel: 'expert'
  }
};

// Export enhanced tour data
export interface EnhancedTourData {
  tours: typeof ENHANCED_GUIDED_TOURS;
  personas: typeof PERSONAS;
  config: EnhancedDemoConfig;
}

export default {
  tours: ENHANCED_GUIDED_TOURS,
  personas: PERSONAS
};