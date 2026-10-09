import type { ButtonHTMLAttributes } from 'react'

/**
 * - primary: filled blue (submit)
 * - outline: blue outline (secondary)
 * - danger: red outline (Close early, Remove, Cancel raffle)
 * - gold: gold fill (Draw winner; only for the winner moment)
 * - link: text-only blue action inside tables ("Restore", "Redraw")
 * - link-danger: text-only red action inside tables ("Remove")
 */
export type ButtonVariant = 'primary' | 'outline' | 'danger' | 'gold' | 'link' | 'link-danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const cls = `btn btn--${variant}${className ? ` ${className}` : ''}`
  return <button type={type} className={cls} {...rest} />
}
