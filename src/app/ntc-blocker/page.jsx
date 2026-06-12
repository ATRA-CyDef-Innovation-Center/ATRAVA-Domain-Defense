function cleanDomain(value) {
  const domain = String(value || '').split(':')[0].trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain)) return '';
  return domain.replace(/^\.+|\.+$/g, '');
}

export const metadata = {
  title: 'Website Blocked | ATRAVA Domain Defense',
  description: 'Network policy notice for blocked domain access.',
};

export default async function NtcBlockerPage({ searchParams }) {
  const params = await searchParams;
  const blockedDomain = cleanDomain(params?.domain) || 'this website';

  return (
    <main className="min-h-screen bg-[#eef4fb] text-[#182235]">
      <div className="h-2.5 bg-[linear-gradient(90deg,#0b3d91_0_48%,#f7c948_48%_56%,#c9252d_56%_100%)]" />
      <section className="grid min-h-[calc(100vh-10px)] place-items-center px-5 py-8">
        <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-[#dce3ee] bg-white shadow-[0_24px_70px_rgba(24,34,53,0.12)]">
          <header className="flex items-center gap-5 border-b border-[#dce3ee] bg-[#f8fbff] px-6 py-7 sm:px-8">
            <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border-[3px] border-[#0b3d91] bg-white font-extrabold leading-none text-[#0b3d91]">
              NTC
            </div>
            <div>
              <p className="m-0 text-sm font-bold uppercase text-[#0b3d91]">
                National Telecommunications Commission of the Philippines
              </p>
              <h1 className="mt-1.5 text-3xl font-bold leading-tight text-[#182235] sm:text-5xl">
                Website Blocked
              </h1>
            </div>
          </header>

          <div className="grid gap-6 px-6 py-8 sm:px-8">
            <div className="border-l-4 border-[#c9252d] bg-[#fff6f6] px-5 py-4 text-lg text-[#182235]">
              Access to{' '}
              <strong className="break-words font-bold">{blockedDomain}</strong>{' '}
              has been restricted by network policy.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="min-h-32 rounded-lg border border-[#dce3ee] bg-white p-5">
                <h2 className="mb-2.5 text-[17px] font-bold text-[#0b3d91]">
                  Why am I seeing this?
                </h2>
                <p className="text-[15px] leading-6 text-[#5d6b82]">
                  This domain matches an active DNS filtering policy configured
                  for this network. The request was redirected to this notice
                  page instead of the original website.
                </p>
              </article>

              <article className="min-h-32 rounded-lg border border-[#dce3ee] bg-white p-5">
                <h2 className="mb-2.5 text-[17px] font-bold text-[#0b3d91]">
                  Need assistance?
                </h2>
                <p className="text-[15px] leading-6 text-[#5d6b82]">
                  If you believe this block is incorrect, contact your network
                  administrator with the blocked domain and time of access.
                </p>
              </article>
            </div>
          </div>

          <footer className="flex flex-wrap justify-between gap-3 border-t border-[#dce3ee] bg-[#f8fbff] px-6 py-5 text-sm text-[#5d6b82] sm:px-8">
            <span>ATRAVA Domain Defense</span>
            <span>Policy notice generated for {blockedDomain}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
