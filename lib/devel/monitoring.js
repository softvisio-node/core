import Locale from "#lib/locale";
import fs from "node:fs";
import os from "node:os";

const memoryTotal = os.totalmem();

const locale = new Locale();

class DevelMonitoringMark {
    #start;
    #end;
    #duration;

    #hasCpu;
    #cpuUser;
    #cpuUserDelta;
    #cpuSystem;
    #cpuSystemDelta;

    #hasMemory;
    #memoryTotal;
    #memoryFree;
    #memoryFreeDelta;
    #memoryRss;
    #memoryRssDelta;

    #hasFs;
    #fsTotal;
    #fsFree;
    #fsFreeDelta;

    #toString;

    constructor ( snapshot1, snapshot2 ) {
        this.#start = snapshot1.date;
        this.#end = snapshot2.date;
        this.#duration = Number( snapshot2.time - snapshot1.time ) / 1_000_000;

        // cpu
        if ( snapshot1.cpu != null ) {
            this.#hasCpu = true;

            this.#cpuUser = snapshot2.cpu.user;
            this.#cpuUserDelta = snapshot2.cpu.user - snapshot1.cpu.user;

            this.#cpuSystem = snapshot2.cpu.system;
            this.#cpuSystemDelta = snapshot2.cpu.system - snapshot1.cpu.system;
        }

        // memory
        if ( snapshot1.memoryTotal != null ) {
            this.#hasMemory = true;

            this.#memoryTotal = snapshot2.memoryTotal;
            this.#memoryFree = snapshot2.memoryFree;
            this.#memoryFreeDelta = snapshot2.memoryFree - snapshot1.memoryFree;

            this.#memoryRss = snapshot2.memoryRss;
            this.#memoryRssDelta = snapshot2.memoryRss - snapshot1.memoryRss;
        }

        // fs
        if ( snapshot1.fsTotal != null ) {
            this.#hasFs = true;

            this.#fsTotal = snapshot2.fsTotal;
            this.#fsFree = snapshot2.fsFree;
            this.#fsFreeDelta = snapshot2.fsFree - snapshot1.fsFree;
        }
    }

    // properties
    get hasCpu () {
        return this.#hasCpu;
    }

    get hasMemory () {
        return this.#hasMemory;
    }

    hasFs () {
        return this.#hasFs;
    }

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

    get cpuUserDelta () {
        return this.#cpuUserDelta;
    }

    get cpuSystem () {
        return this.#cpuSystem;
    }

    get cpuSystemDelta () {
        return this.#cpuSystemDelta;
    }

    get memoryTotal () {
        return this.#memoryTotal;
    }

    get memoryFree () {
        return this.#memoryFree;
    }

    get memoryFreeDelta () {
        return this.#memoryFreeDelta;
    }

    get memoryRss () {
        return this.#memoryRss;
    }

    get memoryRssDelta () {
        return this.#memoryRssDelta;
    }

    get fsTotal () {
        return this.#fsTotal;
    }

    get fsFree () {
        return this.#fsFree;
    }

    get fsFreeDelta () {
        return this.#fsFreeDelta;
    }

    // public
    toString () {
        if ( !this.#toString ) {
            this.#toString = `duration: ${locale.formatDuration( this.#duration )}`;

            if ( this.#hasCpu ) {
                this.#toString += `\ncpu user delta: ${locale.formatNumber( this.#cpuUserDelta, "signDisplay:always" )}, cpu system delta: ${locale.formatNumber( this.#cpuSystemDelta, "signDisplay:always" )}`;
            }

            if ( this.#hasMemory ) {
                this.#toString += `\nrss memory: ${locale.formatDigitalSize( this.#memoryRss )}, rss memory delta: ${locale.formatDigitalSize( this.#memoryRssDelta, "signDisplay:always" )}`;
            }

            if ( this.#hasFs ) {
                this.#toString += `\nfs total: ${locale.formatDigitalSize( this.#fsTotal )}, fs free: ${locale.formatDigitalSize( this.#fsFree )}, fs free delta: ${locale.formatDigitalSize( this.#fsFreeDelta, "signDisplay:always" )}`;
            }
        }

        return this.#toString;
    }

    toJSON () {
        const json = {
            "start": this.#start.toISOString(),
            "end": this.#end.toISOString(),
            "duration": this.#duration,
        };

        if ( this.#hasCpu ) {
            json.cpuUser = this.#cpuUser;
            json.cpuUserDelta = this.#cpuUserDelta;
            json.cpSystem = this.#cpuSystem;
            json.cpSystemDelta = this.#cpuSystemDelta;
        }

        if ( this.#hasMemory ) {
            json.memoryTotal = this.#memoryTotal;
            json.memoryFree = this.#memoryFree;
            json.memoryFreeDelta = this.#memoryFreeDelta;
            json.memoryRss = this.#memoryRss;
            json.memoryRssDelta = this.#memoryRssDelta;
        }

        if ( this.#hasFs ) {
            json.fsTotal = this.#fsTotal;
            json.fsFree = this.#fsFree;
            json.fsFreeDelta = this.#fsFreeDelta;
        }

        return json;
    }
}

export default class Monitoring {
    #hasCpu;
    #hasMemory;
    #hasFs;
    #snapshot;

    constructor ( { cpu, memory, fs } = {} ) {
        this.#hasCpu = !!cpu;
        this.#hasMemory = !!memory;
        this.#hasFs = !!fs;
        this.#snapshot = this.#getSnapshot();
    }

    // properties
    get hasCpu () {
        return this.#hasCpu;
    }

    get hasMemory () {
        return this.#hasMemory;
    }

    get hasFs () {
        return this.#hasFs;
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
        const snapshot = {
            "time": process.hrtime.bigint(),
            "date": new Date(),
        };

        if ( this.hasCpu ) {
            snapshot.cpu = process.cpuUsage();
        }

        if ( this.hasMemory ) {
            snapshot.memoryTotal = memoryTotal;
            snapshot.memoryFree = os.freemem();
            snapshot.memoryRss = process.memoryUsage.rss();
        }

        if ( this.hasFs ) {
            const stat = fs.statfsSync( "." );

            snapshot.fsTotal = stat.blocks * stat.bsize;
            snapshot.fsFree = stat.bfree * stat.bsize;
        }

        return snapshot;
    }
}
