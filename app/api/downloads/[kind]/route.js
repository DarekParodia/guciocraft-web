import { download } from '../../../../lib/downloads.mjs';
import { getSettings } from '../../../../lib/settings.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) { return download((await params).kind, getSettings().downloads); }
