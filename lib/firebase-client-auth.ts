import { getAuth, type Auth } from 'firebase/auth';
import app from '@/lib/firebase';

let _auth: Auth | null = null;

export function getFirebaseClientAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(app);
  }
  return _auth;
}
