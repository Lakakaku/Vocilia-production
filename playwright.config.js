// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Main Playwright configuration for comprehensive E2E testing
 * Covers all user journeys, browsers, and production scenarios
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 10000
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/e2e-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['list'],
    // Custom reporter for Swedish pilot monitoring
    ['./tests/e2e/reporters/pilot-reporter.js']
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Maximum time each action such as `click()` can take. */
    actionTimeout: 15000,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
    /* Ignore HTTPS errors for local testing */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for comprehensive testing */
  projects: [
    // Desktop browsers for admin and business dashboard testing
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },
    {
      name: 'Desktop Firefox',
      use: { 
        ...devices['Desktop Firefox'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },
    {
      name: 'Desktop Safari',
      use: { 
        ...devices['Desktop Safari'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },

    // Mobile devices for customer PWA testing
    {
      name: 'iPhone 15 Pro',
      use: { 
        ...devices['iPhone 15 Pro'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },
    {
      name: 'iPhone 14',
      use: { 
        ...devices['iPhone 14'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },
    {
      name: 'iPhone 13',
      use: { 
        ...devices['iPhone 13'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },
    {
      name: 'Samsung Galaxy S23',
      use: { 
        ...devices['Galaxy S III'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },
    {
      name: 'iPad Pro',
      use: { 
        ...devices['iPad Pro'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    },

    // Edge case browsers
    {
      name: 'Chrome Android',
      use: { 
        ...devices['Pixel 5'],
        permissions: ['microphone', 'camera', 'geolocation']
      },
    }
  ],

  /* Folder for test artifacts */
  outputDir: 'test-results/e2e-artifacts/',

  /* Run local development servers before starting tests */
  webServer: [
    {
      command: 'npm run dev:web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        E2E_TESTING: 'true'
      }
    },
    {
      command: 'npm run dev:api', 
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        E2E_TESTING: 'true'
      }
    },
    {
      command: 'npm run dev:business',
      port: 3002,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        E2E_TESTING: 'true'
      }
    }
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),

  // Test match patterns
  testMatch: [
    'tests/e2e/**/*.test.js',
    'tests/e2e/**/*.spec.js'
  ],

  // Test ignore patterns
  testIgnore: [
    'tests/e2e/fixtures/**',
    'tests/e2e/utils/**',
    'tests/e2e/reporters/**'
  ]
});