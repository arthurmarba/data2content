import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Types } from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal from '@/app/models/BrandProposal';
import CampaignLink, {
  CampaignLinkEntityType,
  CampaignLinkScriptApprovalStatus,
} from '@/app/models/CampaignLink';
import ScriptEntry from '@/app/models/ScriptEntry';
import Metric from '@/app/models/Metric';
import { PUBLI_CAPTION_INDICATOR_REGEX } from '@/app/lib/publisCaptionDetector';

export const runtime = 'nodejs';

type LinkEntitySummary = {
  id: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  detailUrl: string | null;
  updatedAt: string | null;
  postDate: string | null;
};

type SerializedLink = {
  id: string;
  entityType: CampaignLinkEntityType;
  entityId: string;
  scriptApprovalStatus: CampaignLinkScriptApprovalStatus | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  entity: LinkEntitySummary | null;
};

type LinkableScriptItem = {
  id: string;
  title: string;
  source: 'manual' | 'ai' | 'planner';
  updatedAt: string | null;
};

type LinkablePubliItem = {
  id: string;
  description: string;
  theme: string | null;
  postDate: string | null;
};

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

function parseLimit(value: string | null, fallback = 30, max = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
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

function serializeLink(
  link: any,
  entities: Map<string, LinkEntitySummary>
): SerializedLink {
  const entityKey = `${link.entityType}:${String(link.entityId)}`;
  return {
    id: String(link._id),
    entityType: link.entityType as CampaignLinkEntityType,
    entityId: String(link.entityId),
    scriptApprovalStatus: (link.scriptApprovalStatus as CampaignLinkScriptApprovalStatus) ?? null,
    notes: typeof link.notes === 'string' && link.notes.trim().length > 0 ? link.notes : null,
    createdAt: link.createdAt ? new Date(link.createdAt).toISOString() : null,
    updatedAt: link.updatedAt ? new Date(link.updatedAt).toISOString() : null,
    entity: entities.get(entityKey) ?? null,
  };
}

async function resolveEntitySummaries(
  links: any[],
  userId: string
): Promise<Map<string, LinkEntitySummary>> {
  const map = new Map<string, LinkEntitySummary>();

  const scriptIds = links
    .filter((link) => link.entityType === 'script')
    .map((link) => String(link.entityId))
    .filter((value, index, all) => all.indexOf(value) === index)
    .filter((value) => Types.ObjectId.isValid(value))
    .map((value) => new Types.ObjectId(value));

  const publiIds = links
    .filter((link) => link.entityType === 'publi')
    .map((link) => String(link.entityId))
    .filter((value, index, all) => all.indexOf(value) === index)
    .filter((value) => Types.ObjectId.isValid(value))
    .map((value) => new Types.ObjectId(value));

  if (scriptIds.length > 0) {
    const scripts = await ScriptEntry.find({
      _id: { $in: scriptIds },
      userId: new Types.ObjectId(userId),
    })
      .select('_id title source updatedAt')
      .lean()
      .exec();

    for (const script of scripts) {
      const id = String(script._id);
      map.set(`script:${id}`, {
        id,
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
      });
    }
  }

  if (publiIds.length > 0) {
    const publis = await Metric.find({
      _id: { $in: publiIds },
      user: new Types.ObjectId(userId),
      $or: [{ isPubli: true }, { description: { $regex: PUBLI_CAPTION_INDICATOR_REGEX } }],
    })
      .select('_id description theme coverUrl updatedAt postDate')
      .lean()
      .exec();

    for (const publi of publis) {
      const id = String(publi._id);
      const title = previewText(publi.description) || publi.theme || 'Publi';
      map.set(`publi:${id}`, {
        id,
        title,
        subtitle: publi.theme ?? null,
        coverUrl: publi.coverUrl ?? null,
        detailUrl: `/dashboard/publis/${id}`,
        updatedAt: publi.updatedAt ? new Date(publi.updatedAt).toISOString() : null,
        postDate: publi.postDate ? new Date(publi.postDate).toISOString() : null,
      });
    }
  }

  return map;
}

async function resolveLinkableScripts(userId: string, limit: number): Promise<LinkableScriptItem[]> {
  const scripts = await ScriptEntry.find({
    userId: new Types.ObjectId(userId),
  })
    .select('_id title source updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return scripts.map((script: any) => ({
    id: String(script._id),
    title:
      typeof script.title === 'string' && script.title.trim().length > 0
        ? script.title.trim()
        : 'Roteiro sem título',
    source: script.source === 'ai' || script.source === 'planner' ? script.source : 'manual',
    updatedAt: script.updatedAt ? new Date(script.updatedAt).toISOString() : null,
  }));
}

async function resolveLinkablePublis(userId: string, limit: number): Promise<LinkablePubliItem[]> {
  const publis = await Metric.find({
    user: new Types.ObjectId(userId),
    $or: [{ isPubli: true }, { description: { $regex: PUBLI_CAPTION_INDICATOR_REGEX } }],
  })
    .select('_id description theme postDate updatedAt')
    .sort({ postDate: -1, updatedAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return publis.map((publi: any) => ({
    id: String(publi._id),
    description: typeof publi.description === 'string' ? publi.description : '',
    theme: typeof publi.theme === 'string' && publi.theme.trim().length > 0 ? publi.theme.trim() : null,
    postDate: publi.postDate ? new Date(publi.postDate).toISOString() : null,
  }));
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await getAuthorizedProposal(request, params.id);
  if (!session) return response;

  const includeLinkablesRaw = request.nextUrl.searchParams.get('includeLinkables');
  const includeLinkables = includeLinkablesRaw === '1' || includeLinkablesRaw === 'true';
  const linkablesLimit = parseLimit(request.nextUrl.searchParams.get('limit'), 30, 100);

  const links = await CampaignLink.find({
    proposalId: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(session.user.id),
  })
    .sort({ updatedAt: -1 })
    .lean()
    .exec();

  const entitiesPromise = resolveEntitySummaries(links, session.user.id);
  const linkablesPromise = includeLinkables
    ? Promise.all([
        resolveLinkableScripts(session.user.id, linkablesLimit),
        resolveLinkablePublis(session.user.id, linkablesLimit),
      ])
    : null;

  const entities = await entitiesPromise;
  const serializedLinks = links.map((link) => serializeLink(link, entities));

  if (!linkablesPromise) {
    return NextResponse.json({ items: serializedLinks });
  }

  const [linkableScripts, linkablePublis] = await linkablesPromise;
  return NextResponse.json({
    items: serializedLinks,
    linkableScripts,
    linkablePublis,
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await getAuthorizedProposal(request, params.id);
  if (!session) return response;

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const entityType = payload?.entityType as CampaignLinkEntityType;
  const entityId = typeof payload?.entityId === 'string' ? payload.entityId.trim() : '';
  const requestedStatus = payload?.scriptApprovalStatus as CampaignLinkScriptApprovalStatus | undefined;
  const notes =
    payload?.notes === null
      ? null
      : typeof payload?.notes === 'string'
        ? payload.notes.trim().slice(0, 3000)
        : undefined;

  if (entityType !== 'script' && entityType !== 'publi') {
    return NextResponse.json({ error: 'Tipo de item inválido.' }, { status: 422 });
  }
  if (!Types.ObjectId.isValid(entityId)) {
    return NextResponse.json({ error: 'Item inválido para vinculação.' }, { status: 422 });
  }

  if (requestedStatus && !SCRIPT_APPROVAL_STATUSES.includes(requestedStatus)) {
    return NextResponse.json({ error: 'Status de aprovação inválido.' }, { status: 422 });
  }

  const entityObjectId = new Types.ObjectId(entityId);

  if (entityType === 'script') {
    const script = await ScriptEntry.findOne({
      _id: entityObjectId,
      userId: new Types.ObjectId(session.user.id),
    })
      .select('_id')
      .lean()
      .exec();

    if (!script) {
      return NextResponse.json({ error: 'Roteiro não encontrado.' }, { status: 404 });
    }
  } else {
    const publi = await Metric.findOne({
      _id: entityObjectId,
      user: new Types.ObjectId(session.user.id),
      $or: [{ isPubli: true }, { description: { $regex: PUBLI_CAPTION_INDICATOR_REGEX } }],
    })
      .select('_id')
      .lean()
      .exec();

    if (!publi) {
      return NextResponse.json({ error: 'Publi não encontrada.' }, { status: 404 });
    }
  }

  let linkDoc: any | null = null;
  let created = false;

  try {
    linkDoc = await CampaignLink.create({
      proposalId: new Types.ObjectId(params.id),
      userId: new Types.ObjectId(session.user.id),
      entityType,
      entityId: entityObjectId,
      scriptApprovalStatus: entityType === 'script' ? requestedStatus ?? 'draft' : null,
      ...(notes !== undefined ? { notes } : {}),
    });
    created = true;
  } catch (error: any) {
    if (error?.code !== 11000) {
      return NextResponse.json({ error: 'Não foi possível criar o vínculo.' }, { status: 500 });
    }

    linkDoc = await CampaignLink.findOne({
      proposalId: new Types.ObjectId(params.id),
      userId: new Types.ObjectId(session.user.id),
      entityType,
      entityId: entityObjectId,
    })
      .lean()
      .exec();
    created = false;
  }

  if (!linkDoc) {
    return NextResponse.json({ error: 'Não foi possível carregar o vínculo.' }, { status: 500 });
  }

  const entities = await resolveEntitySummaries([linkDoc], session.user.id);
  return NextResponse.json({
    created,
    item: serializeLink(linkDoc, entities),
  });
}
