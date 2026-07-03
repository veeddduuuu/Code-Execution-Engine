import {Pool} from "pg";
import dotenv from "dotenv";
import dns from "dns";

// Monkeypatch dns.lookup to force IPv4, bypassing Node 22 Happy Eyeballs bug on Alpine
const originalLookup = dns.lookup;
(dns as any).lookup = (hostname: string, options: any, callback: any) => {
    if (typeof options === 'function') {
        callback = options;
        options = { family: 4 };
    } else if (typeof options === 'object') {
        options.family = 4;
    } else {
        options = { family: 4 };
    }
    return originalLookup(hostname, options, callback);
};

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});


