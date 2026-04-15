import dotenv from 'dotenv';
dotenv.config();

export default {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai_case_manager',
  jwtSecret: process.env.JWT_SECRET || 'default_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 新增 MinIO 配置
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'admin123',
    bucket: process.env.MINIO_BUCKET || 'screenshots',
    publicBaseUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
  },

  // 截图压缩配置（可选）
  screenshot: {
    maxWidth: 1280,
    jpegQuality: 80,
  },
};
