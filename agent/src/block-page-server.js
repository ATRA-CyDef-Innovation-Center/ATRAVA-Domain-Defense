"use strict";

const http = require("http");
const https = require("https");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HTTP_PORT = Number(process.env.BLOCK_PAGE_PORT || 80);
const HTTPS_PORT = Number(process.env.BLOCK_PAGE_HTTPS_PORT || 443);
const CERT_DIR = process.env.BLOCK_PAGE_CERT_DIR || "/var/lib/gcot-block-page";
const SUPPORT_EMAIL = process.env.BLOCK_PAGE_SUPPORT_EMAIL || "support@atrava.local";
const CA_KEY = path.join(CERT_DIR, "gcot-block-root-ca.key");
const CA_CERT = path.join(CERT_DIR, "gcot-block-root-ca.crt");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(hostname) {
  const blockedHost = escapeHtml(hostname || "this website");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Website Blocked | NTC Philippines</title>
  <style>
    :root {
      color-scheme: light;
      --blue: #0b3d91;
      --red: #c9252d;
      --gold: #f7c948;
      --ink: #182235;
      --muted: #5d6b82;
      --line: #dce3ee;
      --paper: #ffffff;
      --wash: #eef4fb;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(180deg, rgba(11, 61, 145, 0.08), rgba(247, 201, 72, 0.08)),
        var(--wash);
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
    }

    .topbar {
      height: 10px;
      background: linear-gradient(90deg, var(--blue) 0 48%, var(--gold) 48% 56%, var(--red) 56% 100%);
    }

    main {
      min-height: calc(100vh - 10px);
      display: grid;
      place-items: center;
      padding: 32px 18px;
    }

    .notice {
      width: min(920px, 100%);
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      box-shadow: 0 24px 70px rgba(24, 34, 53, 0.12);
    }

    .header {
      display: flex;
      gap: 18px;
      align-items: center;
      padding: 28px 32px;
      border-bottom: 1px solid var(--line);
      background: #f8fbff;
    }

    .seal {
      display: grid;
      width: 72px;
      height: 72px;
      flex: 0 0 auto;
      place-items: center;
      border: 3px solid var(--blue);
      border-radius: 50%;
      background: #fff;
      color: var(--blue);
      font-weight: 800;
      letter-spacing: 0;
      line-height: 1;
    }

    .agency {
      margin: 0;
      color: var(--blue);
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
    }

    h1 {
      margin: 6px 0 0;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.05;
      letter-spacing: 0;
    }

    .content {
      display: grid;
      gap: 24px;
      padding: 32px;
    }

    .domain {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      padding: 18px 20px;
      border-left: 5px solid var(--red);
      background: #fff6f6;
      font-size: 18px;
    }

    .domain strong {
      overflow-wrap: anywhere;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .panel {
      min-height: 132px;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }

    .panel h2 {
      margin: 0 0 10px;
      color: var(--blue);
      font-size: 17px;
    }

    .panel p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }

    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      justify-content: space-between;
      padding: 20px 32px;
      border-top: 1px solid var(--line);
      background: #f8fbff;
      color: var(--muted);
      font-size: 13px;
    }

    @media (max-width: 720px) {
      .header, .content, .footer { padding-left: 20px; padding-right: 20px; }
      .grid { grid-template-columns: 1fr; }
      .seal { width: 60px; height: 60px; }
    }
  </style>
</head>
<body>
  <div class="topbar"></div>
  <main>
    <section class="notice" aria-labelledby="blocked-title">
      <header class="header">
        <div class="seal" aria-hidden="true">NTC</div>
        <div>
          <p class="agency">National Telecommunications Commission of the Philippines</p>
          <h1 id="blocked-title">Website Blocked</h1>
        </div>
      </header>

      <div class="content">
        <div class="domain">
          Access to <strong>${blockedHost}</strong> has been restricted by network policy.
        </div>

        <div class="grid">
          <article class="panel">
            <h2>Why am I seeing this?</h2>
            <p>This domain matches an active DNS filtering policy configured for this network. The request was redirected to this notice page instead of the original website.</p>
          </article>

          <article class="panel">
            <h2>Need assistance?</h2>
            <p>If you believe this block is incorrect, contact your network administrator or email ${escapeHtml(SUPPORT_EMAIL)} with the blocked domain and time of access.</p>
          </article>
        </div>
      </div>

      <footer class="footer">
        <span>GCOT Domain Defense</span>
        <span>Policy notice generated for ${blockedHost}</span>
      </footer>
    </section>
  </main>
</body>
</html>`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeHostname(hostname) {
  const clean = String(hostname || "blocked.local").split(":")[0].toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(clean)) return "blocked.local";
  return clean.replace(/^\.+|\.+$/g, "") || "blocked.local";
}

function runOpenSsl(args) {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function ensureCa() {
  ensureDir(CERT_DIR);
  if (fs.existsSync(CA_KEY) && fs.existsSync(CA_CERT)) return;

  console.log(`[block-page] Generating GCOT block page root CA at ${CERT_DIR}`);
  runOpenSsl([
    "req",
    "-x509",
    "-newkey",
    "rsa:4096",
    "-sha256",
    "-days",
    "3650",
    "-nodes",
    "-keyout",
    CA_KEY,
    "-out",
    CA_CERT,
    "-subj",
    "/C=PH/O=ATRAVA GCOT/OU=Domain Defense/CN=GCOT Block Page Root CA",
  ]);
}

function ensureHostCert(hostname) {
  ensureCa();
  const host = safeHostname(hostname);
  const hostDir = path.join(CERT_DIR, "issued");
  ensureDir(hostDir);

  const keyPath = path.join(hostDir, `${host}.key`);
  const csrPath = path.join(hostDir, `${host}.csr`);
  const certPath = path.join(hostDir, `${host}.crt`);
  const extPath = path.join(hostDir, `${host}.ext`);

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: keyPath, cert: certPath };
  }

  fs.writeFileSync(
    extPath,
    [
      "basicConstraints=CA:FALSE",
      "keyUsage=digitalSignature,keyEncipherment",
      "extendedKeyUsage=serverAuth",
      `subjectAltName=DNS:${host}`,
      "",
    ].join("\n")
  );

  runOpenSsl([
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    csrPath,
    "-subj",
    `/C=PH/O=ATRAVA GCOT/OU=Domain Defense/CN=${host}`,
  ]);

  runOpenSsl([
    "x509",
    "-req",
    "-in",
    csrPath,
    "-CA",
    CA_CERT,
    "-CAkey",
    CA_KEY,
    "-CAcreateserial",
    "-out",
    certPath,
    "-days",
    "825",
    "-sha256",
    "-extfile",
    extPath,
  ]);

  return { key: keyPath, cert: certPath };
}

function handleRequest(req, res) {
  const host = (req.headers.host || "").split(":")[0];
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  });
  res.end(page(host));
}

ensureCa();
const defaultCert = ensureHostCert("blocked.local");

const httpServer = http.createServer(handleRequest);
const httpsServer = https.createServer(
  {
    key: fs.readFileSync(defaultCert.key),
    cert: fs.readFileSync(defaultCert.cert),
    SNICallback: (servername, callback) => {
      try {
        const cert = ensureHostCert(servername);
        const context = tls.createSecureContext({
          key: fs.readFileSync(cert.key),
          cert: fs.readFileSync(cert.cert),
        });
        callback(null, context);
      } catch (error) {
        console.error("[block-page] Failed to prepare certificate:", error);
        callback(error);
      }
    },
  },
  handleRequest
);

httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`[block-page] HTTP listening on 0.0.0.0:${HTTP_PORT}`);
});

httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
  console.log(`[block-page] HTTPS listening on 0.0.0.0:${HTTPS_PORT}`);
  console.log(`[block-page] Trust this CA on managed clients: ${CA_CERT}`);
});
