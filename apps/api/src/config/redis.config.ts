import { Redis } from "ioredis";

const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
};

export const redis = new Redis(redisConfig);

redis.on("connect", ()=>{
    console.log("Connected to Redis");
});

redis.on("error", (err)=>{
    console.error("Redis connection error:", err);
});

export const createRedisClient = () => {
    return new Redis(redisConfig);
};