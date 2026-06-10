import React, { useEffect } from 'react';
import { useApp } from '../state/AppContext';
import { CriteriaEditor } from './CriteriaBuilder';

export default function CriteriaSlideOver() {
  const { setCriteriaOpen } = useApp();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setCriteriaOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCriteriaOpen]);

  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label="Edit success criteria">
      <div className="absolute inset-0 bg-black/50" onClick={() => setCriteriaOpen(false)} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[640px] bg-stone-50 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-emerald-900 text-white px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold">Edit success criteria</h2>
          <button
            onClick={() => setCriteriaOpen(false)}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
        <div className="p-5">
          <CriteriaEditor compact />
        </div>
      </div>
    </div>
  );
}
