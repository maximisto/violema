// Routes shared by the page shell, the field page and the records, kept free of imports so
// pages.mjs and records.mjs can both read them without importing each other at load time.
export const FIELD = { route: '/fields/quantum-advantage/', name: 'Quantum advantage' };
export const FE4S4_ROUTE = '/records/fe4s4-benchmark/';
export const FE4S4_RECORD_ROUTE = '/records/fe4s4-benchmark/record/';
