import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function usePWAInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, []);

  const checkInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const standalone = (window.navigator as any).standalone;
    const displayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    return Boolean(standalone || displayModeStandalone);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const installed = checkInstalled();
    setIsInstalled(installed);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShouldShow(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled);

    // Engagement gate (10s) and session-only suppression
    const dismissed = sessionStorage.getItem('pwa_install_dismissed') === '1';
    if (!installed && !dismissed) {
      const t = setTimeout(() => setShouldShow(true), 10000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
        window.removeEventListener('appinstalled', onAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [checkInstalled]);

  const promptInstall = useCallback(async () => {
    const evt = deferredPromptRef.current;
    if (!evt) return { supported: false };
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        setShouldShow(false);
      } else {
        sessionStorage.setItem('pwa_install_dismissed', '1');
        setShouldShow(false);
      }
      return { supported: true, outcome: choice.outcome };
    } catch (e) {
      return { supported: true, error: e };
    }
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem('pwa_install_dismissed', '1');
    setShouldShow(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    shouldShow,
    isIOS,
    promptInstall,
    dismiss,
  };
}


