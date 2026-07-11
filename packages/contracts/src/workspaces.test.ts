import { describe, expect, it } from 'vitest';
import { createInvitationSchema } from './workspaces.js';

describe('invitation contracts', () => {
  it('requires an email only for targeted invitations', () => {
    expect(createInvitationSchema.safeParse({ kind: 'email', role: 'viewer' }).success).toBe(false);
    expect(
      createInvitationSchema.safeParse({
        kind: 'share_link',
        email: 'x@example.com',
        role: 'viewer',
      }).success,
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({ kind: 'email', email: 'x@example.com', role: 'scorer' })
        .success,
    ).toBe(true);
  });

  it('never permits an invitation to grant ownership', () => {
    expect(createInvitationSchema.safeParse({ kind: 'share_link', role: 'owner' }).success).toBe(
      false,
    );
  });
});
