import { getAccountBaselineDataPack } from '@/lib/logbook/aiPack/getAccountBaselineDataPack';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 80);

export async function GET() {
  try {
    const pack = await getAccountBaselineDataPack();
    const filename = `${sanitizeFileSegment(pack.account_id)}_${sanitizeFileSegment(pack.marketplace)}_ai_baseline_data_pack.json`;
    return new Response(`${JSON.stringify(pack, null, 2)}\n`, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to build account baseline data pack.',
      { status: 500 }
    );
  }
}
