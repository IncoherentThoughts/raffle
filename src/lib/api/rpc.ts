import { supabase } from '../supabase'
import type { Database } from '../database.types'
import { unwrap, type SupabaseResult } from './errors'

export type Functions = Database['public']['Functions']
export type FunctionName = keyof Functions
export type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
export type Enums = Database['public']['Enums']

type ArgsOf<F extends FunctionName> = Functions[F]['Args']
type HasNoArgs<F extends FunctionName> =
  ArgsOf<F> extends Record<PropertyKey, never> ? true : false

/**
 * Typed `supabase.rpc` that throws {@link ApiError} instead of returning `{ error }`.
 * Arg and return types come from `src/lib/database.types.ts` (`npm run gen:types`).
 *
 *   const id = await rpc('create_raffle', { p_title, p_close_time })
 *   const now = await rpc('keepalive')
 */
export async function rpc<F extends FunctionName>(
  fn: F,
  ...args: HasNoArgs<F> extends true ? [] : [ArgsOf<F>]
): Promise<Functions[F]['Returns']> {
  // supabase-js's own rpc generics don't survive a generic F; the public signature above is typed.
  const call = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args?: object,
  ) => PromiseLike<SupabaseResult<Functions[F]['Returns']>>
  return unwrap(await call(fn, args[0]))
}
