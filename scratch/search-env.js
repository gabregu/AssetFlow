const fs = require('fs');
if (fs.existsSync('.env.local')) {
  console.log('.env.local contents:');
  console.log(fs.readFileSync('.env.local', 'utf8'));
} else if (fs.existsSync('.env')) {
  console.log('.env contents:');
  console.log(fs.readFileSync('.env', 'utf8'));
} else {
  console.log('No env file found.');
}
