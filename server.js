import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js'
import { notFound, errorHandler } from './middleware/errorHandlers.js'
import './jobs/abandonedCartCron.js';
import './jobs/syncOrdersCron.js'

// Routes 
import routes from './routes/index.js'

import './utils/modelLoader.js';


dotenv.config();

const app = express();

// 1. Connect DB
connectDB();

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("trust proxy", true);


// 2. Core Middlewares
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://parati-superadmin.vercel.app',
  'https://parati-client.vercel.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// app.options('*', cors());





// 3. Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 4. Routes
app.use('/api', routes);



app.get('/', (req, res) => {
   const ip = req.ip;
     const forwarded = req.headers["x-forwarded-for"];

  res.json({ message: 'Server running 🚀', ip });
});



// 5. 404 + Error Handler
app.use(notFound);
app.use(errorHandler);

// 6. Server Start
const PORT = process.env.PORT || 5000;
console.log('🚀PORT: ',process.env.STORE_URL)
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port http://localhost:${PORT}`);
});

// 7. Graceful Shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
