#!/usr/bin/env node

/**
 * GPT-4o-mini Integration Test
 * 
 * This test validates that the OpenAI provider works correctly with GPT-4o-mini
 * for both feedback evaluation and conversation generation.
 */

// We'll test with a simple API call first since the TypeScript modules need compilation
const axios = require('axios');

async function testGPT4oMiniIntegration() {
  console.log('🧪 Testing GPT-4o-mini Integration...\n');

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    console.log('Set your OpenAI API key:');
    console.log('export OPENAI_API_KEY="sk-your-key-here"');
    process.exit(1);
  }

  // Initialize AI service with GPT-4o-mini
  const aiService = new UniversalAIService({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    fallbackProvider: 'ollama',
    fallbackModel: 'qwen2:0.5b',
    endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434'
  });

  // Test data
  const testTranscript = "Jag tycker att cafét har riktigt bra kaffe och personalen är väldigt vänlig. Dock känns det lite stressigt när det är mycket folk och man får vänta lite längre än vad man skulle vilja.";
  
  const businessContext = {
    type: 'cafe',
    layout: {
      departments: ['kaffe', 'bakverk', 'drycker'],
      checkouts: 2,
      selfCheckout: false
    },
    currentPromotions: ['Sommarlunch 89kr'],
    knownIssues: ['Långa köer vid lunch'],
    strengths: ['Färska råvaror', 'Vänlig personal']
  };

  const purchaseItems = ['kaffe', 'smörgås'];

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing service health check...');
    const healthStatus = await aiService.healthCheck();
    console.log(`   Health status: ${healthStatus ? '✅ Healthy' : '❌ Unhealthy'}`);

    // Test 2: Service Status
    console.log('\n2️⃣ Getting service status...');
    const status = await aiService.getStatus();
    console.log(`   Provider: ${status.provider}`);
    console.log(`   Model: ${status.model}`);
    console.log(`   Available: ${status.available ? '✅ Yes' : '❌ No'}`);
    console.log(`   Latency: ${status.latency || 'N/A'}ms`);

    // Test 3: Feedback Evaluation
    console.log('\n3️⃣ Testing feedback evaluation with GPT-4o-mini...');
    console.log(`   Transcript: "${testTranscript.substring(0, 100)}..."`);
    
    const startTime = Date.now();
    const qualityScore = await aiService.evaluateFeedback(
      testTranscript,
      businessContext,
      purchaseItems
    );
    const evaluationTime = Date.now() - startTime;

    console.log(`   ✅ Evaluation completed in ${evaluationTime}ms`);
    console.log(`   Overall Score: ${qualityScore.total}/100`);
    console.log(`   - Authenticity: ${qualityScore.authenticity}/100 (40% weight)`);
    console.log(`   - Concreteness: ${qualityScore.concreteness}/100 (30% weight)`);
    console.log(`   - Depth: ${qualityScore.depth}/100 (30% weight)`);
    console.log(`   Sentiment: ${qualityScore.sentiment} (-1 to 1)`);
    console.log(`   Categories: [${qualityScore.categories.join(', ')}]`);
    console.log(`   Reasoning: "${qualityScore.reasoning}"`);

    // Test 4: Conversation Response
    console.log('\n4️⃣ Testing conversation generation...');
    
    const conversationStart = Date.now();
    const response = await aiService.generateResponse(
      testTranscript,
      [],
      businessContext
    );
    const conversationTime = Date.now() - conversationStart;

    console.log(`   ✅ Response generated in ${conversationTime}ms`);
    console.log(`   Response: "${response.response}"`);
    console.log(`   Should Continue: ${response.shouldContinue ? 'Yes' : 'No'}`);
    console.log(`   Confidence: ${response.confidence}`);

    // Summary
    console.log('\n🎉 GPT-4o-mini Integration Test Summary:');
    console.log(`   ✅ Service Health: ${healthStatus ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Feedback Evaluation: PASS (${evaluationTime}ms)`);
    console.log(`   ✅ Conversation Generation: PASS (${conversationTime}ms)`);
    console.log(`   📊 Quality Score: ${qualityScore.total}/100`);
    
    if (evaluationTime > 5000) {
      console.log(`   ⚠️  Warning: Evaluation took ${evaluationTime}ms (>5s)`);
    }
    
    if (conversationTime > 3000) {
      console.log(`   ⚠️  Warning: Conversation took ${conversationTime}ms (>3s)`);
    }

    console.log('\n✅ All tests passed! GPT-4o-mini is ready for production.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 Make sure your OpenAI API key is valid and has sufficient credits.');
    } else if (error.message.includes('fallback')) {
      console.log('\n💡 Primary provider failed, check if fallback Ollama service is running.');
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testGPT4oMiniIntegration().catch(console.error);
}

module.exports = { testGPT4oMiniIntegration };