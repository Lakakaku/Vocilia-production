// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * iOS Safari specific Playwright configuration
 * Focuses on mobile Safari compatibility testing
 */
module.exports = defineConfig({
  testDir: './tests/ios-safari',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 5000
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/ios-safari' }],
    ['json', { outputFile: 'test-results/ios-safari/results.json' }],
    ['list']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // iPhone devices
    {
      name: 'iPhone 15 Pro',
      use: { 
        ...devices['iPhone 15 Pro'],
        permissions: ['microphone', 'camera']
      },
    },
    {
      name: 'iPhone 14',
      use: { 
        ...devices['iPhone 14'],
        permissions: ['microphone', 'camera']
      },
    },
    {
      name: 'iPhone 13',
      use: { 
        ...devices['iPhone 13'],
        permissions: ['microphone', 'camera']
      },
    },
    
    // iPad devices
    {
      name: 'iPad Pro',
      use: { 
        ...devices['iPad Pro'],
        permissions: ['microphone', 'camera']
      },
    },
    {
      name: 'iPad Air',
      use: { 
        ...devices['iPad Air'],
        permissions: ['microphone', 'camera']
      },
    },

    // Safari on macOS (for baseline comparison)
    {
      name: 'Safari Desktop',
      use: { 
        ...devices['Desktop Safari'],
        permissions: ['microphone', 'camera']
      },
    }
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'test-results/ios-safari/',

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev:web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes
    },
    {
      command: 'npm run dev:api', 
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes
    }
  ],

  // Global test setup
  globalSetup: require.resolve('./tests/ios-safari/global-setup.js'),
  globalTeardown: require.resolve('./tests/ios-safari/global-teardown.js'),
});