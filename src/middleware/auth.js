function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

module.exports = { requireAdmin };
