#!/bin/bash

# Enhanced Demo Setup Script
# Sets up the complete Phase B+ demo environment with additional scenarios
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEMO_DIR="$PROJECT_ROOT/demo-enhanced"
UI_COMPONENTS_DIR="$PROJECT_ROOT/packages/ui-components/src/components"

echo -e "${PURPLE}🚀 Enhanced Demo Setup - Phase B+ Environment${NC}"
echo -e "${BLUE}Advanced Swedish Café Pilot Demo System${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        echo -e "${RED}❌ Node.js version 18+ required${NC}"
        exit 1
    fi
    
    # Check required tools
    for tool in npm npx git; do
        if ! command -v "$tool" &> /dev/null; then
            echo -e "${RED}❌ $tool is not installed${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to create enhanced demo structure
create_demo_structure() {
    echo -e "${YELLOW}📁 Creating enhanced demo structure...${NC}"
    
    # Create directories
    mkdir -p "$DEMO_DIR"/{src,public,docs,assets,scripts,data}
    mkdir -p "$DEMO_DIR/src"/{components,pages,services,utils,types,hooks}
    mkdir -p "$DEMO_DIR/data"/{scenarios,personas,analytics}
    mkdir -p "$DEMO_DIR/assets"/{images,videos,audio,documents}
    mkdir -p "$DEMO_DIR/docs"/{api,user-guides,technical}
    
    echo -e "${GREEN}✅ Enhanced demo structure created${NC}"
}

# Function to create demo application
create_demo_application() {
    echo -e "${YELLOW}⚛️ Creating enhanced demo application...${NC}"
    
    cd "$DEMO_DIR"
    
    # Create package.json
    cat > package.json << 'EOF'
{
  "name": "enhanced-feedback-demo",
  "version": "2.0.0",
  "description": "Enhanced Swedish Café Feedback Platform Demo - Phase B+",
  "main": "src/index.tsx",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "npm run dev",
    "demo:swedish-owner": "npm run dev -- --mode swedish-cafe-owner",
    "demo:investor": "npm run dev -- --mode investor-presentation",
    "demo:technical": "npm run dev -- --mode technical-deep-dive",
    "demo:load-test": "npm run dev -- --mode peak-hour-simulation",
    "demo:security": "npm run dev -- --mode fraud-detection-showcase",
    "export:analytics": "node scripts/export-analytics.js",
    "generate:report": "node scripts/generate-demo-report.js"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "@types/react": "^18.0.27",
    "@types/react-dom": "^18.0.10",
    "recharts": "^2.5.0",
    "framer-motion": "^10.0.0",
    "date-fns": "^2.29.0",
    "lucide-react": "^0.312.0"
  },
  "devDependencies": {
    "vite": "^4.1.0",
    "@vitejs/plugin-react": "^3.1.0",
    "typescript": "^4.9.4",
    "tailwindcss": "^3.2.0",
    "autoprefixer": "^10.4.13",
    "postcss": "^8.4.21",
    "eslint": "^8.35.0",
    "@typescript-eslint/eslint-plugin": "^5.54.0",
    "@typescript-eslint/parser": "^5.54.0"
  },
  "keywords": [
    "demo",
    "feedback",
    "swedish",
    "cafe",
    "ai",
    "pilot"
  ],
  "author": "Swedish Café Feedback Platform Team",
  "license": "MIT"
}
EOF

    # Create main demo application
    cat > src/App.tsx << 'EOF'
/**
 * Enhanced Demo Application - Phase B+
 * Advanced Swedish Café Feedback Platform Demo
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DemoOrchestrator } from '../../../packages/ui-components/src/components/DemoOrchestrator';
import { FeedbackVisualizationDashboard } from '../../../packages/ui-components/src/components/FeedbackVisualizationDashboard';
import { FeedbackCollectionSystem } from '../../../packages/feedback-collection/FeedbackCollectionSystem';
import FeedbackDemoRunner from '../../../demo/feedback-demo-runner';

// Demo modes
type DemoMode = 
  | 'swedish-cafe-owner'
  | 'investor-presentation' 
  | 'technical-deep-dive'
  | 'peak-hour-simulation'
  | 'fraud-detection-showcase'
  | 'interactive';

interface DemoConfig {
  mode: DemoMode;
  autoStart: boolean;
  showControls: boolean;
  enableRecording: boolean;
  language: 'sv' | 'en';
}

const App: React.FC = () => {
  const [demoConfig, setDemoConfig] = useState<DemoConfig>({
    mode: 'interactive',
    autoStart: false,
    showControls: true,
    enableRecording: false,
    language: 'sv'
  });

  const [demoRunner, setDemoRunner] = useState<FeedbackDemoRunner | null>(null);
  const [analytics, setAnalytics] = useState(null);

  // Initialize demo based on URL params or default
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') as DemoMode || 'interactive';
    const autoStart = urlParams.get('autostart') === 'true';
    const lang = urlParams.get('lang') as 'sv' | 'en' || 'sv';

    setDemoConfig(prev => ({
      ...prev,
      mode,
      autoStart,
      language: lang
    }));

    // Initialize analytics tracking
    const trackAnalytics = (event: string, data: any) => {
      console.log(`📊 Analytics: ${event}`, data);
      // Could send to external analytics service
    };

    // Setup demo runner for data collection
    if (mode !== 'interactive') {
      const scenarios = FeedbackDemoRunner.getAvailableScenarios();
      const scenario = scenarios.find(s => s.id.includes(mode.split('-')[0])) || scenarios[0];
      
      const runner = new FeedbackDemoRunner({
        scenario,
        realTimeUpdates: true,
        autoExport: false,
        exportInterval: 60000
      });

      setDemoRunner(runner);
      
      runner.on('analytics:updated', setAnalytics);
      runner.on('demo:started', (data) => trackAnalytics('demo_started', data));
      runner.on('demo:stopped', (data) => trackAnalytics('demo_completed', data));
    }
  }, []);

  // Demo mode rendering
  const renderDemoMode = () => {
    switch (demoConfig.mode) {
      case 'swedish-cafe-owner':
        return (
          <div className="demo-mode-container">
            <header className="demo-header bg-blue-600 text-white p-6">
              <h1 className="text-3xl font-bold">🇸🇪 Välkommen till AI Feedback Platform</h1>
              <p className="text-blue-100 mt-2">Interaktiv demo för svenska café-ägare</p>
            </header>
            <DemoOrchestrator
              initialConfig={{
                persona: 'cafe-owner',
                language: 'sv',
                enabled: true,
                showMetrics: true
              }}
              showAdvancedControls={demoConfig.showControls}
              enableRecording={demoConfig.enableRecording}
            />
          </div>
        );

      case 'investor-presentation':
        return (
          <div className="demo-mode-container">
            <header className="demo-header bg-green-600 text-white p-6">
              <h1 className="text-3xl font-bold">💼 Investor Presentation</h1>
              <p className="text-green-100 mt-2">Swedish Café Feedback Platform - Market Opportunity</p>
            </header>
            <DemoOrchestrator
              initialConfig={{
                persona: 'investor',
                language: 'en',
                enabled: true,
                showMetrics: false,
                simulateLatency: false
              }}
              showAdvancedControls={false}
              enableRecording={true}
            />
          </div>
        );

      case 'technical-deep-dive':
        return (
          <div className="demo-mode-container">
            <header className="demo-header bg-purple-600 text-white p-6">
              <h1 className="text-3xl font-bold">🔧 Technical Deep Dive</h1>
              <p className="text-purple-100 mt-2">System Architecture & Implementation Details</p>
            </header>
            <DemoOrchestrator
              initialConfig={{
                persona: 'technical-lead',
                language: 'en',
                enabled: true,
                showMetrics: true,
                simulateLatency: true
              }}
              showAdvancedControls={true}
              enableRecording={false}
            />
          </div>
        );

      case 'peak-hour-simulation':
        return (
          <div className="demo-mode-container">
            <header className="demo-header bg-orange-600 text-white p-6">
              <h1 className="text-3xl font-bold">⚡ Peak Hour Simulation</h1>
              <p className="text-orange-100 mt-2">High-Load Testing & Performance Monitoring</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              <DemoOrchestrator
                initialConfig={{
                  persona: 'system-admin',
                  language: 'en',
                  enabled: true,
                  showMetrics: true
                }}
                showAdvancedControls={true}
              />
              {analytics && (
                <FeedbackVisualizationDashboard
                  analytics={analytics}
                  isDemo={true}
                  refreshInterval={5000}
                />
              )}
            </div>
          </div>
        );

      case 'fraud-detection-showcase':
        return (
          <div className="demo-mode-container">
            <header className="demo-header bg-red-600 text-white p-6">
              <h1 className="text-3xl font-bold">🔒 Fraud Detection Showcase</h1>
              <p className="text-red-100 mt-2">Advanced Security & Anti-Fraud Systems</p>
            </header>
            <DemoOrchestrator
              initialConfig={{
                persona: 'security-admin',
                language: 'en',
                enabled: true,
                showMetrics: true,
                simulateLatency: true
              }}
              showAdvancedControls={true}
              enableRecording={false}
            />
          </div>
        );

      default:
        return (
          <div className="demo-selector p-8">
            <div className="max-w-6xl mx-auto">
              <header className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  🇸🇪 Enhanced Demo Environment
                </h1>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Välj din demo-upplevelse baserad på din roll och intresse. 
                  Varje demo är skräddarsydd för olika användare och användningsfall.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Demo Cards */}
                <DemoCard
                  title="🇸🇪 Café Ägare"
                  description="Interaktiv genomgång för svenska café-ägare"
                  duration="15 min"
                  difficulty="Nybörjare"
                  onClick={() => setDemoConfig(prev => ({ ...prev, mode: 'swedish-cafe-owner' }))}
                />
                
                <DemoCard
                  title="💼 Investerare"
                  description="Professionell presentation för potentiella investerare"
                  duration="20 min"
                  difficulty="Executive"
                  onClick={() => setDemoConfig(prev => ({ ...prev, mode: 'investor-presentation' }))}
                />
                
                <DemoCard
                  title="🔧 Teknisk"
                  description="Djupgående teknisk genomgång för utvecklare"
                  duration="25 min"
                  difficulty="Expert"
                  onClick={() => setDemoConfig(prev => ({ ...prev, mode: 'technical-deep-dive' }))}
                />
                
                <DemoCard
                  title="⚡ Belastningstest"
                  description="Simulering av hög belastning och prestanda"
                  duration="8 min"
                  difficulty="Avancerad"
                  onClick={() => setDemoConfig(prev => ({ ...prev, mode: 'peak-hour-simulation' }))}
                />
                
                <DemoCard
                  title="🔒 Säkerhet"
                  description="Bedrägeriskydd och säkerhetssystem"
                  duration="10 min"
                  difficulty="Avancerad"
                  onClick={() => setDemoConfig(prev => ({ ...prev, mode: 'fraud-detection-showcase' }))}
                />
                
                <DemoCard
                  title="🎮 Interaktiv"
                  description="Anpassningsbar demo med full kontroll"
                  duration="Flexibel"
                  difficulty="Alla nivåer"
                  onClick={() => setDemoConfig(prev => ({ ...prev, mode: 'interactive' }))}
                  isCustom={true}
                />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        {renderDemoMode()}
      </div>
    </Router>
  );
};

// Demo Card Component
interface DemoCardProps {
  title: string;
  description: string;
  duration: string;
  difficulty: string;
  onClick: () => void;
  isCustom?: boolean;
}

const DemoCard: React.FC<DemoCardProps> = ({ 
  title, 
  description, 
  duration, 
  difficulty, 
  onClick,
  isCustom = false 
}) => (
  <div 
    className={`demo-card p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
      isCustom 
        ? 'border-purple-200 bg-purple-50 hover:border-purple-400' 
        : 'border-gray-200 bg-white hover:border-blue-400'
    }`}
    onClick={onClick}
  >
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-gray-600 mb-4">{description}</p>
    <div className="flex justify-between text-sm">
      <span className="text-blue-600 font-medium">⏱️ {duration}</span>
      <span className="text-green-600 font-medium">📊 {difficulty}</span>
    </div>
  </div>
);

export default App;
EOF

    # Create index file
    cat > src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

    # Create Tailwind CSS
    cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Demo-specific styles */
.demo-mode-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.demo-header {
  background: linear-gradient(135deg, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 100%);
}

.demo-card {
  transition: all 0.3s ease;
}

.demo-card:hover {
  transform: translateY(-2px);
}

/* Animation for demo highlights */
@keyframes demo-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  }
}

.demo-highlight {
  animation: demo-glow 2s infinite;
}
EOF

    # Create Vite config
    cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
EOF

    # Create Tailwind config
    cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../packages/ui-components/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'swedish-blue': '#006aa7',
        'swedish-yellow': '#fecc02',
      }
    },
  },
  plugins: [],
}
EOF

    # Create HTML template
    cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Enhanced Demo - Swedish Café Feedback Platform</title>
    <meta name="description" content="Advanced demo environment for the Swedish Café Feedback Platform - Phase B+">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

    echo -e "${GREEN}✅ Enhanced demo application created${NC}"
}

# Function to create demo data and scenarios
create_demo_data() {
    echo -e "${YELLOW}📊 Creating enhanced demo data...${NC}"
    
    # Create scenario configurations
    cat > data/scenarios/enhanced-scenarios.json << 'EOF'
{
  "swedish-cafe-morning-rush": {
    "name": "Svensk Morgon-Rush",
    "description": "Simulerar morgonrushen på svenska caféer",
    "duration": 300000,
    "feedbackRate": 15,
    "cafes": [
      {
        "id": "stockholm-central",
        "name": "Café Aurora Central",
        "location": "Stockholm Centralstation",
        "customerTypes": ["commuter", "business", "tourist"],
        "qualityRange": [70, 90],
        "categories": ["service", "speed", "quality", "convenience"]
      },
      {
        "id": "malmoe-station",
        "name": "Malmö Stationskafé",
        "location": "Malmö Centralstation", 
        "customerTypes": ["commuter", "local", "student"],
        "qualityRange": [65, 85],
        "categories": ["service", "quality", "value", "atmosphere"]
      }
    ]
  },
  "investor-presentation-data": {
    "name": "Investerarpresentation Data",
    "description": "Kurerade data för investerarpresentationer",
    "marketData": {
      "swedishMarketSize": "127000 small businesses",
      "horecaRevenue": "€18.2B annually",
      "feedbackGap": "92% without feedback systems",
      "roiMultiplier": "3.2x from customer insights"
    },
    "revenueModel": {
      "commissionRates": {
        "tier1": 0.20,
        "tier2": 0.18,
        "tier3": 0.15
      },
      "projections": {
        "year1": { "businesses": 50, "users": 5000, "arr": 120000 },
        "year2": { "businesses": 200, "users": 25000, "arr": 480000 },
        "year3": { "businesses": 500, "users": 50000, "arr": 2800000 }
      }
    }
  }
}
EOF

    # Create persona data
    cat > data/personas/enhanced-personas.json << 'EOF'
{
  "cafe-owner": {
    "name": "Café Ägare",
    "demographics": {
      "age": "35-55",
      "location": "Stockholm, Malmö, Göteborg",
      "businessSize": "1-3 locations",
      "techComfort": "Medium"
    },
    "goals": [
      "Förstå kundernas upplevelse",
      "Förbättra servicequalitet",
      "Öka kundlojalitet",
      "Maximera intäkter"
    ],
    "painPoints": [
      "Svårt att få ärlig feedback",
      "Vet inte vad kunderna verkligen tycker",
      "Konkurrens från stora kedjor",
      "Begränsad tid för analys"
    ],
    "preferredLanguage": "sv"
  },
  "investor": {
    "name": "Venture Capital Investor",
    "focus": [
      "Market size and opportunity",
      "Revenue model scalability", 
      "Competitive advantages",
      "Technical differentiation",
      "Team and execution capability"
    ],
    "investmentCriteria": {
      "minMarketSize": "€1B+",
      "techAdvantage": "Required",
      "scalability": "High",
      "defensibility": "Strong"
    },
    "preferredLanguage": "en"
  }
}
EOF

    echo -e "${GREEN}✅ Enhanced demo data created${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing enhanced demo dependencies...${NC}"
    
    cd "$DEMO_DIR"
    npm install --silent
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to create demo launch scripts
create_launch_scripts() {
    echo -e "${YELLOW}🚀 Creating demo launch scripts...${NC}"
    
    # Create individual demo launchers
    cat > "$DEMO_DIR/scripts/launch-cafe-owner-demo.sh" << 'EOF'
#!/bin/bash
echo "🇸🇪 Launching Swedish Café Owner Demo..."
npm run demo:swedish-owner
EOF

    cat > "$DEMO_DIR/scripts/launch-investor-demo.sh" << 'EOF'
#!/bin/bash
echo "💼 Launching Investor Presentation Demo..."
npm run demo:investor
EOF

    cat > "$DEMO_DIR/scripts/launch-technical-demo.sh" << 'EOF'
#!/bin/bash
echo "🔧 Launching Technical Deep Dive Demo..."
npm run demo:technical
EOF

    # Create analytics export script
    cat > "$DEMO_DIR/scripts/export-analytics.js" << 'EOF'
/**
 * Export Demo Analytics
 * Exports analytics data from demo sessions
 */

const fs = require('fs');
const path = require('path');

function exportAnalytics() {
  console.log('📊 Exporting demo analytics...');
  
  // Mock analytics data - in real implementation would read from actual data
  const analyticsData = {
    timestamp: new Date().toISOString(),
    sessions: [],
    summary: {
      totalSessions: 0,
      averageDuration: 0,
      completionRate: 0,
      topScenarios: []
    }
  };
  
  const outputPath = path.join(__dirname, '..', 'data', 'analytics', 'demo-analytics.json');
  fs.writeFileSync(outputPath, JSON.stringify(analyticsData, null, 2));
  
  console.log('✅ Analytics exported to:', outputPath);
}

if (require.main === module) {
  exportAnalytics();
}

module.exports = { exportAnalytics };
EOF

    # Make scripts executable
    chmod +x "$DEMO_DIR/scripts"/*.sh

    echo -e "${GREEN}✅ Demo launch scripts created${NC}"
}

# Function to generate demo documentation
generate_documentation() {
    echo -e "${YELLOW}📚 Generating enhanced demo documentation...${NC}"
    
    cat > "$DEMO_DIR/docs/README.md" << 'EOF'
# Enhanced Demo Environment - Phase B+

## Overview

This enhanced demo environment provides advanced demonstration capabilities for the Swedish Café Feedback Platform, including multiple personas, interactive scenarios, and comprehensive analytics.

## Available Demo Modes

### 1. 🇸🇪 Swedish Café Owner (`swedish-cafe-owner`)
- **Target Audience:** Swedish small business owners
- **Duration:** ~15 minutes
- **Language:** Swedish
- **Focus:** Business value, ease of use, ROI

### 2. 💼 Investor Presentation (`investor-presentation`)
- **Target Audience:** VCs, angel investors, potential partners
- **Duration:** ~20 minutes  
- **Language:** English
- **Focus:** Market opportunity, revenue model, scalability

### 3. 🔧 Technical Deep Dive (`technical-deep-dive`)
- **Target Audience:** CTOs, lead developers, technical evaluators
- **Duration:** ~25 minutes
- **Language:** English
- **Focus:** Architecture, AI pipeline, performance metrics

### 4. ⚡ Peak Hour Simulation (`peak-hour-simulation`)
- **Target Audience:** System administrators, DevOps teams
- **Duration:** ~8 minutes
- **Language:** English
- **Focus:** Load testing, performance monitoring, scalability

### 5. 🔒 Fraud Detection Showcase (`fraud-detection-showcase`)
- **Target Audience:** Security teams, compliance officers
- **Duration:** ~10 minutes
- **Language:** English
- **Focus:** Security measures, fraud prevention, compliance

## Quick Start

```bash
# Install dependencies
npm install

# Launch specific demo mode
npm run demo:swedish-owner     # Swedish café owner experience
npm run demo:investor         # Investor presentation
npm run demo:technical        # Technical deep dive
npm run demo:load-test        # Load testing simulation
npm run demo:security         # Security showcase

# Launch interactive demo selector
npm run dev
```

## Features

- **Multi-persona targeting** with customized experiences
- **Interactive guided tours** with step-by-step navigation
- **Real-time analytics** and session recording
- **Advanced demo controls** with auto-progression
- **Export capabilities** for analytics and reports
- **Responsive design** optimized for presentations
- **Multiple language support** (Swedish/English)

## Analytics & Reporting

The enhanced demo environment includes comprehensive analytics:

- Session tracking and duration analysis
- Interaction heatmaps and user flows
- Completion rates by scenario and step
- Export capabilities (JSON, CSV formats)
- Real-time monitoring dashboard

## Customization

Each demo mode can be customized via URL parameters:

```
?mode=investor-presentation&lang=en&autostart=true
```

## Integration

The demo environment integrates with:
- Feedback collection system
- Real-time analytics dashboard  
- Monitoring infrastructure
- Export and reporting tools

## Support

For technical support or customization requests, contact the development team.
EOF

    # Create API documentation
    cat > "$DEMO_DIR/docs/api/demo-api.md" << 'EOF'
# Demo API Documentation

## Demo Orchestrator API

### Methods

#### `startTour(tourId: string)`
Starts a specific guided tour.

#### `navigateStep(direction: 'next' | 'previous')`
Navigate between tour steps.

#### `exportDemoData(format: 'json' | 'csv')`
Export demo session data.

#### `trackEvent(type: string, target: string, data?: any)`
Track custom analytics events.

### Events

- `demo_session_started` - New demo session initiated
- `tour_started` - Guided tour began
- `tour_completed` - Guided tour finished
- `step_navigation` - User navigated between steps
- `demo_interaction` - User interaction tracked
- `demo_exported` - Analytics data exported

## Feedback Collection Integration

The demo environment integrates with the feedback collection system to provide realistic data and interactions.

### Configuration

```typescript
interface DemoConfig {
  enabled: boolean;
  autoReset: boolean;
  resetInterval: number;
  showMetrics: boolean;
  simulateLatency: boolean;
  dataMode: 'live' | 'demo' | 'mixed';
  persona?: string;
  language?: 'sv' | 'en';
}
```
EOF

    echo -e "${GREEN}✅ Enhanced demo documentation generated${NC}"
}

# Function to display setup completion
display_completion_info() {
    echo ""
    echo -e "${PURPLE}🎉 Enhanced Demo Environment Setup Complete!${NC}"
    echo ""
    echo -e "${GREEN}📁 Demo Location:${NC} $DEMO_DIR"
    echo ""
    echo -e "${BLUE}🚀 Available Demo Modes:${NC}"
    echo -e "  🇸🇪 Swedish Café Owner:  npm run demo:swedish-owner"
    echo -e "  💼 Investor Presentation: npm run demo:investor"
    echo -e "  🔧 Technical Deep Dive:   npm run demo:technical"
    echo -e "  ⚡ Load Testing:          npm run demo:load-test"
    echo -e "  🔒 Security Showcase:     npm run demo:security"
    echo ""
    echo -e "${YELLOW}🎮 Interactive Demo Selector:${NC}"
    echo -e "  cd $DEMO_DIR && npm run dev"
    echo ""
    echo -e "${GREEN}✨ Enhanced Features:${NC}"
    echo -e "  • 5 specialized demo scenarios"
    echo -e "  • Multi-persona targeting (Swedish café owners, investors, CTOs)"
    echo -e "  • Advanced analytics and session recording"
    echo -e "  • Real-time performance monitoring"
    echo -e "  • Interactive guided tours with highlights"
    echo -e "  • Export capabilities for presentations"
    echo -e "  • Swedish/English language support"
    echo ""
    echo -e "${BLUE}📊 Analytics & Reporting:${NC}"
    echo -e "  • Session tracking and interaction analytics"
    echo -e "  • Completion rates and user flow analysis"
    echo -e "  • Export to JSON/CSV for further analysis"
    echo -e "  • Real-time monitoring dashboard"
    echo ""
    echo -e "${PURPLE}🎯 Ready for Business Presentations!${NC}"
    echo -e "The enhanced demo environment is now ready for:"
    echo -e "  • Investor pitches and VC presentations"
    echo -e "  • Customer onboarding and training"
    echo -e "  • Technical evaluations and code reviews"
    echo -e "  • Load testing and performance demonstrations"
    echo -e "  • Security audits and compliance reviews"
}

# Main execution
main() {
    echo -e "${BLUE}Initializing enhanced demo setup...${NC}"
    
    check_prerequisites
    create_demo_structure
    create_demo_application
    create_demo_data
    install_dependencies
    create_launch_scripts
    generate_documentation
    display_completion_info
    
    echo ""
    echo -e "${GREEN}🏁 Enhanced Demo Environment Ready!${NC}"
}

# Error handling
trap 'echo -e "${RED}❌ Enhanced demo setup failed${NC}"; exit 1' ERR

# Run main function
main "$@"