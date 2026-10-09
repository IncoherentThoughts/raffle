import type { ReactNode } from 'react'

/** Red inline message for a failed action or validation (role="alert"). */
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p className="inline-error" role="alert">
      {children}
    </p>
  )
}
