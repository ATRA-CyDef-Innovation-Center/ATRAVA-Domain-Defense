'use strict'

const http = require('http')
const net = require('net')

const DEFAULT_PROXY_PORT = 8081

function safeHostname(hostname) {
    const clean = String(hostname || '').split(':')[0].trim().toLowerCase()
    if (!/^[a-z0-9.-]+$/.test(clean)) return ''
    return clean.replace(/^\.+|\.+$/g, '')
}

function blockPageUrl(blockPageUrl, domain) {
    const url = new URL(blockPageUrl)
    url.searchParams.set('domain', domain)
    return url.toString()
}

function isBlocked(policyCache, hostname) {
    const host = safeHostname(hostname)
    if (!host) return false
    if (policyCache.isDomainWhitelisted(host)) return false
    return policyCache.isDomainBlacklisted(host)
}

function connectTargetFromRequest(req) {
    const [host, port] = String(req.url || '').split(':')
    return {
        host: safeHostname(host),
        port: Number(port || 443),
    }
}

function httpTargetFromRequest(req) {
    try {
        const url = new URL(req.url)
        return {
            url,
            host: safeHostname(url.hostname),
            port: Number(url.port || 80),
        }
    } catch (_) {
        const host = safeHostname(req.headers.host)
        return {
            url: new URL(`http://${req.headers.host || host}${req.url || '/'}`),
            host,
            port: 80,
        }
    }
}

function writeConnectBlock(socket, blockUrl, host) {
    const body = [
        '<!doctype html>',
        '<html><head><meta charset="utf-8"><title>Website Blocked</title></head>',
        '<body>',
        '<h1>Website Blocked</h1>',
        `<p>Access to ${host} has been restricted by network policy.</p>`,
        `<p><a href="${blockUrl}">Open the ATRAVA NTC Blocker page</a></p>`,
        '</body></html>',
    ].join('')

    socket.write(
        [
            'HTTP/1.1 403 Forbidden',
            'Content-Type: text/html; charset=utf-8',
            `Content-Length: ${Buffer.byteLength(body)}`,
            'Cache-Control: no-store, max-age=0',
            'Connection: close',
            '',
            body,
        ].join('\r\n')
    )
    socket.end()
}

function createProxyServer({ policyCache, blockPageUrl: canonicalBlockPageUrl }) {
    const server = http.createServer((clientReq, clientRes) => {
        const target = httpTargetFromRequest(clientReq)

        if (isBlocked(policyCache, target.host)) {
            const redirectUrl = blockPageUrl(canonicalBlockPageUrl, target.host)
            clientRes.writeHead(302, {
                Location: redirectUrl,
                'Cache-Control': 'no-store, max-age=0',
            })
            clientRes.end()
            return
        }

        const proxyReq = http.request(
            {
                protocol: 'http:',
                hostname: target.host,
                port: target.port,
                method: clientReq.method,
                path: `${target.url.pathname}${target.url.search}`,
                headers: clientReq.headers,
            },
            (proxyRes) => {
                clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
                proxyRes.pipe(clientRes)
            }
        )

        proxyReq.on('error', (error) => {
            console.error('[proxy] HTTP proxy error:', error.message)
            if (!clientRes.headersSent) {
                clientRes.writeHead(502, { 'Content-Type': 'text/plain' })
            }
            clientRes.end('Bad gateway')
        })

        clientReq.pipe(proxyReq)
    })

    server.on('connect', (req, clientSocket, head) => {
        const target = connectTargetFromRequest(req)

        if (!target.host || !Number.isFinite(target.port)) {
            clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
            return
        }

        if (isBlocked(policyCache, target.host)) {
            writeConnectBlock(
                clientSocket,
                blockPageUrl(canonicalBlockPageUrl, target.host),
                target.host
            )
            return
        }

        const upstreamSocket = net.connect(target.port, target.host, () => {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
            if (head && head.length) upstreamSocket.write(head)
            upstreamSocket.pipe(clientSocket)
            clientSocket.pipe(upstreamSocket)
        })

        upstreamSocket.on('error', (error) => {
            console.error('[proxy] CONNECT proxy error:', error.message)
            clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
        })
    })

    return server
}

function startProxyServer({ policyCache }) {
    const port = Number(process.env.PROXY_PORT || DEFAULT_PROXY_PORT)
    const blockPage =
        process.env.BLOCK_PAGE_URL ||
        'https://atrava-domain-defense.cisoasaservice.io/ntc-blocker'
    const server = createProxyServer({ policyCache, blockPageUrl: blockPage })

    server.listen(port, '0.0.0.0', () => {
        console.log(`[proxy] Explicit proxy listening on 0.0.0.0:${port}`)
        console.log(`[proxy] Block page target: ${blockPage}`)
    })

    return server
}

module.exports = {
    createProxyServer,
    startProxyServer,
}
