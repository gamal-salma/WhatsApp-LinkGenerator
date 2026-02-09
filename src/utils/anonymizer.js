const { db } = require('../db');

function anonymizeOldRecords() {
  const result = db.run(`
    UPDATE link_requests
    SET encrypted_data = 'ANONYMIZED',
        iv = 'ANONYMIZED',
        auth_tag = 'ANONYMIZED',
        ip_address = substr(ip_address, 1, instr(ip_address, '.'))  || '*.*.*',
        user_agent = NULL
    WHERE created_at < datetime('now', '-30 days')
      AND encrypted_data != 'ANONYMIZED'
  `);
  if (result.changes > 0) {
    db.save();
  }
  return result.changes;
}

function startAnonymizationScheduler() {
  // Run once at startup (delay to let DB init)
  setTimeout(() => {
    try {
      const changes = anonymizeOldRecords();
      if (changes > 0) {
        console.log(`Anonymized ${changes} records older than 30 days.`);
      }
    } catch (err) {
      console.error('Anonymization error:', err.message);
    }
  }, 3000);

  // Run every 24 hours
  setInterval(() => {
    try {
      const changes = anonymizeOldRecords();
      if (changes > 0) {
        console.log(`Scheduled anonymization: ${changes} records anonymized.`);
      }
    } catch (err) {
      console.error('Scheduled anonymization error:', err.message);
    }
  }, 24 * 60 * 60 * 1000);
}

module.exports = { anonymizeOldRecords, startAnonymizationScheduler };
