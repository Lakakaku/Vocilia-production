// Basic test to validate Jest setup
describe('Basic Jest Configuration Test', () => {
  test('should be able to run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  test('should have access to Jest globals', () => {
    expect(typeof describe).toBe('function');
    expect(typeof test).toBe('function');
    expect(typeof expect).toBe('function');
  });

  test('should support async tests', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });
});

// Simple function to test coverage
function simpleCalculator(a, b, operation) {
  switch(operation) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    default:
      throw new Error('Unknown operation');
  }
}

describe('Simple Calculator Coverage Test', () => {
  test('should add numbers', () => {
    expect(simpleCalculator(2, 3, 'add')).toBe(5);
  });

  test('should subtract numbers', () => {
    expect(simpleCalculator(5, 2, 'subtract')).toBe(3);
  });

  test('should multiply numbers', () => {
    expect(simpleCalculator(3, 4, 'multiply')).toBe(12);
  });

  test('should divide numbers', () => {
    expect(simpleCalculator(10, 2, 'divide')).toBe(5);
  });

  test('should throw error for division by zero', () => {
    expect(() => simpleCalculator(10, 0, 'divide')).toThrow('Division by zero');
  });

  test('should throw error for unknown operation', () => {
    expect(() => simpleCalculator(1, 2, 'unknown')).toThrow('Unknown operation');
  });
});