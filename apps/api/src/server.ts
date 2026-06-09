import app from './app';
import http from 'http';
import { createWebSocketServer } from './ws/websocket.server';
const server = http.createServer(app);
const PORT = process.env.PORT_API || 3000;
createWebSocketServer(server);

server.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
});

export default server;