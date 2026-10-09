import type { ApiError } from '../../../lib/api'

/** Friendly copy for business errors from the Entry RPCs (exception names in the migrations). */
export function friendlyEntryError(err: ApiError): string {
  switch (err.message) {
    case 'raffle_not_open':
      return 'This raffle no longer accepts changes to its entries.'
    case 'raffle_not_found':
      return 'That raffle no longer exists.'
    case 'already_entered':
      return 'Already entered in this raffle.'
    case 'already_entered_removed':
      return 'Already entered in this raffle, but that entry was removed.'
    case 'entry_already_removed':
      return 'That entry was already removed.'
    case 'entry_not_removed':
      return 'That entry is not removed.'
    case 'entry_not_found':
      return 'That entry no longer exists.'
    case 'reason_required':
      return 'Give a reason of at least 3 characters.'
    case 'not_flagged':
      return 'Those entries are no longer flagged for this rule.'
    default:
      // Check constraints (bad email / name length) surface as 23514.
      if (err.code === '23514') return 'Check the name and email.'
      return err.message
  }
}
