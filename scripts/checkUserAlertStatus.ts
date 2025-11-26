import { connectToDatabase } from '../src/app/lib/mongoose';
import User from '../src/app/models/User';
import { isActiveLike } from '../src/app/lib/isActiveLike';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config({ path: '.env.local' });

async function checkUserAlertStatus(userId: string) {
    console.log(`\n🔍 Investigando status de alerta para o usuário: ${userId}\n`);

    try {
        await connectToDatabase();
        console.log('✅ Conectado ao banco de dados.');

        const user = await User.findById(userId);

        if (!user) {
            console.error('❌ Usuário não encontrado.');
            process.exit(1);
        }

        console.log(`👤 Usuário: ${user.name} (${user.email})`);
        console.log('--------------------------------------------------');

        let canReceiveAlerts = true;
        const reasons: string[] = [];

        // 1. Verificação de Plano
        const planStatus = user.planStatus;
        const isPlanActive = isActiveLike(planStatus);
        console.log(`1️⃣  Status do Plano: ${planStatus} [${isPlanActive ? '✅ ATIVO' : '❌ INATIVO'}]`);
        if (!isPlanActive) {
            canReceiveAlerts = false;
            reasons.push(`Plano inativo (${planStatus}). O usuário precisa renovar a assinatura.`);
        }

        // 2. Verificação de WhatsApp
        const phone = user.whatsappPhone;
        const verified = user.whatsappVerified;
        console.log(`2️⃣  WhatsApp: ${phone || 'N/A'} [${verified ? '✅ VERIFICADO' : '❌ NÃO VERIFICADO'}]`);

        if (!phone) {
            canReceiveAlerts = false;
            reasons.push('Telefone WhatsApp não cadastrado.');
        } else if (!verified) {
            canReceiveAlerts = false;
            reasons.push('Telefone WhatsApp não verificado.');
        }

        // 3. Verificação de Trial (Se aplicável)
        const trialActive = user.whatsappTrialActive;
        const trialExpires = user.whatsappTrialExpiresAt;
        const now = new Date();
        const trialValid = trialActive && trialExpires && new Date(trialExpires) > now;

        if (trialActive) {
            console.log(`3️⃣  Trial WhatsApp: Ativo até ${trialExpires ? new Date(trialExpires).toISOString() : 'N/A'} [${trialValid ? '✅ VÁLIDO' : '❌ EXPIRADO'}]`);
            if (!trialValid) {
                // Se o trial expirou, mas o plano é pago/ativo, o trial não importa tanto, 
                // mas se o usuário depende do trial para receber (ex: plano free com trial), então bloqueia.
                // A lógica no código original (dailyTipHandler) diz:
                // if (userForRadar.whatsappTrialActive && !trialWindowActive) -> PULA

                canReceiveAlerts = false;
                reasons.push('Período de Trial do WhatsApp expirou.');
            }
        } else {
            console.log(`3️⃣  Trial WhatsApp: Não ativado (OK se tiver plano pago).`);
        }

        // 4. Verificação de Variáveis de Ambiente (Configuração do Sistema)
        const proactiveTemplate = process.env.PROACTIVE_ALERT_TEMPLATE_NAME;
        const errorTemplate = process.env.GENERIC_ERROR_TEMPLATE_NAME;

        console.log(`4️⃣  Configuração de Templates:`);
        console.log(`   - PROACTIVE_ALERT_TEMPLATE_NAME: ${proactiveTemplate ? '✅ DEFINIDO' : '❌ AUSENTE'}`);
        console.log(`   - GENERIC_ERROR_TEMPLATE_NAME: ${errorTemplate ? '✅ DEFINIDO' : '❌ AUSENTE'}`);

        if (!proactiveTemplate || !errorTemplate) {
            canReceiveAlerts = false;
            reasons.push('Erro de configuração do sistema: Variáveis de template ausentes no .env');
        }

        console.log('--------------------------------------------------');

        if (canReceiveAlerts) {
            console.log('🎉 RESULTADO: O usuário ESTÁ APTO a receber alertas.');
            console.log('Se ele não está recebendo, verifique:');
            console.log(' - Se o Cron Job está rodando corretamente.');
            console.log(' - Se o motor de regras detectou algum evento hoje (verifique os logs do servidor).');
            console.log(' - Se houve erro na API do WhatsApp (verifique os logs do servidor).');
        } else {
            console.log('🚫 RESULTADO: O usuário NÃO receberá alertas.');
            console.log('Motivos:');
            reasons.forEach(r => console.log(` - ${r}`));
        }

    } catch (error) {
        console.error('❌ Erro inesperado:', error);
    } finally {
        process.exit(0);
    }
}

const userIdArg = process.argv[2];
if (!userIdArg) {
    console.error('Uso: npx tsx scripts/checkUserAlertStatus.ts <USER_ID>');
    process.exit(1);
}

checkUserAlertStatus(userIdArg);
