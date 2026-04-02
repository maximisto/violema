import { Globe, Code2, ListTodo, Clock, Plug, Brain } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

const FEATURES = [
  {
    icon: ListTodo,
    title: 'Task Execution',
    description: 'Give Violema a goal and it gets the work done — breaking it into steps, using tools, and reporting back clearly.',
    color: 'violet',
    gradient: 'from-violet-500/20 to-violet-600/5',
    border: 'border-violet-800/40',
  },
  {
    icon: Globe,
    title: 'Web Research',
    description: 'Violema searches the web in real time, synthesizes information from multiple sources, and delivers actionable insights.',
    color: 'cyan',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-800/40',
  },
  {
    icon: Code2,
    title: 'Code & Apps',
    description: 'Write, debug, and execute code in any language. Build scripts, automate data pipelines, and deploy changes.',
    color: 'violet',
    gradient: 'from-violet-500/20 to-purple-600/5',
    border: 'border-violet-800/40',
  },
  {
    icon: Clock,
    title: 'Scheduled Automation',
    description: 'Set Violema on autopilot. Schedule recurring tasks — daily standups, weekly reports, monthly data pulls.',
    color: 'cyan',
    gradient: 'from-cyan-500/20 to-blue-600/5',
    border: 'border-cyan-800/40',
  },
  {
    icon: Plug,
    title: 'Core Integrations',
    description: 'Start with the systems that matter most first. Violema executes across your stack and expands through additional connectors over time.',
    color: 'violet',
    gradient: 'from-violet-500/20 to-pink-600/5',
    border: 'border-violet-800/40',
  },
  {
    icon: Brain,
    title: 'Long-term Memory',
    description: 'Violema keeps thread context, workspace memory, and handoff state organized so the team of specialists stays aligned without wasting tokens.',
    color: 'cyan',
    gradient: 'from-cyan-500/20 to-teal-600/5',
    border: 'border-cyan-800/40',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Create access',
    description: 'Set up your account, accept the operating rules, and choose where Violema should work with you first.',
  },
  {
    number: '02',
    title: 'Connect Slack and the web app',
    description: 'Slack handles alerts, approvals, and team-facing work. The web app stays the full control surface for workflows, settings, and execution.',
  },
  {
    number: '03',
    title: 'Get it done',
    description: 'Violema executes autonomously, reports back with results, and suggests next actions.',
  },
];

export default function Features() {
  const { ref: stepsRef, inView: stepsInView } = useInView();
  const { ref: featuresRef, inView: featuresInView } = useInView();

  return (
    <>
      {/* How it works */}
      <section className="py-24 relative" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
              <span className="text-violet-400 text-sm font-medium">How it works</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Three steps to done.
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Violema integrates with the tools you already use, so your team gets leverage without changing how you work.
            </p>
          </div>

          <div ref={stepsRef} className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`relative transition-all duration-700 ${stepsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-violet-600/40 to-transparent z-0" />
                )}
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-violet-800/10 border border-violet-700/40 mb-4">
                    <span className="text-2xl font-bold text-violet-400 font-mono">{step.number}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24 relative" id="features">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
              <span className="text-violet-400 text-sm font-medium">Capabilities</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Violema gets the work done.{' '}
              <span className="gradient-text">Not just answers.</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Most AI tools stop at advice. Violema handles research, execution, and automation with humans kept in the loop.
            </p>
            <p className="mt-4 text-sm text-slate-500 max-w-3xl mx-auto">
              The runtime is manager-led: one orchestration lane routes typed steps into six resident specialists for research, analysis, build work, operations, review, and coordination. Four elastic lanes open only when a run needs more reasoning depth, burst throughput, or tighter memory control.
            </p>
          </div>

          <div ref={featuresRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className={`group relative bg-gradient-to-br ${feature.gradient} border ${feature.border} rounded-2xl p-6 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default ${
                    feature.color === 'violet'
                      ? 'hover:border-violet-600/60 hover:shadow-violet-900/30'
                      : 'hover:border-cyan-700/60 hover:shadow-cyan-900/20'
                  } ${featuresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${i * 80}ms`, transitionProperty: 'opacity, transform, border-color, box-shadow, scale' }}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300 ${
                      feature.color === 'violet'
                        ? 'bg-violet-600/20 text-violet-400 group-hover:bg-violet-600/35'
                        : 'bg-cyan-600/20 text-cyan-400 group-hover:bg-cyan-600/35'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className={`text-lg font-semibold text-white mb-2 transition-colors duration-300 ${
                    feature.color === 'violet' ? 'group-hover:text-violet-200' : 'group-hover:text-cyan-200'
                  }`}>
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>

                  {/* Hover glow overlay */}
                  <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
                    feature.color === 'violet'
                      ? 'bg-gradient-to-tr from-violet-600/5 via-transparent to-transparent'
                      : 'bg-gradient-to-tr from-cyan-600/5 via-transparent to-transparent'
                  }`} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
