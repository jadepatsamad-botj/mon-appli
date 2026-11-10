// Jade : fonction « stripe-webhook » (Supabase Edge Function)
// Stripe l'appelle après chaque paiement. Elle active l'abonnement du membre pendant 30 jours
// (Premium, Gold ou Diamond selon le montant payé), puis le prolonge à chaque renouvellement.
//
// À créer dans Supabase → Edge Functions → Deploy a new function → nom : stripe-webhook
// (décocher « Enforce JWT verification » / « Verify JWT » : c'est Stripe qui appelle, pas un membre).
// Secrets à ajouter dans Supabase → Edge Functions → Secrets (c'est toi qui les colles, jamais dans le code) :
//   STRIPE_SECRET_KEY      = ta clé secrète Stripe (sk_live_… ou sk_test_…)
//   STRIPE_WEBHOOK_SECRET  = le « Signing secret » du webhook Stripe (whsec_…)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-04-10", httpClient: Stripe.createFetchHttpClient() });
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

// Montant payé (en centimes) → formule. À ajuster si tu changes les prix dans Stripe.
const PLAN_BY_AMOUNT: Record<number, string> = { 1599: "premium", 4599: "gold", 14999: "diamond" };
const DAYS = 30;

function planFor(amount: number | null | undefined): string {
  if (!amount) return "premium";
  if (PLAN_BY_AMOUNT[amount]) return PLAN_BY_AMOUNT[amount];
  // Montant inconnu : on prend la formule dont le prix est le plus proche
  let best = "premium", gap = Infinity;
  for (const [cents, plan] of Object.entries(PLAN_BY_AMOUNT)) {
    const d = Math.abs(Number(cents) - amount);
    if (d < gap) { gap = d; best = plan; }
  }
  return best;
}

async function extend(filter: { id?: string; stripe_customer?: string }, plan: string, until: Date, customer?: string | null) {
  let q = db.from("profiles").select("id, premium_until");
  q = filter.id ? q.eq("id", filter.id) : q.eq("stripe_customer", filter.stripe_customer ?? "");
  const { data: rows, error } = await q.limit(1);
  if (error || !rows || !rows.length) { console.log("Profil introuvable", filter, error?.message); return; }
  const row = rows[0];
  // On ne raccourcit jamais un abonnement déjà plus long
  const current = row.premium_until ? new Date(row.premium_until) : null;
  const end = current && current > until ? current : until;
  const patch: Record<string, unknown> = { plan, premium_until: end.toISOString() };
  if (customer) patch.stripe_customer = customer;
  const up = await db.from("profiles").update(patch).eq("id", row.id);
  if (up.error) console.log("Mise à jour impossible", up.error.message);
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig ?? "", Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "", undefined, cryptoProvider);
  } catch (e) {
    return new Response("Signature invalide : " + (e as Error).message, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      // Premier paiement depuis un lien de paiement Jade : client_reference_id = l'identifiant du membre
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.client_reference_id && s.payment_status === "paid") {
        const until = new Date(Date.now() + DAYS * 86400000);
        await extend({ id: s.client_reference_id }, planFor(s.amount_total), until, typeof s.customer === "string" ? s.customer : null);
      }
    } else if (event.type === "invoice.paid") {
      // Renouvellement mensuel d'un abonnement : on prolonge jusqu'à la fin de la période payée
      const inv = event.data.object as Stripe.Invoice;
      if (inv.billing_reason !== "subscription_create" && typeof inv.customer === "string") {
        const endSec = inv.lines?.data?.[0]?.period?.end;
        const until = endSec ? new Date(endSec * 1000) : new Date(Date.now() + DAYS * 86400000);
        await extend({ stripe_customer: inv.customer }, planFor(inv.amount_paid), until);
      }
    }
  } catch (e) {
    console.log("Erreur", (e as Error).message);
    return new Response("Erreur", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
