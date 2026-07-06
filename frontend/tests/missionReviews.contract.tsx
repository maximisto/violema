import { renderToStaticMarkup } from 'react-dom/server';
import { MissionReviews } from '../src/features/missions/MissionReviews';
import type { MissionWorkspaceView } from '../src/features/missions/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission: MissionWorkspaceView = {
  id: 'mission_weekly',
  title: 'Weekly founder update',
  description: 'Founder operating brief.',
  status: 'waiting_review',
  statusLabel: 'Needs approval',
  nextRunLabel: 'Mon, 9:00 AM',
  lastRunLabel: 'Just now',
  scheduleLabel: 'every monday at 9am',
  deliveryLabel: '#all-purple-orange',
  steps: [],
  agents: [],
  evidence: [],
  metrics: [],
  controlPrimitives: [],
  integrations: [],
  artifact: {
    title: 'Ready for review: Weekly founder update',
    kindLabel: 'Review gate',
    sourceLabel: 'Slack draft',
    statusLabel: 'Ready for approval',
    summary: 'Prepared delivery is waiting for review.',
    reviewBody: 'Slack-ready founder update markdown body.',
    reviewTarget: '#all-purple-orange',
    lastUpdatedLabel: 'Just now',
    primaryActionLabel: 'Open review',
    skills: ['Writer', 'Reviewer', 'Messenger'],
    sections: [],
  },
  lessons: [],
  reviewSummary: 'Run completed and prepared the draft. Approving will send it to #all-purple-orange; requesting changes keeps delivery held.',
  analyticsSummary: 'Tracked at 42 credits.',
};

const unreviewedMarkup = renderToStaticMarkup(
  <MissionReviews mission={mission} reviewAcknowledged={false} onMarkReviewed={() => undefined} onApproveDelivery={() => undefined} />,
);

assert(unreviewedMarkup.includes('Prepared delivery'), 'renders a prepared delivery review panel');
assert(unreviewedMarkup.includes('Slack-ready founder update markdown body.'), 'renders the actual draft body before approval');
assert(unreviewedMarkup.includes('Mark reviewed'), 'offers an explicit review acknowledgement before approval');
assert(unreviewedMarkup.includes('disabled=""'), 'disables approval until the draft is marked reviewed');

const reviewedMarkup = renderToStaticMarkup(
  <MissionReviews mission={mission} reviewAcknowledged={true} onMarkReviewed={() => undefined} onApproveDelivery={() => undefined} />,
);

assert(reviewedMarkup.includes('Reviewed'), 'shows reviewed state after acknowledgement');
assert(reviewedMarkup.includes('Approve delivery'), 'keeps approval available after review acknowledgement');
