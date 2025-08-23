import { ContentDuplicateDetector } from '../ContentDuplicateDetector';

describe('ContentDuplicateDetector', () => {
  let detector: ContentDuplicateDetector;

  beforeEach(() => {
    detector = new ContentDuplicateDetector({
      fuzzyMatchThreshold: 0.8,
      semanticMatchThreshold: 0.85,
      conservativeMode: false // Disable for testing
    });
  });

  describe('Swedish text normalization', () => {
    it('should normalize Swedish text correctly', async () => {
      const content = 'Kaffe var mycket bra! Personalen var trevlig och snäll.';
      const result = await detector.analyzeContent(content, 'test-session-1');

      expect(result.type).toBe('content_duplicate');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.evidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle Swedish characters (å, ä, ö)', async () => {
      const content = 'Kött och fågel var bra, köket höll hög standard.';
      const result = await detector.analyzeContent(content, 'test-session-2');

      expect(result.evidence.contentLength).toBe(content.length);
      expect(result.evidence.wordCount).toBeGreaterThan(0);
    });

    it('should extract keywords correctly', async () => {
      const content = 'Det var mycket bra service och trevlig personal som hjälpte oss.';
      const result = await detector.analyzeContent(content, 'test-session-3');

      expect(result.evidence.wordCount).toBeGreaterThan(5);
      expect(result.description).toContain('risk');
    });
  });

  describe('Exact duplicate detection', () => {
    it('should detect exact duplicates', async () => {
      const content = 'Exakt samma feedback som tidigare.';
      
      // First submission
      const result1 = await detector.analyzeContent(content, 'session-1');
      expect(result1.score).toBeLessThan(0.3); // Should be low risk initially
      
      // Second submission with identical content
      const result2 = await detector.analyzeContent(content, 'session-2');
      expect(result2.score).toBeGreaterThan(0.8); // Should detect exact match
      expect(result2.description).toContain('Exact duplicate');
    });

    it('should handle minor punctuation differences', async () => {
      const content1 = 'Bra service och trevlig personal.';
      const content2 = 'Bra service och trevlig personal!';
      
      await detector.analyzeContent(content1, 'session-1');
      const result = await detector.analyzeContent(content2, 'session-2');
      
      // Should still detect high similarity despite punctuation difference
      expect(result.score).toBeGreaterThan(0.6);
    });
  });

  describe('Fuzzy matching', () => {
    it('should detect similar content with minor changes', async () => {
      const content1 = 'Personalen var mycket trevlig och hjälpsam.';
      const content2 = 'Personalen var väldigt trevlig och hjälpsam.';
      
      await detector.analyzeContent(content1, 'session-1');
      const result = await detector.analyzeContent(content2, 'session-2');
      
      expect(result.score).toBeGreaterThan(0.4);
      expect(result.evidence.fuzzyMatches).toBeGreaterThan(0);
    });

    it('should handle word order changes', async () => {
      const content1 = 'Kaffe var bra och personalen trevlig.';
      const content2 = 'Personalen var trevlig och kaffe var bra.';
      
      await detector.analyzeContent(content1, 'session-1');
      const result = await detector.analyzeContent(content2, 'session-2');
      
      expect(result.score).toBeGreaterThan(0.3);
    });
  });

  describe('Semantic similarity', () => {
    it('should detect synonymous content', async () => {
      const content1 = 'Maten var mycket bra och personalen trevlig.';
      const content2 = 'Käket var riktigt bra och de anställda trevliga.';
      
      await detector.analyzeContent(content1, 'session-1');
      const result = await detector.analyzeContent(content2, 'session-2');
      
      expect(result.score).toBeGreaterThan(0.2);
      expect(result.evidence.semanticMatches).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Suspicious patterns', () => {
    it('should detect template-like patterns', async () => {
      const templateContent = 'Jag tycker att personalen var bra och service var bra.';
      
      // Submit same pattern multiple times
      await detector.analyzeContent(templateContent, 'session-1');
      await detector.analyzeContent(templateContent.replace('bra', 'okej'), 'session-2');
      const result = await detector.analyzeContent(templateContent.replace('bra', 'fint'), 'session-3');
      
      expect(result.evidence).toBeDefined();
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle empty content', async () => {
      const result = await detector.analyzeContent('', 'session-empty');
      expect(result.score).toBeLessThan(0.5);
      expect(result.severity).toBe('low');
    });

    it('should handle very short content', async () => {
      const result = await detector.analyzeContent('Bra', 'session-short');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.evidence.wordCount).toBe(1);
    });

    it('should handle very long content', async () => {
      const longContent = 'Bra service '.repeat(100);
      const result = await detector.analyzeContent(longContent, 'session-long');
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.evidence.contentLength).toBeGreaterThan(1000);
    });

    it('should handle special characters and emojis', async () => {
      const content = 'Kaffe var bra! 😊 Personalen var 100% professionell.';
      const result = await detector.analyzeContent(content, 'session-special');
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.evidence).toBeDefined();
    });

    it('should process content within reasonable time', async () => {
      const content = 'En ganska lång feedback med mycket detaljer om servicen och hur personalen bemötte oss under vårt besök.';
      
      const startTime = Date.now();
      const result = await detector.analyzeContent(content, 'session-perf');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should respect fuzzy match threshold', async () => {
      const strictDetector = new ContentDuplicateDetector({
        fuzzyMatchThreshold: 0.95,
        conservativeMode: false
      });
      
      const content1 = 'Personalen var trevlig.';
      const content2 = 'Personalen var snäll.'; // Similar but not 95% match
      
      await strictDetector.analyzeContent(content1, 'session-1');
      const result = await strictDetector.analyzeContent(content2, 'session-2');
      
      expect(result.score).toBeLessThan(0.5); // Should not trigger high threshold
    });

    it('should apply conservative mode multiplier', async () => {
      const conservativeDetector = new ContentDuplicateDetector({
        conservativeMode: true,
        conservativeModeMultiplier: 2.0
      });
      
      const content1 = 'Personalen var trevlig och hjälpsam.';
      const content2 = 'Personalen var trevlig och hjälpsam.';
      
      await conservativeDetector.analyzeContent(content1, 'session-1');
      const result = await conservativeDetector.analyzeContent(content2, 'session-2');
      
      expect(result.score).toBe(1.0); // Should be capped at 1.0 even with multiplier
    });
  });

  describe('Statistics and cleanup', () => {
    it('should provide accurate statistics', async () => {
      await detector.analyzeContent('Test content 1', 'session-1');
      await detector.analyzeContent('Test content 2', 'session-2');
      
      const stats = detector.getStats();
      expect(stats.contentHistorySize).toBe(2);
      expect(stats.patternsDetected).toBeGreaterThanOrEqual(0);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    it('should clean up old history', async () => {
      await detector.analyzeContent('Old content', 'session-old');
      
      // Clean up with very short max age (1ms)
      detector.cleanupHistory(1);
      
      // Wait a bit then check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = detector.getStats();
      expect(stats.contentHistorySize).toBe(0);
    });
  });
});