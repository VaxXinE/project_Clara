# Golden V1 to V2 Migration Map

Golden V1 remains immutable and is not reinterpreted at runtime. V2 is a separate canonical dataset.

| V1 concept | V2 field/value | Migration rule |
|---|---|---|
| `case_id`/legacy identifier | `id` | Assign stable V2 category-prefixed ID; do not rename V1. |
| implicit schema | `schema_version: 2.0` | Explicit per case. |
| mixed category | six canonical `category` values | Reclassify into the current service domain; exactly five each. |
| prompt/input text | `customer_message`, `conversation_context` | Rewrite as synthetic/sanitized data, never copy customer chat. |
| legacy account type | `account_category` | Use current account vocabulary. |
| legacy process label | `input_runtime_state.process_state`, `expected.process_state` | Map to current FSM (`UNKNOWN` through `ACTIVE_SUPPORT`); no silent aliases. |
| lowercase action | `expected.policy_action` | Map explicitly to `NORMAL`, `HUMAN_REVIEW`, `SAFE_HANDOFF`, or `BLOCK`. |
| expected topic | `top_level_route`, `conversation_intent`, `generation_strategy` | Use current routing contract enums. |
| review hint | `reviewer_requirement`, `expected_handoff` | Use current policy/routing contract values. |
| embedded fact prose | grounding and required fact keys | Replace mutable facts with registry/synthetic fixture keys. |
| exact-answer expectation | `required_answer_points` | Human guidance only; no brittle exact-text gate. |
| prohibited behavior | validator IDs and forbidden claims | Critical IDs drive deterministic hard fail; phrases are heuristic support. |
| no explicit size | `max_reply_characters` | Explicit deterministic upper bound. |

V1 tests continue against V1. V2 tests validate only canonical V2 semantics and hashing.
