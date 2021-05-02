import redis from "redis";

export default class Redis {
    connect ( ...args ) {
        return redis.createClient( ...args );
    }
}
