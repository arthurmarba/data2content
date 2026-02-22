import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Types } from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal from '@/app/models/BrandProposal';
import CampaignLink, { CampaignLinkScriptApprovalStatus } from '@/app/models/CampaignLink';
import ScriptEntry from '@/app/models/ScriptEntry';
import Metric from '@/app/models/Metric';
import { PUBLI_CAPTION_INDICATOR_REGEX } from '@/app/lib/publisCaptionDetector';

export const runtime = 'nodejs';

const SCRIPT_APPROVAL_STATUSES: CampaignLinkScriptApprovalStatus[] = [
  'draft',
  'sent',
  'approved',
  'changes_requested',
];

function previewText(value: string | null | undefined, max = 84): string {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}...`;
}

async function getAuthorizedProposal(request: NextRequest, proposalId: string) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  }

  if (!Types.ObjectId.isValid(proposalId)) {
    return { response: NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 }) };
  }

  await connectToDatabase();

  const proposal = await BrandProposal.findById(proposalId).select('_id userId').lean().exec();
  if (!proposal) {
    return { response: NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 }) };
  }
  if (String(proposal.userId) !== session.user.id) {
    return { response: NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 }) };
  }

  return { session, proposal };
}

async function serializeLink(link: any, userId: string) {
  let entity: {
    id: string;
    title: string;
    subtitle: string | null;
    coverUrl: string | null;
    detailUrl: string | null;
    updatedAt: string | null;
    postDate: string | null;
  } | null = null;

  if (link.entityType === 'script') {
    const script = await ScriptEntry.findOne({
      _id: link.entityId,
      userId: new Types.ObjectId(userId),
    })
      .select('_id title source updatedAt')
      .lean()
      .exec();

    if (script) {
      entity = {
        id: String(script._id),
        title: script.title || 'Roteiro sem título',
        subtitle:
          script.source === 'planner'
            ? 'Roteiro do planner'
            : script.source === 'ai'
              ? 'Roteiro criado com IA'
              : 'Roteiro manual',
        coverUrl: null,
        detailUrl: '/planning/roteiros',
        updatedAt: script.updatedAt ? new Date(script.updatedAt).toISOString() : null,
        postDate: null,
      };
    }
  } else {
    const publi = await Metric.findOne({
      _id: link.entityId,
      user: new Types.ObjectId(userId),
      $or: [{ isPubli: true }, { description: { $regex: PUBLI_CAPTION_INDICATOR_REGEX } }],
    })
      .select('_id description theme coverUrl updatedAt postDate')
      .lean()
      .exec();

    if (publi) {
      const id = String(publi._id);
      entity = {
        id,
        title: previewText(publi.description) || publi.theme || 'Publi',
        subtitle: publi.theme ?? null,
        coverUrl: publi.coverUrl ?? null,
        detailUrl: `/dashboard/publis/${id}`,
        updatedAt: publi.updatedAt ? new Date(publi.updatedAt).toISOString() : null,
        postDate: publi.postDate ? new Date(publi.postDate).toISOString() : null,
      };
    }
  }

  return {
    id: String(link._id),
    entityType: link.entityType,
    entityId: String(link.entityId),
    scriptApprovalStatus: link.scriptApprovalStatus ?? null,
    notes: typeof link.notes === 'string' && link.notes.trim().length > 0 ? link.notes : null,
    createdAt: link.createdAt ? new Date(link.createdAt).toISOString() : null,
    updatedAt: link.updatedAt ? new Date(link.updatedAt).toISOString() : null,
    entity,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; linkId: string } }
) {
  const { session, response } = await getAuthorizedProposal(request, params.id);
  if (!session) return response;

  if (!Types.ObjectId.isValid(params.linkId)) {
    return NextResponse.json({ error: 'Vínculo inválido.' }, { status: 400 });
  }

  const link = await CampaignLink.findOne({
    _id: new Types.ObjectId(params.linkId),
    proposalId: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(session.user.id),
  }).exec();

  if (!link) {
    return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const hasStatusField = Object.prototype.hasOwnProperty.call(payload ?? {}, 'scriptApprovalStatus');
  const hasNotesField = Object.prototype.hasOwnProperty.call(payload ?? {}, 'notes');
  const nextStatus = payload?.scriptApprovalStatus as CampaignLinkScriptApprovalStatus | null | undefined;
  const nextNotes =
    payload?.notes === null
      ? null
      : typeof payload?.notes === 'string'
        ? payload.notes.trim().slice(0, 3000)
        : undefined;

  if (!hasStatusField && !hasNotesField) {
    return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 422 });
  }

  if (hasStatusField) {
    if (link.entityType !== 'script') {
      return NextResponse.json(
        { error: 'Status de aprovação só pode ser alterado para roteiros.' },
        { status: 422 }
      );
    }
    if (nextStatus !== null && nextStatus !== undefined && !SCRIPT_APPROVAL_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: 'Status de aprovação inválido.' }, { status: 422 });
    }
    link.scriptApprovalStatus = nextStatus ?? null;
  }

  if (hasNotesField) {
    if (nextNotes === undefined) {
      return NextResponse.json({ error: 'Notas inválidas.' }, { status: 422 });
    }
    link.notes = nextNotes;
  }

  await link.save();

  const serialized = await serializeLink(link.toObject(), session.user.id);
  return NextResponse.json({ item: serialized });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; linkId: string } }
) {
  const { session, response } = await getAuthorizedProposal(request, params.id);
  if (!session) return response;

  if (!Types.ObjectId.isValid(params.linkId)) {
    return NextResponse.json({ error: 'Vínculo inválido.' }, { status: 400 });
  }

  const result = await CampaignLink.deleteOne({
    _id: new Types.ObjectId(params.linkId),
    proposalId: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(session.user.id),
  }).exec();

  if (!result.deletedCount) {
    return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
