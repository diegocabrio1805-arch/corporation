const fs = require('fs');

let perf = fs.readFileSync('components/CollectorPerformance.tsx', 'utf8');

perf = perf.replace(
  /new Date\(\)\.toLocaleDateString\(undefined/g,
  "new Date().toLocaleDateString(state.settings.language || 'es'"
);

perf = perf.replace(
  /new Date\(log\.date\)\.toLocaleDateString\(\)/g,
  "new Date(log.date).toLocaleDateString(state.settings.language || 'es')"
);

fs.writeFileSync('components/CollectorPerformance.tsx', perf, 'utf8');
console.log('Fixed dates in CollectorPerformance');
