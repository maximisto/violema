// Sends the briefing form as JSON to /api/briefing and shows the handler's answer in place.
// Without this module the form is complete but its button stays disabled: a plain form post
// cannot reach the JSON-only handler, and the noscript line names the fallback.
const FALLBACK_ERROR = 'Could not send your request. Try again in a moment.';
const FIELDS = ['intent', 'role', 'name', 'email', 'organization', 'topic', 'message'];

export function enhanceBriefingForm(form) {
  const intents = JSON.parse(form.dataset.briefingIntents);
  const submit = form.querySelector('[data-briefing-submit]');
  const status = form.querySelector('[data-briefing-status]');
  const sent = form.querySelector('[data-briefing-sent]');
  const control = id => form.elements[id];
  const slot = id => form.querySelector(`[data-briefing-field="${id}"]`);
  const errorOf = id => slot(id).querySelector('[data-briefing-error]');
  const optionalOf = id => slot(id).querySelector('[data-briefing-optional]');

  // Corrections and privacy requests come from people, not buyers: the organization becomes
  // optional and the message carries the request.
  const applyIntent = () => {
    const intent = intents.find(item => item.value === control('intent').value) || intents[0];
    submit.textContent = intent.submit;
    control('message').placeholder = intent.prompt;
    optionalOf('organization').hidden = Boolean(intent.record) === false;
    optionalOf('message').hidden = Boolean(intent.record);
    control('organization').required = !intent.record;
    control('message').required = Boolean(intent.record);
  };
  control('intent').addEventListener('change', applyIntent);
  applyIntent();

  const clearErrors = () => {
    for (const id of FIELDS) {
      errorOf(id).hidden = true;
      errorOf(id).textContent = '';
      control(id).removeAttribute('aria-invalid');
    }
    status.hidden = true;
    status.textContent = '';
  };
  const showErrors = errors => {
    let first = null;
    for (const id of FIELDS) {
      if (!errors[id]) continue;
      errorOf(id).textContent = errors[id];
      errorOf(id).hidden = false;
      control(id).setAttribute('aria-invalid', 'true');
      first ??= control(id);
    }
    first?.focus();
  };

  // The same rules the handler applies first, so an empty required field is named before a
  // round trip; the handler's own field errors replace these when it answers.
  const localErrors = () => {
    const errors = {};
    if (!control('name').value.trim()) errors.name = 'Enter your name.';
    if (!control('email').validity.valid || !control('email').value.includes('@')) errors.email = 'Enter a valid work email.';
    if (control('organization').required && !control('organization').value.trim()) errors.organization = 'Enter your organization.';
    if (control('message').required && !control('message').value.trim()) errors.message = 'Say what the request is about.';
    return errors;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();
    const errors = localErrors();
    if (Object.keys(errors).length) return showErrors(errors);
    const body = Object.fromEntries(FIELDS.map(id => [id, control(id).value.trim()]));
    body.website = control('website').value;
    body.sourcePage = window.location.pathname;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const answer = await response.json().catch(() => ({}));
      if (response.ok && answer.ok) {
        sent.querySelector('[data-briefing-sent-to]').textContent = body.email;
        for (const child of form.children) child.hidden = child !== sent;
        sent.focus({ preventScroll: true });
        return;
      }
      if (answer.fieldErrors) showErrors(answer.fieldErrors);
      status.textContent = answer.error || FALLBACK_ERROR;
      status.hidden = false;
    } catch {
      status.textContent = FALLBACK_ERROR;
      status.hidden = false;
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  });

  submit.disabled = false;
}
