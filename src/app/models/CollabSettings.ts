import mongoose, { Schema } from 'mongoose';
export interface CollabSettingsRecord { _id: string; generationEnabled: boolean; pilotUserIds: string[]; whatsappTemplate: string | null; whatsappApiVersion: string | null; whatsappTemplateApproved: boolean; maxMatchingJobsPerDay: number; }
const schema = new Schema<CollabSettingsRecord>({
  _id: String, generationEnabled: { type: Boolean, default: false }, pilotUserIds: { type: [String], default: [] },
  whatsappTemplate: { type: String, default: null }, whatsappApiVersion: { type: String, default: null }, whatsappTemplateApproved: { type: Boolean, default: false },
  maxMatchingJobsPerDay: { type: Number, default: 4 },
}, { timestamps: true, collection: 'collabsettings' });
export default (mongoose.models.CollabSettings as mongoose.Model<CollabSettingsRecord>) || mongoose.model('CollabSettings', schema);
