// Vercel must never publish a frontend pointing at the visitor's localhost.
if (process.env.VERCEL === '1') {
  const value = process.env.VITE_SOCKET_URL;
  let url;
  try { url = new URL(value); } catch {}
  if (!url || url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Set VITE_SOCKET_URL to the public HTTPS multiplayer server URL in Vercel, then redeploy.');
  }
}
