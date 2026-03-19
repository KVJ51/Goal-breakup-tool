const fs = require('fs');
const filePath = 'd:/Goal-Breakup/goal.html';
let content = fs.readFileSync(filePath, 'utf8');

// Replace duplicate markTodayActive in toggleTask
content = content.replace(/markTodayActive\(\);\s*markTodayActive\(\);/, "markTodayActive();");
content = content.replace(/saveState\(\);\s*saveState\(\);/, "saveState();");

// Replace duplicate markTodayActive in toggleMilestone
content = content.replace(/markTodayActive\(\);\s*markTodayActive\(\);/g, "markTodayActive();");
content = content.replace(/saveState\(\);\s*saveState\(\);/g, "saveState();");

// Replace the syntax error in toggleDailyTask specifically!!
content = content.replace(/\} markTodayActive\(\); \}/g, "}");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Regex fixed!');
