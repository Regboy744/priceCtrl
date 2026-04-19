import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type { Database } from '../types/database.types.js';

// Service role client - bypasses RLS, for server-side operations
let serviceClient: SupabaseClient<Database> | null = null;

// Anon client - respects RLS, for user-context operations
let anonClient: SupabaseClient<Database> | null = null;

/**
 * Get the service role Supabase client.
 * Use this for server-side operations that need to bypass RLS.
 * IMPORTANT: Never expose this client to the frontend.
 */
export function getServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    serviceClient = createClient<Database>(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serviceClient;
}

/**
 * Get the anon Supabase client.
 * Use this for operations that should respect RLS.
 */
export function getAnonClient(): SupabaseClient<Database> {
  if (!anonClient) {
    anonClient = createClient<Database>(env.supabase.url, env.supabase.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anonClient;
}

/**
 * Create a client with a specific user's JWT token.
 * Use this to perform operations as a specific user (respects RLS with user context).
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(env.supabase.url, env.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
