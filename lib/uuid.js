import crypto from "crypto";

export function v4 () {
    return crypto.randomUUID();
}
