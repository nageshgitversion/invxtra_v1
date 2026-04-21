# Security Specification - Guilt Tax Engine

## 1. Data Invariants
- **Ownership**: Every `GuiltTaxRule` must have a `uid` matching the creator's UID.
- **Integrity**: `taxRate` must be between 0 and 1 (inclusive).
- **Integrity**: `limit` must be a positive number.
- **Relational Integrity**: `targetAccountId` must refer to an existing account owned by the same user.
- **Immutability**: `id` and `uid` should not change after creation.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Create a rule with another user's UID.
2. **Privilege Escalation**: Update a rule's `uid` to another user's UID to "transfer" management.
3. **Orphaned Rule**: Create a rule with a `targetAccountId` that doesn't exist.
4. **Invalid Rate**: Set `taxRate` to 1.5 (150%) or -0.1.
5. **Negative Limit**: Set `limit` to -500.
6. **Shadow Field Injection**: Add `isAdmin: true` to a rule document.
7. **ID Poisoning**: Use a 2KB string as the rule document ID.
8. **Unverified Account Access**: Use a `targetAccountId` belonging to a different user.
9. **Spam Creation**: Attempting to create rules without being authenticated or without email verification.
10. **Global Read**: Attempting to list all rules without a `where` filter on `uid`.
11. **Malicious Update**: Updating `totalTaxed` to a negative value or a massive number via client SDK.
12. **Cross-User Delete**: Deleting a rule that belongs to another user.

## 3. Test Runner (Draft Plan)
- Verify `create` fails if `uid != request.auth.uid`.
- Verify `create` fails if `!get(/databases/$(database)/documents/accounts/$(data.targetAccountId)).exists()`.
- Verify `update` fails if `affectedKeys().hasAny(['uid', 'id'])`.
- Verify `list` fails without `where('uid', '==', auth.uid)`.
