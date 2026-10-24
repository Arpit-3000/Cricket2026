import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  port: number;
  corsOrigin: string;
  tickRateHz: number;
  defaultOvers: number;
  reconnectGraceMs: number;
  maxRooms: number;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  tickRateHz: parseInt(process.env.TICK_RATE_HZ || '30', 10),
  defaultOvers: parseInt(process.env.DEFAULT_OVERS || '5', 10),
  reconnectGraceMs: parseInt(process.env.RECONNECT_GRACE_MS || '30000', 10),
  maxRooms: parseInt(process.env.MAX_ROOMS || '100', 10)
};
