'use strict'

const childProcess = require('child_process')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')
const tls = require('tls')

const HTTP_PORT = readPort(process.env.BLOCK_PAGE_PORT, 80)
const HTTPS_PORT = readPort(process.env.BLOCK_PAGE_HTTPS_PORT, 443)
const HTTPS_ENABLED = readFlag(
    process.env.BLOCK_PAGE_HTTPS_ENABLED,
    Boolean(
        process.env.BLOCK_PAGE_HTTPS_PORT ||
            process.env.BLOCK_PAGE_TLS_CERT ||
            process.env.BLOCK_PAGE_TLS_CERT_FILE ||
            process.env.BLOCK_PAGE_CA_CERT ||
            process.env.BLOCK_PAGE_CA_CERT_FILE
    )
)
const BLOCK_PAGE_URL =
    process.env.BLOCK_PAGE_URL || `http://blocked.local:${HTTP_PORT}/`
const BLOCK_PAGE_HOST = safeHostname(new URL(BLOCK_PAGE_URL).hostname)
const SUPPORT_EMAIL =
    process.env.BLOCK_PAGE_SUPPORT_EMAIL || 'support@atrava.local'
const CERT_CACHE_DIR =
    process.env.BLOCK_PAGE_CERT_CACHE_DIR ||
    path.join(os.tmpdir(), 'atrava-block-page-certs')
const CERT_DAYS = readPositiveInt(process.env.BLOCK_PAGE_CERT_DAYS, 7)

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function page(hostname) {
    const blockedHost = escapeHtml(hostname || 'this website')

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
        <span>ATRAVA Domain Defense</span>
        <span>Policy notice generated for ${blockedHost}</span>
      </footer>
    </section>
  </main>
</body>
</html>`
}

function safeHostname(hostname) {
    const clean = String(hostname || 'blocked.local')
        .split(':')[0]
        .toLowerCase()
    if (!/^[a-z0-9.-]+$/.test(clean)) return 'blocked.local'
    return clean.replace(/^\.+|\.+$/g, '') || 'blocked.local'
}

function optionalHostname(hostname) {
    if (!hostname) return ''
    const clean = String(hostname).split(':')[0].toLowerCase()
    if (!/^[a-z0-9.-]+$/.test(clean)) return ''
    return clean.replace(/^\.+|\.+$/g, '')
}

function readPort(value, fallback) {
    const port = Number(value || fallback)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return fallback
    return port
}

function readFlag(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback
    return /^(1|true|yes|on)$/i.test(String(value))
}

function readPositiveInt(value, fallback) {
    const number = Number(value || fallback)
    if (!Number.isInteger(number) || number < 1) return fallback
    return number
}

function readPemValue(value) {
    return String(value || '').replace(/\\n/g, '\n')
}

function loadPem({ inlineEnv, fileEnv }) {
    const inlineValue = readPemValue(process.env[inlineEnv])
    if (inlineValue) return inlineValue

    const filePath = process.env[fileEnv]
    if (!filePath) return ''
    return fs.readFileSync(filePath, 'utf8')
}

function writeInlinePemToCache({ inlineEnv, fileEnv, filename, mode }) {
    if (process.env[fileEnv]) return process.env[fileEnv]

    const inlineValue = readPemValue(process.env[inlineEnv])
    if (!inlineValue) return ''

    fs.mkdirSync(CERT_CACHE_DIR, { recursive: true })
    const filePath = path.join(CERT_CACHE_DIR, filename)
    fs.writeFileSync(filePath, inlineValue, { mode })
    return filePath
}

function loadStaticTlsOptions() {
    const cert = loadPem({
        inlineEnv: 'BLOCK_PAGE_TLS_CERT',
        fileEnv: 'BLOCK_PAGE_TLS_CERT_FILE',
    })
    const key = loadPem({
        inlineEnv: 'BLOCK_PAGE_TLS_KEY',
        fileEnv: 'BLOCK_PAGE_TLS_KEY_FILE',
    })

    if (cert && key) {
        return {
            cert,
            key,
            minVersion: 'TLSv1.2',
        }
    }

    if (cert || key) {
        console.warn(
            '[block-page] Static HTTPS certificate is incomplete; set both BLOCK_PAGE_TLS_CERT(_FILE) and BLOCK_PAGE_TLS_KEY(_FILE).'
        )
    }

    return null
}

function loadCaMaterial() {
    const certFile = writeInlinePemToCache({
        inlineEnv: 'BLOCK_PAGE_CA_CERT',
        fileEnv: 'BLOCK_PAGE_CA_CERT_FILE',
        filename: 'block-page-ca.crt',
        mode: 0o644,
    })
    const keyFile = writeInlinePemToCache({
        inlineEnv: 'BLOCK_PAGE_CA_KEY',
        fileEnv: 'BLOCK_PAGE_CA_KEY_FILE',
        filename: 'block-page-ca.key',
        mode: 0o600,
    })

    if (certFile && keyFile) return { certFile, keyFile }

    if (certFile || keyFile) {
        console.warn(
            '[block-page] HTTPS inspection CA is incomplete; set both BLOCK_PAGE_CA_CERT(_FILE) and BLOCK_PAGE_CA_KEY(_FILE).'
        )
    }

    return null
}

function openssl(args) {
    childProcess.execFileSync('openssl', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
    })
}

function assertOpenSslAvailable() {
    try {
        openssl(['version'])
    } catch (error) {
        throw new Error(
            `OpenSSL is required for BLOCK_PAGE_CA_CERT mode: ${error.message}`
        )
    }
}

function certBaseName(hostname) {
    return optionalHostname(hostname).replace(/[^a-z0-9.-]/g, '_')
}

function certPaths(hostname) {
    const base = path.join(CERT_CACHE_DIR, certBaseName(hostname))
    return {
        cert: `${base}.crt`,
        csr: `${base}.csr`,
        key: `${base}.key`,
        config: `${base}.cnf`,
    }
}

function isCertificateFresh(certPath) {
    if (!fs.existsSync(certPath)) return false

    try {
        openssl(['x509', '-checkend', '3600', '-noout', '-in', certPath])
        return true
    } catch (_) {
        return false
    }
}

function writeOpenSslConfig(hostname, configPath) {
    const config = [
        '[req]',
        'distinguished_name=req_distinguished_name',
        'prompt=no',
        'req_extensions=v3_req',
        '',
        '[req_distinguished_name]',
        `CN=${hostname}`,
        '',
        '[v3_req]',
        'keyUsage=critical,digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth',
        'subjectAltName=@alt_names',
        '',
        '[alt_names]',
        `DNS.1=${hostname}`,
        '',
    ].join('\n')

    fs.writeFileSync(configPath, config, { mode: 0o600 })
}

function ensureHostCertificate(hostname, caMaterial) {
    const host = optionalHostname(hostname) || 'blocked.local'
    const paths = certPaths(host)

    fs.mkdirSync(CERT_CACHE_DIR, { recursive: true })

    if (
        fs.existsSync(paths.key) &&
        fs.existsSync(paths.cert) &&
        isCertificateFresh(paths.cert)
    ) {
        return {
            cert: fs.readFileSync(paths.cert, 'utf8'),
            key: fs.readFileSync(paths.key, 'utf8'),
        }
    }

    writeOpenSslConfig(host, paths.config)
    openssl(['genrsa', '-out', paths.key, '2048'])
    openssl([
        'req',
        '-new',
        '-key',
        paths.key,
        '-out',
        paths.csr,
        '-config',
        paths.config,
    ])
    openssl([
        'x509',
        '-req',
        '-in',
        paths.csr,
        '-CA',
        caMaterial.certFile,
        '-CAkey',
        caMaterial.keyFile,
        '-CAcreateserial',
        '-out',
        paths.cert,
        '-days',
        String(CERT_DAYS),
        '-sha256',
        '-extensions',
        'v3_req',
        '-extfile',
        paths.config,
    ])
    fs.rmSync(paths.csr, { force: true })

    return {
        cert: fs.readFileSync(paths.cert, 'utf8'),
        key: fs.readFileSync(paths.key, 'utf8'),
    }
}

function loadCaTlsOptions(caMaterial) {
    assertOpenSslAvailable()

    const contextCache = new Map()
    const fallbackHost = BLOCK_PAGE_HOST || 'blocked.local'
    const fallbackCert = ensureHostCertificate(fallbackHost, caMaterial)
    const fallbackContext = tls.createSecureContext(fallbackCert)

    return {
        ...fallbackCert,
        minVersion: 'TLSv1.2',
        SNICallback: (servername, callback) => {
            const host = optionalHostname(servername)

            if (!host) {
                callback(null, fallbackContext)
                return
            }

            try {
                let context = contextCache.get(host)
                if (!context) {
                    context = tls.createSecureContext(
                        ensureHostCertificate(host, caMaterial)
                    )
                    contextCache.set(host, context)
                }
                callback(null, context)
            } catch (error) {
                console.error(
                    `[block-page] Failed to prepare TLS certificate for ${host}: ${error.message}`
                )
                callback(null, fallbackContext)
            }
        },
    }
}

function loadHttpsOptions() {
    const caMaterial = loadCaMaterial()
    if (caMaterial) return loadCaTlsOptions(caMaterial)

    const staticOptions = loadStaticTlsOptions()
    if (staticOptions) return staticOptions

    return null
}

function handleRequest(req, res) {
    const host = (req.headers.host || '').split(':')[0]
    const blockedHost = safeHostname(host)
    const requestUrl = new URL(req.url || '/', BLOCK_PAGE_URL)
    const queryDomain = optionalHostname(requestUrl.searchParams.get('domain'))

    if (blockedHost && blockedHost !== BLOCK_PAGE_HOST) {
        const redirectUrl = new URL(BLOCK_PAGE_URL)
        redirectUrl.searchParams.set('domain', blockedHost)
        res.writeHead(302, {
            Location: redirectUrl.toString(),
            'Cache-Control': 'no-store, max-age=0',
        })
        res.end()
        return
    }

    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
    })
    res.end(page(queryDomain || blockedHost))
}

const httpServer = http.createServer(handleRequest)

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[block-page] HTTP listening on 0.0.0.0:${HTTP_PORT}`)
    console.log(`[block-page] Redirect target: ${BLOCK_PAGE_URL}`)
})

if (HTTPS_ENABLED) {
    try {
        const httpsOptions = loadHttpsOptions()

        if (!httpsOptions) {
            console.warn(
                '[block-page] HTTPS listener not started. Configure BLOCK_PAGE_CA_CERT(_FILE)+BLOCK_PAGE_CA_KEY(_FILE) for trusted HTTPS redirects, or BLOCK_PAGE_TLS_CERT(_FILE)+BLOCK_PAGE_TLS_KEY(_FILE) for a static certificate.'
            )
        } else {
            const httpsServer = https.createServer(httpsOptions, handleRequest)

            httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
                console.log(
                    `[block-page] HTTPS redirect listening on 0.0.0.0:${HTTPS_PORT}`
                )
            })
        }
    } catch (error) {
        console.error(
            `[block-page] HTTPS listener failed to start: ${error.message}`
        )
    }
}
