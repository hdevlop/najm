# Router-first reply preparation

ReplyPreparationPolicy.strategy now also accepts router-first. It completes the
existing ordinary preparation (routing and context, without answer generation),
then starts the bounded candidate factory with server-produced availableToolNames.
Only candidates whose tool calls belong to that shortlist may win. Declines,
invalid plans, errors and timeouts reuse the prepared ordinary result; they do not
route again. Text-only candidates require no tools. Guards and template execution
remain unchanged. A disconnect while routing prevents candidate dispatch.

The deadline begins after ordinary preparation. Candidate-first and parallel
remain unchanged; parallel is still the default. Selection diagnostics carry the
shortlist for this strategy. It is observational and grants no tool permission.
