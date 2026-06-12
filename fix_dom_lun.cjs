const fs = require('fs');

let content = fs.readFileSync('components/CollectorCommission.tsx', 'utf8');

content = content.replace(
  /name: formatLocalDate\(currentDay, state\.settings\.country, \{ weekday: 'short' \}\)/g,
  "name: formatLocalDate(currentDay, state.settings.country, { weekday: 'short' }, state.settings.language)"
);

// We can also just replace all formatLocalDate that don't pass language to pass it if we want,
// but let's just fix the one used in the chart to prevent unintended side effects if the signature differs elsewhere.
// Wait, what about `formatLocalDate(log.date, state.settings.country)`?
// Let's replace `formatLocalDate(..., state.settings.country)` with `formatLocalDate(..., state.settings.country, {}, state.settings.language)`

content = content.replace(
  /formatLocalDate\(([^,]+), state\.settings\.country\)/g,
  "formatLocalDate($1, state.settings.country, {}, state.settings.language)"
);

// Do the same for formatLocalTime
content = content.replace(
  /formatLocalTime\(([^,]+), state\.settings\.country\)/g,
  "formatLocalTime($1, state.settings.country, {}, state.settings.language)"
);

// Also for settingsToUse.country (in the receipt)
content = content.replace(
  /formatLocalDate\(([^,]+), settingsToUse\.country\)/g,
  "formatLocalDate($1, settingsToUse.country, {}, state.settings.language)"
);

content = content.replace(
  /formatLocalTime\(([^,]+), settingsToUse\.country\)/g,
  "formatLocalTime($1, settingsToUse.country, {}, state.settings.language)"
);

fs.writeFileSync('components/CollectorCommission.tsx', content, 'utf8');
console.log('DOM/LUN language support injected.');
