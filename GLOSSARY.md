# Company Raffle

An internal app for The Comfort Group: employees enter giveaways (typically Titans tickets) through a shared link, and an Admin draws the winners.

## Language

### Raffles

**Raffle**:
One giveaway with a title, an optional prize and details, a Close Time and a Winner Count. Only one Raffle is open at a time. A Raffle is Open, Closed, Drawn or Cancelled.
_Avoid_: Drawing, contest, giveaway (as a noun for the record)

**Closed**:
A Raffle whose Close Time has passed but which has not yet been Drawn. Not a separate decision by the Admin: moving the Close Time back into the future reopens it.
_Avoid_: Ended, finished

**Cancelled**:
A Raffle the Admin abandoned before its Draw. Its Entries stay on record; it can never be reopened or drawn.
_Avoid_: Deleted, archived

**Close Time**:
The moment a Raffle stops accepting Entries, set by the Admin when the Raffle is created.
_Avoid_: Expiration, deadline

**Winner Count**:
How many Winners a Raffle's Draw picks; one by default.

### People

**Entrant**:
An employee identified by their work email address (trimmed and lowercased, nothing more), who has entered at least one Raffle or appears as a Winner. The same person on two company domains is two Entrants.
_Avoid_: Participant, user, signup

**Entry**:
One Entrant's single submission to one Raffle (name + work email). An Entrant has at most one Entry per Raffle. An Admin may also add an Entry by hand.
_Avoid_: Ticket, signup, submission

**Removed Entry**:
An Entry an Admin has taken out of a Raffle. It stays on record, is never an Eligible Entry, and can be Restored by an Admin.
_Avoid_: Deleted entry

**Duplicate Flag**:
A warning attached to an Entry that looks like the same person entering twice (same name, matching normalized email, or same device). It never blocks a Draw.
_Avoid_: Duplicate (as a verdict), fraud flag

**Admin**:
A person allowed into the admin panel to create Raffles, view Entries and statistics, and perform Draws.
_Avoid_: Organizer, owner

### Drawing

**Draw**:
The Admin action that randomly selects a Raffle's Winners from its Eligible Entries after the Close Time.
_Avoid_: Spin, pick

**Winner**:
An Entrant selected by a Draw (or recorded manually as a Past Winner). A Winner is Standing until a Redraw marks them Replaced. Their Won Date is when they were drawn or redrawn in, or the date entered for a Past Winner.

**Past Winner**:
A Winner an Admin recorded by hand (name, email, Won Date, note) with no linked Raffle, so earlier giveaways count toward the Exclusion Window. The only kind of Winner that can be deleted.
_Avoid_: Manual winner, legacy winner

**Replaced Winner**:
A Winner a Redraw swapped out. The record stays, with the reason, but they are treated as never having won: eligible again in later Raffles.
_Avoid_: Removed winner, void winner

**Draw Snapshot**:
The record a Draw makes of every Entry in its pool at that instant, marked eligible or excluded with the reason, plus the Winners picked. Redraws take alternates from the Snapshot, never from a fresh pool.
_Avoid_: Pool, audit log

**Redraw**:
Replacing a Winner who can't accept the prize with a newly drawn alternate; both outcomes stay on record.
_Avoid_: Re-roll

**Vacant Slot**:
A Winner position left empty when a Redraw is refused because the Draw Snapshot has no eligible alternates left. It stays on record and the public page omits it; the only remedy is a new Raffle.
_Avoid_: Empty winner, null winner

**Exclusion Window**:
The period (12 months by default, set per Raffle) during which a Standing Winner is ineligible for new Draws, if the Raffle's exclusion setting is on. Counted from the Won Date to the moment of the Draw.

**Eligible Entry**:
An Entry that is not Removed and whose Entrant has no Standing Winner record inside the Exclusion Window when the Draw happens, unless an Eligibility Override says otherwise.

**Eligibility Override**:
An Admin's standing instruction, with a reason, that an Entrant is always eligible or always excluded regardless of the Exclusion Window. May expire.
_Avoid_: Ban, whitelist, blacklist

**Activity Log**:
The permanent record of every Admin action (Raffle changes, Draws, Redraws, Entry removals and additions, Winner and Override changes) with when it happened and, where required, why.
_Avoid_: Audit trail, history (which names the Raffle list)
