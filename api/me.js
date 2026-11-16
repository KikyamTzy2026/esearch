const { getUser } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Not signed in.' });
  res.status(200).json({ user: u });
};
