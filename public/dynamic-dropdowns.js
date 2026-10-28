/* Public legacy forms share the website proxy, without changing their submission transport. */
(() => {
  const cache = new Map();
  async function load(select) {
    const name = select.dataset.dropdown;
    const previous = select.value;
    select.disabled = true;
    let notice = select.nextElementSibling;
    if (!notice?.matches('[data-dropdown-notice]')) { notice = document.createElement('div'); notice.dataset.dropdownNotice = ''; select.after(notice); }
    notice.replaceChildren();
    try {
      if (!cache.has(name)) cache.set(name, fetch('/api/dropdowns/' + encodeURIComponent(name), { cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error('unavailable'); return response.json(); }));
      const data = await cache.get(name);
      if (!Array.isArray(data.options)) throw new Error('unavailable');
      const options = data.options.filter(option => option.isActive);
      const placeholder = new Option('Select an option', '');
      select.replaceChildren(placeholder, ...options.map(option => new Option(option.label, option.value)));
      select.setCustomValidity('');
      if (previous && !options.some(option => option.value === previous)) { select.add(new Option(previous + ' (no longer available)', previous)); select.options[select.options.length - 1].disabled = true; select.setCustomValidity('Choose an available option.'); }
      select.value = previous;
      select.disabled = false;
      select.onchange = () => select.setCustomValidity('');
    } catch {
      cache.delete(name);
      notice.setAttribute('role', 'alert');
      notice.append('Choices are temporarily unavailable. ');
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again'; retry.onclick = () => load(select); notice.append(retry);
    }
  }
  const controls = Array.from(document.querySelectorAll('select[data-dropdown]'));
  controls.forEach(load);
  window.addEventListener('focus', () => { cache.clear(); controls.forEach(load); });
  for (const form of new Set(controls.map(select => select.form).filter(Boolean))) form.addEventListener('submit', event => {
    if (controls.some(select => select.form === form && (select.disabled || !select.checkValidity()))) { event.preventDefault(); event.stopImmediatePropagation(); const first = controls.find(select => select.form === form && (select.disabled || !select.checkValidity())); first?.focus(); first?.reportValidity(); }
  }, true);
})();
