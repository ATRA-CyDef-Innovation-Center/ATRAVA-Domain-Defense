'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import { AuthFormShell } from '@/components/auth-form-shell';
import { useAuth } from '@/components/auth-provider';
import { ROLE_LABELS } from '@/lib/rbac';
import type { UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const signUpRoles: UserRole[] = ["analyst", "viewer"];

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, userProfile, loading } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && userProfile) {
      router.replace('/');
    }
  }, [loading, router, userProfile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await signUp({ displayName, email, password, role });
      toast({
        title: 'Account created',
        description: 'Your ATRAVA Domain Defense account is ready. You can now sign in.',
      });
      router.replace('/');
    } catch (error) {
      const message =
        error instanceof FirebaseError ? error.message : 'Unable to create this account.';
      toast({
        title: 'Sign-up failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Create account"
      description="Register a user or service identity for ATRAVA Domain Defense role-based access."
      footer={
        <>
          Already have an account? <Link href="/sign-in" className="text-primary hover:underline">Sign in</Link>
        </>
      }
    >
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="bg-secondary border-border"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="bg-secondary border-border"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="bg-secondary border-border"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger id="role" className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {signUpRoles.map((roleOption) => (
                    <SelectItem key={roleOption} value={roleOption}>
                      {ROLE_LABELS[roleOption]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthFormShell>
  );
}
