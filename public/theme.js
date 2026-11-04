// applies a forced theme before first paint; a separate file because the CSP allows no inline script
try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t } catch {}
