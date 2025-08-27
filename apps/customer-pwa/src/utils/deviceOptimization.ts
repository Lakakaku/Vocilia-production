/**
 * Device optimization utilities for handling older devices with reduced performance
 * This helps fix animation stutter and improve overall performance
 */

interface DeviceCapabilities {
  isOldDevice: boolean;
  isLowEndDevice: boolean;
  shouldReduceAnimations: boolean;
  shouldUseSimpleAnimations: boolean;
  deviceScore: number; // 0-100, lower means older/slower device
}

/**
 * Detect device capabilities and performance characteristics
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    // SSR fallback - assume modern device
    return {
      isOldDevice: false,
      isLowEndDevice: false,
      shouldReduceAnimations: false,
      shouldUseSimpleAnimations: false,
      deviceScore: 80
    };
  }

  let deviceScore = 100;
  let penalties = 0;

  // Check user agent for old devices
  const userAgent = navigator.userAgent;
  
  // Old Android versions
  if (/Android [1-6]\./.test(userAgent)) {
    deviceScore -= 40;
    penalties += 1;
  }
  
  // Old iOS versions  
  if (/iPhone OS [1-9]_/.test(userAgent)) {
    deviceScore -= 30;
    penalties += 1;
  }
  
  // Very old browsers
  if (/Chrome\/[1-5][0-9]\./.test(userAgent) || /Safari\/5[0-3][0-9]\./.test(userAgent)) {
    deviceScore -= 25;
    penalties += 1;
  }

  // Check hardware capabilities
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    // No WebGL support indicates older device
    deviceScore -= 30;
    penalties += 1;
  } else {
    // Check WebGL capabilities
    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);
    
    // Old GPU indicators
    if (renderer.includes('Adreno 2') || renderer.includes('PowerVR SGX') || 
        renderer.includes('Mali-4') || renderer.includes('Tegra 2')) {
      deviceScore -= 35;
      penalties += 1;
    }
    
    // Intel integrated graphics (often slower)
    if (renderer.includes('Intel') && !renderer.includes('Iris')) {
      deviceScore -= 15;
    }
  }

  // Check memory (RAM estimation)
  const memory = (navigator as any).deviceMemory;
  if (memory && memory < 4) {
    deviceScore -= (4 - memory) * 10; // Penalize low memory
    penalties += 1;
  }

  // Check CPU cores
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) {
    deviceScore -= (4 - cores) * 8;
    penalties += 1;
  }

  // Check connection speed (slower connections often correlate with older devices)
  const connection = (navigator as any).connection;
  if (connection && connection.effectiveType) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      deviceScore -= 20;
      penalties += 1;
    } else if (connection.effectiveType === '3g') {
      deviceScore -= 10;
    }
  }

  // Check screen density (older devices often have lower DPI)
  const devicePixelRatio = window.devicePixelRatio || 1;
  if (devicePixelRatio < 2) {
    deviceScore -= 15;
  }

  // Check available width/height (smaller screens often indicate older devices)
  const screenArea = screen.width * screen.height;
  if (screenArea < 500000) { // Less than ~800x600 equivalent
    deviceScore -= 10;
    penalties += 1;
  }

  // Ensure score doesn't go below 0
  deviceScore = Math.max(0, deviceScore);

  const isOldDevice = deviceScore < 50 || penalties >= 3;
  const isLowEndDevice = deviceScore < 70 || penalties >= 2;
  const shouldReduceAnimations = isOldDevice || penalties >= 4;
  const shouldUseSimpleAnimations = isLowEndDevice || penalties >= 2;

  return {
    isOldDevice,
    isLowEndDevice,
    shouldReduceAnimations,
    shouldUseSimpleAnimations,
    deviceScore
  };
}

/**
 * Apply device-specific optimizations to the page
 */
export function applyDeviceOptimizations(capabilities?: DeviceCapabilities) {
  if (typeof window === 'undefined') return;

  const caps = capabilities || detectDeviceCapabilities();
  const body = document.body;

  // Remove existing optimization classes
  body.classList.remove('old-device', 'low-end-device', 'reduce-animations', 'simple-animations');

  if (caps.isOldDevice) {
    body.classList.add('old-device');
    console.log('🐌 Old device detected, applying performance optimizations');
  }

  if (caps.isLowEndDevice) {
    body.classList.add('low-end-device');
    console.log('📱 Low-end device detected, applying UI optimizations');
  }

  if (caps.shouldReduceAnimations) {
    body.classList.add('reduce-animations');
    console.log('⚡ Reducing animations for better performance');
  }

  if (caps.shouldUseSimpleAnimations) {
    body.classList.add('simple-animations');
    console.log('🎯 Using simplified animations');
  }

  // Add device score as CSS custom property
  document.documentElement.style.setProperty('--device-score', caps.deviceScore.toString());

  return caps;
}

/**
 * Get optimized animation class names based on device capabilities
 */
export function getOptimizedAnimationClasses(baseClass: string, capabilities?: DeviceCapabilities): string {
  const caps = capabilities || detectDeviceCapabilities();
  
  let classes = baseClass;
  
  if (caps.shouldReduceAnimations) {
    classes += ' no-animation';
  } else if (caps.shouldUseSimpleAnimations) {
    // Replace complex animations with simple ones
    if (baseClass.includes('recording-pulse')) {
      classes = classes.replace('recording-pulse', 'recording-pulse-simple');
    }
    if (baseClass.includes('loading-dots') && !baseClass.includes('simple')) {
      classes = classes.replace('loading-dots', 'loading-dots-simple');
    }
  }
  
  if (caps.isLowEndDevice) {
    classes += ' old-device-friendly';
  }
  
  return classes;
}

/**
 * Hook for React components to use device optimization
 */
export function useDeviceOptimization() {
  if (typeof window === 'undefined') {
    return {
      isOldDevice: false,
      isLowEndDevice: false,
      shouldReduceAnimations: false,
      shouldUseSimpleAnimations: false,
      deviceScore: 80,
      getOptimizedClasses: (baseClass: string) => baseClass
    };
  }

  const capabilities = detectDeviceCapabilities();
  
  return {
    ...capabilities,
    getOptimizedClasses: (baseClass: string) => getOptimizedAnimationClasses(baseClass, capabilities)
  };
}

// Initialize optimizations when module loads
if (typeof window !== 'undefined') {
  // Apply optimizations after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyDeviceOptimizations());
  } else {
    applyDeviceOptimizations();
  }
}