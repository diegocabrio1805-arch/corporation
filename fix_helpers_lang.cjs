const fs = require('fs');

let content = fs.readFileSync('utils/helpers.ts', 'utf8');

content = content.replace(
  /export const formatLocalTime = \(date: Date \| string \| null \| undefined, country: string = 'CO', options: Intl\.DateTimeFormatOptions = \{\}\): string => \{/g,
  "export const formatLocalTime = (date: Date | string | null | undefined, country: string = 'CO', options: Intl.DateTimeFormatOptions = {}, language: string = 'es'): string => {"
);

// We also need to pass language to Intl.DateTimeFormat inside formatLocalTime
// Let's see how formatLocalTime calls it:
content = content.replace(
  /return new Intl\.DateTimeFormat\('es-'\+country, defaultOptions\)\.format\(d\);/g,
  "return new Intl.DateTimeFormat(`${language}-${country}`, defaultOptions).format(d);"
);

// We should also check formatLocalDate to see if it uses language.
// Inside formatLocalDate: return new Intl.DateTimeFormat('es-'+country, defaultOptions).format(d);
// Wait, I should make sure formatLocalDate actually uses the language parameter!
content = content.replace(
  /return new Intl\.DateTimeFormat\('es-'\+country, defaultOptions\)\.format\(d\);/g,
  "return new Intl.DateTimeFormat(`${language}-${country}`, defaultOptions).format(d);"
);

fs.writeFileSync('utils/helpers.ts', content, 'utf8');
console.log('Helpers language parameter updated.');
