(function () {
  const form = document.getElementById('generate-form');
  const phoneInput = document.getElementById('phone');
  const messageInput = document.getElementById('message');
  const charCount = document.getElementById('char-count');
  const charCounter = charCount.parentElement;
  const generateBtn = document.getElementById('generate-btn');
  const resultDiv = document.getElementById('result');
  const resultLink = document.getElementById('result-link');
  const qrCode = document.getElementById('qr-code');
  const copyBtn = document.getElementById('copy-btn');
  const errorAlert = document.getElementById('error-alert');
  const consentModal = document.getElementById('consent-modal');
  const consentAccept = document.getElementById('consent-accept');
  const consentCancel = document.getElementById('consent-cancel');

  let csrfToken = '';
  let consentResolve = null;

  // Fetch CSRF token on load
  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token');
      const data = await res.json();
      csrfToken = data.csrfToken;
    } catch {
      console.error('Failed to fetch CSRF token');
    }
  }

  fetchCsrfToken();

  // Character counter
  messageInput.addEventListener('input', () => {
    const len = messageInput.value.length;
    charCount.textContent = len.toLocaleString();
    charCounter.className = 'char-counter';
    if (len > 60000) charCounter.className = 'char-counter danger';
    else if (len > 50000) charCounter.className = 'char-counter warning';
  });

  function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove('hidden');
  }

  function hideError() {
    errorAlert.classList.add('hidden');
  }

  // Consent modal logic
  function showConsentModal() {
    return new Promise((resolve) => {
      consentResolve = resolve;
      consentModal.classList.remove('hidden');
    });
  }

  consentAccept.addEventListener('click', () => {
    consentModal.classList.add('hidden');
    if (consentResolve) consentResolve(true);
  });

  consentCancel.addEventListener('click', () => {
    consentModal.classList.add('hidden');
    if (consentResolve) consentResolve(false);
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const phone = phoneInput.value.trim();
    const message = messageInput.value;

    if (!phone) {
      showError('Please enter a phone number.');
      return;
    }

    // Show consent modal and wait for user response
    const accepted = await showConsentModal();
    if (!accepted) return;

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> Generating...';

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ phone, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Something went wrong.');
        resultDiv.classList.remove('show');
        return;
      }

      // Show result
      resultLink.href = data.link;
      resultLink.textContent = data.link;
      qrCode.src = data.qrCode;
      resultDiv.classList.add('show');
    } catch (err) {
      showError('Network error. Please try again.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Link';
    }
  });

  // Copy button
  copyBtn.addEventListener('click', () => {
    const link = resultLink.href;
    navigator.clipboard.writeText(link).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
    });
  });
})();
