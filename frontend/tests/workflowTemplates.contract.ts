import {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplateById,
  type WorkflowTemplateCategory,
  type WorkflowTemplateStepKind,
} from '../src/content/workflowTemplates';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const VALID_CATEGORIES: WorkflowTemplateCategory[] = [
  'Operating cadence',
  'Revenue & risk',
  'Market intelligence',
  'Customer & growth',
  'Relationships',
];

const VALID_STEP_KINDS: WorkflowTemplateStepKind[] = [
  'search',
  'query',
  'capture',
  'analyze',
  'summarize',
  'deliver',
  'note',
];

assert(WORKFLOW_TEMPLATES.length >= 6, 'ships at least six founder templates');

const ids = new Set<string>();
const slugs = new Set<string>();

for (const template of WORKFLOW_TEMPLATES) {
  const label = template.id || '(missing id)';

  assert(template.id.trim().length > 0, 'template has an id');
  assert(!ids.has(template.id), `template id is unique: ${label}`);
  ids.add(template.id);

  assert(template.slug.trim().length > 0, `template has a slug: ${label}`);
  assert(!slugs.has(template.slug), `template slug is unique: ${label}`);
  slugs.add(template.slug);

  assert(template.title.trim().length > 0, `template has a title: ${label}`);
  assert(template.outcome.trim().length > 0, `template has an outcome: ${label}`);
  assert(template.description.trim().length > 0, `template has a description: ${label}`);
  assert(template.cadence.trim().length > 0, `template has a cadence: ${label}`);
  assert(VALID_CATEGORIES.includes(template.category), `template category is valid: ${label}`);
  assert(template.integrations.length > 0, `template lists at least one integration: ${label}`);
  assert(template.steps.length >= 2, `template has at least two steps: ${label}`);

  for (const step of template.steps) {
    assert(VALID_STEP_KINDS.includes(step.kind), `step kind is valid in ${label}: ${step.kind}`);
    assert(step.title.trim().length > 0, `step has a title in ${label}`);
    assert(step.objective.trim().length > 0, `step has an objective in ${label}`);
    if (step.kind === 'deliver') {
      assert(
        Boolean(step.deliveryTarget && step.deliveryTarget.target.trim().length > 0),
        `deliver step carries a delivery target in ${label}`,
      );
    }
  }
}

assert(getWorkflowTemplateById('weekly-founder-brief')?.title === 'Weekly founder brief', 'resolves a known template by id');
assert(getWorkflowTemplateById('does-not-exist') === undefined, 'returns undefined for an unknown id');

const revenueWatch = getWorkflowTemplateById('revenue-watch');
assert(Boolean(revenueWatch), 'Revenue Watch template exists');
assert(
  revenueWatch?.requiredIntegrationIds?.includes('stripe'),
  'Revenue Watch requires Stripe',
);
assert(
  revenueWatch?.firstRunRequiresApproval === true,
  'Revenue Watch first run requires approval',
);

console.log(`workflowTemplates.contract: ${WORKFLOW_TEMPLATES.length} templates verified`);
