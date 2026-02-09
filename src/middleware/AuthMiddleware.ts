import {Response, Request, NextFunction} from "express";
import jwt from 'jsonwebtoken'

export default class AuthMiddleware {
    middleware(req: Request, res: Response, next: NextFunction) {
        try {

            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({error: 'Unauthorized'});
            }

            const token = authHeader.substring(7);

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
                role: string;
            };

            // @ts-ignore
            req.role = decoded.role;

            next();
        } catch (e: any) {
            if (e instanceof jwt.JsonWebTokenError) {
                res.status(401).json({ error: 'Invalid token.' });
                return;
            }

            if (e instanceof jwt.TokenExpiredError) {
                res.status(401).json({ error: 'Token expired.' });
                return;
            }

            res.status(500).json({ error: 'Authentication error.' });
        }
    }
}