import React from 'react';

interface UpdateToastProps {
  visible: boolean;
  applying: boolean;
  onReload: () => void;
  isIOS?: boolean;
}

export function UpdateToast({ visible, applying, onReload, isIOS }: UpdateToastProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center z-50">
      <div className="max-w-sm w-full mx-4 bg-white border border-gray-200 shadow-xl rounded-xl p-4">
        <div className="flex items-start">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Uppdatering tillgänglig</p>
            <p className="text-xs text-gray-600 mt-1">
              {isIOS
                ? 'En ny version är tillgänglig. På iOS kan uppdateringen ibland slås på efter att alla flikar med appen har stängts.'
                : 'Ladda om för att få den senaste versionen.'}
            </p>
          </div>
          <button
            onClick={onReload}
            disabled={applying}
            className="ml-3 px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-60"
          >
            {applying ? 'Uppdaterar…' : 'Ladda om'}
          </button>
        </div>
      </div>
    </div>
  );
}


