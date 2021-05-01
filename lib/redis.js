import redis from "redis";

export default function connect ( ...args ) {
    return redis.createClient( ...args );
}
