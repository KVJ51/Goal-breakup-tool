const fs = require('fs');
const html = fs.readFileSync('goal.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch && scriptMatch[1]) {
    try {
        new Function(scriptMatch[1]);
        fs.writeFileSync('js_status.txt', 'OK');
    } catch (err) {
        fs.writeFileSync('js_status.txt', err.stack);
    }
} else {
    fs.writeFileSync('js_status.txt', 'NO SCRIPT block');
}
