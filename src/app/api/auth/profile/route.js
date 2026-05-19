var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-session';
import { getLoginAccount } from '@/lib/user-accounts';
export function GET() {
    return __awaiter(this, void 0, void 0, function* () {
        const session = yield getServerSession();
        if (!session) {
            return NextResponse.json({ user: null }, { status: 401 });
        }
        const account = yield getLoginAccount(session.email).catch(() => null);
        if (!account) {
            return NextResponse.json({ user: null }, { status: 404 });
        }
        return NextResponse.json({ user: account });
    });
}
