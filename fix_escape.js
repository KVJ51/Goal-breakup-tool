const fs = require('fs');

const path = 'd:/Goal-Breakup/goal.html';
let content = fs.readFileSync(path, 'utf8');

// Fix the bad literal escaping that Gemini added to the template strings
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed escaping in goal.html');
