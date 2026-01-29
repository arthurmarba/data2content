import mongoose, { Schema, model, Document, Model, Types } from 'mongoose';

export type PostReviewStatus = 'do' | 'dont' | 'almost';

export interface IPostReview extends Document {
  postId: Types.ObjectId;
  status: PostReviewStatus;
  note?: string;
  reviewedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const postReviewSchema = new Schema<IPostReview>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Metric', required: true, unique: true, index: true },
    status: { type: String, enum: ['do', 'dont', 'almost'], required: true, index: true },
    note: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

postReviewSchema.index({ status: 1, updatedAt: -1 });
postReviewSchema.index({ updatedAt: -1 });

const PostReviewModel = mongoose.models.PostReview
  ? (mongoose.models.PostReview as Model<IPostReview>)
  : model<IPostReview>('PostReview', postReviewSchema);

export default PostReviewModel;
