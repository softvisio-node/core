import fs from "node:fs";
import os from "node:os";
import MonitoringMark from "#lib/devel/monitoring/mark";

const ramTotal = os.totalmem();

export default class Monitoring {
    #hasCpu;
    #hasRam;
    #hasHdd;
    #hddPath;
    #snapshot;

    constructor ( { cpu, ram, hdd, hddPath } = {} ) {
        this.#hasCpu = !!cpu;
        this.#hasRam = !!ram;
        this.#hasHdd = !!hdd;

        if ( this.#hasHdd ) {
            this.#hddPath = hddPath || ".";
        }

        this.#snapshot = this.#getSnapshotSync();
    }

    // properties
    get hasCpu () {
        return this.#hasCpu;
    }

    get hasRam () {
        return this.#hasRam;
    }

    get hasHdd () {
        return this.#hasHdd;
    }

    get hddPath () {
        return this.#hddPath;
    }

    // public
    async mark () {
        const snapshot = await this.#getSnapshot();

        const mark = new MonitoringMark( this.#snapshot, snapshot );

        this.#snapshot = snapshot;

        return mark;
    }

    markSync () {
        const snapshot = this.#getSnapshotSync();

        const mark = new MonitoringMark( this.#snapshot, snapshot );

        this.#snapshot = snapshot;

        return mark;
    }

    // private
    #createSnapshot () {
        const snapshot = {
            "time": process.hrtime.bigint(),
            "date": new Date(),
        };

        if ( this.hasCpu ) {
            snapshot.cpu = this.#getCpuUsage();
        }

        if ( this.hasRam ) {
            snapshot.ramTotal = ramTotal;
            snapshot.ramFree = os.freemem();
            snapshot.rssUsed = process.memoryUsage.rss();
        }

        return snapshot;
    }

    async #getSnapshot () {
        const snapshot = this.#createSnapshot();

        if ( this.hasHdd ) {
            const stat = await fs.promises.statfs( this.#hddPath );

            snapshot.hddTotal = stat.blocks * stat.bsize;
            snapshot.hddFree = stat.bfree * stat.bsize;
        }

        return snapshot;
    }

    #getSnapshotSync () {
        const snapshot = this.#createSnapshot();

        if ( this.hasHdd ) {
            const stat = fs.statfsSync( this.#hddPath );

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
