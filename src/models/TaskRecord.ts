import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskRecord extends Document {
  taskId: mongoose.Types.ObjectId;
  testCaseId: mongoose.Types.ObjectId;
  testCaseName: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  errorMessage: string;
  steps: { stepIndex: number; status: string; screenshot?: string }[];
  createdAt: Date;
}

const TaskRecordSchema = new Schema<ITaskRecord>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    testCaseId: { type: Schema.Types.ObjectId, ref: 'TestCase', required: true },
    testCaseName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'passed', 'failed', 'skipped'], default: 'pending' },
    startTime: Date,
    endTime: Date,
    errorMessage: { type: String, default: '' },
    steps: [{
      stepIndex: Number,
      status: String,
      screenshot: String,
    }],
  },
  { timestamps: true }
);

export default mongoose.model<ITaskRecord>('TaskRecord', TaskRecordSchema);
