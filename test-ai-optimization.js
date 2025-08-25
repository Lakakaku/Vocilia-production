#!/usr/bin/env node

// Quick test script to validate AI optimization improvements
// Tests the new ultra-fast qwen2:0.5b model with optimized prompts

async function testAIOptimizations() {
  console.log('🚀 Testing AI Performance Optimizations');
  console.log('=========================================');
  
  // Test 1: Check if qwen2:0.5b model is available
  console.log('\n📋 Test 1: Model Availability');
  try {
    const { spawn } = require('child_process');
    const ollamaList = spawn('ollama', ['list']);
    
    let output = '';
    ollamaList.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ollamaList.on('close', (code) => {
      if (code === 0) {
        const hasQwen = output.includes('qwen2:0.5b');
        const hasLlama = output.includes('llama3.2:1b');
        
        console.log(`✅ qwen2:0.5b model: ${hasQwen ? 'Available' : 'Missing'}`);
        console.log(`✅ llama3.2:1b model: ${hasLlama ? 'Available' : 'Missing'}`);
        
        if (hasQwen) {
          testModelPerformance();
        } else {
          console.log('❌ qwen2:0.5b not found - install with: ollama pull qwen2:0.5b');
        }
      } else {
        console.log('❌ Could not check Ollama models');
      }
    });
  } catch (error) {
    console.log('❌ Ollama not available:', error.message);
  }
}

async function testModelPerformance() {
  console.log('\n⚡ Test 2: Model Performance');
  
  const testCases = [
    {
      name: 'Simple Swedish feedback',
      input: 'Bra kaffe och trevlig personal.',
      expectedTime: 2000 // 2 seconds max
    },
    {
      name: 'Detailed Swedish feedback', 
      input: 'Jag handlade kaffe här idag klockan 2. Baristan Emma var mycket hjälpsam och kaffet var perfekt tempererat. Lokalen var ren men det var lite för kallt vid dörren.',
      expectedTime: 2000
    },
    {
      name: 'Short feedback',
      input: 'Okej service.',
      expectedTime: 1000
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    const startTime = Date.now();
    
    try {
      // Test the optimized prompt structure
      const optimizedPrompt = `Bedöm feedback 0-100:
"${testCase.input}"

Kontext: cafe

Kriterier: Trov (40%), Konkret (30%), Djup (30%)

Svara JSON:
{"authenticity":50,"concreteness":50,"depth":50,"total_score":50,"reasoning":"test","categories":["test"],"sentiment":0}`;

      // Simulate AI processing with optimized model
      const { spawn } = require('child_process');
      const ollama = spawn('ollama', ['run', 'qwen2:0.5b'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      ollama.stdin.write(optimizedPrompt);
      ollama.stdin.end();
      
      let response = '';
      ollama.stdout.on('data', (data) => {
        response += data.toString();
      });
      
      ollama.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = duration < testCase.expectedTime;
        
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Target: <${testCase.expectedTime}ms`);
        console.log(`   Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
        
        if (response) {
          console.log(`   Response length: ${response.length} chars`);
        }
      });
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Helper to compare with old performance
function displayOptimizationSummary() {
  console.log('\n📊 Optimization Summary');
  console.log('=======================');
  console.log('🎯 Target Improvements:');
  console.log('   • AI Response Latency: 10.4s → <2s (80% reduction)');
  console.log('   • Model Size: Llama 3.2 (3B) → qwen2 (0.5B) (83% smaller)');
  console.log('   • Prompt Length: ~1000 chars → ~200 chars (80% shorter)');
  console.log('   • Connection Pool: 1 → 5 connections (5x throughput)');
  console.log('   • Caching: 0% → 40%+ hit rate expected');
  console.log('');
  console.log('🔧 Key Optimizations Applied:');
  console.log('   ✅ Ultra-fast qwen2:0.5b model');
  console.log('   ✅ Simplified prompts');
  console.log('   ✅ Response caching');
  console.log('   ✅ Connection pooling');
  console.log('   ✅ Model warm-up');
  console.log('   ✅ Production-tuned parameters');
}

// Run the tests
console.log('Testing AI optimization improvements...');
displayOptimizationSummary();
testAIOptimizations();

console.log('\n✨ Next: Run real validation with: npm run test:ai-performance');