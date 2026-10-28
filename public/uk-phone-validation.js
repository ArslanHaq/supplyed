/* UK phone controls for the standalone registration pages. Uses the same
   libphonenumber-js/max metadata and prefix rules as lib/uk-validation.ts. */
(function () {
  const error = 'Enter a valid UK phone number.';
  function validate(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return { valid: true, value: '' };
    const invalid = { valid: false, value: raw, error };
    if (raw.length > 40 || !/^[+\d\s().-]+$/.test(raw)) return invalid;
    const compact = raw.replace(/[\s().-]/g, '');
    if (!/^(?:\+44|0044|0(?!0))\d+$/.test(compact)) return invalid;
    const phone = window.libphonenumber?.parsePhoneNumberFromString(raw.replace(/^00/, '+'), { defaultCountry: 'GB', extract: false });
    return phone?.country === 'GB' && phone.isValid() && !phone.ext
      ? { valid: true, value: phone.number }
      : invalid;
  }
  function bind(input, button) {
    let submitting = false;
    let previous = input.value;
    const message = document.createElement('span');
    message.id = input.id + '-phone-error';
    message.setAttribute('role', 'alert');
    message.style.cssText = 'display:block;margin-top:6px;color:#b91c1c;font-size:12px';
    input.insertAdjacentElement('afterend', message);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
    input.maxLength = 40;
    function update() {
      const result = validate(input.value);
      input.setCustomValidity(result.error || '');
      input.setAttribute('aria-invalid', String(!result.valid));
      message.textContent = result.error || '';
      button.disabled = submitting || !result.valid;
      return result.valid;
    }
    function permitsEdit(raw) {
      if (!raw || ['+', '+4', '+44', '0', '00', '004', '0044'].includes(raw)) return true;
      if (!/^[+\d\s().-]+$/.test(raw)) return false;
      let digits = raw.replace(/[\s().-]/g, '').replace(/^00/, '+');
      if (digits.startsWith('+') && !digits.startsWith('+44')) return false;
      if (!digits.startsWith('+44') && !digits.startsWith('0')) return false;
      digits = digits.replace(/^\+44/, '').replace(/^0/, '');
      if (!digits) return true;
      if (!/^[1235789]\d*$/.test(digits) || window.libphonenumber.validatePhoneNumberLength('+44' + digits, 'GB') === 'TOO_LONG') return false;
      const phone = window.libphonenumber.parsePhoneNumberFromString('+44' + digits, { defaultCountry: 'GB', extract: false });
      return (!phone?.country || phone.country === 'GB') && (digits.length < 10 || phone?.isValid());
    }
    input.addEventListener('beforeinput', event => {
      if (!event.data) return;
      const proposed = input.value.slice(0, input.selectionStart) + event.data + input.value.slice(input.selectionEnd);
      if (!permitsEdit(proposed)) { event.preventDefault(); message.textContent = error; }
    });
    input.addEventListener('paste', event => {
      event.preventDefault();
      const result = validate(event.clipboardData.getData('text'));
      if (!result.valid) { message.textContent = error; return; }
      input.value = previous = result.value;
      update();
    });
    input.addEventListener('input', () => {
      if (!permitsEdit(input.value)) { input.value = previous; update(); message.textContent = error; return; }
      previous = input.value; update();
    });
    input.addEventListener('blur', () => {
      const result = validate(input.value);
      if (result.valid) input.value = previous = result.value;
      update();
    });
    update();
    return { update, setSubmitting(value) { submitting = value; update(); } };
  }
  window.SupplyEdPhone = { validate, bind };
})();
