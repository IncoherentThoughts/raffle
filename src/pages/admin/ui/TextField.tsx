import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

type Common = {
  label: ReactNode
  /** Small muted text after the label, e.g. "(optional)". */
  hint?: ReactNode
  /** Helper text under the field (linked with aria-describedby). */
  description?: ReactNode
  /** Validation message shown under the field (also sets aria-invalid). */
  error?: string | null
}

type InputProps = Common & InputHTMLAttributes<HTMLInputElement> & { multiline?: false }
type AreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true }

/** Labelled input/textarea in the Letterhead style. */
export function TextField(props: InputProps | AreaProps) {
  const id = useId()
  const errorId = `${id}-error`
  const descId = `${id}-desc`
  const { label, hint, description, error, className, ...rest } = props
  const describedBy = [description && descId, error && errorId].filter(Boolean).join(' ')
  const shared = {
    id,
    className: `field${className ? ` ${className}` : ''}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  }
  return (
    <div className="field-group">
      <label htmlFor={id} className="field-label">
        {label}
        {hint && <small> {hint}</small>}
      </label>
      {rest.multiline ? (
        <textarea {...(withoutMultiline(rest) as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...shared} />
      ) : (
        <input {...(withoutMultiline(rest) as InputHTMLAttributes<HTMLInputElement>)} {...shared} />
      )}
      {description && (
        <p id={descId} className="field-description">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

function withoutMultiline<T extends { multiline?: boolean }>(p: T): Omit<T, 'multiline'> {
  const { multiline: _ignored, ...rest } = p
  void _ignored
  return rest
}
