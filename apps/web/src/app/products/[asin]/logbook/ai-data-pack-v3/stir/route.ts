import { GET as getStis } from "../stis/route";

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const url = new URL(request.url);
  if (!url.searchParams.get("metric")) {
    url.searchParams.set("metric", "stir");
  }
  const nextRequest = new Request(url.toString(), request);
  return getStis(nextRequest, ctx);
}
