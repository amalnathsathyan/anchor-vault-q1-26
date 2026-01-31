//fix for intelMacOs issue as described in 
//https://github.com/anza-xyz/agave/issues/8134#issuecomment-3757553817

const net = require('net');
const tls = require('tls');

const TARGET_HOST = 'api.devnet.solana.com';
const TARGET_PORT = 443;
const LOCAL_PORT = 8899;
const UPSTREAM_PROXY_HOST = '127.0.0.1';
const UPSTREAM_PROXY_PORT = 7890;

const server = net.createServer((clientSocket) => { 
let remoteSocket = null; 
let isConnected = false; 

clientSocket.on('data', (chunk) => { 
if (!isConnected) { 
const rawContent = chunk.toString('utf8'); 
const lines = rawContent.split(/\r?\n/); 

// --- 1. CLEAN & FIX HEADERS --- 
if (lines[0].startsWith('POST')) { 
const parts = lines[0].trim().split(' '); 
// Force the first line to: "POST / HTTP/1.1" 
// parts[1] is the path (usually /), parts[2] is the missing protocol 
lines[0] = `POST ${parts[1] || '/'} HTTP/1.1`; 
} 

// Update Host header and filter out empty lines/old host 
const newHeaders = lines.map(line => { 
if (line.toLowerCase().startsWith('host:')) { 
return `Host: ${TARGET_HOST}`; 
} 
if (line.toLowerCase().startsWith('connection:')) { 
return 'Connection: close'; // Avoid keep-alive issues in the proxy 
} 
return line; 
}); 

const patchedRequest = newHeaders.join('\r\n'); 

// --- 2. CONNECT THROUGH VPN PROXY --- 
const proxySocket = net.connect(UPSTREAM_PROXY_PORT, UPSTREAM_PROXY_HOST, () => { 
proxySocket.write(`CONNECT ${TARGET_HOST}:${TARGET_PORT} HTTP/1.1\r\nHost: ${TARGET_HOST}\r\n\r\n`); 
}); 

proxySocket.once('data', (proxyResponse) => { 
const responseStr = proxyResponse.toString(); 
if (responseStr.includes('200')) { 
// --- 3. TLS UPGRADE --- 
remoteSocket = tls.connect({ 
socket: proxySocket, 
servername: TARGET_HOST, 
rejectUnauthorized: false 
}, () => { 
console.log('✨ Header Patched & Sent to RPC', patchedRequest); 
remoteSocket.write(patchedRequest); 
isConnected = true; 
}); 

remoteSocket.on('data', (data) => clientSocket.write(data)); 
remoteSocket.on('error', (e) => console.error('Remote Error:', e.message)); 
remoteSocket.on('end', () => clientSocket.end()); 
} else { 
console.error('❌ VPN Proxy rejected the CONNECT request:', responseStr.split('\n')[0]); 
} 
}); 

proxySocket.on('error', (e) => console.error('Proxy Socket Error:', e.message)); 

} else if (remoteSocket) { 
remoteSocket.write(chunk); 
} 
}); 

clientSocket.on('error', (e) => console.error('Client Socket Error:', e.message));
});

server.listen(LOCAL_PORT, '127.0.0.1', () => { 
console.log(`🚀 Fixer v3 listening on http://127.0.0.1:${LOCAL_PORT}`); 
console.log(`📡 Chaining through VPN proxy at ${UPSTREAM_PROXY_PORT}`);
});
