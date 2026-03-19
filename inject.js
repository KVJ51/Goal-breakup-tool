const fs = require('fs');

try {
    const htmlPath = 'd:/Goal-Breakup/goal.html';
    const scriptPath = 'd:/Goal-Breakup/clean_script.js';

    let html = fs.readFileSync(htmlPath, 'utf8');
    const script = fs.readFileSync(scriptPath, 'utf8');

    // Split precisely by string index
    const startIdx = html.indexOf('<script>');
    const endIdx = html.lastIndexOf('</script>');

    if (startIdx === -1 || endIdx === -1) {
        fs.writeFileSync('d:/Goal-Breakup/err.txt', 'Could not find script tags.');
        process.exit(1);
    }

    const beforeScript = html.substring(0, startIdx + '<script>'.length);
    const afterScript = html.substring(endIdx);

    const injectedHtml = beforeScript + '\n' + script + '\n' + afterScript;
    
    fs.writeFileSync(htmlPath, injectedHtml, 'utf8');
    fs.writeFileSync('d:/Goal-Breakup/err.txt', 'SUCCESS!');
} catch (e) {
    fs.writeFileSync('d:/Goal-Breakup/err.txt', e.stack);
}
