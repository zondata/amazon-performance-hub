import { GET as getDeepDivePack } from '../ai-deep-dive-pack/route';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  return getDeepDivePack(request, context);
}
