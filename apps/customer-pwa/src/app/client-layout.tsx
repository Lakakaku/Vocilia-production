'use client';

import { useEffect } from 'react';
import { InstallPrompt } from '../components/InstallPrompt';
import { usePWAInstall } from '../components/usePWAInstall';
import { useServiceWorkerUpdate } from '../components/useServiceWorkerUpdate';
import { UpdateToast } from '../components/UpdateToast';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { shouldShow, isIOS, promptInstall, dismiss } = usePWAInstall();
  const { updateAvailable, isApplying, applyUpdate } = useServiceWorkerUpdate();

  useEffect(() => {
    // Handle service worker based on environment
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        // Register service worker for PWA in production
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      } else {
        // In development, unregister any existing service workers to prevent caching issues
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister().then(function(success) {
              if (success) {
                console.log('SW unregistered in development mode');
                // Also clear all caches
                caches.keys().then(function(cacheNames) {
                  cacheNames.forEach(function(cacheName) {
                    caches.delete(cacheName);
                  });
                });
              }
            });
          }
        });
      }
    }
  }, []);

  return (
    <>
      {children}
      <UpdateToast visible={updateAvailable} applying={isApplying} onReload={applyUpdate} isIOS={isIOS} />
      <InstallPrompt
        isVisible={shouldShow}
        isIOS={isIOS}
        onInstall={() => { promptInstall(); }}
        onDismiss={dismiss}
      />
    </>
  );
}