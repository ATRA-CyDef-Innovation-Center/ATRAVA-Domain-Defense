import { getAuth } from 'firebase/auth';
import app from '@/lib/firebase';
let _auth = null;
export function getFirebaseClientAuth() {
    if (!_auth) {
        _auth = getAuth(app);
    }
    return _auth;
}
