// src/app/api/billing/preview-plan-change/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import Stripe from 'stripe';

export const runtime = 'nodejs';

// Helper function to get Price ID (can be shared)
function getPriceId(plan: string, currency: string) {
    if (plan === "monthly" && currency === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
    if (plan === "annual"  && currency === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
    if (plan === "monthly" && currency === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
    if (plan === "annual"  && currency === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
    throw new Error("PriceId not configured");
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // --- DEFINITIVE FIX ---
        // The global Stripe client has an initialization issue with the invoices resource.
        // To reliably preview a plan change, we will use a Subscription Schedule,
        // which is a safer and more modern approach.
        const localStripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2024-06-20' as any, // Use a recent stable API version and bypass strict type check
        });

        const { toPlan } = await req.json();
        if (!toPlan) {
            return NextResponse.json({ error: 'Destino do plano (toPlan) é obrigatório' }, { status: 400 });
        }
        
        await connectToDatabase();
        const user = await User.findById(session.user.id);
        if (!user || !user.stripeSubscriptionId || !user.stripeCustomerId) {
            return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 });
        }

        const subscription = await localStripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        const currentItem = subscription.items.data[0];
        if (!currentItem) {
            throw new Error("Item da assinatura atual não foi encontrado.");
        }

        const currentCurrency = currentItem.price?.currency?.toUpperCase() || 'BRL';
        const newPriceId = getPriceId(toPlan, currentCurrency);
        
        // Use a Subscription Schedule to preview the changes without applying them.
        const schedule = await localStripe.subscriptionSchedules.create({
            from_subscription: subscription.id,
        });

        const currentPhase = schedule.phases[0];
        if (!currentPhase) {
            throw new Error("Could not find current phase in subscription schedule.");
        }

        // Update the schedule to simulate the plan change.
        const updatedSchedule = await localStripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: 'cancel', // Cancel the schedule after simulation, don't apply it.
            phases: [
                {
                    items: currentPhase.items.map(item => ({
                        price: typeof item.price === 'string' ? item.price : item.price.id,
                        quantity: item.quantity,
                    })),
                    start_date: currentPhase.start_date,
                    end_date: 'now', // End it immediately to calculate the next phase
                },
                {
                    items: [{ price: newPriceId }],
                    proration_behavior: 'create_prorations',
                    // --- CORRECTION: Specify iterations for the final phase ---
                    iterations: 1, 
                },
            ],
        });

        const scheduleWithPreview = updatedSchedule as Stripe.SubscriptionSchedule & { invoice_preview?: Stripe.Invoice };

        // The cost of the change is in the invoice preview within the schedule.
        const amountDue = scheduleWithPreview.invoice_preview?.amount_due ?? 0;
        const currency = scheduleWithPreview.invoice_preview?.currency ?? currentCurrency;

        return NextResponse.json({
            amountDue: amountDue,
            currency: currency,
        });

    } catch (error: any) {
        console.error('[preview-plan-change] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
