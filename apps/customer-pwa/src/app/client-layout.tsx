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
    // Register service worker for PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
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