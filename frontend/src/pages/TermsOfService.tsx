import { useNavigate } from 'react-router-dom';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useTheme } from '../lib/useTheme';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using VIOLEMA (the "Service") provided by Purple Orange AI, Inc. ("Purple Orange AI", "we", "us", "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.

These Terms apply to all visitors, users, and others who access or use the Service. By using VIOLEMA on behalf of an organisation, you represent that you have authority to bind that organisation to these Terms.

Last updated: March 28, 2026.`,
  },
  {
    id: 'service',
    title: '2. Description of Service',
    content: `VIOLEMA is an AI-powered work execution platform that allows users to interact with AI assistants, connect third-party integrations, and automate business tasks. The Service is powered by Anthropic's Claude AI and processes user requests through various connected tools and APIs.

We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice. We will make reasonable efforts to provide advance notice of material changes.`,
  },
  {
    id: 'accounts',
    title: '3. Accounts & Access',
    content: `**Account creation.** You must provide accurate, complete information when creating an account. You are responsible for maintaining the security of your credentials and for all activity under your account.

**Age requirement.** You must be at least 16 years old to use the Service. By using VIOLEMA, you represent that you meet this requirement.

**One account per person.** You may not create multiple accounts for the purpose of circumventing usage limits, bans, or other restrictions.

**Account security.** Notify us immediately at security@purpleorange.io if you suspect unauthorised access to your account. We are not liable for losses arising from compromised credentials.

**Termination.** We may suspend or terminate your account if you violate these Terms, with or without prior notice depending on the severity of the violation.`,
  },
  {
    id: 'use',
    title: '4. Acceptable Use',
    content: `You agree not to use the Service to:

• Generate, distribute, or facilitate illegal content or activities
• Harass, threaten, defame, or harm any person
• Infringe intellectual property rights of any third party
• Attempt to gain unauthorised access to any system, network, or data
• Reverse-engineer, decompile, or attempt to extract source code from the Service
• Use automated scraping or data extraction on the Service without written permission
• Send spam, phishing messages, or other unsolicited communications via connected integrations
• Create or distribute malware, viruses, or other harmful code
• Violate any applicable law, regulation, or third-party terms of service
• Use the Service in ways that could damage, disable, or impair it

We reserve the right to investigate violations and cooperate with law enforcement authorities.`,
  },
  {
    id: 'ai',
    title: '5. AI-Generated Content',
    content: `**Nature of AI output.** VIOLEMA uses Claude, a large language model, to generate responses. AI-generated content may sometimes be inaccurate, incomplete, or inappropriate. You should not rely on VIOLEMA output for critical decisions - medical, legal, financial, or otherwise - without independent verification.

**Your responsibility.** You are responsible for reviewing AI-generated content before acting on it, especially for actions taken through connected integrations (sending messages, creating tasks, executing code, etc.).

**No professional advice.** Nothing VIOLEMA says constitutes professional legal, medical, financial, or other licensed professional advice.

**Autonomous actions.** When using Autonomous mode, VIOLEMA may execute actions in connected tools without requiring your approval for each step. You accept responsibility for enabling this mode and for the actions taken.`,
  },
  {
    id: 'ip',
    title: '6. Intellectual Property',
    content: `**Our IP.** The Service, including all software, design, branding, documentation, and AI models (excluding Anthropic's models), is owned by Purple Orange AI and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute our proprietary materials without written permission.

**Your content.** You retain ownership of content you create and input into the Service. By using VIOLEMA, you grant Purple Orange AI a limited, non-exclusive licence to process your content solely to provide the Service.

**AI outputs.** The intellectual property status of AI-generated content is an evolving area of law. To the extent permitted by law, you own AI-generated outputs that result from your prompts, subject to any third-party IP embedded in those outputs.

**Feedback.** If you provide feedback or suggestions about the Service, you grant us a royalty-free licence to use that feedback without obligation to you.`,
  },
  {
    id: 'privacy',
    title: '7. Privacy',
    content: `Your use of the Service is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you agree to our collection and use of information as described in the Privacy Policy.`,
  },
  {
    id: 'third-party',
    title: '8. Third-Party Integrations',
    content: `VIOLEMA allows you to connect third-party services (Slack, GitHub, Stripe, HubSpot, etc.). Your use of these services is governed by their own terms and privacy policies. Purple Orange AI is not responsible for the practices, content, or reliability of third-party services.

By connecting an integration, you authorise VIOLEMA to interact with that service on your behalf within the scope of permissions you grant. You can revoke these permissions at any time from your account settings.`,
  },
  {
    id: 'payment',
    title: '9. Payment & Subscriptions',
    content: `**Billing.** Paid subscriptions are billed monthly in advance. Prices are listed on our Pricing page and may change with 30 days' notice.

**Top-ups.** Credits purchased as top-ups are one-time add-ons to an active workspace account. Top-ups do not change your subscription tier, included seats, or feature access.

**Cancellation.** You may cancel your subscription at any time from account settings. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial periods except where required by law.

**Disputed charges.** Contact billing@purpleorange.io within 30 days of a charge to dispute it. We will investigate and respond within 5 business days.`,
  },
  {
    id: 'disclaimer',
    title: '10. Disclaimer of Warranties',
    content: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY OF AI-GENERATED CONTENT.

We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components. We do not warrant the accuracy, completeness, or reliability of any AI-generated output.`,
  },
  {
    id: 'liability',
    title: '11. Limitation of Liability',
    content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, PURPLE ORANGE AI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.

OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.

SOME JURISDICTIONS DO NOT ALLOW THESE LIMITATIONS, SO THEY MAY NOT APPLY TO YOU IN FULL.`,
  },
  {
    id: 'indemnification',
    title: '12. Indemnification',
    content: `You agree to indemnify and hold harmless Purple Orange AI, its officers, directors, employees, and agents from any claims, damages, costs, or liabilities arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) content you submit through the Service.`,
  },
  {
    id: 'governing',
    title: '13. Governing Law & Disputes',
    content: `These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles.

Any dispute arising from these Terms shall first be subject to good-faith negotiation. If unresolved within 30 days, disputes shall be resolved by binding arbitration under JAMS rules in San Francisco, CA, except that either party may seek injunctive relief in a court of competent jurisdiction.

CLASS ACTION WAIVER: You agree to resolve disputes on an individual basis and waive the right to participate in a class action.`,
  },
  {
    id: 'changes',
    title: '14. Changes to Terms',
    content: `We may update these Terms from time to time. We will provide at least 14 days' notice of material changes via email and an in-app notice. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.

For minor changes (e.g., typo corrections, clarifications that don't change your rights), we may update the Terms without notice.`,
  },
  {
    id: 'contact',
    title: '15. Contact',
    content: `For questions about these Terms:

**Email:** legal@purpleorange.io
**Post:** Purple Orange AI, Inc., Attn: Legal, [Address]

For security issues: security@purpleorange.io
For billing issues: billing@purpleorange.io`,
  },
];

function renderContent(text: string) {
  const paragraphs = text.split('\n\n');
  return paragraphs.map((para, i) => {
    if (para.startsWith('•')) {
      const lines = para.split('\n').filter((l) => l.startsWith('•'));
      return (
        <ul key={i} className="space-y-2 my-4">
          {lines.map((line, j) => {
            const content = line.slice(2);
            const withBold = content.split(/(\*\*[^*]+\*\*)/).map((part, k) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={k} className="text-slate-200 font-semibold">{part.slice(2, -2)}</strong>;
              }
              return part;
            });
            return (
              <li key={j} className="flex gap-2.5 text-slate-400 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                <span>{withBold}</span>
              </li>
            );
          })}
        </ul>
      );
    }

    const withBold = para.split(/(\*\*[^*]+\*\*)/).map((part, k) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={k} className="text-slate-200 font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    // ALL-CAPS paragraphs = legal boilerplate → subdued treatment
    const isAllCaps = para === para.toUpperCase() && para.length > 20;
    return (
      <p key={i} className={`leading-relaxed mb-4 ${isAllCaps ? 'text-slate-500 text-sm' : 'text-slate-400'}`}>
        {withBold}
      </p>
    );
  });
}

export default function TermsOfService() {
  const navigate = useNavigate();
  const { scopeClass } = useTheme();

  return (
    <div className={`min-h-screen bg-navy-900 ${scopeClass}`}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-transparent to-navy-900 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-blue-400 font-semibold tracking-wider uppercase">Legal</div>
              <div className="text-slate-500 text-xs">Last updated March 28, 2026</div>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-xl text-slate-400 max-w-2xl">
            The rules of the road for using VIOLEMA. We've tried to make this as readable as possible.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid lg:grid-cols-4 gap-10">
          {/* Sticky TOC */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-28 bg-navy-800/40 border border-navy-700/60 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contents</p>
              <nav className="space-y-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-xs text-slate-500 hover:text-blue-400 py-1 transition-colors leading-relaxed"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-10">
            {/* TL;DR summary */}
            <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">TL;DR Summary</p>
              <ul className="space-y-2">
                {[
                  'Use VIOLEMA for legal purposes only - don\'t abuse it.',
                  'You own your content; we own the platform.',
                  'AI output can be wrong — always review before acting.',
                  'Cancel any time, no lock-in.',
                  'We\'re not liable for AI mistakes or integration actions taken in Autonomous mode.',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-slate-400">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="text-xl font-bold text-white mb-4 pb-3 border-b border-navy-700/60">
                  {section.title}
                </h2>
                {renderContent(section.content)}
              </section>
            ))}

            {/* Contact CTA */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-900/20 to-navy-800/60 border border-blue-700/20 text-center">
              <FileText className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Legal questions?</h3>
              <p className="text-slate-400 text-sm mb-4">Our legal team is happy to clarify anything in these Terms.</p>
              <a href="mailto:legal@purpleorange.io" className="btn-primary">
                Contact Legal Team
              </a>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
