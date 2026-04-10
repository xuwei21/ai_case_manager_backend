import mongoose, { Schema, Document } from 'mongoose';

// 图片
const ImageSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

// 前置条件修复步骤
const FixStepSchema = new Schema({
  type: { type: String, enum: ['click', 'swipe', 'wait'], required: true },
  prompt: String,
  images: [ImageSchema],
  waitDuration: Number,
  scrollStart: String,
  scrollEnd: String,
  scrollDuration: Number,
  inputText: String,
}, { _id: false });

// 前置条件
const PreconditionSchema = new Schema({
  assertPrompt: { type: String, required: true },
  images: [ImageSchema],
}, { _id: false });

// 自动化步骤
const AutomationStepSchema = new Schema({
  inputType: {
    type: String,
    enum: ['click', 'input', 'swipe', 'wait', 'assert', 'if', 'plan'],
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

export interface ITestCase extends Document {
  platforms: string[];
  business: string;
  module: string;
  testCase: string;
  creator: mongoose.Types.ObjectId;
  creatorName: string;
  relatedCase: string;
  remark: string;
  automation_steps: any[];
  createdAt: Date;
  updatedAt: Date;
}

const TestCaseSchema = new Schema<ITestCase>(
  {
    platforms: [{ type: String }],
    business: { type: String, required: true, index: true },
    module: { type: String, default: '' },
    testCase: { type: String, required: true },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creatorName: { type: String, required: true },
    relatedCase: { type: String, default: '' },
    remark: { type: String, default: '' },
    automation_steps: [AutomationStepSchema],
  },
  { timestamps: true }
);

TestCaseSchema.index({ business: 1, testCase: 1 });

export default mongoose.model<ITestCase>('TestCase', TestCaseSchema);
