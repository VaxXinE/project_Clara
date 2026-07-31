# Clara Semi-Automatic Review Runbook

Status: Stage 5 controlled rollout

## Operating rule

AI generation produces a draft, never approval. In `ENFORCE`, every
customer-facing draft remains pending until an authenticated, authorized human
reviews it. Sending is still an explicit user action.

## Sales review flow

1. Open the pending suggestion in the assigned conversation scope.
2. Compare the draft with the latest customer intent and approved facts.
3. Remove unsupported claims and sensitive data.
4. Approve only `SALES_REVIEW` drafts within the reviewer’s scope.
5. Send through the existing explicit workflow after approval.

Do not rubber-stamp drafts. Generation confidence is not approval evidence.

## Manager/head escalation flow

- `MANAGER_REVIEW`: manager, head, or superadmin reviews.
- `COMPLIANCE_REVIEW`: only roles configured in
  `CLARA_COMPLIANCE_REVIEWER_ROLES` review; default head/superadmin.
- Legal, regulatory, high-risk, negotiation, and closing content must not be
  downgraded by a sales reviewer.

Where a dedicated compliance role is required organizationally, assign that
responsibility outside Clara until the role model is formally expanded.

## Safe-handoff review

Safe handoff is backend-owned and deterministic. A manager, head, superadmin,
or configured compliance reviewer must verify that it:

- acknowledges without admitting fault;
- promises routing, not an outcome or SLA;
- requests only minimum non-sensitive information;
- contains no sales/deposit CTA or transaction instruction.

The internal category must not be copied into the customer message.

## Blocked suggestions

- A blocked record has no customer-facing draft.
- It cannot be approved or sent, including by superadmin.
- Inspect safe reason codes and critical validator IDs in internal logs.
- Create a new safe draft through the approved operational process; never copy
  rejected unsafe text into chat, tickets, or audit notes.

## Extension flow

In `ENFORCE`, extension send cannot auto-approve. If the backend reports that
approval is required, review the suggestion in Clara first, then return to the
explicit send flow. The extension receives the approved final text, and the
backend rejects a changed text during send synchronization. Do not attempt
direct endpoint calls to bypass the gate.

## Audit procedure

Review:

- enforcement contract/mode;
- calculated and applied action;
- safe reason codes;
- reviewer requirement;
- critical validator IDs;
- decision and reply hashes;
- authenticated approval/send actor and role.

Never place full prompts, unsafe drafts, passwords, OTPs, identity documents,
or customer messages into audit metadata.

## Emergency rollback

1. Set `CLARA_POLICY_ENFORCEMENT_MODE=OBSERVE`.
2. Restart the backend through the normal deployment procedure.
3. Confirm logs report `OBSERVE` and `enforcement_applied=false`.
4. Keep manual review active operationally.
5. Record the incident and reason for rollback.

Use `OFF` only when OBSERVE itself causes an operational incident. Rollback
does not authorize auto-send, AI self-approval, or a persona-mode switch.

## Prohibited reviewer behavior

- approving under another person’s name;
- approving without reading the current conversation;
- copying blocked content back into the final reply;
- bypassing organization scope;
- treating safe handoff as a sales opportunity;
- promising refund, compensation, legal outcome, or status access;
- sharing secrets or customer-sensitive data in logs.
