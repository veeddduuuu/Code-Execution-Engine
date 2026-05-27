import {WebSocket} from 'ws';

export const jobSubscrptions = new Map<string, Set<WebSocket>>();

export const subscribeClient = (jobId : string, ws : WebSocket) => {
	const channel = `job:${jobId}`;
	if(!jobSubscrptions.has(channel)){
		jobSubscrptions.set(channel, new Set());
	}
	jobSubscrptions.get(channel)?.add(ws);
	ws.send(JSON.stringify({ message: `Subscribed to jobId ${jobId}` }));
}

export const unsubscribeClient = (ws : WebSocket) => {
	for(const [channel, clients] of jobSubscrptions.entries()){
		if(clients.has(ws)){
			clients.delete(ws);
			if(clients.size === 0){
				jobSubscrptions.delete(channel);
			}
		}
	}
	console.log(`Client unsubscribed from all channels`);
}

export function broadcastToChannels(channel : string, message : string){
	const clients = jobSubscrptions.get(channel);
	if(!clients){
		return;
	}
	for(const client of clients){
		client.send(JSON.stringify({ message }));
	}
}
