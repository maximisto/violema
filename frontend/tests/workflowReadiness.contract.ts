import { getWorkflowTemplateById } from '../src/content/workflowTemplates';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const revenueWatch = getWorkflowTemplateById('revenue-watch');

assert(Boolean(revenueWatch), 'revenue-watch template exists');
assert(revenueWatch?.destination === 'slack', 'Revenue Watch delivers to Slack');
assert(revenueWatch?.requiredIntegrationIds?.join(',') === 'stripe', 'Revenue Watch only requires Stripe in first proof');
assert(revenueWatch?.optionalIntegrationIds?.length === 0, 'Revenue Watch keeps optional integrations out of first proof');
assert(revenueWatch?.firstRunRequiresApproval === true, 'Revenue Watch approval gate is explicit');

console.log('workflowReadiness.contract: Revenue Watch metadata verified');
