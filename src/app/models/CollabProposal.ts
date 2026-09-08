import mongoose, { Schema, Types } from 'mongoose';
import type { ContentIdeaListItem } from '@/app/dashboard/boards/videoUpload/contentIdeasReadService';
import type { NarrativeCollabMatch } from '@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService';

/** Uma proposta imutável por versão. As intenções nunca são devolvidas ao outro lado. */
export interface CollabProposalRecord {
  _id: Types.ObjectId;
  key: string;
  version: number;
  participants: string[];
  originUserId: string;
  sourceIdeaId: string;
  idea: ContentIdeaListItem;
  partnerSnapshot: NarrativeCollabMatch;
  contextRevision: string;
  decisions: Map<string, 'interested' | 'dismissed' | 'cancelled'>;
  saved: Map<string, 'active' | 'saved' | 'dismissed' | 'posted'>;
  celebrated: string[];
  exposed: string[];
  acceptedBy: string[];
  matchedAt?: Date | null;
  endedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<CollabProposalRecord>({
  key: { type: String, required: true, unique: true },
  version: { type: Number, required: true, default: 1 },
  participants: { type: [String], required: true, index: true },
  originUserId: { type: String, required: true }, sourceIdeaId: { type: String, required: true },
  idea: { type: Schema.Types.Mixed, required: true },
  partnerSnapshot: { type: Schema.Types.Mixed, required: true },
  contextRevision: { type: String, required: true },
  decisions: { type: Map, of: String, default: {} }, saved: { type: Map, of: String, default: {} },
  celebrated: { type: [String], default: [] }, exposed: { type: [String], default: [] }, acceptedBy: { type: [String], default: [] },
  matchedAt: { type: Date, default: null }, endedAt: { type: Date, default: null }, expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: 'collabproposals' });
// Sem TTL: expiração encerra descoberta, nunca destrói histórico confirmado.
schema.index({ participants: 1, matchedAt: 1, expiresAt: 1 });
export default (mongoose.models.CollabProposal as mongoose.Model<CollabProposalRecord>) || mongoose.model('CollabProposal', schema);
