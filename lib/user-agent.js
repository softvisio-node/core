import { UAParser } from "ua-parser-js";
import { isAIBot, isBot, isChromeFamily } from "ua-parser-js/helpers";

export default class UserAgent {
    #ua;
    #device;
    #os;
    #isBot;
    #isAiBot;
    #isChromeFamily;

    constructor ( ua ) {
        if ( !ua || typeof ua === "string" ) {
            this.#ua = UAParser( {
                "user-agent": ua,
            } );
        }
        else if ( ua[ "user-agent" ] ) {
            this.#ua = UAParser( ua ).withClientHints();
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
        return this.#ua.browser?.name;
    }

    get browserVersion () {
        return this.#ua.browser?.version;
    }

    get browserMajorVersion () {
        return this.#ua.browser?.major;
    }

    get engineName () {
        return this.#ua.engine?.name;
    }

    get engineVersion () {
        return this.#ua.engine?.version;
    }

    get osName () {
        return this.#ua.os?.name;
    }

    get osVersion () {
        return this.#ua.os?.version;
    }

    get deviceType () {
        return this.#ua.device?.type;
    }

    get deviceVendor () {
        return this.#ua.device?.vendor;
    }

    get deviceModel () {
        return this.#ua.device?.model;
    }

    get cpuArchitecture () {
        return this.#ua.cpu?.architecture;
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

    get isBot () {
        this.#isBot ??= isBot( this.userAgent );

        return this.#isBot;
    }

    get isAiBot () {
        this.#isAiBot ??= isAIBot( this.userAgent );

        return this.#isAiBot;
    }

    get isChromeFamily () {
        this.#isChromeFamily ??= isChromeFamily( this.userAgent );

        return this.#isChromeFamily;
    }

    // public
    toString () {
        return this.userAgent;
    }

    toJSON () {
        return this.#ua;
    }
}
