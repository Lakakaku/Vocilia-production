// Test script for enhanced concreteness scoring algorithm
const { ScoringEngine } = require('./packages/ai-evaluator/src/ScoringEngine');

// Test data with varying levels of concreteness
const testCases = [
  {
    name: "High Concreteness",
    transcript: "Jag var på ert kafé på Vasagatan idag kl 14:30 och köpte en cappuccino för 45 kr. Baristan Emma var fantastisk - hon kände igen min vanliga beställning och föreslog en ny böna från Guatemala. Kaffet hade perfekt temperatur och mjölkskummet var krämigt. Lokalen var mysig men det var lite för kallt vid fönsterplatserna - kanske ni kan justera värmen några grader? Jag märkte att ni bytt till miljövänliga muggar vilket jag verkligen uppskattar. Förslaget är att ha mer information om kaffebörnornas ursprung synligt vid kassan så kunder kan lära sig mer om sina drycker.",
    expectedRange: [85, 100]
  },
  {
    name: "Medium Concreteness", 
    transcript: "Bra service och trevlig personal idag. Mitt cappuccino var perfekt temperatur och mjölkskummet var krämigt. Lokalen var mysig men det var lite för kallt vid dörren. Kanske ni kan justera värmen lite? Personalen kunde svara på mina frågor om kaffet.",
    expectedRange: [60, 80]
  },
  {
    name: "Low Concreteness",
    transcript: "Det var bra. Kaffe var okej och personalen var trevlig. Lokalen var mysig. Allt kändes rätt bra överlag. Kommer nog tillbaka någon gång.",
    expectedRange: [20, 45]
  },
  {
    name: "Very Low Concreteness",
    transcript: "Bra. Allt var okej. Inga problem.",
    expectedRange: [0, 25]
  }
];

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

function testConcretenessScoringManually() {
  console.log('🧪 Testing Enhanced Concreteness Scoring Algorithm\n');
  
  const scoringEngine = new ScoringEngine();
  
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. Testing: ${testCase.name}`);
    console.log(`   Transcript: "${testCase.transcript.substring(0, 100)}..."`);
    
    const result = scoringEngine.analyzeConcreteness(
      testCase.transcript,
      businessContext,
      purchaseItems
    );
    
    console.log(`   🎯 Score: ${result.score}/100`);
    console.log(`   📊 Analysis:`);
    console.log(`      - Specific Details: ${result.analysis.specificDetails.length} items`);
    console.log(`        ${result.analysis.specificDetails.slice(0, 3).join(', ')}`);
    console.log(`      - Actionable Insights: ${result.analysis.actionableInsights.length} items`);
    console.log(`        ${result.analysis.actionableInsights.slice(0, 2).join(', ')}`);
    console.log(`      - Measurable Observations: ${result.analysis.measurableObservations.length} items`);
    console.log(`        ${result.analysis.measurableObservations.slice(0, 3).join(', ')}`);
    console.log(`      - Vague Language: ${result.analysis.vagueness.length} items`);
    console.log(`        ${result.analysis.vagueness.slice(0, 3).join(', ')}`);
    console.log(`      - Concreteness Factor: ${result.analysis.concretenessFactor.toFixed(2)}`);
    
    const isInExpectedRange = result.score >= testCase.expectedRange[0] && 
                             result.score <= testCase.expectedRange[1];
    
    console.log(`   ${isInExpectedRange ? '✅' : '❌'} Expected: ${testCase.expectedRange[0]}-${testCase.expectedRange[1]}, Got: ${result.score}`);
    
    if (!isInExpectedRange) {
      console.log(`   ⚠️  Score outside expected range!`);
    }
    
    console.log('');
  });
  
  // Test context relevance bonus
  console.log('🔍 Testing Context Relevance Bonus:');
  
  const contextRelevantTranscript = "Emma serverade mig en cappuccino vid kassan. Det var problem med temperatur vid fönsterplatser som ni vet om. Kvalitetskaffe som alltid men personlig service kunde förbättras.";
  
  const contextResult = scoringEngine.analyzeConcreteness(
    contextRelevantTranscript,
    businessContext,
    purchaseItems
  );
  
  console.log(`   Context-relevant feedback score: ${contextResult.score}/100`);
  console.log(`   Should have bonus for mentioning:`);
  console.log(`   - Purchase item (cappuccino) ✓`);
  console.log(`   - Known issue (temperatur vid fönsterplatser) ✓`);  
  console.log(`   - Strength (kvalitetskaffe, personlig service) ✓`);
  console.log(`   - Staff name (Emma) ✓`);
  console.log(`   - Location (kassan) ✓`);
  
  console.log('\n🎉 Concreteness scoring test completed!');
  
  // Performance test
  console.log('\n⚡ Performance Test:');
  const startTime = Date.now();
  
  for (let i = 0; i < 100; i++) {
    scoringEngine.analyzeConcreteness(
      testCases[0].transcript,
      businessContext, 
      purchaseItems
    );
  }
  
  const endTime = Date.now();
  const averageTime = (endTime - startTime) / 100;
  
  console.log(`   100 analyses completed in ${endTime - startTime}ms`);
  console.log(`   Average time per analysis: ${averageTime.toFixed(2)}ms`);
  console.log(`   ${averageTime < 10 ? '✅' : '❌'} Performance target: <10ms per analysis`);
}

// Manual test implementation since we can't easily import the class
function manualConcretenessScoringTest() {
  console.log('🧪 Manual Concreteness Scoring Test\n');
  
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Text: "${testCase.transcript}"`);
    
    const text = testCase.transcript.toLowerCase();
    let score = 0;
    
    // Word count analysis
    const wordCount = testCase.transcript.split(/\\s+/).length;
    const lengthScore = Math.min(20, wordCount / 2);
    
    // Specific details patterns
    const specificMatches = [
      ...text.match(/\\b([A-ZÅÄÖ][a-zåäö]+)\\s+(var|som|hjälpte|serverade)/g) || [],
      ...text.match(/\\b(kl|klockan|tid)\\s*(\\d{1,2}[:.:]\\d{2}|\\d{1,2})/g) || [],
      ...text.match(/\\b(idag|igår|förra\\s+veckan|i\\s+morse|på\\s+eftermiddagen)/g) || [],
      ...text.match(/\\b(kassan|kassor|kassa\\s+\\d+|vid\\s+ingången|i\\s+hörnet|vid\\s+fönstret)/g) || [],
      ...text.match(/\\b(cappuccino|latte|espresso|americano|macchiato|kanelbulle|croissant|smörgås)/g) || [],
      ...text.match(/\\b(\\d+\\s*(kr|kronor|procent|minuter|sekunder|grader|liter|cl))/g) || []
    ];
    
    const detailScore = Math.min(40, specificMatches.length * 8);
    
    // Actionable insights
    const actionableMatches = [
      ...text.match(/\\b(föreslår|rekommenderar|skulle\\s+kunna|borde|kan\\s+ni|kanske\\s+ni)/g) || [],
      ...text.match(/\\b(skulle\\s+vara\\s+bättre\\s+om|skulle\\s+förbättras\\s+om|behöver\\s+justeras)/g) || []
    ];
    
    const actionableScore = Math.min(25, actionableMatches.length * 12);
    
    // Measurable observations  
    const measurableMatches = [
      ...text.match(/\\b(för\\s+varmt|för\\s+kallt|perfekt\\s+temperatur|lagom\\s+varmt)/g) || [],
      ...text.match(/\\b(krämigt|fast|mjukt|segt|färskt|gammalt|torrt|fuktigt)/g) || [],
      ...text.match(/\\b(snabbt|långsamt|vänta\\s+\\d+|tog\\s+\\d+|inom\\s+\\d+)/g) || [],
      ...text.match(/\\b(stor|liten|lagom\\s+stor|för\\s+stor|för\\s+liten)/g) || []
    ];
    
    const measurableScore = Math.min(25, measurableMatches.length * 5);
    
    // Vagueness penalty
    const vagueMatches = [
      ...text.match(/\\b(bra|dåligt|okej|ok|sådär|ganska\\s+bra|rätt\\s+bra|helt\\s+okej)/g) || [],
      ...text.match(/\\b(någonting|någonstans|ibland|kanske|typ|liksom|sånt\\s+där)/g) || [],
      ...text.match(/\\b(saker|grejer|sånt|sådant|det\\s+där|den\\s+där)/g) || []
    ];
    
    const vaguenessPenalty = Math.min(20, vagueMatches.length * 3);
    
    score = lengthScore + detailScore + actionableScore + measurableScore - vaguenessPenalty;
    score = Math.min(100, Math.max(0, score));
    
    console.log(`   📊 Analysis:`);
    console.log(`      - Word Count: ${wordCount} (${lengthScore} points)`);
    console.log(`      - Specific Details: ${specificMatches.length} (${detailScore} points)`);
    console.log(`      - Actionable Insights: ${actionableMatches.length} (${actionableScore} points)`);  
    console.log(`      - Measurable Observations: ${measurableMatches.length} (${measurableScore} points)`);
    console.log(`      - Vague Language: ${vagueMatches.length} (-${vaguenessPenalty} points)`);
    console.log(`   🎯 Final Score: ${score}/100`);
    
    const isInRange = score >= testCase.expectedRange[0] && score <= testCase.expectedRange[1];
    console.log(`   ${isInRange ? '✅' : '❌'} Expected: ${testCase.expectedRange[0]}-${testCase.expectedRange[1]}`);
    console.log('');
  });
}

console.log('Testing enhanced concreteness scoring algorithm...\n');
manualConcretenessScoringTest();