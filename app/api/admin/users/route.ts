import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-session';
import { deliverInviteEmail } from '@/lib/invite-delivery';
import {
  inviteUserAccount,
  listUserAccounts,
  revokeInviteById,
} from '@/lib/user-accounts';
import type { UserRole } from '@/lib/types';

// ---------------------------------------------------------------------------
// Auth guard helper
// ---------------------------------------------------------------------------

async function requireAdmin(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ message: 'Unauthorized.' }, { status: 401 }) };
  }
  if (session.role !== 'admin') {
    return { error: NextResponse.json({ message: 'Forbidden.' }, { status: 403 }) };
  }
  return { session };
}

// ---------------------------------------------------------------------------
// GET /api/admin/users — list all users
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const users = await listUserAccounts();
  return NextResponse.json({ users });
}

// ---------------------------------------------------------------------------
// POST /api/admin/users — invite a new user
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { session } = auth;

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const role = typeof body?.role === 'string' ? (body.role as UserRole) : 'viewer';

    const result = await inviteUserAccount({ email, role, invitedBy: session.email });

    // Deliver invite email
    let delivery = null;
    try {
      delivery = await deliverInviteEmail({
        toEmail: result.user.email,
        invitedBy: session.email,
        expiresAt: result.invite.expiresAt,
        inviteToken: result.invite.token,
        requestOrigin: request.nextUrl?.origin ?? '',
      });
    } catch (deliveryErr: unknown) {
      const reason = deliveryErr instanceof Error ? deliveryErr.message : 'email_delivery_failed';

      // Revoke invite and fail
      await revokeInviteById(result.invite.id).catch(() => null);
      
      let errorMessage = `Invite email could not be delivered. Invitation was revoked. (${reason})`;
      if (reason === 'firebase_email_provider_not_enabled') {
        errorMessage = 'Failed to send invite email: Please enable "Email link (passwordless sign-in)" in Firebase Authentication settings (Sign-in method tab).';
      }

      return NextResponse.json(
        { message: errorMessage },
        { status: 502 }
      );
    }

    const baseUrl = request.nextUrl?.origin ?? 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/verify-invite?token=${encodeURIComponent(result.invite.token)}`;

    return NextResponse.json(
      {
        ok: true,
        user: result.user,
        invite: {
          id: result.invite.id,
          email: result.invite.email,
          role: result.invite.role,
          invitedBy: result.invite.invitedBy,
          invitedAt: result.invite.invitedAt,
          expiresAt: result.invite.expiresAt,
          status: result.invite.status,
        },
        delivery,
        link: process.env.NODE_ENV !== 'production' || (delivery && 'previewUrl' in delivery) ? verifyUrl : undefined,
        ...(delivery && 'status' in delivery && delivery.status === 'failed'
          ? { warning: `Invite email delivery failed (${(delivery as any).reason || 'dev mode'}) — share the manual link.` }
          : {}),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    const message =
      reason === 'invalid_email'
        ? 'Invalid email address.'
        : reason === 'invalid_role'
        ? 'Invalid role selected.'
        : reason === 'user_already_exists'
        ? 'A user with that email already exists and is active.'
        : 'Unable to create invitation.';

    return NextResponse.json({ message }, { status: 400 });
  }
}
