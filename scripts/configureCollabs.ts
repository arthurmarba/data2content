/** Configuração operacional explícita; --apply é obrigatório para escrever. */
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
async function main() {
  const args = process.argv.slice(2), value = (name: string) => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const patch: Record<string, unknown> = {};
  if (args.includes('--pause')) patch.generationEnabled = false;
  if (args.includes('--enable')) patch.generationEnabled = true;
  const pilot = value('--pilot');
  if (pilot !== undefined) { const ids = pilot.split(',').filter(Boolean); if (!ids.length || ids.some(id => !Types.ObjectId.isValid(id))) throw new Error('Informe os IDs válidos do piloto.'); patch.pilotUserIds = ids; }
  if (args.includes('--all-users')) patch.pilotUserIds = [];
  if (args.includes('--enable') && !pilot && !args.includes('--all-users')) throw new Error('Para habilitar, informe --pilot=IDs ou --all-users explicitamente.');
  const apiVersion = value('--api-version');
  if (apiVersion) { if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error('Informe a versão da Graph API validada para o aplicativo.'); patch.whatsappApiVersion = apiVersion; }
  const template = value('--approved-template');
  if (template) { if (!/^[a-z0-9_]+$/.test(template)) throw new Error('Nome de template inválido.'); patch.whatsappTemplate = template; patch.whatsappTemplateApproved = true; }
  if (args.includes('--disable-whatsapp')) patch.whatsappTemplateApproved = false;
  console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'dry-run', changes: { ...patch, ...(patch.pilotUserIds ? { pilotUserIds: `${(patch.pilotUserIds as string[]).length} participantes` } : {}) } }, null, 2));
  if (args.includes('--apply') && Object.keys(patch).length) {
    mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
    await connectToDatabase();
    const { default: Settings } = await import('@/app/models/CollabSettings');
    await Settings.updateOne({ _id: 'default' }, { $set: patch, $setOnInsert: { _id: 'default' } }, { upsert: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
