const fs = require('fs');

let sim = fs.readFileSync('components/Simulator.tsx', 'utf8');

sim = sim.replace(
  /\{simulation\.table\.length\} Cuotas/g,
  "{simulation.table.length} {t.installments || 'Cuotas'}"
);

sim = sim.replace(
  /\(trans as any\)\.generator\?\.frequencies/g,
  "(trans as any).loans?.frequencies"
);

fs.writeFileSync('components/Simulator.tsx', sim, 'utf8');
console.log('Fixed frequency and cuotas in Simulator.');
