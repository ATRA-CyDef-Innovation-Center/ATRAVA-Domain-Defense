import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
export function AuthFormShell({ title, description, footer, children, }) {
    return (<div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-1/2 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_45%),linear-gradient(180deg,#08111f_0%,#04070d_100%)] border-r border-border p-12">
        <div className="max-w-lg">
          <Link href="/" className="flex items-center gap-3 text-foreground mb-10">
            <BrandLogo />
          </Link>
          <p className="text-sm uppercase tracking-[0.3em] text-primary/80 mb-4">DNS Security Control Plane</p>
          <h1 className="text-5xl font-semibold text-foreground leading-tight mb-5">
            Secure access for the Philippines DNS node.
          </h1>
          <p className="text-muted-foreground text-lg leading-8">
            Authenticate operators, assign roles, and keep domain enforcement isolated to the right people and services.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 text-foreground mb-8">
            <BrandLogo />
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-semibold text-foreground mb-2">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          {children}
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>);
}
