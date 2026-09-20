/* local-proxy.mjs — reach a Local (Flywheel) site from WSL in a real browser.
 *
 *   node build/local-proxy.mjs si-v4.local 8770
 *   → http://127.0.0.1:8770/  is  http://si-v4.local/
 *
 * WHY: Local serves its sites by virtual host on the Windows side. From WSL the
 * site answers at the Windows default-route IP only when the request carries
 * `Host: si-v4.local`, which curl can do and a browser cannot — and /etc/hosts
 * needs root. Chromium has --host-resolver-rules; Firefox, which is the browser
 * that runs on this box, has no equivalent.
 *
 * So: a forwarding proxy that sets the Host header, and rewrites the site's own
 * absolute URLs in HTML, CSS, JS and JSON so that stylesheets, modules and
 * images load from the proxy too.
 */
import http from 'node:http';
import { execSync } from 'node:child_process';

const host = process.argv[2] || 'si-v4.local';
const port = Number(process.argv[3] || 8770);
const upstream = process.env.WIN_IP || execSync("ip route | awk '/^default/{print $3}'").toString().trim();
const TEXT = /\b(text\/|application\/(json|javascript|xml)|\+json|\+xml)/i;

http.createServer((req, res) => {
	const proxied = http.request({
		host: upstream, port: 80, path: req.url, method: req.method,
		headers: { ...req.headers, host, 'accept-encoding': 'identity' },
	}, (up) => {
		const type = up.headers['content-type'] || '';
		const headers = { ...up.headers };
		delete headers['content-length'];
		delete headers['content-encoding'];
		if (headers.location) {
			headers.location = String(headers.location).replaceAll(`http://${host}`, `http://127.0.0.1:${port}`);
		}
		res.writeHead(up.statusCode || 502, headers);
		if (!TEXT.test(type)) {
			up.pipe(res);
			return;
		}
		const chunks = [];
		up.on('data', c => chunks.push(c));
		up.on('end', () => res.end(Buffer.concat(chunks).toString('utf8')
			.replaceAll(`http://${host}`, `http://127.0.0.1:${port}`)
			.replaceAll(`http:\\/\\/${host}`, `http:\\/\\/127.0.0.1:${port}`)));
	});
	proxied.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
	req.pipe(proxied);
}).listen(port, '127.0.0.1', () => {
	console.log(`http://127.0.0.1:${port}/  →  ${host} at ${upstream}`);
});
