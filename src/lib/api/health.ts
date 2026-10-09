import { rpc } from './rpc'

/**
 * Cheap round trip to the database (anon-callable `keepalive()`), used by the admin shell
 * to decide whether to show the "Can't reach the database" banner.
 */
export async function ping(): Promise<void> {
  await rpc('keepalive')
}
