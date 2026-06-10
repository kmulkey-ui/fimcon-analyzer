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
      <header className="no-print">
        {/* Brand bar */}
        <div className="bg-white border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src="/fimcon-logo.png"
                alt="FIMCON 2026 — Food is Medicine Conference"
                className="h-10 sm:h-12 w-auto shrink-0"
              />
              <div className="hidden md:block border-l border-stone-200 pl-4">
                <div className="text-sm font-extrabold text-brand-navy tracking-tight">Event Performance Analyzer</div>
                <div className="text-xs text-stone-500">June 1–2, 2026 · Grand Hyatt Washington · ARB Meetings &amp; Events</div>
              </div>
            </div>
            <button
              onClick={() => setCriteriaOpen(true)}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-lg text-sm font-semibold bg-brand-orange hover:bg-[#d96f12] text-white cursor-pointer transition-colors"
            >
              Edit criteria
            </button>
          </div>
        </div>
        {/* Nav bar */}
        <div className="bg-brand-navy">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border-b-[3px] ${
                  section === id
                    ? 'border-brand-green text-white bg-brand-navydark'
                    : 'border-transparent text-blue-100 hover:bg-brand-navydark/60'
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
        FIMCON 2026 · Food is Medicine Conference · Prepared for funders and the steering committee
      </footer>

      {/* Floating edit-criteria button (mobile) */}
      <button
        onClick={() => setCriteriaOpen(true)}
        className="no-print fixed bottom-5 right-5 sm:hidden bg-brand-orange hover:bg-[#d96f12] text-white rounded-full shadow-lg px-4 py-3 text-sm font-semibold cursor-pointer"
        aria-label="Edit criteria"
      >
        Edit criteria
      </button>

      {criteriaOpen && <CriteriaSlideOver />}
    </div>
  );
}
