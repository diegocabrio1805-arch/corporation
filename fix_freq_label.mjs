import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('components/Clients.tsx', 'utf8');

// Replace the hardcoded freqLabel with a multi-language version
// Use regex to match the exact line
const re = /const freqLabel = \(loan\.frequency === Frequency\.DAILY \|\| loan\.frequency === 'Diaria' as any\) \? 'DIARIO \(L-S\)'.*?'MENSUAL';/s;

const newLabel = `const isFr = state.settings.language === 'fr';
                         const isPt = state.settings.language === 'pt';
                         const freqLabel = (loan.frequency === Frequency.DAILY || loan.frequency === 'Diaria' as any)
                           ? (isFr ? 'QUOTIDIEN (L-S)' : isPt ? 'DIÁRIO (L-S)' : 'DIARIO (L-S)')
                           : loan.frequency === Frequency.DAILY_MF
                           ? (isFr ? 'QUOTIDIEN (L-V)' : isPt ? 'DIÁRIO (L-V)' : 'DIARIO (L-V)')
                           : loan.frequency === Frequency.WEEKLY
                           ? (isFr ? \`HEBDOMADAIRE · \${FR_DIAS[startDate.getDay()]}\` : \`SEMANAL · \${diaSemana}\`)
                           : loan.frequency === Frequency.BIWEEKLY
                           ? (isFr ? 'BIMENSUEL' : isPt ? 'QUINZENAL' : 'QUINCENAL')
                           : (isFr ? 'MENSUEL' : isPt ? 'MENSAL' : 'MENSUAL');`;

if (re.test(content)) {
  content = content.replace(re, newLabel);
  writeFileSync('components/Clients.tsx', content, 'utf8');
  console.log('Frequency label patched successfully!');
} else {
  console.log('Pattern not found. Check the regex.');
}
