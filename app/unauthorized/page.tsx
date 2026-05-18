'use client';

import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-lg bg-card border-border">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-300">
            <ShieldX className="h-6 w-6" />
          </div>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            Your current ATRAVA Domain Defense role does not allow access to this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">Switch account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
