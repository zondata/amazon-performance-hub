import { buildFileResponse, resolveDownloadPath } from '@/lib/bulksheets/fileServe';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const relativePath = url.searchParams.get('path');
  const filename = url.searchParams.get('filename');
  if (!relativePath) {
    return new Response('Missing path', { status: 400 });
  }

  try {
    const absolutePath = resolveDownloadPath(relativePath);
    const response = buildFileResponse(absolutePath, {
      downloadFilename: filename,
    });
    if (!response) {
      return new Response('Not found', { status: 404 });
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid path';
    return new Response(message, { status: 400 });
  }
}
