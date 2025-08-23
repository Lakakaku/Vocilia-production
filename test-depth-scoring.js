// Test script for depth scoring algorithm
console.log('🧪 Testing Depth Scoring Algorithm\n');

const testCases = [
  {
    name: "Very High Depth",
    transcript: "När jag tänker efter om mitt besök idag så känner jag att atmosfären verkligen påverkade min upplevelse positivt. Jag märkte att personalen Emma hade ett genuint intresse för att hjälpa mig förstå skillnaden mellan olika kaffesorter. Detta leder till en känsla av att ni verkligen bryr er om kundernas upplevelse, inte bara försäljningen. Jämfört med andra kaféer jag besökt så är era baristas mycket mer kunniga. Eftersom ni arbetar med lokalproducerade produkter så förstår jag att det kan vara en utmaning att hålla priserna nere, men det skapar också en unik identitet. På sikt tror jag det här kan vara er största konkurrensfördel. Mitt förslag är att ni tydligare kommunicerar värdet av era lokala produkter - det skulle hjälpa kunder som mig att bättre förstå priserna.",
    expectedRange: [85, 100]
  },
  {
    name: "High Depth",
    transcript: "Jag känner att servicen var mycket bra idag eftersom Emma tog sig tid att förklara kaffets ursprung. Det får mig att uppskatta besöket mer än vanligt. Atmosfären känns mycket avslappnad jämfört med andra ställen. Detta påverkar andra kunder positivt också - jag såg att familjen vid bordet bredvid verkade trivas. Mitt förslag skulle vara att ha mer information om kaffeproducenterna synligt.",
    expectedRange: [70, 85]
  },
  {
    name: "Medium Depth", 
    transcript: "Jag tänker att servicen var bra. Personalen var trevlig och kaffet smakade bra. Lokalen känns mysig och jag kommer nog tillbaka. Priset var okej för kvaliteten.",
    expectedRange: [40, 65]
  },
  {
    name: "Low Depth",
    transcript: "Det var bara bra. Allt var som vanligt. Inget speciellt att säga egentligen. Okej kaffe och trevlig personal. Det var det.",
    expectedRange: [10, 35]
  },
  {
    name: "Very Low Depth",
    transcript: "Bra. Okej. Inga kommentarer.",
    expectedRange: [0, 15]
  }
];

const businessContext = {
  type: 'cafe',
  layout: {
    departments: ['drycker', 'bakverk', 'lunch'],
    checkouts: 1,
    selfCheckout: false
  },
  strengths: ['kvalitetskaffe', 'personlig service'],
  knownIssues: ['temperatur vid fönsterplatser']
};

const purchaseItems = ['cappuccino', 'kanelbulle'];

function analyzeDepthManually(transcript, businessContext, purchaseItems) {
  const text = transcript.toLowerCase();
  const analysis = {
    reflectiveElements: [],
    causalReasoningInstances: [],
    contextualUnderstanding: [],
    consequenceConsiderations: [],
    comparativeInsights: [],
    emotionalDepth: [],
    constructiveNature: [],
    superficialIndicators: []
  };

  // 1. Reflective elements
  const reflectivePatterns = [
    /\b(jag\s+(tänker|funderar|reflekterar|känner|upplever)\s+att)/g,
    /\b(det\s+(gör\s+mig|får\s+mig\s+att|påverkar\s+mig))/g,
    /\b(jag\s+(märkte|observerade|lade\s+märke\s+till|upptäckte))/g,
    /\b(enligt\s+min\s+(åsikt|upplevelse|uppfattning))/g,
    /\b(ur\s+mitt\s+perspektiv|från\s+min\s+synvinkel)/g,
    /\b(när\s+jag\s+(tänker\s+efter|reflekterar|funderar))/g
  ];

  reflectivePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.reflectiveElements.push(...matches);
    }
  });

  // 2. Causal reasoning
  const causalPatterns = [
    /\b(eftersom|därför\s+att|på\s+grund\s+av|beroende\s+på)/g,
    /\b(det\s+(leder\s+till|resulterar\s+i|orsakar|betyder\s+att))/g,
    /\b(anledningen\s+(är\s+att|till\s+att)|orsaken\s+är)/g,
    /\b(följden\s+(blir|av\s+detta)|konsekvensen\s+är)/g,
    /\b(detta\s+(innebär|påverkar|medför)\s+att)/g
  ];

  causalPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.causalReasoningInstances.push(...matches);
    }
  });

  // 3. Contextual understanding
  const contextualPatterns = [
    /\b(förstår\s+att\s+ni|jag\s+vet\s+att\s+ni|medveten\s+om\s+att)/g,
    /\b(med\s+tanke\s+på|i\s+relation\s+till|jämfört\s+med)/g,
    /\b(inom\s+(branschen|området)|för\s+en\s+(restaurang|butik|kafé))/g,
    /\b(som\s+(kund|gäst|besökare)\s+förväntar\s+jag\s+mig)/g,
    /\b(era\s+(utmaningar|möjligheter|styrkor|svagheter))/g
  ];

  contextualPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.contextualUnderstanding.push(...matches);
    }
  });

  // 4. Consequence considerations
  const consequencePatterns = [
    /\b(det\s+kan\s+(leda\s+till|betyda\s+att|resultera\s+i))/g,
    /\b(påverka(r\s+andra\s+kunder|r\s+verksamheten|r\s+upplevelsen))/g,
    /\b(långsiktigt|på\s+sikt|i\s+framtiden|framöver)/g,
    /\b(kunde\s+(påverka|förbättra|förvärra|förändra))/g
  ];

  consequencePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.consequenceConsiderations.push(...matches);
    }
  });

  // 5. Comparative insights
  const comparativePatterns = [
    /\b(jämfört\s+med\s+(andra|tidigare)|i\s+förhållande\s+till)/g,
    /\b(andra\s+(ställen|restauranger|kaféer|butiker))/g,
    /\b(tidigare\s+(besök|erfarenheter|upplevelser))/g,
    /\b(vanligtvis|normalt\s+sett|brukar\s+vara)/g
  ];

  comparativePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.comparativeInsights.push(...matches);
    }
  });

  // 6. Emotional depth
  const emotionalPatterns = [
    /\b(känns\s+(som|att)|känsla\s+av|stämning(en\s+är|en\s+var))/g,
    /\b(atmosfär(en\s+är|en\s+var|en\s+känns)|miljö(n\s+känns|n\s+var))/g,
    /\b(trygg(het|a)|bekväm|avslappna(d|de)|stressig|orolig)/g,
    /\b(uppskattar\s+verkligen|djupt\s+tacksam|riktigt\s+nöjd)/g
  ];

  emotionalPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.emotionalDepth.push(...matches);
    }
  });

  // 7. Constructive nature
  const constructivePatterns = [
    /\b(förslag\s+(är\s+att|skulle\s+vara)|rekommendation)/g,
    /\b(skulle\s+(kunna|vara\s+bra\s+att|hjälpa\s+om))/g,
    /\b(möjlighet\s+(att\s+förbättra|för\s+utveckling))/g,
    /\b(hoppas\s+att|önskar\s+att|skulle\s+vara\s+bra)/g
  ];

  constructivePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.constructiveNature.push(...matches);
    }
  });

  // 8. Superficial indicators
  const superficialPatterns = [
    /\b(bara|endast|enbart)\s+(bra|dåligt|okej|ok)/g,
    /\b(inget\s+(speciellt|mer\s+att\s+säga)|inga\s+kommentarer)/g,
    /\b(som\s+vanligt|som\s+alltid|som\s+förväntat)/g,
    /\b(helt\s+enkelt|bara\s+så|det\s+var\s+det)/g
  ];

  superficialPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      analysis.superficialIndicators.push(...matches);
    }
  });

  // Calculate score
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const avgWordsPerSentence = transcript.split(/\s+/).length / Math.max(1, sentences.length);
  const complexityScore = Math.min(15, Math.max(0, (avgWordsPerSentence - 5) * 2));

  const reflectiveScore = Math.min(20, analysis.reflectiveElements.length * 10);
  const causalScore = Math.min(20, analysis.causalReasoningInstances.length * 8);
  const contextualScore = Math.min(15, analysis.contextualUnderstanding.length * 7);
  const consequenceScore = Math.min(15, analysis.consequenceConsiderations.length * 7);
  const comparativeScore = Math.min(10, analysis.comparativeInsights.length * 5);
  const emotionalScore = Math.min(10, analysis.emotionalDepth.length * 4);
  const constructiveScore = Math.min(10, analysis.constructiveNature.length * 5);
  const superficialPenalty = Math.min(20, analysis.superficialIndicators.length * 4);

  let score = complexityScore + reflectiveScore + causalScore + contextualScore + 
              consequenceScore + comparativeScore + emotionalScore + constructiveScore - 
              superficialPenalty;

  score = Math.min(100, Math.max(0, score));

  return { score, analysis, avgWordsPerSentence, complexityScore };
}

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   Text: "${testCase.transcript.substring(0, 80)}..."`);
  
  const result = analyzeDepthManually(testCase.transcript, businessContext, purchaseItems);
  
  console.log(`   🎯 Score: ${result.score}/100`);
  console.log(`   📊 Analysis:`);
  console.log(`      - Sentence Complexity: Avg ${result.avgWordsPerSentence.toFixed(1)} words/sentence (${result.complexityScore} points)`);
  console.log(`      - Reflective Elements: ${result.analysis.reflectiveElements.length} items`);
  if (result.analysis.reflectiveElements.length > 0) {
    console.log(`        "${result.analysis.reflectiveElements.slice(0, 2).join('", "')}"`);
  }
  console.log(`      - Causal Reasoning: ${result.analysis.causalReasoningInstances.length} items`);
  if (result.analysis.causalReasoningInstances.length > 0) {
    console.log(`        "${result.analysis.causalReasoningInstances.slice(0, 2).join('", "')}"`);
  }
  console.log(`      - Contextual Understanding: ${result.analysis.contextualUnderstanding.length} items`);
  console.log(`      - Consequence Considerations: ${result.analysis.consequenceConsiderations.length} items`);
  console.log(`      - Comparative Insights: ${result.analysis.comparativeInsights.length} items`);
  console.log(`      - Emotional Depth: ${result.analysis.emotionalDepth.length} items`);
  console.log(`      - Constructive Nature: ${result.analysis.constructiveNature.length} items`);
  console.log(`      - Superficial Indicators: ${result.analysis.superficialIndicators.length} items (penalty)`);
  if (result.analysis.superficialIndicators.length > 0) {
    console.log(`        "${result.analysis.superficialIndicators.slice(0, 2).join('", "')}"`);
  }
  
  const isInRange = result.score >= testCase.expectedRange[0] && result.score <= testCase.expectedRange[1];
  console.log(`   ${isInRange ? '✅' : '❌'} Expected: ${testCase.expectedRange[0]}-${testCase.expectedRange[1]}`);
  
  if (!isInRange) {
    console.log(`   ⚠️  Score outside expected range!`);
  }
  
  console.log('');
});

console.log('🎉 Depth scoring test completed!');

// Test depth factors specifically
console.log('\n🔍 Testing Specific Depth Factors:');

const depthFactorTests = [
  {
    text: "Jag tänker att servicen var bra eftersom personalen var hjälpsam",
    factors: "Reflective + Causal reasoning"
  },
  {
    text: "Jämfört med andra kaféer så är atmosfären här mycket bättre",
    factors: "Comparative insights + Emotional depth"
  },
  {
    text: "Det kan leda till att andra kunder också trivs bättre på sikt",
    factors: "Consequence considerations + Future thinking"
  },
  {
    text: "Bara bra. Inget speciellt. Som vanligt helt enkelt.",
    factors: "Multiple superficial indicators (should get penalty)"
  }
];

depthFactorTests.forEach((test, i) => {
  const result = analyzeDepthManually(test.text, businessContext, purchaseItems);
  console.log(`${i + 1}. "${test.text}"`);
  console.log(`   Factor: ${test.factors}`);
  console.log(`   Score: ${result.score}/100`);
  console.log('');
});

console.log('✨ All depth scoring tests completed!');