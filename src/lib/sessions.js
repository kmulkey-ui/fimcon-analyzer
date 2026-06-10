// Hardcoded session attendance from agenda manual counts (FIMCON manual
// session counts.xlsx, verified 2026-06-09). Closed-door sessions are
// excluded from charts; see CLOSED_DOOR_NOTE.

export const PLENARIES = [
  { day: 1, title: 'Food Is Medicine: Building a Healthier America (Keynote)', count: 750 },
  { day: 1, title: 'Advancing Food is Medicine: Innovations & Field Insights', count: 750 },
  { day: 1, title: "State Leadership & Investment: Delaware's Vision (Keynote)", count: 750 },
  { day: 1, title: 'Food is Medicine: A Whole-Person Approach to Care', count: 750 },
  { day: 1, title: 'Advancing Food is Medicine in Rural Communities (Fireside)', count: 740 },
  { day: 2, title: 'Day Two Welcome Remarks & Fireside Chat', count: 745 },
  { day: 2, title: 'Food is More than Medicine: Nourishing Communities', count: 745 },
  { day: 2, title: 'The "Food" in Food is Medicine (Fireside)', count: 745 },
  { day: 2, title: 'Food is Medicine is Good Business, Good Policy, & Good Care', count: 750 },
  { day: 2, title: 'Growing the Evidence Base for Food is Medicine (Keynote Luncheon)', count: 750 },
  { day: 2, title: 'Food is Medicine as a Win-Win Bipartisan Policy Opportunity (Keynote Luncheon)', count: 750 },
];

export const BREAKOUTS = [
  { day: 1, block: 'Breakout 1 (2:00 PM)', title: 'Value-Based Care Lens', count: 167 },
  { day: 1, block: 'Breakout 1 (2:00 PM)', title: 'Clinical-to-Community Technology', count: 64 },
  { day: 1, block: 'Breakout 1 (2:00 PM)', title: 'New Research in Food is Medicine', count: 146 },
  { day: 1, block: 'Breakout 1 (2:00 PM)', title: 'Farm to FIM Purchasing', count: 101 },
  { day: 1, block: 'Breakout 2 (3:45 PM)', title: 'Clinical & Community Integration', count: 143 },
  { day: 1, block: 'Breakout 2 (3:45 PM)', title: 'Specialized Populations', count: 59 },
  { day: 1, block: 'Breakout 2 (3:45 PM)', title: 'Research Partnerships', count: 72 },
  { day: 1, block: 'Breakout 2 (3:45 PM)', title: 'Farm to FIM Scaling', count: 107 },
  { day: 2, block: 'Breakout 3 (2:15 PM)', title: 'Clinical Care Integration', count: 117 },
  // Research Pt 1 & 2 ran sequentially to ONE audience in the same room — counted once.
  { day: 2, block: 'Breakout 3 (2:15 PM)', title: 'Research Sessions Pt 1 & 2 (one audience)', count: 131 },
  { day: 2, block: 'Breakout 4 (4:00 PM)', title: 'Charting a Path Forward', count: 147 },
  { day: 2, block: 'Breakout 4 (4:00 PM)', title: 'Economic Value of Food is Medicine', count: 54 },
];

export const CLOSED_DOOR_NOTE =
  'Day 2 ran four concurrent closed-door sessions (CHLPI ×2, FIM Coalition ×2, NPPC ×2, Farm to FIM convening ×2 across both days); counts were not taken, so open-session totals understate Day 2 participation.';

export function sessionStats() {
  const plenaryCounts = PLENARIES.map((p) => p.count);
  const breakoutCounts = BREAKOUTS.map((b) => b.count);
  const peak = Math.max(...plenaryCounts, ...breakoutCounts);
  const avgPlenary = plenaryCounts.reduce((a, b) => a + b, 0) / plenaryCounts.length;
  const avgBreakout = breakoutCounts.reduce((a, b) => a + b, 0) / breakoutCounts.length;
  const lowestPlenary = Math.min(...plenaryCounts);
  return {
    peak,
    avgPlenary,
    avgBreakout,
    lowestPlenary,
    plenaryRetention: (lowestPlenary / peak) * 100,
  };
}

export function breakoutBlocks() {
  const blocks = {};
  for (const b of BREAKOUTS) {
    const key = `Day ${b.day} — ${b.block}`;
    if (!blocks[key]) blocks[key] = { day: b.day, block: b.block, sessions: [], total: 0 };
    blocks[key].sessions.push(b);
    blocks[key].total += b.count;
  }
  return Object.values(blocks);
}
