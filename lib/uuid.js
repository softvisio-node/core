import crypto from "node:crypto";

export default uuidV4;

export function uuidV4 () {
    return crypto.randomUUID();
}
