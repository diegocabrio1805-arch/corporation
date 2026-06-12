const fs = require('fs');

let sim = fs.readFileSync('components/Simulator.tsx', 'utf8');

sim = sim.replace(
  /\(trans as any\)\.loans\?\.frequencies/g,
  "(trans as any).clients?.registrationForm?.frequencies"
);

fs.writeFileSync('components/Simulator.tsx', sim, 'utf8');
console.log('Fixed frequency path in Simulator.');
