import { handleCorsPreflight } from '../../lib/cors';
import storeOwnersController from './store-owners.controller';
import { StoreOwnersError } from './store-owners.service';

export async function handleStoreOwnersRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  try {
    return await storeOwnersController.dispatch(request, url);
  } catch (error: any) {
    const status = error instanceof StoreOwnersError ? error.status : 500;
    if (status === 500) console.error('Store-owner API error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error?.message || 'Internal Server Error',
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}