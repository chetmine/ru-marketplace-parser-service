import winston, {createLogger} from "winston";

export const loggerFactory = (context: any) => {
    const className = context?.constructor?.name || 'Unknown?';

    return createLogger({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} ${level}: [${className}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
            })
        ),
        transports: [new winston.transports.Console()]
    })
}