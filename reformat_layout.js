const fs = require('fs');
const path = 'app/dashboard/tickets/[id]/page.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update Grid Layout
content = content.replace(
    /gridTemplateColumns: '2fr 1fr'/,
    "gridTemplateColumns: '2fr 1fr 1fr'"
);

// 2. Extract "Historial y Notas" block
// Finding it precisely: starts with { /* History & Internal Notes */ } and ends with its Card's </Card >
const historyBlockRegex = /{\/\* History & Internal Notes \*\/}\n\s+< Card title="Historial y Notas"[\s\S]*?<\/Card >/;
const historyMatch = content.match(historyBlockRegex);

if (!historyMatch) {
    // Try with \r\n
    const historyBlockRegexRN = /{\/\* History & Internal Notes \*\/}\r\n\s+< Card title="Historial y Notas"[\s\S]*?<\/Card >/;
    const historyMatchRN = content.match(historyBlockRegexRN);
    if (historyMatchRN) {
        moveBlock(historyMatchRN[0]);
    } else {
        console.log("Could not find history block (tested both LF and CRLF).");
    }
} else {
    moveBlock(historyMatch[0]);
}

function moveBlock(historyBlock) {
    // Remove it from current position
    content = content.replace(historyBlock, "");
    
    // Find the insertion point: the last </div> before "Case Config Modal"
    // In view_file:
    // 1327:                 </div >
    // 1328:             </div >
    // 1331:             {/* Case Config Modal */}
    
    const caseConfigIdx = content.indexOf('{/* Case Config Modal */}');
    if (caseConfigIdx === -1) {
        console.log("Could not find Case Config Modal anchor.");
        return;
    }
    
    const lastDivIdx = content.lastIndexOf('</div >', caseConfigIdx);
    if (lastDivIdx === -1) {
        console.log("Could not find last div before Case Config Modal.");
        return;
    }
    
    // Insert after the second column's </div> (which is lastDivIdx + 7)
    // We want the 3rd column to be:
    // </div>
    // <div column 3>History</div>
    // </div> (end of grid)
    
    const before = content.substring(0, lastDivIdx + 7);
    const after = content.substring(lastDivIdx + 7);
    
    const newColumn = `\n\n                {/* Third Column: History & Internal Notes */}\n                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>\n                    ${historyBlock}\n                </div>`;
    
    content = before + newColumn + after;
    fs.writeFileSync(path, content);
    console.log("Successfully restructured to 3 columns.");
}
