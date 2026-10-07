# Reply preparation scheduling

`reply.preparation.strategy` defaults to `parallel`: ordinary routing/context
readiness selects fallback immediately. The opt-in `candidate-first` strategy
defers ordinary preparation until the candidate declines, fails validation,
rejects, or reaches `timeoutMs` (800 ms by default). A valid candidate bypasses
ordinary preparation and model generation. Synchronous templates still take
precedence, and the existing MCP executor retains guards and request scope.

Candidate-first can add up to the configured wait to fallback latency. Measure
full response time and classifier plus generation costs for the actual query
mix before selecting it. Unknown eligibility starts ordinary immediately.
Disconnect cancels waiting and prevents deferred fallback from dispatching.
Late decisions never replace a selected reply. Cancellation does not prove a
provider request was free; applications retain responsibility for billing.
