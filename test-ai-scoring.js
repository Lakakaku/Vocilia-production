// Quick test script for the enhanced AI scoring system
const axios = require('axios');

// Mock data for testing
const testFeedback = "Jag var på ert kafé idag och köpte en cappuccino. Kaffet var riktigt bra, temperaturen var perfekt och mjölkskummet var krämigt. Personalen var trevlig, speciellt Emma som serverade mig. Hon visste exakt hur jag ville ha min drink. Lokalen var ren och mysig men det var lite kallt vid fönstret. Kanske ni kan justera värmen lite? Jag kommer definitivt tillbaka!";

const businessContext = {
  type: 'cafe',
  layout: {
    departments: ['drycker', 'bakverk', 'lunch'],
    checkouts: 1,
    selfCheckout: false
  },
  currentPromotions: ['20% rabatt på bakverk efter 15:00'],
  strengths: ['kvalitetskaffe', 'personlig service'],
  knownIssues: ['temperatur vid fönsterplatser']
};

const purchaseItems = ['cappuccino', 'kanelbulle'];

// Build the enhanced evaluation prompt
function buildEvaluationPrompt(transcript, businessContext, purchaseItems) {
  return `Du är en expert på att utvärdera kundåterrapportering för svenska företag. Din uppgift är att bedöma feedbacken objektiv och konsekvent.

FÖRETAGSKONTEXT:
Typ: ${businessContext.type}
Layout: Avdelningar: ${businessContext.layout.departments.join(', ')}, ${businessContext.layout.checkouts} kassor
Aktuella erbjudanden: ${businessContext.currentPromotions.join(', ')}
Styrkor: ${businessContext.strengths.join(', ')}
Kända utmaningar: ${businessContext.knownIssues.join(', ')}

KÖPTA PRODUKTER: ${purchaseItems.join(', ')}

KUNDFEEDBACK ATT UTVÄRDERA:
"${transcript}"

BEDÖMNINGSKRITERIER (0-100 poäng vardera):

1. AUTENTICITET (Vikt: 40%)
   90-100: Perfekt match med företagskontext, visar djup förståelse
   75-89: Mycket trovärdigt, stämmer väl överens med kontext  
   60-74: Rimligt trovärdigt, några detaljer stämmer
   45-59: Delvis trovärdig men vaga referencer
   0-44: Otrovärdigt eller helt irrelevant för företaget

2. KONKRETHET (Vikt: 30%)
   90-100: Mycket specifika, mätbara observationer och förslag
   75-89: Flera konkreta detaljer och handlingsbara insikter
   60-74: Några specifika exempel eller förslag
   45-59: Mestadels allmänt men med några konkreta element
   0-44: Vag, allmän feedback utan specifika detaljer

3. DJUP (Vikt: 30%)
   90-100: Djupgående analys med sammanhang och konsekvenser
   75-89: Välformulerad reflektion med god förståelse
   60-74: Genomtänkt feedback med rimlig förklaring
   45-59: Grundläggande förklaring av upplevelsen
   0-44: Ytlig kommentar utan fördjupning

INSTRUKTIONER:
1. Läs feedbacken noggrant
2. Jämför mot företagskontexten  
3. Betygssätt enligt kriterierna
4. Var strikt men rättvis
5. Förklara ditt resonemang tydligt

Svara med ENDAST denna JSON-struktur (utan markdown eller extra text):
{
  "authenticity": number,
  "concreteness": number,
  "depth": number,
  "total_score": number,
  "reasoning": "Detaljerad förklaring av bedömningen",
  "categories": ["kategori1", "kategori2"],
  "sentiment": number,
  "confidence": number
}

VIKTIGT: 
- Sentiment: -1.0 (mycket negativ) till +1.0 (mycket positiv)
- Confidence: 0.0-1.0 (hur säker du är på bedömningen)
- Categories: Svenska ord som "service", "kvalitet", "miljö", "personal", "pris", "produkter", "upplevelse"`;
}

async function testAIScoring() {
  try {
    console.log('🧪 Testing Enhanced AI Scoring System\n');
    
    // Test Ollama connection
    console.log('1. Testing Ollama connection...');
    const healthResponse = await axios.get('http://localhost:11434/api/tags');
    const models = healthResponse.data.models;
    console.log(`✅ Ollama connected. Available models: ${models.map(m => m.name).join(', ')}\n`);
    
    // Test evaluation
    console.log('2. Testing feedback evaluation...');
    const prompt = buildEvaluationPrompt(testFeedback, businessContext, purchaseItems);
    
    console.log('📝 Test feedback:');
    console.log(`"${testFeedback}"\n`);
    
    const startTime = Date.now();
    const evaluationResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:latest',
      prompt,
      stream: false,
      temperature: 0.7
    });
    
    const latency = Date.now() - startTime;
    const aiResponse = evaluationResponse.data.response;
    
    console.log('🤖 AI Response:');
    console.log(aiResponse);
    console.log(`\n⏱️  Response time: ${latency}ms\n`);
    
    // Try to parse JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed evaluation:');
        console.log(`   Authenticity: ${evaluation.authenticity}/100`);
        console.log(`   Concreteness: ${evaluation.concreteness}/100`);
        console.log(`   Depth: ${evaluation.depth}/100`);
        console.log(`   Total Score: ${evaluation.total_score}/100`);
        console.log(`   Sentiment: ${evaluation.sentiment}`);
        console.log(`   Categories: ${evaluation.categories?.join(', ')}`);
        console.log(`   Confidence: ${evaluation.confidence}`);
        console.log(`   Reasoning: ${evaluation.reasoning}\n`);
        
        // Calculate reward
        const rewardTiers = [
          { min: 90, max: 100, rewardPercentage: [0.08, 0.12] },
          { min: 75, max: 89, rewardPercentage: [0.04, 0.07] },
          { min: 60, max: 74, rewardPercentage: [0.01, 0.03] },
          { min: 0, max: 59, rewardPercentage: [0, 0] }
        ];
        
        const tier = rewardTiers.find(t => evaluation.total_score >= t.min && evaluation.total_score <= t.max);
        const purchaseAmount = 85; // SEK
        const rewardPercentage = tier ? tier.rewardPercentage[0] + 
          ((evaluation.total_score - tier.min) / (tier.max - tier.min)) * 
          (tier.rewardPercentage[1] - tier.rewardPercentage[0]) : 0;
        
        const rewardAmount = Math.round(purchaseAmount * rewardPercentage);
        
        console.log('💰 Reward Calculation:');
        console.log(`   Purchase Amount: ${purchaseAmount} SEK`);
        console.log(`   Reward Percentage: ${(rewardPercentage * 100).toFixed(1)}%`);
        console.log(`   Reward Amount: ${rewardAmount} SEK\n`);
        
        console.log('🎉 Test completed successfully!');
        
      } else {
        console.log('❌ Could not find JSON in AI response');
      }
    } catch (parseError) {
      console.log('❌ Failed to parse AI response as JSON:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAIScoring();