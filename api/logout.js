const { clearSession } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  clearSession(res);
  res.status(200).json({ ok: true });
};
