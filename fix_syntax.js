const fs = require('fs');
const filePath = 'd:/Goal-Breakup/goal.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix toggleTask
content = content.replace("markTodayActive();\n                markTodayActive();", "markTodayActive();");
content = content.replace("saveState();\n            saveState();", "saveState();");

// Fix toggleMilestone
content = content.replace("markTodayActive();\n                markTodayActive();", "markTodayActive();");
content = content.replace("saveState();\n             saveState();", "saveState();");

// Fix toggleDailyTask
content = content.replace("} markTodayActive(); }", "}");
content = content.replace("saveState();\n             saveState();", "saveState();");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed syntax errors.');
