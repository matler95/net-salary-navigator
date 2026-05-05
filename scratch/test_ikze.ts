
import { calculateIkzeTaxReturn, DEFAULT_GLOBAL_SETTINGS, DEFAULT_SALARY_INPUTS } from '../src/lib/salary';

const settings = { ...DEFAULT_GLOBAL_SETTINGS };
const inputs = { ...DEFAULT_SALARY_INPUTS, gross: 5000 }; // Low salary

const contribution = 3000; // Annual

const result = calculateIkzeTaxReturn(inputs, contribution, settings, 'standard');

console.log('Annual Base:', result.annualBase);
console.log('Tax Return:', result.taxReturn);
console.log('Breakdown 32%:', result.breakdown.amountAt32);
console.log('Breakdown 12%:', result.breakdown.amountAt12);
console.log('Breakdown 0%:', result.breakdown.amountAt0);
