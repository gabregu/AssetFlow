import { readData, writeData } from '../../../lib/db';

export async function GET() {
    const data = readData('sfdc');
    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function POST(request) {
    const data = await request.json();
    writeData('sfdc', data);
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
