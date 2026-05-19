import LoginCard from '@/components/login-card';

export const metadata = {
  title: 'Sign In | ATRAVA Domain Defense',
  description: 'Sign in to the ATRAVA Domain Defense DNS security control plane.',
};

export default function SignInPage() {
  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#080c14]">

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,#080c14_100%)]" />

      {/* Cyan glow top-left */}
      <div className="pointer-events-none absolute -top-72 -left-48 h-[600px] w-[600px] rounded-full bg-cyan-500 opacity-[0.07] blur-[140px]" />

      {/* Indigo glow bottom-right */}
      <div className="pointer-events-none absolute -bottom-72 -right-48 h-[600px] w-[600px] rounded-full bg-indigo-600 opacity-[0.07] blur-[140px]" />

      {/* Violet glow center */}
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-violet-600 opacity-[0.05] blur-[120px]" />

      {/* Top border line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <LoginCard />
      </div>
    </main>
  );
}
