import Reveal from './Reveal';

const metrics = [
  { stat: '6', cap: 'Stage runs', body: 'Trigger, research, analysis, draft, review, deliver — every time.' },
  { stat: '100%', cap: 'Source-linked', body: 'Every output ships with its evidence trail attached.' },
  { stat: '1-tap', cap: 'Approvals', body: 'Approve or request changes from Slack in seconds.' },
  { stat: '0', cap: 'Black boxes', body: 'Retries and failures show exactly what happened.' },
];

export default function SignalBand() {
  return (
    <section className="relative border-y border-white/10 bg-ink-950">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="flex items-center gap-3 py-6">
          <span className="text-telemetry text-[0.6rem] text-signal-400">// the receipt</span>
          <span className="hairline-x h-px flex-1" />
          <span className="text-telemetry text-[0.6rem] text-[#6f7a91]">a run is proof, not a mystery</span>
        </Reveal>

        <div className="grid grid-cols-1 gap-px overflow-hidden border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => (
            <Reveal key={metric.cap} delay={index * 90}>
              <div className="group flex h-full flex-col gap-4 bg-ink-950 py-10 pr-6 transition-colors duration-300 sm:px-6 lg:py-12">
                <p className="font-mono text-[3.4rem] font-semibold leading-none tracking-[-0.04em] text-white tabular sm:text-[3.9rem]">
                  {metric.stat}
                  <span className="ml-0.5 text-signal-500 transition-opacity duration-300">.</span>
                </p>
                <div>
                  <p className="text-telemetry text-[0.62rem] text-violet-200">{metric.cap}</p>
                  <p className="mt-2 max-w-[15rem] text-sm leading-6 text-[#8793ad]">{metric.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
