(() => {
  let theme;
  try {
    theme = localStorage.getItem('theme');
  } catch {
    // Storage can be unavailable even when the system preference is readable.
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.add('js');
})();
