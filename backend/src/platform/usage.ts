import fs from 'fs';
import path from 'path';
import { DEFAULT_AUTOMATION_RUN_CREDIT_COST } from './cost';
import { getBillingStatus, getApplicableTopUpOffer } from './billing';

interface AutomationLike {
  cron_expression?: string;
}

export interface CreditSnapshot {
  planName: string;
  creditsRemaining: number;
  creditsTotal: number;
  estimatedTaskCost: number;
  automationBurnMonthly: number;
  referralBonus: number;
  topUpSuggestion: number;
  projectedDaysLeft: number;
  lastUpdatedAt: string;
}

const AUTOMATIONS_FILE = path.join(process.cwd(), 'automations.json');
const DAYS_IN_MONTH = 30;
export const DEFAULT_WORKSPACE_ID = 'workspace_default';
const DEFAULT_REFERRAL_BONUS = 2000;
const DEFAULT_ESTIMATED_TASK_COST = 18;

function estimateMonthlyRuns(cronExpression?: string): number {
  if (!cronExpression) return 0;

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return 0;

  const [minute, hour, , , dayOfWeek] = parts;
  const isHourly = minute === '0' && hour === '*';
  if (isHourly) return 24 * DAYS_IN_MONTH;

  const everyHours = hour.match(/^\*\/(\d+)$/);
  if (minute === '0' && everyHours) {
    const interval = Number(everyHours[1]);
    return interval > 0 ? Math.ceil((24 / interval) * DAYS_IN_MONTH) : 0;
  }

  const isDaily = minute !== undefined && hour !== undefined && dayOfWeek === '*';
  if (isDaily) return DAYS_IN_MONTH;

  const isWeekly = dayOfWeek !== '*';
  if (isWeekly) return 4;

  return DAYS_IN_MONTH;
}

function readAutomations(): AutomationLike[] {
  try {
    if (!fs.existsSync(AUTOMATIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf-8')) as AutomationLike[];
  } catch {
    return [];
  }
}

export function buildCreditSnapshot(): CreditSnapshot {
  const automations = readAutomations();
  const automationBurnMonthly = automations.reduce((sum, automation) => {
    return sum + estimateMonthlyRuns(automation.cron_expression) * DEFAULT_AUTOMATION_RUN_CREDIT_COST;
  }, 0);
  const billing = getBillingStatus(DEFAULT_WORKSPACE_ID);
  const dailyBurn = automationBurnMonthly / DAYS_IN_MONTH + 8;
  const projectedDaysLeft = dailyBurn > 0
    ? Math.max(1, Math.floor(billing.summary.balanceCredits / dailyBurn))
    : 999;
  const topUpSuggestion = getApplicableTopUpOffer(
    billing.summary.balanceCredits,
    Math.max(DEFAULT_ESTIMATED_TASK_COST, Math.ceil(dailyBurn * 7))
  );

  return {
    planName: billing.plan.name,
    creditsRemaining: billing.summary.balanceCredits,
    creditsTotal: billing.plan.includedCredits,
    estimatedTaskCost: DEFAULT_ESTIMATED_TASK_COST,
    automationBurnMonthly,
    referralBonus: DEFAULT_REFERRAL_BONUS,
    topUpSuggestion: topUpSuggestion.credits + (topUpSuggestion.bonusCredits || 0),
    projectedDaysLeft,
    lastUpdatedAt: new Date().toISOString(),
  };
}
