// Cloudflare CDN Configuration for Business Dashboard Assets
// This configuration optimizes content delivery for the business dashboard

const CDN_CONFIG = {
  // Zone configuration
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  
  // Custom domains for CDN
  domains: {
    assets: 'assets.feedback.your-domain.com',
    businessAssets: 'business-assets.feedback.your-domain.com',
    staticFiles: 'static.feedback.your-domain.com'
  },
  
  // Cache rules for different asset types
  cacheRules: [
    {
      // Business dashboard static assets - aggressive caching
      pattern: '/business/static/**/*',
      cacheLevel: 'cache_everything',
      ttl: 31536000, // 1 year
      browserTtl: 31536000,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding'
      }
    },
    {
      // JavaScript and CSS files
      pattern: '**/*.{js,css,mjs}',
      cacheLevel: 'cache_everything',
      ttl: 86400, // 1 day
      browserTtl: 86400,
      compression: 'gzip,br',
      minify: {
        js: true,
        css: true,
        html: false
      }
    },
    {
      // Images and fonts
      pattern: '**/*.{png,jpg,jpeg,gif,webp,avif,svg,woff,woff2,ttf,eot}',
      cacheLevel: 'cache_everything',
      ttl: 2592000, // 30 days
      browserTtl: 2592000,
      compression: 'gzip,br',
      polish: 'lossy',
      webp: true
    },
    {
      // API responses (selective caching)
      pattern: '/api/dashboard/**/*',
      cacheLevel: 'selective',
      ttl: 300, // 5 minutes
      browserTtl: 60,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      },
      bypassOnCookie: ['session_token', 'auth_token']
    },
    {
      // Analytics and reports (short-term caching)
      pattern: '/api/analytics/**/*',
      cacheLevel: 'selective',
      ttl: 180, // 3 minutes
      browserTtl: 60,
      varyOnHeader: ['X-Business-ID', 'X-Business-Tier']
    }
  ],
  
  // Page rules for business dashboard
  pageRules: [
    {
      url: 'business.feedback.your-domain.com/*',
      settings: {
        cache_level: 'cache_everything',
        edge_cache_ttl: 300,
        browser_cache_ttl: 300,
        ssl: 'full',
        always_use_https: true,
        security_level: 'high',
        brotli: true,
        minify: {
          js: true,
          css: true,
          html: true
        }
      }
    },
    {
      url: 'business.feedback.your-domain.com/api/*',
      settings: {
        cache_level: 'bypass',
        disable_performance: false,
        ssl: 'full',
        always_use_https: true
      }
    }
  ],
  
  // Custom headers for business dashboard
  customHeaders: {
    response: [
      {
        name: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        name: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        name: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        name: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        name: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()'
      }
    ]
  },
  
  // Transform rules for optimization
  transformRules: [
    {
      // Auto-minify HTML, CSS, JS
      expression: 'http.host eq "business.feedback.your-domain.com"',
      action: 'execute',
      settings: {
        auto_minify: {
          js: true,
          css: true,
          html: true
        }
      }
    },
    {
      // Enable Rocket Loader for JS optimization
      expression: 'http.host eq "business.feedback.your-domain.com" and http.request.uri.path matches "^/(?!api/).*"',
      action: 'execute',
      settings: {
        rocket_loader: true
      }
    }
  ],
  
  // Rate limiting for business dashboard
  rateLimiting: [
    {
      // General dashboard access
      expression: 'http.host eq "business.feedback.your-domain.com"',
      characteristics: ['ip.src'],
      period: 60,
      requests_per_period: 100,
      mitigation_timeout: 600,
      action: 'challenge'
    },
    {
      // API endpoints
      expression: 'http.host eq "business.feedback.your-domain.com" and http.request.uri.path matches "^/api/"',
      characteristics: ['ip.src', 'http.request.headers["x-business-id"][0]'],
      period: 60,
      requests_per_period: 300,
      mitigation_timeout: 300,
      action: 'block'
    },
    {
      // Export endpoints (stricter limits)
      expression: 'http.request.uri.path matches "^/api/(export|bulk|batch)"',
      characteristics: ['ip.src', 'http.request.headers["x-business-id"][0]'],
      period: 3600, // 1 hour
      requests_per_period: 10,
      mitigation_timeout: 3600,
      action: 'block'
    }
  ],
  
  // Geographic optimization
  geographic: {
    // Argo Smart Routing for Sweden/Nordic region
    argo_smart_routing: true,
    
    // Data localization preferences
    data_localization: {
      eu: true,
      sweden: true
    },
    
    // Regional caching preferences
    regional_cache: {
      stockholm: {
        colo: 'ARN', // Arlanda (Stockholm)
        priority: 'high'
      },
      gothenburg: {
        colo: 'GOT', // Gothenburg
        priority: 'medium'
      },
      malmo: {
        colo: 'CPH', // Copenhagen (closest to Malmö)
        priority: 'medium'
      }
    }
  },
  
  // Business-specific optimizations
  businessOptimizations: {
    // Tier-based caching strategies
    tierCaching: {
      tier1: {
        cacheTtl: 300, // 5 minutes
        browserTtl: 60  // 1 minute
      },
      tier2: {
        cacheTtl: 180, // 3 minutes
        browserTtl: 30  // 30 seconds
      },
      tier3: {
        cacheTtl: 60,  // 1 minute (near real-time)
        browserTtl: 10 // 10 seconds
      }
    },
    
    // Location-aware caching
    locationCaching: {
      enabled: true,
      varyOnLocation: true,
      locationHeader: 'X-Business-Location'
    },
    
    // Real-time features bypass
    realTimeBypass: [
      '/api/dashboard/realtime',
      '/api/notifications/live',
      '/api/analytics/live',
      '/ws/**'
    ]
  }
};

// Cloudflare Worker for advanced business logic
const BUSINESS_DASHBOARD_WORKER = `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const businessId = request.headers.get('X-Business-ID');
  const businessTier = request.headers.get('X-Business-Tier') || '1';
  const businessLocation = request.headers.get('X-Business-Location');
  
  // Business-specific routing
  if (businessLocation) {
    const regionColo = getRegionalColo(businessLocation);
    if (regionColo) {
      request.headers.set('CF-IPCountry', regionColo);
    }
  }
  
  // Tier-based caching
  const cacheConfig = getCacheConfigForTier(businessTier);
  
  // Check for real-time endpoints
  if (isRealTimeEndpoint(url.pathname)) {
    return fetch(request, { cf: { cacheTtl: 0 } });
  }
  
  // Apply business-specific optimizations
  const response = await fetch(request, {
    cf: {
      cacheTtl: cacheConfig.cacheTtl,
      cacheEverything: true,
      polish: businessTier === '3' ? 'lossless' : 'lossy',
      minify: {
        javascript: true,
        css: true,
        html: true
      }
    }
  });
  
  // Add business-specific headers
  const modifiedResponse = new Response(response.body, response);
  modifiedResponse.headers.set('Cache-Control', 
    \`public, max-age=\${cacheConfig.browserTtl}, stale-while-revalidate=300\`);
  modifiedResponse.headers.set('X-Business-Optimized', 'true');
  modifiedResponse.headers.set('X-Cache-Tier', businessTier);
  
  return modifiedResponse;
}

function getRegionalColo(location) {
  const regionMap = {
    'stockholm': 'SE',
    'gothenburg': 'SE',
    'malmo': 'SE',
    'oslo': 'NO',
    'copenhagen': 'DK'
  };
  return regionMap[location.toLowerCase()] || 'SE';
}

function getCacheConfigForTier(tier) {
  const configs = {
    '1': { cacheTtl: 300, browserTtl: 60 },
    '2': { cacheTtl: 180, browserTtl: 30 },
    '3': { cacheTtl: 60, browserTtl: 10 }
  };
  return configs[tier] || configs['1'];
}

function isRealTimeEndpoint(pathname) {
  const realTimePatterns = [
    '/api/dashboard/realtime',
    '/api/notifications/live',
    '/api/analytics/live',
    '/ws/'
  ];
  return realTimePatterns.some(pattern => pathname.startsWith(pattern));
}
`;

// Export configuration for deployment scripts
module.exports = {
  CDN_CONFIG,
  BUSINESS_DASHBOARD_WORKER,
  
  // Deployment functions
  async deployCDNConfig() {
    console.log('Deploying CDN configuration...');
    // Implementation for Cloudflare API deployment
  },
  
  async deployWorker() {
    console.log('Deploying Cloudflare Worker...');
    // Implementation for Worker deployment
  },
  
  async purgeCache(patterns = []) {
    console.log('Purging CDN cache...');
    // Implementation for cache purging
  }
};