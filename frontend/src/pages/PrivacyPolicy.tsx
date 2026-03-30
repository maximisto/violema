import { useNavigate } from 'react-router-dom';
import { Shield, Zap } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview',
    content: `Purple Orange AI, Inc. ("Purple Orange AI", "we", "our", or "us") operates Nexus, an AI coworker platform accessible at nexus.purpleorange.io and related subdomains (the "Service"). This Privacy Policy explains how we collect, use, store, and share information when you use the Service.

By using Nexus, you agree to the practices described in this policy. If you do not agree, please discontinue use of the Service.

Last updated: March 28, 2026.`,
  },
  {
    id: 'collect',
    title: '2. Information We Collect',
    content: `**Account information.** When you create access for Nexus, we collect the identifying information you provide, such as your name and email address. If additional authentication methods are introduced later, this policy will be updated to reflect them.

**Usage data.** We collect information about how you interact with the Service: features used, autonomy mode selections, tool calls made, conversation metadata (not content), session duration, and error events. This helps us improve reliability and build better features.

**Conversation content.** Your messages to Nexus and Nexus's responses are processed and stored to provide conversation history, smart titles, and summaries. See Section 5 for how we handle AI-generated content.

**Connected integrations.** When you connect third-party tools (Slack, GitHub, Stripe, etc.), we receive OAuth access tokens and the minimum data necessary to execute actions on your behalf. We never store raw secrets in plaintext.

**Payment information.** Billing is processed by Stripe. We store only a Stripe customer ID and subscription status — never your card number or CVV.

**Device and network data.** We log IP address, browser type, operating system, and referring URL for security and fraud prevention purposes.`,
  },
  {
    id: 'use',
    title: '3. How We Use Your Information',
    content: `We use collected information to:

• **Provide and improve the Service** — process your requests, execute tool calls, generate AI responses, maintain conversation history, and build new features.

• **Personalise your experience** — remember your preferences, autonomy mode defaults, and conversation context.

• **Communicate with you** — send transactional emails (receipts, security alerts, password resets) and, if you opt in, product updates and newsletters.

• **Ensure security** — detect fraud, investigate abuse, enforce our Terms of Service, and comply with legal obligations.

• **Analyse aggregate usage** — understand how teams use Nexus at a population level to prioritise our roadmap. This analysis uses anonymised, aggregated data and never targets individual users.

We do **not** use your conversation content or data to train AI models. Your data is yours.`,
  },
  {
    id: 'sharing',
    title: '4. How We Share Your Information',
    content: `We do not sell your personal data. We share it only in these limited circumstances:

**Service providers.** We use trusted vendors to operate the Service: Anthropic (AI inference), Stripe (payments), infrastructure providers, transactional email providers, and analytics tooling. Each vendor is expected to process data only as needed to operate the Service.

**Connected integrations.** When you instruct Nexus to take an action in a third-party tool, the minimum necessary data is shared with that tool's API. You control which integrations are connected and can revoke access at any time.

**Legal obligations.** We may disclose information if required by law, court order, or governmental authority, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.

**Business transfers.** If Purple Orange AI is acquired or merges with another company, your data may be transferred as part of that transaction. We will notify you before your data becomes subject to a different privacy policy.`,
  },
  {
    id: 'ai',
    title: '5. AI Processing & Anthropic',
    content: `Nexus sends your messages and conversation context to Anthropic's Claude API to generate responses. Anthropic processes this data as a data processor acting on our behalf, governed by Anthropic's data processing agreement.

**We use Anthropic's API under a terms that prohibit Anthropic from training on your data.** Your conversations are not used to improve Claude or any other AI model.

Anthropic retains API inputs/outputs for up to 30 days for trust & safety review as required by their policies. This is standard practice across all major AI API providers.

You can delete your conversation history at any time from the dashboard. Deleted conversations are purged from our systems within 30 days.`,
  },
  {
    id: 'retention',
    title: '6. Data Retention',
    content: `We retain your data for as long as your account is active or as needed to provide the Service.

• **Conversation history:** Kept until you delete individual conversations or close your account.
• **Account data:** Retained for 30 days after account closure, then permanently deleted.
• **Usage logs:** Aggregated and anonymised after 90 days; raw logs deleted after 1 year.
• **Payment records:** Retained for 7 years as required by financial regulations.

You can request deletion of your account and all associated data at any time via Settings → Account → Delete Account, or by emailing privacy@purpleorange.io.`,
  },
  {
    id: 'rights',
    title: '7. Your Rights',
    content: `Depending on your location, you may have the following rights regarding your personal data:

• **Access** — request a copy of the personal data we hold about you.
• **Correction** — request correction of inaccurate data.
• **Deletion** — request deletion of your data (right to be forgotten).
• **Portability** — receive your data in a machine-readable format.
• **Restriction** — request that we restrict processing of your data.
• **Objection** — object to processing based on legitimate interests.
• **Withdraw consent** — where processing is based on consent, withdraw it at any time.

To exercise any of these rights, contact us at privacy@purpleorange.io. We will respond within 30 days. We may need to verify your identity before fulfilling a request.

**EU/EEA residents:** You have the right to lodge a complaint with your local data protection authority (DPA).

**California residents (CCPA):** We do not sell personal information. You have the right to know what data we collect and to request deletion.`,
  },
  {
    id: 'security',
    title: '8. Security',
    content: `We implement industry-standard security measures:

• TLS 1.3 encryption for all data in transit
• AES-256 encryption for data at rest
• Encrypted credential vault for third-party integration tokens
• Managed infrastructure security controls and audit logging
• Regular third-party penetration testing
• Employee access controls and least-privilege policies
• Automated anomaly detection and alerting

No system is 100% secure. If you discover a security vulnerability, please report it responsibly to security@purpleorange.io. We offer a responsible disclosure program and will respond within 24 hours.`,
  },
  {
    id: 'cookies',
    title: '9. Cookies & Tracking',
    content: `We use cookies and similar technologies for:

• **Essential cookies:** Authentication sessions, CSRF protection, and security tokens. Required for the Service to function. Cannot be disabled.
• **Preference cookies:** Remembering your UI preferences (theme, mode settings). Can be cleared via browser settings.
• **Analytics cookies:** PostHog for anonymised product analytics. We do not use Google Analytics. You can opt out via our cookie preferences banner.

We do not use advertising cookies, cross-site tracking pixels, or any technology designed to build advertising profiles.`,
  },
  {
    id: 'children',
    title: '10. Children\'s Privacy',
    content: `Nexus is not directed to children under 16. We do not knowingly collect personal data from anyone under 16. If you believe we have inadvertently collected data from a minor, please contact us immediately at privacy@purpleorange.io and we will delete it promptly.`,
  },
  {
    id: 'changes',
    title: '11. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email and display a prominent notice in the dashboard at least 14 days before the changes take effect.

The "last updated" date at the top of this page reflects the most recent revision. Continued use of the Service after changes take effect constitutes acceptance of the updated policy.`,
  },
  {
    id: 'contact',
    title: '12. Contact Us',
    content: `For privacy-related questions, requests, or concerns:

**Email:** privacy@purpleorange.io
**Post:** Purple Orange AI, Inc., Attn: Privacy Team, [Address]

For EU/EEA-specific queries, our EU representative can be reached at eu-privacy@purpleorange.io.

For security disclosures: security@purpleorange.io`,
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
    return <p key={i} className="text-slate-400 leading-relaxed mb-4">{withBold}</p>;
  });
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/15 via-transparent to-navy-900 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-xs text-green-400 font-semibold tracking-wider uppercase">Legal</div>
              <div className="text-slate-500 text-xs">Last updated March 28, 2026</div>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-xl text-slate-400 max-w-2xl">
            We believe privacy is a right, not a feature. Here's exactly how we handle your data — no legalese, just plain English.
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
                    className="block text-xs text-slate-500 hover:text-violet-400 py-1 transition-colors leading-relaxed"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-10">
            {/* Summary badges */}
            <div className="grid sm:grid-cols-3 gap-3 p-5 rounded-xl bg-navy-800/40 border border-navy-700/40">
              {[
                { icon: '🔒', label: 'End-to-end encrypted', sub: 'TLS 1.3 + AES-256' },
                { icon: '🚫', label: 'Never sold', sub: 'Your data is yours' },
                { icon: '🤖', label: 'No AI training', sub: 'On your content' },
              ].map((item) => (
                <div key={item.label} className="text-center p-3">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.sub}</div>
                </div>
              ))}
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
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-900/20 to-navy-800/60 border border-green-700/20 text-center">
              <Shield className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Questions about your privacy?</h3>
              <p className="text-slate-400 text-sm mb-4">Our team typically responds within 24 hours.</p>
              <a href="mailto:privacy@purpleorange.io" className="btn-primary">
                Contact Privacy Team
              </a>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
