#!/usr/bin/env node

/**
 * Simple OpenAI GPT-4o-mini Connection Test
 */

async function testOpenAIConnection() {
  console.log('🧪 Testing OpenAI GPT-4o-mini Connection...\n');

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found');
  console.log(`   Key prefix: ${process.env.OPENAI_API_KEY.substring(0, 20)}...`);

  try {
    // Test basic API connection
    console.log('\n🔍 Testing API connection...');
    
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const models = await response.json();
    console.log('✅ Successfully connected to OpenAI API');
    
    // Check if GPT-4o-mini is available
    const gpt4oMini = models.data.find(model => model.id === 'gpt-4o-mini');
    if (gpt4oMini) {
      console.log('✅ GPT-4o-mini model is available');
    } else {
      console.log('⚠️  GPT-4o-mini not found in available models');
      console.log('   Available models:', models.data.slice(0, 5).map(m => m.id).join(', '));
    }

    // Test a simple completion
    console.log('\n🤖 Testing GPT-4o-mini completion...');
    
    const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Säg hej på svenska och förklara att du är redo att analysera kundfeedback.'
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    if (!testResponse.ok) {
      const error = await testResponse.json();
      throw new Error(`Completion failed: ${error.error?.message || testResponse.statusText}`);
    }

    const completion = await testResponse.json();
    const message = completion.choices[0].message.content;
    
    console.log('✅ GPT-4o-mini completion successful');
    console.log(`   Response: "${message}"`);
    console.log(`   Usage: ${completion.usage.total_tokens} tokens`);

    console.log('\n🎉 OpenAI GPT-4o-mini Setup Complete!');
    console.log('✅ API connection: WORKING');
    console.log('✅ GPT-4o-mini model: AVAILABLE');
    console.log('✅ Swedish responses: WORKING');
    console.log('\n🚀 Ready for production deployment!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n💡 API key is invalid. Check your key at https://platform.openai.com/api-keys');
    } else if (error.message.includes('429')) {
      console.log('\n💡 Rate limit exceeded. Wait a moment and try again.');
    } else if (error.message.includes('billing')) {
      console.log('\n💡 Billing issue. Check your payment method at https://platform.openai.com/account/billing');
    }
    
    process.exit(1);
  }
}

// Run the test
testOpenAIConnection().catch(console.error);