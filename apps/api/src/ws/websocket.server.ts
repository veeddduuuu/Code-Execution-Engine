import { WebSocketServer } from 'ws';
import http from 'http';
import app from '../app';
import { createRedisClient } from '../../../../packages/config/redis.config';
import { ExtendedWebSocket } from '../../../../packages/types/index';
import { subscribeClient, unsubscribeClient, broadcastToChannels, jobSubscrptions } from './subscription.manager';


const redis = createRedisClient();

export function createWebSocketServer(server : http.Server){
	const wss = new WebSocketServer({ server, path: '/ws' });
	wss.on('connection', (ws: ExtendedWebSocket) => {
		console.log('Client connected to WebSocket on /ws');
		ws.isAlive = true;
		ws.on('message', async (message) => {
			try{
				const parsedMessage = JSON.parse(message.toString());
				const type = parsedMessage.type;
				const jobId = parsedMessage.jobId;
				if(type === 'SUBSCRIBE' && jobId){
					console.log(`Client subscribed to jobId ${jobId}`);
					const logs = await redis.lrange(`job:${jobId}:logs`, 0, -1);
					logs.reverse();
					for(const log of logs){
						ws.send(log);
					}
					console.log(`Sent last 100 logs for jobId ${jobId} to client`);
					subscribeClient(jobId, ws);
					await redis.subscribe(`job:${jobId}`, (err, count) => {
						if (err) {
							console.error('Failed to subscribe to Redis channel:', err);
						}
					});
				}
			}
			catch(error){
				console.error('Error processing message:', error);
			}
		});

		ws.on('pong', () => {
			ws.isAlive = true;
		});

		ws.on('close', () => {
			unsubscribeClient(ws);
			console.log('WS client disconnected');
		});
	});

	const heartbeat = setInterval(()=>{
		jobSubscrptions.forEach((clients) => {
			for(const ws of clients){
				const socket = ws as ExtendedWebSocket;
				if(!socket.isAlive){
					socket.terminate();
				}
				socket.isAlive = false;
				socket.ping();
			}
		});
	}, 30000);

	redis.on('message', async (channel, message) => {
    	console.log(`Received message from Redis channel ${channel}: ${message}`);
		broadcastToChannels(channel, message);
		try{
			const parsedMessage = JSON.parse(message);
			if(parsedMessage.type === 'DONE'){
				console.log(`Job ${channel} completed with result: ${message}`);
				await redis.unsubscribe(channel);
				console.log(`Unsubscribed from Redis channel ${channel}`);
				jobSubscrptions.delete(channel);
				console.log(`Deleted job subscription for channel ${channel}`);
			}
		}
		catch(error){
			console.error('Error processing Redis message:', error);
		}
	});

	return wss;
}









