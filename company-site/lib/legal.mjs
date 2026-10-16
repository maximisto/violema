import { analytics, analyticsEnabled, ANALYTICS_BACKUP_EXPIRY_DAYS, ANALYTICS_RETENTION_MONTHS } from './analytics.mjs';

export const legalUpdatedAt = '2026-10-12';

// The privacy page describes visit statistics exactly when the tracker renders: both read analytics.websiteId, so a
// build can never ship one without the other. While it is null, every string below is the wording already live.
// The array keeps its original indentation: its policy HTML sits in multi-line template literals, so re-indenting
// would change the served bytes.
export function buildLegalPolicies(config = analytics) {
  const counted = analyticsEnabled(config);
  const when = (on, off) => (counted ? on : off);
  return [
  {
    slug: 'terms',
    title: 'Website Terms of Use',
    description: 'Terms for the Violema scientific website, its demonstrations, and downloadable evidence materials.',
    summary: 'These terms cover the public scientific website operated by Violema, Inc., a Delaware corporation. The demonstrations are research and educational materials; they are not clinical services.',
    sections: [
      {
        id: 'scope',
        title: '1. Who we are and what these terms cover',
        html: `<p>Violema, Inc., a Delaware corporation ("Violema," "we," or "us"), operates this public scientific website. These terms cover the homepage, Method, Evidence lab, For reviewers, these legal pages, and associated evidence downloads. Please read them before using these materials.</p>
<p>Existing Violema workspace services have separate <a href="/terms">workspace terms</a> and a <a href="/privacy">workspace privacy policy</a>. PsychDoc at psychdoc.ai is a division of Violema, Inc. and has its own <a href="https://psychdoc.ai/policies/terms">terms</a> and <a href="https://psychdoc.ai/policies/privacy">privacy policy</a>, which govern information you provide there. These website terms do not replace those agreements.</p>`,
      },
      {
        id: 'scientific-materials',
        title: '2. Scientific information and demonstrations',
        html: `<p>The site presents prepared evidence, explanatory content, and limited interactive demonstrations. It does not provide diagnosis, treatment, personalized medical advice, or a clinician-patient relationship. Do not use it as the sole basis for a clinical, safety-critical, investment, or other consequential decision. Consult the original research and appropriately qualified professionals.</p>
<p>Examples have the scope, assumptions, and limitations described alongside them. An illustrative adjustment is not a new study, a refitted model, or a measurement of actual bias. Animal findings do not by themselves establish human outcomes. A source link does not mean its authors endorse Violema.</p>
<p>AI-assisted preparation, a working demonstration, and internal checks do not constitute independent scientific review or peer review. Independent source and method review remains pending where the site says so. Evidence and interpretations can change.</p>`,
      },
      {
        id: 'permitted-use',
        title: '3. Using the website and its materials',
        html: `<p>You may browse, link to, download, and use the materials for lawful research, evaluation, and educational purposes, subject to any license identified with a particular item. When sharing excerpts, preserve relevant attribution, source links, and limitations. Do not present altered results as our original work or imply our endorsement.</p>
<p>Do not interfere with the website, introduce malicious code, evade access controls, unlawfully obtain information, or infringe others' rights. Automated access must not impair availability or bypass technical restrictions.</p>
<p>Violema or its licensors retain rights in the site's original content, software, and branding. Papers, datasets, software, images, and other third-party materials remain subject to their owners' rights and applicable licenses. A download or citation does not grant rights we do not own. Nothing here restricts fair use or other rights provided by law.</p>`,
      },
      {
        id: 'communications',
        title: '4. Inquiries, feedback, and external services',
        html: `<p>The scientific pages do not accept accounts, payments, uploads, or review submissions. Please keep patient records, confidential datasets, credentials, and other sensitive information out of ordinary correspondence. The <a href="/legal/privacy/">Website Privacy Policy</a> explains information handling.</p>
<p>You retain ownership of your feedback. We may consider suggestions and corrections to improve the materials; sending feedback does not transfer ownership of your work. Any publication, attribution, or use requiring your permission must be agreed separately.</p>
<p>An inquiry or briefing request does not create a paid engagement, research collaboration, investment commitment, confidentiality agreement, or other commercial arrangement. Those require separate agreement. Following an external link takes you to another service; its operator's terms and practices apply.</p>`,
      },
      {
        id: 'availability',
        title: '5. Availability and responsibility',
        html: `<p>We may correct, update, or discontinue website materials and features. To the extent permitted by law, the website and materials are provided as available, without warranties of accuracy, completeness, fitness for a particular purpose, or uninterrupted availability.</p>
<p>To the extent permitted by law, Violema is not liable for indirect or consequential losses arising from use of the website. Nothing in these terms excludes liability or limits consumer protections, remedies, or other rights that cannot lawfully be excluded or limited.</p>`,
      },
      {
        id: 'changes-contact',
        title: '6. Changes, applicable law, and contact',
        html: `<p>Delaware law governs these website terms, subject to mandatory protections that apply where you live. We may revise these terms by posting an updated version and date. Material changes will be identified on this page and apply prospectively.</p>
<p>For questions about these terms or a rights concern, contact Violema, Inc. at <a href="mailto:legal@violema.com">legal@violema.com</a>. Include the relevant page or material and a brief explanation.</p>`,
      },
    ],
  },
  {
    slug: 'privacy',
    updatedAt: when(config.policyDate, '2026-10-15'),
    title: 'Website Privacy Policy',
    description: 'How Violema, Inc. handles information on its public scientific website and in related correspondence.',
    summary: when(
      'The scientific demonstrations run in your browser. These pages have no accounts, submission forms, advertising trackers, or cookies. We count visits with analytics we run ourselves. Hosting requests and messages you choose to send can still involve personal information.',
      'The scientific demonstrations run in your browser. These pages have no accounts, submission forms, advertising trackers, or analytics scripts. Hosting requests and messages you choose to send can still involve personal information.',
    ),
    sections: [
      {
        id: 'scope',
        title: '1. Operator and scope',
        html: `<p>Violema, Inc., a Delaware corporation, is responsible for the information practices described here. This policy covers the public scientific homepage, Method, Evidence lab, For reviewers, these legal pages, evidence downloads, and related correspondence.</p>
<p>Existing workspace services are covered by their separate <a href="/privacy">workspace privacy policy</a>. A scientific briefing link takes you to psychdoc.ai, run by PsychDoc, a division of Violema, Inc., under its own <a href="https://psychdoc.ai/policies/privacy">privacy policy</a>. This policy does not govern information you provide there.</p>`,
      },
      {
        id: 'information',
        title: '2. Information involved',
        html: `<p><strong>Website requests.</strong> Hosting and security systems may receive ordinary request information, such as your IP address, request time, requested page or file, browser information, referring page when supplied, and response or error information. Your browser may also attach cookies already associated with this domain from an earlier workspace visit.</p>
<p><strong>Correspondence.</strong> If you contact us, we receive your email address, any name or affiliation you provide, message content, attachments, and related correspondence. Provide only what is needed for your inquiry. Do not send patient information, credentials, or confidential research through ordinary email.</p>
<p><strong>Demonstration controls.</strong> Map filters, selected views, and illustrative adjustments run in browser memory or the URL fragment after the # character. The scientific pages do not submit these selections to Violema or an AI provider.${when(' Visit statistics count that a few of these controls were used, never the values chosen (section 3).', '')} A copied link or your browser history may retain a selected view.</p>`,
      },
      {
        id: 'cookies-tracking',
        title: '3. Cookies, analytics, and tracking signals',
        html: `<p>The scientific pages use localStorage to remember your light or dark appearance choice in this browser, under the key <code>violema-theme</code>. This preference is not sent to Violema or an AI provider. You can change it using the appearance control or remove it by clearing this website's browser storage. The pages still work when browser storage is unavailable.</p>
${when(`<p>The scientific pages do not set cookies or use sessionStorage or advertising pixels. Fonts, scripts, and visual assets are served from this website. These statements concern the scientific pages; they do not mean a browser returning from the workspace has no violema.com cookies.</p>
<p><strong>Visit statistics.</strong> We count visits with Umami, an open-source analytics tool that runs on our own server. It stores nothing on your device. For each page view it records the page address and title, the address of the page that linked to it (both without their query or fragment), the browser, operating system and device type it reads from your browser's description, your screen size and language, and an approximate location (country, region and city) looked up from your IP address. Neither the IP address nor the full browser description is stored. To count returning visits without a cookie, it derives an identifier from your IP address and browser together with a value that changes every month.</p>
<p>It also counts four actions on the scientific pages: opening the full evidence map, switching between research corpora, opening a trial record, and first moving an assumed-shift slider. These counts carry fixed labels, such as the corpus or trial name, never anything you type or the value you choose. The statistics are not sent to an analytics company, sold, or shared.</p>
<p>We do not conduct cross-site behavioral tracking through these pages or embed third-party services to perform it. If your browser sends a Do Not Track signal, no visit statistics are recorded. External websites you choose to visit have their own practices.</p>`, `<p>The scientific pages do not set cookies or use sessionStorage, advertising pixels, or analytics scripts. Fonts, scripts, and visual assets are served from this website. These statements concern the scientific pages; they do not mean a browser returning from the workspace has no violema.com cookies.</p>
<p>We do not conduct cross-site behavioral tracking through these pages or embed third-party services to perform it. Because these pages do not perform that tracking, a browser's Do Not Track signal does not change their behavior. External websites you choose to visit have their own practices.</p>`)}`,
      },
      {
        id: 'purposes-sharing',
        title: '4. Purposes and recipients',
        html: `<p>We use request information to deliver and protect the website, investigate errors or abuse, and maintain availability.${when(' We use visit statistics to learn which pages and demonstrations readers use.', '')} We use correspondence to respond, assess corrections or inquiries, and keep relevant business records. We may also process information to meet legal duties or establish, exercise, or defend legal rights.</p>
<p>Information may be handled by hosting, security, and email providers supporting those purposes, by professional advisers when needed, or by authorities and other recipients where disclosure is legally required or necessary to address unlawful activity or protect rights. We do not sell personal information collected through this website or use it for targeted advertising.</p>`,
      },
      {
        id: 'retention-security',
        title: '5. Retention and security',
        html: `<p>Retention depends on why information is held: handling an inquiry, resolving a security issue, maintaining necessary records, or meeting legal obligations. There is no single retention period for all request logs and correspondence. You can contact us about information related to you.</p>${when(`\n<p>Visit statistics are kept for up to ${ANALYTICS_RETENTION_MONTHS} months: older records are deleted every day, and backup copies of them expire within ${ANALYTICS_BACKUP_EXPIRY_DAYS} days after that.</p>`, '')}
<p>No website or email transmission can be guaranteed secure. The public demonstrations are not a channel for sensitive personal information and do not provide patient-record storage.</p>`,
      },
      {
        id: 'choices-rights',
        title: '6. Your choices and requests',
        html: `<p>You can use the scientific pages without submitting an inquiry. Browser settings let you manage cookies and history.${when(' Turning on Do Not Track stops visit statistics.', '')}</p>
<p>Depending on applicable law, you may have rights to access, correct, delete, or receive a copy of personal information, or to object to or restrict certain processing. Email <a href="mailto:privacy@violema.com">privacy@violema.com</a> with your request and enough context to locate the relevant correspondence or record. Do not include sensitive identity documents unless we arrange a necessary verification step.</p>
<p>We may need proportionate information to verify a request and will explain any applicable limits. If we decline a request, you may reply to ask us to reconsider. Where applicable, you may also complain to a privacy regulator.</p>`,
      },
      {
        id: 'changes-contact',
        title: '7. Updates and contact',
        html: `<p>We will post revisions here with an updated effective date and identify material changes on this page. If a change requires additional notice or consent under applicable law, we will provide it.</p>
<p>Contact Violema, Inc. about this policy at <a href="mailto:privacy@violema.com">privacy@violema.com</a>.</p>`,
      },
    ],
  },
];
}

export const legalPolicies = buildLegalPolicies();
