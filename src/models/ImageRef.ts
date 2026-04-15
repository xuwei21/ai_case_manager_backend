import mongoose, { Schema, Document } from 'mongoose';

export interface IImageRef extends Document {
  md5: string;
  objectName: string;
  url: string;
  refCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ImageRefSchema = new Schema<IImageRef>(
  {
    md5: { type: String, required: true, unique: true, index: true },
    objectName: { type: String, required: true },
    url: { type: String, required: true },
    refCount: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.model<IImageRef>('ImageRef', ImageRefSchema);
