export function basicAuth(req, res, next) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // No auth configured — allow all requests (local dev)
  if (!user || !password) {
    return next();
  }

  const header = req.headers.authorization;

  if (!header || !header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="RSS Reader"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const [providedUser, providedPassword] = Buffer.from(
    header.slice(6),
    'base64'
  )
    .toString()
    .split(':');

  if (providedUser !== user || providedPassword !== password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="RSS Reader"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  next();
}
