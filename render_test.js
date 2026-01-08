const ejs = require('ejs');
const path = require('path');

const file = path.join(__dirname, 'views', 'custom2.ejs');

ejs.renderFile(file, {title: 'TEST TITLE'}, {}, (err, str) => {
  if (err) {
    console.error('RENDER ERROR:');
    console.error(err);
    process.exit(1);
  } else {
    console.log('RENDER SUCCESS, length:', str.length);
    // Optional: write to file for inspection
    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, 'render_output.html'), str, 'utf8');
  }
});
