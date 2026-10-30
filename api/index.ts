// Vercel serverless entry point.
//
// Vercel invokes this as a Node.js serverless function for every /api/* request.
// The rewrite in vercel.json uses /api/:path* so Vercel preserves the full
// original path (e.g. /api/auth/staff-login) and Express matches its routes.
// app.listen() is guarded by VERCEL=1 in server.ts so no port is bound here.

import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../server.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
