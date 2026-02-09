(function () {
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const logsBody = document.getElementById('logs-body');
  const paginationDiv = document.getElementById('pagination');
  const purgeBtn = document.getElementById('purge-btn');
  const blockIpBtn = document.getElementById('block-ip-btn');
  const blockIpInput = document.getElementById('block-ip-input');
  const blockReasonInput = document.getElementById('block-reason-input');
  const blockedIpsBody = document.getElementById('blocked-ips-body');

  let csrfToken = '';
  let currentPage = 1;

  function headers() {
    return {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        loginError.textContent = data.error || 'Login failed';
        loginError.classList.remove('hidden');
        return;
      }

      csrfToken = data.csrfToken;
      loginSection.classList.add('hidden');
      dashboardSection.classList.remove('hidden');
      loadDashboard();
    } catch {
      loginError.textContent = 'Network error';
      loginError.classList.remove('hidden');
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', headers: headers() });
    } catch { /* ignore */ }
    csrfToken = '';
    dashboardSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
  });

  // Load dashboard data
  async function loadDashboard() {
    await Promise.all([loadAnalytics(), loadLogs(1), loadBlockedIps()]);
  }

  // Analytics
  async function loadAnalytics() {
    try {
      const res = await fetch('/api/admin/analytics', { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      document.getElementById('stat-total').textContent = data.total_requests;
      document.getElementById('stat-today').textContent = data.today_requests;
      document.getElementById('stat-week').textContent = data.week_requests;
      document.getElementById('stat-blocked').textContent = data.active_blocks;
    } catch { /* ignore */ }
  }

  // Logs
  async function loadLogs(page) {
    currentPage = page;
    try {
      const res = await fetch(`/api/admin/logs?page=${page}&limit=15`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();

      if (data.logs.length === 0) {
        logsBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No logs found</td></tr>';
        paginationDiv.innerHTML = '';
        return;
      }

      logsBody.innerHTML = data.logs.map(log => `
        <tr>
          <td>${log.id}</td>
          <td>${escapeHtml(log.phone)}</td>
          <td title="${escapeHtml(log.message)}">${escapeHtml(truncate(log.message, 40))}</td>
          <td>${escapeHtml(log.ip_address)}</td>
          <td>${log.created_at}</td>
        </tr>
      `).join('');

      // Pagination
      const { totalPages } = data.pagination;
      let paginationHtml = '';
      paginationHtml += `<button ${page <= 1 ? 'disabled' : ''} onclick="window.__loadLogs(${page - 1})">Prev</button>`;
      for (let i = 1; i <= Math.min(totalPages, 10); i++) {
        paginationHtml += `<button class="${i === page ? 'active' : ''}" onclick="window.__loadLogs(${i})">${i}</button>`;
      }
      paginationHtml += `<button ${page >= totalPages ? 'disabled' : ''} onclick="window.__loadLogs(${page + 1})">Next</button>`;
      paginationDiv.innerHTML = paginationHtml;
    } catch { /* ignore */ }
  }

  // Expose for inline onclick
  window.__loadLogs = loadLogs;

  // Blocked IPs
  async function loadBlockedIps() {
    try {
      const res = await fetch('/api/admin/blocked-ips', { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();

      if (data.length === 0) {
        blockedIpsBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No blocked IPs</td></tr>';
        return;
      }

      blockedIpsBody.innerHTML = data.map(ip => `
        <tr>
          <td>${escapeHtml(ip.ip_address)}</td>
          <td>${escapeHtml(ip.reason)}</td>
          <td>${ip.blocked_at}</td>
          <td>${ip.expires_at || 'Never (manual)'}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="window.__unblockIp('${escapeHtml(ip.ip_address)}')">Unblock</button></td>
        </tr>
      `).join('');
    } catch { /* ignore */ }
  }

  // Block IP
  blockIpBtn.addEventListener('click', async () => {
    const ip = blockIpInput.value.trim();
    if (!ip) return;
    try {
      await fetch('/api/admin/block-ip', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ip, reason: blockReasonInput.value.trim() }),
      });
      blockIpInput.value = '';
      blockReasonInput.value = '';
      await Promise.all([loadBlockedIps(), loadAnalytics()]);
    } catch { /* ignore */ }
  });

  // Unblock IP
  window.__unblockIp = async (ip) => {
    try {
      await fetch('/api/admin/unblock-ip', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ip }),
      });
      await Promise.all([loadBlockedIps(), loadAnalytics()]);
    } catch { /* ignore */ }
  };

  // Purge
  purgeBtn.addEventListener('click', async () => {
    if (!confirm('Anonymize all records older than 30 days? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/logs/purge', {
        method: 'DELETE',
        headers: headers(),
      });
      const data = await res.json();
      alert(data.message || 'Purge complete');
      await loadLogs(currentPage);
    } catch { /* ignore */ }
  });

  // Check if already logged in (session still valid)
  async function checkSession() {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        // Already authenticated — fetch CSRF token
        const tokenRes = await fetch('/api/csrf-token');
        const tokenData = await tokenRes.json();
        csrfToken = tokenData.csrfToken;
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        loadDashboard();
      }
    } catch { /* not logged in */ }
  }

  checkSession();
})();
