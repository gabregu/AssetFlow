import { readData, writeData } from '../../../lib/db';

export async function GET() {
    const users = readData('users');
    return new Response(JSON.stringify(users), {
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function POST(request) {
    const users = await request.json();
    writeData('users', users);
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
