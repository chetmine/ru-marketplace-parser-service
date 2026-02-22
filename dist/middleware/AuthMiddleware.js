"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthMiddleware {
    middleware(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const token = authHeader.substring(7);
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // @ts-ignore
            req.role = decoded.role;
            next();
        }
        catch (e) {
            if (e instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                res.status(401).json({ error: 'Invalid token.' });
                return;
            }
            if (e instanceof jsonwebtoken_1.default.TokenExpiredError) {
                res.status(401).json({ error: 'Token expired.' });
                return;
            }
            res.status(500).json({ error: 'Authentication error.' });
        }
    }
}
exports.default = AuthMiddleware;
