import React from 'react';

interface InstallPromptProps {
  isVisible: boolean;
  isIOS: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({ isVisible, isIOS, onInstall, onDismiss }: InstallPromptProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50">
      <div className="bg-white shadow-xl rounded-2xl border border-gray-200 p-4 flex items-start justify-between">
        <div className="pr-3">
          <div className="text-sm font-semibold text-gray-900">Installera appen</div>
          {isIOS ? (
            <div className="text-xs text-gray-600 mt-1">
              Öppna delningsmenyn i Safari och välj “Lägg till på hemskärmen”.
            </div>
          ) : (
            <div className="text-xs text-gray-600 mt-1">
              Installera PWA för snabbare upplevelse och offline-stöd.
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {!isIOS && (
            <button
              onClick={onInstall}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
            >
              Installera
            </button>
          )}
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}


