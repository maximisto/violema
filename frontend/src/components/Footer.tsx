import { Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LINKS = {
  Product: ['Features', 'Integrations', 'Pricing', 'Changelog', 'Roadmap'],
  Company: ['About', 'Blog', 'Careers', 'Press', 'Contact'],
  Resources: ['Documentation', 'API Reference', 'Status', 'Community', 'Support'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'],
};

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-navy-800 bg-navy-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* CTA section */}
        <div className="py-20 text-center border-b border-navy-800">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Start with Nexus today
          </h2>
          <p className="text-xl text-slate-400 mb-8 max-w-xl mx-auto">
            Join thousands of teams that have already hired their first AI coworker.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary text-base py-3 px-8 shadow-glow-violet"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Add Nexus to Slack — Free
            </button>
            <button className="btn-secondary text-base py-3 px-8">
              Book a demo
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Logo + description */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <button
              className="flex items-center gap-2.5 mb-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg"
              onClick={() => navigate('/')}
            >
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center group-hover:shadow-glow-violet transition-all">
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm leading-tight">Nexus</span>
                <span className="text-[9px] text-violet-400/60 leading-none font-medium tracking-widest uppercase">
                  by Purple Orange AI
                </span>
              </div>
            </button>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Your AI coworker that proactively executes tasks, coordinates your tools, and gets things done — autonomously.
            </p>
            <div className="flex gap-3">
              {['twitter', 'linkedin', 'github'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-8 h-8 rounded-lg bg-navy-800 border border-navy-700 hover:border-navy-600 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors text-xs capitalize"
                >
                  {social[0].toUpperCase()}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-slate-200 font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-slate-500 hover:text-slate-300 text-sm transition-colors duration-150"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">
            © {new Date().getFullYear()} Purple Orange AI, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-slate-700 text-xs">SOC 2 Certified</span>
            <span className="w-px h-3 bg-navy-700" />
            <span className="text-slate-700 text-xs">GDPR Compliant</span>
            <span className="w-px h-3 bg-navy-700" />
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
