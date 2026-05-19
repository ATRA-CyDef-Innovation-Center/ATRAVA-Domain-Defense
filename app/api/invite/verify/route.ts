import { NextRequest, NextResponse } from 'next/server';
import {
  getInviteForEmailVerification,
  verifyInviteEmail,
} from '@/lib/user-accounts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeToken(value: string | null): string {
  const token = String(value ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{24,128}$/.test(token)) return '';
  return token;
}

function messageForReason(reason: string): string {
  const map: Record<string, string> = {
    invalid_invite_token: 'Invite link is invalid or unavailable.',
    invite_not_found: 'Invite link is invalid or unavailable.',
    invite_expired: 'Invite link has expired. Ask an admin to send a new invitation.',
    invite_revoked: 'Invite link has been revoked. Contact your admin.',
    invite_already_verified: 'Invite verification is already completed. You can sign in.',
    invite_user_not_found: 'Invited account is not available. Contact your admin.',
    account_disabled: 'Invited account is disabled. Contact your admin.',
  };
  return map[reason] ?? 'Unable to process invite verification.';
}

function statusForReason(reason: string): number {
  if (reason === 'invalid_invite_token') return 400;
  if (reason === 'invite_not_found' || reason === 'invite_user_not_found') return 404;
  if (reason === 'invite_expired') return 410;
  if (reason === 'invite_revoked' || reason === 'account_disabled') return 403;
  if (reason === 'invite_already_verified') return 200;
  return 400;
}

// ---------------------------------------------------------------------------
// GET — load invite info for display
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const token = normalizeToken(request.nextUrl.searchParams.get('token'));
  if (!token) {
    return NextResponse.json(
      { message: messageForReason('invalid_invite_token') },
      { status: 400 }
    );
  }

  try {
    const invite = await getInviteForEmailVerification(token);
    if (!invite) {
      return NextResponse.json(
        { message: messageForReason('invite_not_found') },
        { status: 404 }
      );
    }
    if (invite.status === 'expired') {
      return NextResponse.json({ message: messageForReason('invite_expired'), invite }, { status: 410 });
    }
    if (invite.status === 'revoked') {
      return NextResponse.json({ message: messageForReason('invite_revoked'), invite }, { status: 403 });
    }
    return NextResponse.json({ ok: true, invite });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    if (reason === 'invite_already_verified') {
      const invite = await getInviteForEmailVerification(token).catch(() => null);
      return NextResponse.json(
        { ok: true, alreadyVerified: true, invite, message: messageForReason(reason) },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { message: messageForReason(reason) },
      { status: statusForReason(reason) }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — verify invite email
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let token = '';
  try {
    const body = await request.json();
    token = normalizeToken(body?.token ?? null);
  } catch {
    token = '';
  }

  if (!token) {
    return NextResponse.json(
      { message: messageForReason('invalid_invite_token') },
      { status: 400 }
    );
  }

  try {
    const result = await verifyInviteEmail({ token });
    return NextResponse.json({
      ok: true,
      user: result.user,
      invite: result.invite,
      message: 'Email verification completed. You can now sign in with Google.',
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    if (reason === 'invite_already_verified') {
      return NextResponse.json(
        { ok: true, alreadyVerified: true, message: messageForReason(reason) },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { message: messageForReason(reason), reason },
      { status: statusForReason(reason) }
    );
  }
}
