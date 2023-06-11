class DevelMonitoringMark {
    #start;
    #end;
    #duration;
    #cpuUser;
    #cpuSystem;
    #memory;

    constructor ( snapshot1, snapshot2 ) {
        this.#start = snapshot1.start;
        this.#end = snapshot2.start;
        this.#duration = ( snapshot2.time - snapshot1.time ).toNumber();

        if ( snapshot1.cpu ) {
            this.#cpuUser = snapshot2.cpu.user - snapshot1.cpu.user;
            this.#cpuSystem = snapshot2.cpu.system - snapshot1.cpu.system;
        }

        if ( snapshot1.memory ) {
            this.#memory = snapshot2.memory - snapshot1.memory;
        }
    }

    // properties
    get start () {
        return this.#start;
    }

    get end () {
        return this.#end;
    }

    get duration () {
        return this.#duration;
    }

    get cpuUser () {
        return this.#cpuUser;
    }

    get cpuSystem () {
        return this.#cpuSystem;
    }

    get memory () {
        return this.#memory;
    }

    // public
    toString () {
        return JSON.stringify( this, null, 4 );
    }

    toJSON () {
        return {
            "start": this.#start.toISOString(),
            "end": this.#end.toISOString(),
            "duration": this.#duration,
            "cpuUser": this.#cpuUser,
            "cpSystem": this.#cpuSystem,
            "memory": this.#memory,
        };
    }
}

export default class Monitoring {
    #cpu;
    #memory;
    #snapshot;

    constructor ( { cpu, memory } = {} ) {
        this.#cpu = !!cpu;
        this.#memory = !!memory;
        this.#snapshot = this.#getSnapshot();
    }

    // public
    mark () {
        const snapshot = this.#getSnapshot();

        const mark = new DevelMonitoringMark( this.#snapshot, snapshot );

        this.#snapshot = snapshot;

        return mark;
    }

    // private
    #getSnapshot () {
        return {
            "date": new Date(),
            "time": process.hrtime.bigint(),
            "cpu": this.#cpu ? process.cpuUsage() : null,
            "memory": this.#memory ? process.memoryUsage.rss() : null,
        };
    }
}
