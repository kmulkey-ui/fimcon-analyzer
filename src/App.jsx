import React, { useState } from 'react';
import { useApp } from './state/AppContext';
import DataInput from './sections/DataInput';
import CriteriaBuilder from './sections/CriteriaBuilder';
import Dashboard from './sections/Dashboard';
import Drilldown from './sections/Drilldown';
import DeepAnalysis from './sections/DeepAnalysis';
import Outcomes from './sections/Outcomes';
import Comparisons from './sections/Comparisons';
import CriteriaSlideOver from './sections/CriteriaSlideOver';

const SECTIONS = [
  ['data', 'Data Input'],
  ['criteria', 'Success Criteria'],
  ['dashboard', 'Dashboard'],
  ['drilldown', 'Attendance & No-Shows'],
  ['analysis', 'Deep Analysis'],
  ['outcomes', 'Outcomes'],
  ['comparisons', 'Comparisons'],
];

export default function App() {
  const [section, setSection] = useState('dashboard');
  const { setCriteriaOpen, criteriaOpen } = useApp();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-emerald-900 text-white no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                FIMCON 2026 <span className="font-medium text-emerald-200">Event Performance Analyzer</span>
              </h1>
              <p className="text-xs text-emerald-300 mt-0.5">
                Food is Medicine · June 1–2, 2026 · Grand Hyatt Washington · ARB Meetings &amp; Events
              </p>
            </div>
            <button
              onClick={() => setCriteriaOpen(true)}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-lg text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 cursor-pointer transition-colors"
            >
              Edit criteria
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px pb-0" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-lg cursor-pointer transition-colors ${
                  section === id
                    ? 'bg-stone-50 text-emerald-900'
                    : 'text-emerald-100 hover:bg-emerald-800'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {section === 'data' && <DataInput />}
        {section === 'criteria' && <CriteriaBuilder />}
        {section === 'dashboard' && <Dashboard />}
        {section === 'drilldown' && <Drilldown />}
        {section === 'analysis' && <DeepAnalysis />}
        {section === 'outcomes' && <Outcomes />}
        {section === 'comparisons' && <Comparisons />}
      </main>

      <footer className="no-print text-center text-xs text-stone-400 py-4">
        FIMCON 2026 · Food is Medicine · Prepared for funders and the steering committee
      </footer>

      {/* Floating edit-criteria button (mobile / everywhere) */}
      <button
        onClick={() => setCriteriaOpen(true)}
        className="no-print fixed bottom-5 right-5 sm:hidden bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-lg px-4 py-3 text-sm font-semibold cursor-pointer"
        aria-label="Edit criteria"
      >
        Edit criteria
      </button>

      {criteriaOpen && <CriteriaSlideOver />}
    </div>
  );
}
