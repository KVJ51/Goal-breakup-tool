const fs = require('fs');
const html = fs.readFileSync('goal.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch && scriptMatch[1]) {
    fs.writeFileSync('temp.js', scriptMatch[1], 'utf8');
    
    const { exec } = require('child_process');
    exec('node -c temp.js', (err, stdout, stderr) => {
        if (err) {
            console.error('Syntax Error found:\n', stderr);
        } else {
            console.log('No JS Syntax Errors!');
        }
    });
} else {
    console.log('No script block found in goal.html');
}
