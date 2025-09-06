#!/bin/bash

# Run Feedback Collection Demo
# Interactive demo system for Swedish Café Pilot Program
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
DEMO_DIR="$PROJECT_ROOT/demo"
LOGS_DIR="$PROJECT_ROOT/logs"

echo -e "${BLUE}🇸🇪 Swedish Café Feedback Collection Demo${NC}"
echo -e "${BLUE}Interactive Demo System${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        echo "Please install Node.js 18+ to continue"
        exit 1
    fi
    
    # Check Node version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        echo -e "${RED}❌ Node.js version 18+ required (found: $(node -v))${NC}"
        exit 1
    fi
    
    # Check if TypeScript is available
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}❌ npx is not available${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to create necessary directories
create_directories() {
    echo -e "${YELLOW}📁 Creating demo directories...${NC}"
    
    mkdir -p "$DEMO_DIR"
    mkdir -p "$LOGS_DIR"
    mkdir -p "$PROJECT_ROOT/packages/feedback-collection"
    mkdir -p "$PROJECT_ROOT/packages/ui-components/src/components"
    
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing demo dependencies...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Create package.json for demo if it doesn't exist
    if [[ ! -f "$DEMO_DIR/package.json" ]]; then
        cat > "$DEMO_DIR/package.json" << EOF
{
  "name": "feedback-demo",
  "version": "1.0.0",
  "description": "Swedish Café Feedback Collection Demo",
  "main": "feedback-demo-runner.js",
  "scripts": {
    "start": "npx ts-node feedback-demo-runner.ts",
    "build": "npx tsc --build"
  },
  "dependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "events": "^3.3.0"
  }
}
EOF
    fi
    
    # Install dependencies
    cd "$DEMO_DIR"
    npm install --silent
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to show available scenarios
show_scenarios() {
    echo -e "${PURPLE}🎭 Available Demo Scenarios:${NC}"
    echo ""
    echo -e "${GREEN}1. Svensk Morgon-Rush${NC}"
    echo "   - Duration: 5 minutes"
    echo "   - Rate: 15 feedbacks/minute"
    echo "   - Focus: High volume morning commuter traffic"
    echo ""
    echo -e "${GREEN}2. Lunch Feedback-våg${NC}"
    echo "   - Duration: 10 minutes"  
    echo "   - Rate: 8 feedbacks/minute"
    echo "   - Focus: Diverse lunch crowd with quality variation"
    echo ""
    echo -e "${GREEN}3. Helg Avkoppling${NC}"
    echo "   - Duration: 8 minutes"
    echo "   - Rate: 5 feedbacks/minute"
    echo "   - Focus: Relaxed weekend customers with detailed feedback"
    echo ""
    echo -e "${GREEN}4. Stress Test - Hög Belastning${NC}"
    echo "   - Duration: 3 minutes"
    echo "   - Rate: 30 feedbacks/minute"
    echo "   - Focus: System capacity testing with high volume"
    echo ""
    echo -e "${YELLOW}5. Custom Interactive Demo${NC}"
    echo "   - User-controlled scenario"
    echo "   - Manual feedback generation"
    echo "   - Real-time analytics viewing"
    echo ""
}

# Function to run interactive demo selection
select_demo_scenario() {
    echo -e "${BLUE}📋 Demo Scenario Selection${NC}"
    echo ""
    
    show_scenarios
    
    echo -e "${YELLOW}Please select a demo scenario (1-5):${NC}"
    read -r SCENARIO_CHOICE
    
    case $SCENARIO_CHOICE in
        1)
            SCENARIO_ID="swedish-morning-rush"
            SCENARIO_NAME="Svensk Morgon-Rush"
            ;;
        2)
            SCENARIO_ID="lunch-feedback-wave"
            SCENARIO_NAME="Lunch Feedback-våg"
            ;;
        3)
            SCENARIO_ID="weekend-leisure"
            SCENARIO_NAME="Helg Avkoppling"
            ;;
        4)
            SCENARIO_ID="stress-test-scenario"
            SCENARIO_NAME="Stress Test - Hög Belastning"
            ;;
        5)
            SCENARIO_ID="interactive-demo"
            SCENARIO_NAME="Custom Interactive Demo"
            ;;
        *)
            echo -e "${RED}❌ Invalid selection. Defaulting to scenario 1.${NC}"
            SCENARIO_ID="swedish-morning-rush"
            SCENARIO_NAME="Svensk Morgon-Rush"
            ;;
    esac
    
    echo -e "${GREEN}✅ Selected: $SCENARIO_NAME${NC}"
}

# Function to create demo execution script
create_demo_script() {
    echo -e "${YELLOW}📝 Creating demo execution script...${NC}"
    
    cat > "$DEMO_DIR/run-demo.ts" << 'EOF'
/**
 * Demo Execution Script
 * Runs the selected feedback collection demo scenario
 */

import FeedbackDemoRunner, { DemoConfig } from './feedback-demo-runner';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('🇸🇪 Swedish Café Feedback Collection Demo');
  console.log('==========================================\n');
  
  const scenarios = FeedbackDemoRunner.getAvailableScenarios();
  const scenarioId = process.argv[2] || 'swedish-morning-rush';
  const scenario = scenarios.find(s => s.id === scenarioId) || scenarios[0];
  
  console.log(`📊 Running Scenario: ${scenario.name}`);
  console.log(`📝 Description: ${scenario.description}`);
  console.log(`⏱️  Duration: ${Math.floor(scenario.duration / 1000)}s`);
  console.log(`⚡ Rate: ${scenario.feedbackRate} feedbacks/min\n`);
  
  const config: DemoConfig = {
    scenario,
    realTimeUpdates: true,
    autoExport: true,
    exportInterval: 60000 // Export every minute
  };
  
  const demoRunner = new FeedbackDemoRunner(config);
  
  // Setup event listeners
  demoRunner.on('demo:started', (data) => {
    console.log(`🚀 Demo started: ${data.scenario}`);
    console.log(`📅 Start time: ${data.startTime.toLocaleString('sv-SE')}`);
  });
  
  demoRunner.on('feedback:generated', (data) => {
    const stats = demoRunner.getRealTimeStats();
    process.stdout.write(`\r📝 Feedbacks: ${stats.demoStats.feedbacksGenerated} | ` +
      `⏱️  Elapsed: ${Math.floor(stats.demoStats.elapsedTime / 1000)}s | ` +
      `🎯 Avg Quality: ${stats.averageQualityToday.toFixed(1)} | ` +
      `💰 Rewards: ${stats.totalRewardsToday.toFixed(0)} SEK`);
  });
  
  demoRunner.on('analytics:updated', (analytics) => {
    // Analytics updated - could trigger UI updates here
  });
  
  demoRunner.on('demo:stopped', (data) => {
    console.log('\n\n🎉 Demo Completed!');
    console.log('===================');
    console.log(`📊 Total Feedbacks: ${data.feedbackCount}`);
    console.log(`⏱️  Duration: ${Math.floor(data.duration / 1000)}s`);
    console.log(`📈 Final Analytics:`);
    console.log(`   - Average Quality: ${data.analytics.averageQuality.toFixed(1)}`);
    console.log(`   - Total Rewards: ${data.analytics.rewardDistribution.total.toFixed(0)} SEK`);
    console.log(`   - Categories: ${Object.keys(data.analytics.categoryDistribution).join(', ')}`);
    console.log(`   - Active Cafés: ${data.analytics.cafePerformance.length}`);
    
    console.log('\n🏆 Top Performing Cafés:');
    data.analytics.cafePerformance
      .sort((a, b) => b.averageQuality - a.averageQuality)
      .slice(0, 3)
      .forEach((cafe, index) => {
        console.log(`   ${index + 1}. ${cafe.cafeName} (${cafe.location}) - Quality: ${cafe.averageQuality.toFixed(1)}`);
      });
    
    console.log('\n📤 Export demo data? (y/n):');
    rl.question('', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        try {
          const jsonData = await demoRunner.exportDemoData('json');
          console.log(`✅ Demo data exported (${(jsonData as string).length} characters)`);
        } catch (error) {
          console.error('❌ Export failed:', error);
        }
      }
      
      console.log('\n🇸🇪 Tack för att du testade vårt feedback-system!');
      console.log('Thank you for testing our feedback system!');
      process.exit(0);
    });
  });
  
  demoRunner.on('demo:error', (error) => {
    console.error('\n❌ Demo error:', error);
    process.exit(1);
  });
  
  // Interactive controls
  console.log('🎮 Interactive Controls:');
  console.log('   Press SPACE for real-time stats');
  console.log('   Press Q to quit early');
  console.log('   Press E to export current data\n');
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', async (key) => {
    const keyStr = key.toString();
    
    switch (keyStr) {
      case ' ':
        const stats = demoRunner.getRealTimeStats();
        console.log('\n📊 Real-time Stats:');
        console.log(`   Feedbacks Today: ${stats.feedbacksToday}`);
        console.log(`   Average Quality: ${stats.averageQualityToday.toFixed(1)}`);
        console.log(`   Total Rewards: ${stats.totalRewardsToday.toFixed(0)} SEK`);
        console.log(`   Top Categories: ${stats.topCategories.map(c => c.category).join(', ')}`);
        console.log(`   Demo Progress: ${Math.floor((stats.demoStats.elapsedTime / scenario.duration) * 100)}%`);
        break;
        
      case 'q':
      case 'Q':
        console.log('\n🛑 Stopping demo early...');
        await demoRunner.stopDemo();
        break;
        
      case 'e':
      case 'E':
        try {
          const exportData = await demoRunner.exportDemoData('json');
          console.log(`\n📤 Current data exported (${(exportData as string).length} characters)`);
        } catch (error) {
          console.error('\n❌ Export failed:', error);
        }
        break;
        
      case '\u0003': // Ctrl+C
        console.log('\n👋 Demo interrupted by user');
        process.exit(0);
        break;
    }
  });
  
  // Start the demo
  try {
    await demoRunner.startDemo();
  } catch (error) {
    console.error('❌ Failed to start demo:', error);
    process.exit(1);
  }
}

// Run the demo
main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
EOF

    echo -e "${GREEN}✅ Demo script created${NC}"
}

# Function to start the demo
start_demo() {
    echo -e "${YELLOW}🚀 Starting demo...${NC}"
    echo ""
    
    cd "$DEMO_DIR"
    
    # Compile TypeScript and run
    echo -e "${BLUE}Compiling and starting demo with scenario: $SCENARIO_ID${NC}"
    
    # Run the demo
    npx ts-node run-demo.ts "$SCENARIO_ID"
}

# Function to show post-demo information
show_post_demo_info() {
    echo ""
    echo -e "${BLUE}🎯 Demo Information${NC}"
    echo ""
    echo -e "${GREEN}📁 Demo Files:${NC}"
    echo "   Demo Runner: $DEMO_DIR/feedback-demo-runner.ts"
    echo "   Collection System: $PROJECT_ROOT/packages/feedback-collection/FeedbackCollectionSystem.ts"
    echo "   Visualization Dashboard: $PROJECT_ROOT/packages/ui-components/src/components/FeedbackVisualizationDashboard.tsx"
    echo ""
    echo -e "${GREEN}📊 Integration Options:${NC}"
    echo "   • Connect to existing monitoring infrastructure"
    echo "   • Export data to business intelligence tools"
    echo "   • Integrate with Grafana dashboards"
    echo "   • Real-time WebSocket updates to admin dashboard"
    echo ""
    echo -e "${GREEN}🎭 Demo Features Demonstrated:${NC}"
    echo "   • Swedish language feedback processing"
    echo "   • Real-time quality scoring (authenticity, concreteness, depth)"
    echo "   • Multi-café performance analytics"
    echo "   • Reward calculation and tier management"
    echo "   • Category and sentiment analysis"
    echo "   • Time-series analytics and trends"
    echo ""
    echo -e "${YELLOW}🚀 Next Steps for Pilot Deployment:${NC}"
    echo "   1. Configure real Swedish café data"
    echo "   2. Connect to production POS systems"
    echo "   3. Set up Swedish banking integration (Swish, Bankgiro)"
    echo "   4. Deploy monitoring infrastructure"
    echo "   5. Train pilot café staff"
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}Initializing feedback collection demo...${NC}"
    
    check_prerequisites
    create_directories
    install_dependencies
    select_demo_scenario
    create_demo_script
    
    echo ""
    echo -e "${GREEN}✅ Demo setup complete!${NC}"
    echo ""
    
    # Ask if user wants to start immediately
    echo -e "${YELLOW}Start demo now? (y/n):${NC}"
    read -r START_NOW
    
    if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
        start_demo
    else
        echo ""
        echo -e "${BLUE}Demo ready to run!${NC}"
        echo -e "${GREEN}To start manually:${NC}"
        echo "   cd $DEMO_DIR"
        echo "   npx ts-node run-demo.ts $SCENARIO_ID"
        echo ""
    fi
    
    show_post_demo_info
}

# Error handling
trap 'echo -e "${RED}❌ Demo setup failed${NC}"; exit 1' ERR

# Run main function
main "$@"