const fs = require('fs');

const filePath = 'app/dashboard/warehouse/page.js';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const beforeGrid = lines.slice(0, 1945).join('\n');
const afterGrid = lines.slice(2825).join('\n');

const locW = lines.slice(1950, 2010).join('\n');
const cajas = lines.slice(2010, 2114).join('\n');
const rev = lines.slice(2114, 2195).join('\n');
const dep = lines.slice(2195, 2322).join('\n');
const info = lines.slice(2322, 2620).join('\n');
const search = lines.slice(2620, 2823).join('\n');

const mGridStart = '            {/* Dashboard grid structure */}';

const newGrid = `${mGridStart}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }} className="flex-mobile-column">
                
                {/* Left Panel: Search & Selection Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
${search}
${info}
                </div>

                {/* Right Panel: Mapping Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="flex-mobile-column">
${dep}
                    {/* Middle Row: Revision & Cajas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="flex-mobile-column">
${rev}
${cajas}
                    </div>

${locW}
                </div>
            </div>`;

const newContent = beforeGrid + '\n' + newGrid + '\n' + afterGrid;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Layout successfully rearranged with line precision.');
