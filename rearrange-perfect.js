const fs = require('fs');

const filePath = 'app/dashboard/warehouse/page.js';
let content = fs.readFileSync(filePath, 'utf8');

const regexLocW = /(                    {\/\* LOCACIÓN W \*\/}[\s\S]*?<\/Card>)/;
const regexCajas = /(                    {\/\* ZONA CAJAS \*\/}[\s\S]*?<\/Card>)/;
const regexRev = /(                    {\/\* ZONA REVISIÓN \/ TRANSICIÓN \*\/}[\s\S]*?<\/Card>)/;
const regexDep = /(                    {\/\* LOCACIÓN DEPÓSITO \*\/}[\s\S]*?<\/Card>\r?\n\s*\)\})/;
const regexInfo = /(                    {\/\* Información de Selección \*\/}[\s\S]*?\}\)\(\)\})/;
const regexSearch = /(                    {\/\* Búsqueda Avanzada - Tarjeta Principal \*\/}[\s\S]*?<\/Card>)/;

const locW = content.match(regexLocW)[1];
const cajas = content.match(regexCajas)[1];
const rev = content.match(regexRev)[1];
const dep = content.match(regexDep)[1];
const info = content.match(regexInfo)[1];
const search = content.match(regexSearch)[1];

const regexGrid = /(            {\/\* Dashboard grid structure \*\/}[\s\S]*?                <\/div>\r?\n            <\/div>)/;

const newGrid = `            {/* Dashboard grid structure */}
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

const newContent = content.replace(regexGrid, newGrid);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Layout successfully rearranged with perfect AST-like regex boundaries.');
