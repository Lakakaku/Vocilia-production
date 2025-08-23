import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window { __VOICE_RECORDING_ACTIVE__?: boolean }
}

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let isMounted = true;

    const onRegistration = (registration: ServiceWorkerRegistration) => {
      // If there's an already waiting SW, prompt
      if (registration.waiting) {
        waitingRegistrationRef.current = registration;
        if (!window.__VOICE_RECORDING_ACTIVE__) {
          setUpdateAvailable(true);
        }
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker.controller // existing controller means an update
          ) {
            waitingRegistrationRef.current = registration;
            if (!window.__VOICE_RECORDING_ACTIVE__) {
              setUpdateAvailable(true);
            }
          }
        });
      });

      // Proactively check for updates soon after load
      setTimeout(() => {
        try {
          registration.update().catch(() => {});
        } catch {}
      }, 2000);
    };

    // Prefer the ready registration for more reliable state
    navigator.serviceWorker.ready.then((reg) => {
      if (!isMounted) return;
      if (reg) onRegistration(reg);
    }).catch(() => {});

    // Also handle already-registered case (fallback)
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!isMounted) return;
      if (reg) onRegistration(reg);
    });

    return () => { isMounted = false; };
  }, []);

  // If recording becomes active, hide prompt, and re-show when it ends
  useEffect(() => {
    const id = setInterval(() => {
      if (window.__VOICE_RECORDING_ACTIVE__ && updateAvailable) {
        setUpdateAvailable(false);
      } else if (!window.__VOICE_RECORDING_ACTIVE__ && waitingRegistrationRef.current && !updateAvailable) {
        setUpdateAvailable(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [updateAvailable]);

  const applyUpdate = useCallback(() => {
    const registration = waitingRegistrationRef.current;
    if (!registration) return;
    setIsApplying(true);

    // Try to tell the waiting SW to skip waiting (in case skipWaiting not auto)
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

    // When the controller changes, the new SW has taken control; reload app
    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Fallback safety: hard reload after a short delay if no controllerchange
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }, []);

  return { updateAvailable, isApplying, applyUpdate };
}


