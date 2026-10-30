import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAuth: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
    key &&
    url.trim() !== '' &&
    key.trim() !== '' &&
    !url.includes('your-project-id')
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAdmin) {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

// Dedicated Supabase client used EXCLUSIVELY for Auth operations
// (signInWithPassword, getUser, auth.admin.*).
//
// supabase-js v2 attaches the current session's access token to every PostgREST
// request issued by the same client. Calling signInWithPassword() on the data
// client therefore silently downgrades it from the service role to the signed-in
// user: every later "service-role" query is executed under Row Level Security as
// that user instead. Keeping Auth calls on this separate client guarantees that
// getSupabaseAdmin() stays the service role for the whole process lifetime.
export function getSupabaseAuth(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAuth) {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseAuth = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAuth;
}

export async function logAuditEvent(event: {
  schoolId?: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('audit_events').insert({
        school_id: event.schoolId || '00000000-0000-0000-0000-000000000001',
        actor_id: event.actorId,
        actor_role: event.actorRole || 'system',
        action: event.action,
        target_entity: event.targetEntity,
        target_id: event.targetId,
        metadata: event.metadata || {},
        ip_address: event.ipAddress,
      });
    } catch (err) {
      console.error('[Audit Log Error]', err);
    }
  } else {
    // No database configured: audit events are still recorded to the server log.
    console.log(`[AUDIT EVENT] [${event.action}] entity=${event.targetEntity}:${event.targetId || ''} actor=${event.actorRole || 'system'}:${event.actorId || ''}`);
  }
}
