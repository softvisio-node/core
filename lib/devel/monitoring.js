import MonitoringMark from "#lib/devel/monitoring/mark";
import { createState, createStateSync } from "#lib/devel/monitoring/state";

export default class Monitoring {
    #hasCpu;
    #hasRam;
    #hasHdd;
    #hddPath;
    #state;

    constructor ( { cpu, ram, hdd, hddPath } = {} ) {
        this.#hasCpu = !!cpu;
        this.#hasRam = !!ram;
        this.#hasHdd = !!hdd;

        if ( this.#hasHdd ) {
            this.#hddPath = hddPath || ".";
        }

        this.#state = this.#createStateSync();
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
        const state = await this.#createState();

        const mark = new MonitoringMark( this.#state, state );

        this.#state = state;

        return mark;
    }

    markSync () {
        const state = this.#createStateSync();

        const mark = new MonitoringMark( this.#state, state );

        this.#state = state;

        return mark;
    }

    // private
    #createState () {
        return createState( {
            "cpu": this.#hasCpu,
            "ram": this.#hasRam,
            "hdd": this.#hasHdd,
            "hddPath": this.#hddPath,
        } );
    }

    #createStateSync () {
        return createStateSync( {
            "cpu": this.#hasCpu,
            "ram": this.#hasRam,
            "hdd": this.#hasHdd,
            "hddPath": this.#hddPath,
        } );
    }
}
