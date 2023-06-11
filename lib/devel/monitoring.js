import Locale from "#lib/locale";

const locale = new Locale();

class DevelMonitoringMark {
    #start;
    #end;
    #duration;
    #cpu;
    #cpuUser;
    #cpuUserDelta;
    #cpuSystem;
    #cpuSystemDelta;
    #memory1;
    #memory;
    #memoryDelta;

    constructor ( snapshot1, snapshot2 ) {
        this.#start = snapshot1.date;
        this.#end = snapshot2.date;
        this.#duration = Number( snapshot2.time - snapshot1.time );

        if ( snapshot1.cpu ) {
            this.#cpu = true;

            this.#cpuUser = snapshot2.cpu.user;
            this.#cpuUserDelta = snapshot2.cpu.user - snapshot1.cpu.user;

            this.#cpuSystem = snapshot2.cpu.system;
            this.#cpuSystemDelta = snapshot2.cpu.system - snapshot1.cpu.system;
        }

        if ( snapshot1.memory ) {
            this.#memory1 = true;

            this.#memory = snapshot1.memory;
            this.#memoryDelta = snapshot2.memory - snapshot1.memory;
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

    get memoryDelta () {
        return this.#memoryDelta;
    }

    // public
    toString () {
        var string = `duration: ${locale.formatNumber( this.#duration )}`;

        if ( this.#cpu ) string += `\ncpuUserDelta: ${locale.formatNumber( this.#cpuUserDelta )}, cpSystemDelta: ${locale.formatNumber( this.#cpuSystemDelta )}`;

        if ( this.#memory1 ) string += `\nmemory: ${locale.formatNumber( this.#memory )}, memoryDelta: ${locale.formatNumber( this.#memoryDelta )}`;

        return string;
    }

    toJSON () {
        return {
            "start": this.#start.toISOString(),
            "end": this.#end.toISOString(),
            "duration": this.#duration,
            "cpuUser": this.#cpuUser,
            "cpuUserDelta": this.#cpuUserDelta,
            "cpSystem": this.#cpuSystem,
            "cpSystemDelta": this.#cpuSystemDelta,
            "memory": this.#memory,
            "memoryDelta": this.#memoryDelta,
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
        const time = process.hrtime.bigint(),
            cpu = this.#cpu ? process.cpuUsage() : null;

        return {
            "date": new Date(),
            time,
            cpu,
            "memory": this.#memory ? process.memoryUsage.rss() : null,
        };
    }
}
