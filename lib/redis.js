import redis from "redis";

export default class Redis {
    constructor ( ...args ) {
        // eslint-disable-next-line no-constructor-return
        return redis.createClient( ...args );
    }
}
