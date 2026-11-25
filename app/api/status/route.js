import { status } from '../../../lib/services.mjs';
import { jsonResponse } from '../../../lib/security.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return jsonResponse(await status()); }
