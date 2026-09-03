const fs = require('fs');

const filePath = 'app/dashboard/warehouse/page.js';
let content = fs.readFileSync(filePath, 'utf8');

// Define markers
const mGridStart = '{/* Dashboard grid structure */}';
const mMainColsStart = '{/* Main Mapping Columns (Locación W, H and DEPÓSITO) */}';
const mLocW = '{/* LOCACIÓN W */}';
const mCajas = '{/* ZONA CAJAS */}';
const mRev = '{/* ZONA REVISIÓN / TRANSICIÓN */}';
const mDep = '{/* LOCACIÓN DEPÓSITO */}';
const mRightPanelStart = '{/* Right Panel: Selection Info & Filters */}';
const mInfo = '{/* Información de Selección */}';
const mSearch = '{/* Búsqueda Avanzada - Tarjeta Principal */}';

// Extract everything before the grid structure
const gridStartIndex = content.indexOf(mGridStart);
const beforeGrid = content.substring(0, gridStartIndex);

// Extract Locacion W
const locWStart = content.indexOf(mLocW);
const locWEnd = content.indexOf(mCajas);
const locW = content.substring(locWStart, locWEnd);

// Extract Cajas
const cajasStart = content.indexOf(mCajas);
const cajasEnd = content.indexOf(mRev);
const cajas = content.substring(cajasStart, cajasEnd);

// Extract Revision
const revStart = content.indexOf(mRev);
const revEnd = content.indexOf(mDep);
const rev = content.substring(revStart, revEnd);

// Extract Deposito
const depStart = content.indexOf(mDep);
const depEnd = content.indexOf('                </div>', depStart); // The closing div of Main Mapping Columns
const dep = content.substring(depStart, depEnd);

// Extract Info Seleccion
const infoStart = content.indexOf(mInfo);
const infoEnd = content.indexOf(mSearch);
const info = content.substring(infoStart, infoEnd);

// Extract Busqueda Avanzada
const searchStart = content.indexOf(mSearch);
const searchEnd = content.indexOf('                </div>', searchStart); // The closing div of Right Panel
const search = content.substring(searchStart, searchEnd);

// Extract everything after the Right Panel
const afterGridIndex = searchEnd + '                </div>'.length;
const afterGrid = content.substring(afterGridIndex);

// Reassemble with the new structure
const newGrid = `
            ${mGridStart}
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', alignItems: 'start' }} className="flex-mobile-column">
                
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
            `;

const newContent = beforeGrid + newGrid + afterGrid;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Layout successfully rearranged.');
