const fs = require('fs');
const content = fs.readFileSync('lib/store.js', 'utf8');
const lines = content.split('\n');

console.log("Searching for ticket updates or 'Resuelto' state changes in store.js:");
lines.forEach((line, idx) => {
  if (line.includes('status:') && (line.includes('Resuelto') || line.includes('Cerrado') || line.includes('deliveryCompletedDate'))) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
  if (line.includes('deliveryCompletedDate') || line.includes('delivery_completed_date') || line.includes('closedDate') || line.includes('closed_date')) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
});
