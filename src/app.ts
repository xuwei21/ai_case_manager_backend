import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db';
import config from './config';
import { initMinio, ensureBucket } from './services/minio';
import uploadRoutes from './routes/upload';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import businessRoutes from './routes/business';
import testcaseRoutes from './routes/testcase';
import knowledgeRoutes from './routes/knowledge';
import taskRoutes from './routes/task';
import dashboardRoutes from './routes/dashboard';
import userRoutes from './routes/user';

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'AI Case Manager API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/testcases', testcaseRoutes);
app.use('/api/knowledges', knowledgeRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Error handler
app.use(errorHandler);

// Start server
const start = async () => {
  await connectDB();

  try {
    initMinio();
    await ensureBucket();
  } catch (err) {
    console.error('MinIO init failed:', err);
  }
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
};

start();

export default app;
