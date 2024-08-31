import Locale from "#lib/locale";
import fs from "node:fs";
import os from "node:os";

const ramTotal = os.totalmem();

const locale = new Locale();

class DevelMonitoringMark {
    #start;
    #end;
    #duration;

    #hasCpu;
    #cpuUsed;

    #hasMemory;
    #ramTotal;
    #ramFree;
    #ramFreePercent;
    #ramFreeDelta;
    #ramUsed;
    #ramUsedPercent;
    #ramUsedDelta;

    #rssUsed;
    #rssUsedPercent;
    #rssUsedDelta;

    #hasHdd;
    #hddTotal;
    #hddFree;
    #hddFreePercent;
    #hddFreeDelta;
    #hddUsed;
    #hddUsedPercent;
    #hddUsedDelta;

    #toString;

    constructor ( previousSnapshot, currentSnapshot ) {
        this.#start = previousSnapshot.date;
        this.#end = currentSnapshot.date;
        this.#duration = Number( currentSnapshot.time - previousSnapshot.time ) / 1_000_000;

        // cpu
        if ( currentSnapshot.cpu != null ) {
            this.#hasCpu = true;

            this.#cpuUsed = 1 - ( currentSnapshot.cpu.idle - previousSnapshot.cpu.idle ) / ( currentSnapshot.cpu.total - previousSnapshot.cpu.total );
        }

        // memory
        if ( currentSnapshot.ramTotal != null ) {
            this.#hasMemory = true;

            this.#ramTotal = currentSnapshot.ramTotal;

            this.#ramFree = currentSnapshot.ramFree;
            this.#ramFreePercent = this.#ramFree / this.#ramTotal;
            this.#ramFreeDelta = currentSnapshot.ramFree - previousSnapshot.ramFree;

            this.#ramUsed = this.#ramTotal - this.#ramFree;
            this.#ramUsedPercent = this.#ramUsed / this.#ramTotal;
            this.#ramUsedDelta = this.#ramUsed - ( previousSnapshot.ramTotal - previousSnapshot.ramFree );

            this.#rssUsed = currentSnapshot.rssUsed;
            this.#rssUsedPercent = this.#rssUsed / this.#ramTotal;
            this.#rssUsedDelta = currentSnapshot.rssUsed - previousSnapshot.rssUsed;
        }

        // hdd
        if ( currentSnapshot.hddTotal != null ) {
            this.#hasHdd = true;

            this.#hddTotal = currentSnapshot.hddTotal;

            this.#hddFree = currentSnapshot.hddFree;
            this.#hddFreePercent = this.#hddFree / this.#hddTotal;
            this.#hddFreeDelta = currentSnapshot.hddFree - previousSnapshot.hddFree;

            this.#hddUsed = this.#hddTotal - this.#hddFree;
            this.#hddUsedPercent = this.#hddUsed / this.#hddTotal;
            this.#hddUsedDelta = this.#hddUsed - ( previousSnapshot.hddTotal - previousSnapshot.hddFree );
        }
    }

    // properties
    get hasCpu () {
        return this.#hasCpu;
    }

    get hasMemory () {
        return this.#hasMemory;
    }

    hasHdd () {
        return this.#hasHdd;
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

    get cpuUsed () {
        return this.#cpuUsed;
    }

    get ramTotal () {
        return this.#ramTotal;
    }

    get ramFree () {
        return this.#ramFree;
    }

    get ramFreePercent () {
        return this.#ramFreePercent;
    }

    get ramFreeDelta () {
        return this.#ramFreeDelta;
    }

    get ramUsed () {
        return this.#ramUsed;
    }

    get ramUsedPercent () {
        return this.#ramUsedPercent;
    }

    get ramUsedDelta () {
        return this.#ramUsedDelta;
    }

    get rssUsed () {
        return this.#rssUsed;
    }

    get rssUsedPercent () {
        return this.#rssUsedPercent;
    }

    get rssUsedDelta () {
        return this.#rssUsedDelta;
    }

    get hddTotal () {
        return this.#hddTotal;
    }

    get hddFree () {
        return this.#hddFree;
    }

    get hddFreePercent () {
        return this.#hddFreePercent;
    }

    get hddFreeDelta () {
        return this.#hddFreeDelta;
    }

    get hddUsed () {
        return this.#hddUsed;
    }

    get hddUsedPercent () {
        return this.#hddUsedPercent;
    }

    get hddUsedDelta () {
        return this.#hddUsedDelta;
    }

    // public
    toString () {
        if ( !this.#toString ) {
            this.#toString = `duration: ${ locale.formatDuration( this.#duration ) }`;

            if ( this.#hasCpu ) {
                this.#toString += `\ncpu usage: ${ locale.formatPercent( this.#cpuUsed ) }}`;
            }

            if ( this.#hasMemory ) {
                this.#toString += `\nrss memory: ${ locale.formatDigitalSize( this.#rssUsed ) }, rss memory delta: ${ locale.formatDigitalSize( this.#rssUsedDelta, "signDisplay:always" ) }`;
            }

            if ( this.#hasHdd ) {
                this.#toString += `\nhdd total: ${ locale.formatDigitalSize( this.#hddTotal ) }, hdd free: ${ locale.formatDigitalSize( this.#hddFree ) }, hdd free delta: ${ locale.formatDigitalSize( this.#hddFreeDelta, "signDisplay:always" ) }`;
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
            json.cpuUsed = this.#cpuUsed;
        }

        if ( this.#hasMemory ) {
            json.ramTotal = this.#ramTotal;

            json.ramFree = this.#ramFree;
            json.ramFreePercent = this.#ramFreePercent;
            json.ramFreeDelta = this.#ramFreeDelta;

            json.ramUsed = this.#ramUsed;
            json.ramUsedPercent = this.#ramUsedPercent;
            json.ramUsedDelta = this.#ramUsedDelta;

            json.rssUsed = this.#rssUsed;
            json.rssUsedPercent = this.#rssUsedPercent;
            json.rssUsedDelta = this.#rssUsedDelta;
        }

        if ( this.#hasHdd ) {
            json.hddTotal = this.#hddTotal;

            json.hddFree = this.#hddFree;
            json.hddFreePercent = this.#hddFreePercent;
            json.hddFreeDelta = this.#hddFreeDelta;

            json.hddUsed = this.#hddUsed;
            json.hddUsedPercent = this.#hddUsedPercent;
            json.hddUsedDelta = this.#hddUsedDelta;
        }

        return json;
    }
}

export default class Monitoring {
    #hasCpu;
    #hasMemory;
    #hasHdd;
    #fsPath;
    #snapshot;

    constructor ( { cpu, memory, hdd, fsPath } = {} ) {
        this.#hasCpu = !!cpu;
        this.#hasMemory = !!memory;
        this.#hasHdd = !!hdd;

        if ( this.#hasHdd ) {
            this.#fsPath = fsPath || ".";
        }

        this.#snapshot = this.#getSnapshot();
    }

    // properties
    get hasCpu () {
        return this.#hasCpu;
    }

    get hasMemory () {
        return this.#hasMemory;
    }

    get hasHdd () {
        return this.#hasHdd;
    }

    get fsPath () {
        return this.#fsPath;
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
            snapshot.cpu = this.#getCpuUsage();
        }

        if ( this.hasMemory ) {
            snapshot.ramTotal = ramTotal;
            snapshot.ramFree = os.freemem();
            snapshot.rssUsed = process.memoryUsage.rss();
        }

        if ( this.hasHdd ) {
            const stat = fs.statfsSync( this.#fsPath );

            snapshot.hddTotal = stat.blocks * stat.bsize;
            snapshot.hddFree = stat.bfree * stat.bsize;
        }

        return snapshot;
    }

    #getCpuUsage () {
        var user = 0,
            nice = 0,
            system = 0,
            idle = 0,
            irq = 0,
            total = 0;

        const cpus = os.cpus();

        for ( var cpu in cpus ) {
            user += cpus[ cpu ].times.user;
            nice += cpus[ cpu ].times.nice;
            system += cpus[ cpu ].times.sys;
            irq += cpus[ cpu ].times.irq;
            idle += cpus[ cpu ].times.idle;
        }

        total = user + nice + system + idle + irq;

        return {
            user,
            system,
            nice,
            irq,
            "idle": idle,
            "total": total,
        };
    }
}
