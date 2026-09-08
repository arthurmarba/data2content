import Proposal from '@/app/models/CollabProposal';
import Job, { type CollabJobRecord } from '@/app/models/CollabJob';
import { sendTemplateMessage } from '@/app/lib/whatsappService';
import { participantUsers } from './eligibility';
import { collabSettings } from './settings';
/** Em resposta ambígua de envio, não reenviar: o operador deve reconciliar o ID externo. */
export async function deliverMatchNotification(job: CollabJobRecord) {
  const proposal = await Proposal.findById(job.payload.proposalId).lean();
  if (!proposal?.matchedAt || proposal.endedAt || !proposal.participants.includes(job.userId)) return { delivered: false, reason: 'unavailable' };
  const settings = await collabSettings();
  if (!settings.whatsappTemplateApproved || !settings.whatsappTemplate || !settings.whatsappApiVersion) return { delivered: false, reason: 'template_not_ready' };
  const users = await participantUsers(proposal.participants);
  const recipient = users.find(user => String(user._id) === job.userId), partner = users.find(user => String(user._id) !== job.userId);
  if (!recipient?.whatsappVerified || !recipient.whatsappPhone || recipient.whatsappOptOut) return { delivered: false, reason: 'not_linked' };
  // O checkpoint impede envio duplicado após crash entre a resposta externa e a finalização do job.
  if (job.checkpoint) return { delivered: false, reason: 'delivery_needs_review' };
  const claimed = await Job.updateOne({ _id: job._id, leaseToken: job.leaseToken, checkpoint: null }, { $set: { checkpoint: 'sending' } });
  if (!claimed.modifiedCount) return { delivered: false, reason: 'delivery_needs_review' };
  try {
    const messageId = await sendTemplateMessage(recipient.whatsappPhone, settings.whatsappTemplate, [{ type: 'body', parameters: [{ type: 'text', text: partner?.name || 'outra pessoa' }, { type: 'text', text: proposal.idea.title }] }], 'pt_BR', { maxAttempts: 1, apiVersion: settings.whatsappApiVersion });
    await Job.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { checkpoint: `sent:${messageId}` } });
    return { delivered: true, messageId };
  } catch { return { delivered: false, reason: 'delivery_needs_review' }; }
}
