import crypto from "node:crypto";

export function v4 () {
    return crypto.randomUUID();
}
