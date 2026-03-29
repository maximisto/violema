import path from 'path';
import Stripe from 'stripe';
import { listLedgerEntries } from './store';
import { getBillingStatus, getPlanDefinition, listPlanDefinitions, listTopUpOffers, purchaseTopUp, upsertBillingConfig } from './billing';
import { readJsonFile, writeJsonFile } from './jsonStore';
import type { BillingPlanId, PlanDefinition, TopUpOffer } from './types';

export type BillingCheckoutMode = 'payment' | 'subscription';
export type BillingCheckoutProvider = 'stripe' | 'mock';

export interface StripeBillingConfig {
  workspaceId: string;
  provider: BillingCheckoutProvider;
  currency: string;
  stripeConfigured: boolean;
  publishableKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  successUrl: string;
  cancelUrl: string;
  subscriptionPriceIds: Record<BillingPlanId, string | null>;
  topUpPriceIds: Record<string, string | null>;
  plans: Array<PlanDefinition & { priceId: string | null }>;
  offers: Array<TopUpOffer & { priceId: string | null }>;
  billing: ReturnType<typeof getBillingStatus>;
}

export interface BillingCheckoutSessionInput {
  workspaceId: string;
  kind: BillingCheckoutMode;
  planId?: BillingPlanId;
  offerId?: string;
  quantity?: number;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface BillingCheckoutSessionResult {
  provider: BillingCheckoutProvider;
  status: 'ready' | 'mocked';
  sessionId: string;
  checkoutUrl: string;
  mode: BillingCheckoutMode;
  workspaceId: string;
  planId?: BillingPlanId;
  offerId?: string;
  priceId?: string;
  currency: string;
  amountUsd?: number;
  quantity?: number;
  metadata: Record<string, string>;
  note?: string;
}

const DEFAULT_SUCCESS_URL = 'https://nexus.purpleorange.io/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}';
const DEFAULT_CANCEL_URL = 'https://nexus.purpleorange.io/settings/billing?checkout=cancel';
const DEFAULT_CURRENCY = 'usd';
export const STRIPE_EVENTS_FILE = path.join(process.cwd(), 'platform-stripe-events.json');

let cachedStripe: Stripe | null = null;
let cachedStripeKey: string | null = null;

function getEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getWebhookSecret(): string | null {
  return getEnv('STRIPE_WEBHOOK_SECRET');
}

function getStripeClient(): Stripe | null {
  const key = getEnv('STRIPE_SECRET_KEY');
  if (!key) return null;
  if (!cachedStripe || cachedStripeKey !== key) {
    cachedStripe = new Stripe(key);
    cachedStripeKey = key;
  }
  return cachedStripe;
}

function normalizeOfferKey(offerId: string): string {
  return offerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function getSubscriptionPriceId(planId: BillingPlanId): string | null {
  return getEnv(`STRIPE_PRICE_ID_${planId.toUpperCase()}`);
}

function getTopUpPriceId(offerId: string): string | null {
  return getEnv(`STRIPE_TOP_UP_PRICE_ID_${normalizeOfferKey(offerId)}`);
}

function getSuccessUrl(input?: string): string {
  return input || getEnv('STRIPE_SUCCESS_URL') || DEFAULT_SUCCESS_URL;
}

function getCancelUrl(input?: string): string {
  return input || getEnv('STRIPE_CANCEL_URL') || DEFAULT_CANCEL_URL;
}

function getCurrency(): string {
  return (getEnv('STRIPE_CURRENCY') || DEFAULT_CURRENCY).toLowerCase();
}

function toMetadata(input?: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input || {}).map(([key, value]) => [key, String(value)]));
}

function createMockCheckoutSession(input: BillingCheckoutSessionInput, priceId: string | null, amountUsd?: number): BillingCheckoutSessionResult {
  const sessionId = `mock_chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    provider: 'mock',
    status: 'mocked',
    sessionId,
    checkoutUrl: `/api/billing/stripe/mock-checkout/${sessionId}`,
    mode: input.kind,
    workspaceId: input.workspaceId,
    planId: input.planId,
    offerId: input.offerId,
    priceId: priceId || undefined,
    currency: getCurrency(),
    amountUsd,
    quantity: input.quantity || 1,
    metadata: toMetadata(input.metadata),
    note: 'Stripe is not configured. This is a mock checkout session.',
  };
}

async function createRealCheckoutSession(input: BillingCheckoutSessionInput, priceId: string, amountUsd?: number): Promise<BillingCheckoutSessionResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    return createMockCheckoutSession(input, priceId, amountUsd);
  }

  const successUrl = getSuccessUrl(input.successUrl);
  const cancelUrl = getCancelUrl(input.cancelUrl);
  const metadata = {
    workspaceId: input.workspaceId,
    kind: input.kind,
    planId: input.planId || '',
    offerId: input.offerId || '',
    ...toMetadata(input.metadata),
  };

  const session = await stripe.checkout.sessions.create({
    mode: input.kind,
    line_items: [{ price: priceId, quantity: input.quantity || 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.workspaceId,
    metadata,
    subscription_data: input.kind === 'subscription' ? { metadata } : undefined,
    payment_intent_data: input.kind === 'payment' ? { metadata } : undefined,
  });

  return {
    provider: 'stripe',
    status: 'ready',
    sessionId: session.id,
    checkoutUrl: session.url || successUrl.replace('{CHECKOUT_SESSION_ID}', session.id),
    mode: input.kind,
    workspaceId: input.workspaceId,
    planId: input.planId,
    offerId: input.offerId,
    priceId,
    currency: getCurrency(),
    amountUsd,
    quantity: input.quantity || 1,
    metadata,
  };
}

export function getStripeBillingConfig(workspaceId: string): StripeBillingConfig {
  const billing = getBillingStatus(workspaceId);
  const plans: Array<PlanDefinition & { priceId: string | null }> = listPlanDefinitions().map((plan) => ({
    ...plan,
    priceId: getSubscriptionPriceId(plan.id),
  }));
  const offers = listTopUpOffers().map((offer) => ({
    ...offer,
    priceId: getTopUpPriceId(offer.id),
  }));

  return {
    workspaceId,
    provider: getStripeClient() ? 'stripe' : 'mock',
    currency: getCurrency(),
    stripeConfigured: Boolean(getStripeClient()),
    publishableKeyConfigured: Boolean(getEnv('STRIPE_PUBLISHABLE_KEY')),
    webhookSecretConfigured: Boolean(getEnv('STRIPE_WEBHOOK_SECRET')),
    successUrl: getSuccessUrl(),
    cancelUrl: getCancelUrl(),
    subscriptionPriceIds: Object.fromEntries(plans.map((plan) => [plan.id, plan.priceId])) as Record<BillingPlanId, string | null>,
    topUpPriceIds: Object.fromEntries(offers.map((offer) => [offer.id, offer.priceId])) as Record<string, string | null>,
    plans,
    offers,
    billing,
  };
}

export async function createSubscriptionCheckoutSession(
  workspaceId: string,
  planId: BillingPlanId,
  input: Pick<BillingCheckoutSessionInput, 'successUrl' | 'cancelUrl' | 'metadata'> = {}
): Promise<BillingCheckoutSessionResult> {
  const plan = getPlanDefinition(planId);
  const priceId = getSubscriptionPriceId(planId);
  const amountUsd = plan.monthlyPriceUsd;

  if (!priceId) {
    return createMockCheckoutSession({ workspaceId, kind: 'subscription', planId, ...input }, null, amountUsd);
  }

  return createRealCheckoutSession({ workspaceId, kind: 'subscription', planId, ...input }, priceId, amountUsd);
}

export async function createTopUpCheckoutSession(
  workspaceId: string,
  offerId: string,
  input: Pick<BillingCheckoutSessionInput, 'successUrl' | 'cancelUrl' | 'metadata' | 'quantity'> = {}
): Promise<BillingCheckoutSessionResult> {
  const offer = listTopUpOffers().find((item) => item.id === offerId);
  if (!offer) {
    throw new Error(`Unknown top-up offer: ${offerId}`);
  }

  const priceId = getTopUpPriceId(offer.id);
  const amountUsd = offer.priceUsd;

  if (!priceId) {
    return createMockCheckoutSession({ workspaceId, kind: 'payment', offerId, ...input }, null, amountUsd);
  }

  return createRealCheckoutSession(
    { workspaceId, kind: 'payment', offerId, quantity: input.quantity || 1, ...input },
    priceId,
    amountUsd
  );
}

interface ProcessedStripeEvent {
  id: string;
  type: string;
  processedAt: string;
  workspaceId?: string;
  referenceId?: string;
}

function listProcessedEvents(): ProcessedStripeEvent[] {
  return readJsonFile<ProcessedStripeEvent[]>(STRIPE_EVENTS_FILE, []);
}

function saveProcessedEvent(event: ProcessedStripeEvent) {
  const items = listProcessedEvents();
  if (items.some((item) => item.id === event.id)) return;
  writeJsonFile(STRIPE_EVENTS_FILE, [event, ...items].slice(0, 500));
}

export function hasProcessedStripeEvent(eventId: string): boolean {
  return listProcessedEvents().some((item) => item.id === eventId);
}

export function constructStripeWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const secret = getWebhookSecret();
  if (!stripe || !secret) {
    throw new Error('Stripe webhook verification is not configured.');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

function extractMetadata(metadata?: Record<string, string | null> | null): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata || {})
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .map(([key, value]) => [key, value as string])
  );
}

function hasLedgerReference(workspaceId: string, referenceId: string): boolean {
  return listLedgerEntries(workspaceId).some((entry) => entry.referenceId === referenceId);
}

async function fulfillCheckoutSessionCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const metadata = extractMetadata(session.metadata);
  const workspaceId = metadata.workspaceId || session.client_reference_id || undefined;
  if (!workspaceId) {
    return { applied: false, reason: 'missing_workspace' as const };
  }

  if (session.mode === 'payment') {
    const offerId = metadata.offerId;
    if (!offerId) {
      return { applied: false, reason: 'missing_offer' as const };
    }
    if (hasLedgerReference(workspaceId, session.id)) {
      return { applied: false, reason: 'duplicate_topup' as const };
    }

    purchaseTopUp(workspaceId, offerId, {
      referenceId: session.id,
      note: `Stripe top-up checkout completed: ${offerId}`,
      metadata: { stripeEventId: event.id, stripeSessionId: session.id, paymentStatus: session.payment_status || 'unknown' },
    });

    return { applied: true, workspaceId, kind: 'top_up' as const };
  }

  if (session.mode === 'subscription') {
    const planId = metadata.planId as BillingPlanId | undefined;
    if (!planId || !['starter', 'pro', 'team'].includes(planId)) {
      return { applied: false, reason: 'missing_plan' as const };
    }

    upsertBillingConfig(workspaceId, { planId });
    return { applied: true, workspaceId, kind: 'subscription' as const };
  }

  return { applied: false, reason: 'unsupported_mode' as const };
}

export async function fulfillStripeWebhookEvent(event: Stripe.Event) {
  if (hasProcessedStripeEvent(event.id)) {
    return { duplicate: true, eventId: event.id };
  }

  let result: Record<string, unknown> = { applied: false, ignored: true };

  if (event.type === 'checkout.session.completed') {
    result = await fulfillCheckoutSessionCompleted(event, event.data.object as Stripe.Checkout.Session);
  } else if (event.type === 'checkout.session.async_payment_succeeded') {
    result = await fulfillCheckoutSessionCompleted(event, event.data.object as Stripe.Checkout.Session);
  }

  saveProcessedEvent({
    id: event.id,
    type: event.type,
    processedAt: new Date().toISOString(),
    workspaceId: typeof result.workspaceId === 'string' ? result.workspaceId : undefined,
    referenceId:
      event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded'
        ? (event.data.object as Stripe.Checkout.Session).id
        : undefined,
  });

  return {
    duplicate: false,
    eventId: event.id,
    eventType: event.type,
    ...result,
  };
}
