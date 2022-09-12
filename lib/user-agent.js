import parseUserAgent from "ua-parser-js";

export default class UserAgent {
    #ua;
    #device;
    #os;

    constructor ( ua ) {
        if ( typeof ua === "string" ) {
            this.#ua = parseUserAgent( ua );
        }
        else {
            this.#ua = ua;
        }
    }

    // static
    static new ( ua ) {
        if ( ua instanceof UserAgent ) return ua;

        return new this( ua );
    }

    // properties
    get userAgent () {
        return this.#ua.ua;
    }

    get browserName () {
        return this.#ua.browser.name;
    }

    get browserVersion () {
        return this.#ua.browser.version;
    }

    get browserMajor () {
        return this.#ua.browser.majoe;
    }

    get engineName () {
        return this.#ua.engine.name;
    }

    get engineVersion () {
        return this.#ua.engine.version;
    }

    get osName () {
        return this.#ua.os.name;
    }

    get osVersion () {
        return this.#ua.os.version;
    }

    get deviceType () {
        return this.#ua.device.type;
    }

    get deviceVendor () {
        return this.#ua.device.vendor;
    }

    get deviceModel () {
        return this.#ua.device.model;
    }

    get cpuArchitecture () {
        return this.#ua.cpu.architecture;
    }

    get device () {
        if ( this.#device === undefined ) {
            this.#device = null;

            if ( this.deviceVendor ) {
                this.#device = this.deviceVendor;

                if ( this.deviceModel ) this.#device += " " + this.deviceModel;
            }
        }

        return this.#device;
    }

    get os () {
        if ( this.#os === undefined ) {
            this.#os = null;

            if ( this.osName ) {
                this.#os = this.osName;

                if ( this.osVersion ) this.#os += " " + this.osVersion;
            }
        }

        return this.#os;
    }

    // public
    toString () {
        return this.userAgent;
    }

    toJSON () {
        return this.#ua;
    }
}
