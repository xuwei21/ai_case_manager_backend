import mongoose, { Schema, Document } from 'mongoose';

const ImageSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

const FixStepSchema = new Schema({
  type: { type: String, enum: ['click', 'input', 'swipe', 'wait', 'scroll', 'longPress'], required: true },
  prompt: String,
  images: [ImageSchema],
  waitDuration: Number,
  scrollStart: String,
  scrollEnd: String,
  scrollDuration: Number,
  inputText: String,
}, { _id: false });

const PreconditionSchema = new Schema({
  assertPrompt: { type: String, required: true },
  images: [ImageSchema],
}, { _id: false });

const StepSchema = new Schema({
  inputType: {
    type: String,
    enum: ['click', 'input', 'swipe', 'wait', 'assert', 'if', 'scroll', 'longPress'],
    required: true,
  },
  prompt: String,
  images: [ImageSchema],
  waitDuration: Number,
  scrollStart: String,
  scrollEnd: String,
  scrollDuration: Number,
  inputText: String,
  precondition: PreconditionSchema,
  fixSteps: [FixStepSchema],
}, { _id: false });

export interface IKnowledge extends Document {
  name: string;
  business: string;
  description: string;
  steps: any[];
  creator: mongoose.Types.ObjectId;
  creatorName: string;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeSchema = new Schema<IKnowledge>(
  {
    name: { type: String, required: true },
    business: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    steps: [StepSchema],
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creatorName: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IKnowledge>('Knowledge', KnowledgeSchema);
