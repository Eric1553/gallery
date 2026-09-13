/* 首页：点击复制 @fico 指令 */
document.querySelectorAll('[data-copy]').forEach(el => {
  el.addEventListener('click', () => {
    const text = el.dataset.copy;
    navigator.clipboard.writeText(text).then(() => {
      const orig = el.textContent;
      el.textContent = '✓ 已复制';
      el.style.background = '#d4f5e4';
      el.style.borderColor = '#86efac';
      setTimeout(() => {
        el.textContent = orig;
        el.style.background = '';
        el.style.borderColor = '';
      }, 1400);
    });
  });
});
