/** Editorial worked example using public sources. Never a customer run or delivery record. */
export default function ExampleBrief() {
  return (
    <section aria-labelledby="example-brief-title" className="mt-6 rounded-[1.9rem] border border-violet-400/25 bg-navy-900/60 p-5 sm:p-8">
      <p className="text-sm font-semibold text-violet-200">Worked example · public sources · September 21, 2026</p>
      <h2 id="example-brief-title" className="mt-3 text-3xl font-semibold text-white">Market brief: AI agents for founder workflows</h2>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
        This editorial example shows the output format. It was not produced by a live Violema run,
        approved by a customer or delivered to Slack. The credit estimates below are illustrative
        and were not measured for this brief.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="space-y-5 text-base leading-7 text-slate-200">
          <div>
            <h3 className="font-semibold text-white">What the sources show</h3>
            <p className="mt-2">Claude advertises tasks across files and tools, visible execution and scheduled recurring reports. Scheduling and review are therefore capabilities a buyer can already find in a general-purpose agent. <a href="https://claude.com/product/cowork" className="text-violet-200 underline underline-offset-4">[1]</a></p>
            <p className="mt-2">Lindy describes an AI teammate with connected tools and recurring routines. Buyers have alternatives to assembling every task manually. <a href="https://docs.lindy.ai/" className="text-violet-200 underline underline-offset-4">[2]</a></p>
          </div>
          <div>
            <h3 className="font-semibold text-white">What that means for this team</h3>
            <p className="mt-2">A founder workflow product needs to make a specific recurring job easier to set up and maintain. Compare the finished brief, the time needed to review it, source quality and intervention required across repeated runs. This is our interpretation of the sources, not a measured performance comparison.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Recommended next action</h3>
            <p className="mt-2">Pick one weekly competitive brief. Agree on the competitors, required sources, review owner and delivery channel. Evaluate several runs before adding more workflows.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white">What remains unknown</h3>
            <p className="mt-2">These vendor pages describe capabilities, not independently measured reliability. This example does not establish pricing changes, comparative accuracy or customer time savings.</p>
          </div>
        </article>
        <aside className="space-y-5 rounded-2xl border border-white/10 bg-navy-950/50 p-5 text-sm leading-6 text-slate-300">
          <div>
            <h3 className="font-semibold text-white">Inspect the evidence</h3>
            <ol className="mt-2 list-decimal space-y-3 pl-5">
              <li><a href="https://claude.com/product/cowork" className="text-violet-200 underline underline-offset-4">Anthropic: Claude Cowork</a><p>Vendor description of connected tasks and recurring reports.</p></li>
              <li><a href="https://docs.lindy.ai/" className="text-violet-200 underline underline-offset-4">Lindy: official documentation</a><p>Vendor description of its teammate, tools and routines.</p></li>
            </ol>
            <p className="mt-3">Sources checked September 21, 2026. Pages may change after that date.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Review before delivery</h3>
            <p className="mt-2">The reviewer checks each claim against its source, revises the interpretation and approves the destination. Example state: awaiting review. No approval or delivery has occurred.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Example Slack summary</h3>
            <blockquote className="mt-2 border-l-2 border-violet-400 pl-3">Connected work and scheduling are already offered by general-purpose agents. Evaluate one weekly brief on setup effort, evidence quality and review time. Read the full brief and sources before deciding.</blockquote>
          </div>
        </aside>
      </div>
    </section>
  );
}
