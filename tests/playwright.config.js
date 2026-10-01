// Capturas a 390x844 (iPhone). Sirve la app con python3 desde la carpeta del repo.
var { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'capturas.spec.js',
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8123/',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-CR',
    serviceWorkers: 'block'
  },
  projects: [
    { name: 'safari', use: { browserName: 'webkit', userAgent: devices['iPhone 13'].userAgent } }
  ],
  webServer: {
    command: 'python3 -m http.server 8123',
    cwd: '..',
    url: 'http://localhost:8123/index.html',
    reuseExistingServer: true
  }
});
