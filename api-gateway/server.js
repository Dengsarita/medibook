require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
// Note: no express.json() here, so the request body passes through to the services untouched.

const targets = {
    register: process.env.REGISTRATION_URL,
    login: process.env.LOGIN_URL,
    doctors: process.env.DOCTOR_URL,
    appointments: process.env.APPOINTMENT_URL
};

// One proxy per service
const proxies = {};
for (const [name, target] of Object.entries(targets)) {
    proxies[name] = createProxyMiddleware({
        target,
        changeOrigin: true,
        on: {
            error: (err, req, res) => {
                if (res.writeHead) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: name + ' service unavailable' }));
                }
            }
        }
    });
}

// Access rules: which method + path is public, and which roles may use it
const rules = [
    { method: 'POST', path: /^\/api\/register$/, public: true, service: 'register' },
    { method: 'POST', path: /^\/api\/register\/admin$/, roles: ['admin'], service: 'register' },
    { method: 'POST', path: /^\/api\/login$/, public: true, service: 'login' },
    { method: 'GET', path: /^\/api\/me$/, roles: ['admin', 'patient'], service: 'login' },

    { method: 'GET', path: /^\/api\/doctors$/, roles: ['admin', 'patient'], service: 'doctors' },
    { method: 'GET', path: /^\/api\/doctors\/[^/]+$/, roles: ['admin', 'patient'], service: 'doctors' },
    { method: 'POST', path: /^\/api\/doctors$/, roles: ['admin'], service: 'doctors' },
    { method: 'PUT', path: /^\/api\/doctors\/[^/]+$/, roles: ['admin'], service: 'doctors' },
    { method: 'DELETE', path: /^\/api\/doctors\/[^/]+$/, roles: ['admin'], service: 'doctors' },

    { method: 'POST', path: /^\/api\/appointments$/, roles: ['patient'], service: 'appointments' },
    { method: 'GET', path: /^\/api\/appointments\/my$/, roles: ['patient'], service: 'appointments' },
    { method: 'GET', path: /^\/api\/appointments$/, roles: ['admin'], service: 'appointments' },
    { method: 'PUT', path: /^\/api\/appointments\/[^/]+\/status$/, roles: ['admin'], service: 'appointments' },
    { method: 'DELETE', path: /^\/api\/appointments\/[^/]+$/, roles: ['admin', 'patient'], service: 'appointments' }
];

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

app.use((req, res, next) => {
    // Never trust identity headers sent by the client
    delete req.headers['x-user-id'];
    delete req.headers['x-user-role'];

    const rule = rules.find(r => r.method === req.method && r.path.test(req.path));
    if (!rule) return res.status(404).json({ message: 'Route not found' });

    if (!rule.public) {
        const [scheme, token] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Token required' });
        }
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            if (!rule.roles.includes(payload.role)) {
                return res.status(403).json({ message: 'Forbidden: your role cannot use this API' });
            }
            // Identity from the verified token, trusted by the services behind the gateway
            req.headers['x-user-id'] = payload.id;
            req.headers['x-user-role'] = payload.role;
        } catch (err) {
            const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
            return res.status(401).json({ message });
        }
    }

    return proxies[rule.service](req, res, next);
});

app.listen(process.env.PORT, () => console.log('API Gateway on port ' + process.env.PORT));