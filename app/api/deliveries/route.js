import { NextResponse } from 'next/server';
import { readData, writeData } from '../../../lib/db';

const COLLECTION = 'deliveries';

export async function GET() {
    const data = readData(COLLECTION);
    return NextResponse.json(data);
}

export async function POST(request) {
    const body = await request.json();
    if (Array.isArray(body)) {
        writeData(COLLECTION, body);
        return NextResponse.json({ success: true, count: body.length });
    }
    return NextResponse.json({ success: false, message: 'Invalid format' }, { status: 400 });
}
