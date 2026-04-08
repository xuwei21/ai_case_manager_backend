import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  name: string;
  business: string;
  testCases: mongoose.Types.ObjectId[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: { total: number; completed: number; failed: number; current: number };
  creator: mongoose.Types.ObjectId;
  creatorName: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    name: { type: String, required: true },
    business: { type: String, required: true, index: true },
    testCases: [{ type: Schema.Types.ObjectId, ref: 'TestCase' }],
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' },
    progress: {
      total: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      current: { type: Number, default: 0 },
    },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creatorName: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITask>('Task', TaskSchema);
