import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-session';
import { getLoginAccount } from '@/lib/user-accounts';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const account = await getLoginAccount(session.email).catch(() => null);
  if (!account) {
    return NextResponse.json({ user: null }, { status: 404 });
  }

  return NextResponse.json({ user: account });
}
