const fs = require('fs');

const filePath = 'app/dashboard/warehouse/page.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ZONA REVISIÓN and ZONA CAJAS grid size
// Revision
content = content.replace(
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(28px, 1fr))', gap: '8px', padding: '0.5rem 0' }}>\n                                {Array.from({ length: depositoConfig?.revisionCount || 40 }, (_, i) => i + 1).map(revNum => {`,
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(22px, 1fr))', gap: '6px', padding: '0.5rem 0' }}>\n                                {Array.from({ length: depositoConfig?.revisionCount || 40 }, (_, i) => i + 1).map(revNum => {`
);

// Cajas
content = content.replace(
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(28px, 1fr))', gap: '8px', padding: '0.5rem 0' }}>\n                                {Array.from({ length: depositoConfig?.cajasCount || 80 }, (_, i) => i + 1).map(cajaNum => {`,
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(22px, 1fr))', gap: '6px', padding: '0.5rem 0' }}>\n                                {Array.from({ length: depositoConfig?.cajasCount || 80 }, (_, i) => i + 1).map(cajaNum => {`
);

// 2. Circles size (28px -> 22px)
// There are multiple width: '28px' in those blocks.
// We only want to replace the ones in Revision and Cajas.
// Instead of replacing blindly, we can replace all occurrences of `width: '28px', height: '28px'` with `22px`
// because those are specifically the ones for the circles.
content = content.replaceAll(
    `width: '28px', height: '28px', borderRadius: '4px'`,
    `width: '22px', height: '22px', borderRadius: '4px'`
);

// 3. renderAisle grid
content = content.replace(
    `gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))'`,
    `gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))'`
);

// 4. Locación W layout
// Change flex column to grid
content = content.replace(
    `<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>\n                            {locationsW.length === 0 ? (`,
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>\n                            {locationsW.length === 0 ? (`
);

content = content.replace(
    `<div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>`,
    `<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>`
);

content = content.replace(
    `<div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>\n                                                        {items.map(([aisle, locations]) => renderAisle(aisle, locations, locationsW.length, locationsW, false))}\n                                                    </div>`,
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem', padding: '0.25rem 0' }}>\n                                                        {items.map(([aisle, locations]) => renderAisle(aisle, locations, locationsW.length, locationsW, false))}\n                                                    </div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script ran successfully');
