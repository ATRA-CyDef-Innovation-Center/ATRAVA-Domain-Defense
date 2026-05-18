import { ShieldAlert } from 'lucide-react';

export function PermissionBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100">
      <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
