// The briefing form: the site's one way to send Violema a request without leaving it.
//
// The markup is rendered at build time so it is complete without JavaScript; browser/briefing.mjs
// enhances it. The form posts JSON to /api/briefing on this host, which nginx hands to the lead
// handler PsychDoc.AI already runs on the same server (see README, "Briefing form"). The option
// values below are that handler's contract: it validates every field again and refuses anything
// else, so a label can change here but a value cannot.
import { escapeHTML as e } from './render.mjs';

export const BRIEFING_ENDPOINT = '/api/briefing';

// Where the request goes while the form cannot send: the same handler, on PsychDoc.AI's own page.
export const BRIEFING_FALLBACK = 'https://psychdoc.ai/#briefing';

export const briefingRoles = [
  { value: 'biotech', label: 'Biotech or pharma team' },
  { value: 'fund', label: 'Investor or fund' },
  { value: 'clinic', label: 'Clinic or care operator' },
  { value: 'research', label: 'Research group' },
  { value: 'other', label: 'Other' },
];

// One entry per request type. `submit` names the button and `prompt` the message placeholder, so a
// correction never reads like a sales lead. `record` marks requests about our record rather than
// a commercial enquiry: no organization is needed, but the message is the whole request.
export const briefingIntents = [
  { value: 'briefing', label: 'An evidence briefing', submit: 'Request a briefing', prompt: 'The decision you are making, your timeline, the questions that matter most.' },
  { value: 'pilot', label: 'A commissioned synthesis', submit: 'Request a synthesis', prompt: 'The field, the question and the decision the synthesis would inform.' },
  { value: 'expert-review', label: 'To review the science', submit: 'Offer to review', prompt: 'Your field, and the record or claim you would review.' },
  { value: 'correction', label: 'A correction', submit: 'Send correction', prompt: 'Which page and claim, what is wrong, and where the evidence is.', record: true },
  { value: 'privacy', label: 'A privacy request', submit: 'Send privacy request', prompt: 'What you want us to do: show, correct or delete what we hold about you.', record: true },
];

export const briefingLimits = { name: 120, organization: 160, topic: 200, message: 2000 };

const options = (list, selected) => list.map(item => `<option value="${item.value}"${item.value === selected ? ' selected' : ''}>${e(item.label)}</option>`).join('');

function field(id, label, control, { optional = false } = {}) {
  return `<div class="briefing-field" data-briefing-field="${id}"><label class="briefing-label" for="briefing-${id}">${e(label)}<span class="briefing-optional" data-briefing-optional${optional ? '' : ' hidden'}>Optional</span></label>${control}<p class="briefing-error" id="briefing-${id}-error" data-briefing-error hidden></p></div>`;
}

const input = (id, type, extra = '') => `<input class="briefing-control" id="briefing-${id}" name="${id}" type="${type}" ${extra}>`;

// id="briefing" is the address every "Request a briefing" link on the site points at.
export function briefingForm() {
  const first = briefingIntents[0];
  return `<form class="briefing-form" id="briefing" action="${BRIEFING_ENDPOINT}" method="post" novalidate aria-labelledby="briefing-title" data-briefing-form data-briefing-intents="${e(JSON.stringify(briefingIntents.map(({ value, submit, prompt, record }) => ({ value, submit, prompt, record: Boolean(record) }))))}">`
    + `<h3 class="briefing-title" id="briefing-title">Request a briefing</h3>`
    + `<p class="briefing-status" data-briefing-status role="alert" hidden></p>`
    + `<div class="briefing-grid">`
    + field('intent', 'What do you need?', `<select class="briefing-control" id="briefing-intent" name="intent" required>${options(briefingIntents, first.value)}</select>`)
    + field('role', 'You are', `<select class="briefing-control" id="briefing-role" name="role" required>${options(briefingRoles, 'biotech')}</select>`)
    + field('name', 'Name', input('name', 'text', `required maxlength="${briefingLimits.name}" autocomplete="name" aria-describedby="briefing-name-error"`))
    + field('email', 'Work email', input('email', 'email', 'required autocomplete="email" inputmode="email" aria-describedby="briefing-email-error"'))
    + field('organization', 'Organization', input('organization', 'text', `maxlength="${briefingLimits.organization}" autocomplete="organization" aria-describedby="briefing-organization-error"`))
    + field('topic', 'Research question or field', input('topic', 'text', `maxlength="${briefingLimits.topic}" placeholder="For example: psilocybin for treatment-resistant depression" aria-describedby="briefing-topic-error"`), { optional: true })
    + field('message', 'Anything we should know', `<textarea class="briefing-control" id="briefing-message" name="message" rows="5" maxlength="${briefingLimits.message}" placeholder="${e(first.prompt)}" aria-describedby="briefing-message-error"></textarea>`, { optional: true })
    + `</div>`
    // A trap for form-filling bots: hidden from people and assistive technology, and the handler
    // discards any request that fills it.
    + `<div class="briefing-trap" aria-hidden="true"><label for="briefing-website">Website</label><input id="briefing-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>`
    + `<div class="briefing-submit"><button class="button button-primary" type="submit" data-briefing-submit disabled>${e(first.submit)}</button><p class="briefing-note">Used only to answer your request. No mailing list. <a href="/legal/privacy/">Privacy Policy</a>.</p></div>`
    + `<noscript><p class="briefing-note">Sending needs JavaScript. The same form is on <a href="${BRIEFING_FALLBACK}">PsychDoc.AI</a>.</p></noscript>`
    + `<div class="briefing-sent" data-briefing-sent hidden tabindex="-1"><h3 class="briefing-title">Request received</h3><p>We will reply by email to <span data-briefing-sent-to></span>. Your details are used only to answer this request.</p></div>`
    + `</form>`;
}
