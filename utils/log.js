import Log from "../models/Log.js";


export const createLog = async ({
    user = null,
    source = "API",
    action,
    entity,
    entityId = null,
    status = "INFO",
    message = "",
    details = {},
    req = null,
}) => {
    try {
        await Log.create({
            user,
            source,
            action,
            entity,
            entityId,
            status,
            message,
            details,
            ipAddress: req?.ip,
            userAgent: req?.headers?.["user-agent"],
        });
    } catch (err) {
        console.error(":x: Failed to create log:", err.message);
    }
};