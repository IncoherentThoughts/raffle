// Data-access layer: components import from here (or from a feature file in this folder),
// never `supabase` directly. Conventions: src/pages/admin/README.md.
export { ApiError, isApiError, unwrap, type ApiErrorKind } from './errors'
export { rpc, type Row, type Enums, type Functions, type FunctionName, type Tables } from './rpc'
export { ping } from './health'
export {
  signIn,
  signOut,
  getSession,
  onSessionChange,
  type Session,
  type SignInResult,
} from './auth'
