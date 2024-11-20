import { UAParser } from "ua-parser-js";
import * as defaultExtensions from "ua-parser-js/extensions";
import { isAIBot, isBot, isChromeFamily } from "ua-parser-js/helpers";

export default class UserAgent {
    #ua;
    #browser;
    #engine;
    #device;
    #os;
    #isBot;
    #isAiBot;
    #isChromeFamily;

    constructor ( ua, { extensions = true, withClientHints } = {} ) {
        if ( extensions === true ) {
            extensions = defaultExtensions;
        }

        // from string
        if ( !ua || typeof ua === "string" ) {
            this.#ua = UAParser( ua, extensions );
        }

        // from headers
        else if ( ua[ "user-agent" ] ) {
            this.#ua = UAParser( extensions, ua );
        }

        // from json
        else {
            this.#ua = UAParser( ua.ua, extensions );
        }

        if ( withClientHints && !this.#ua.browser.type ) {
            this.#ua = this.#ua.withClientHints();
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

    get browser () {
        if ( this.#browser === undefined ) {
            this.#browser = null;

            if ( this.browserName ) {
                this.#browser = this.browserName;

                if ( this.browserVersion ) this.#browser += " " + this.browserVersion;
            }
        }

        return this.#browser;
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

    get browserType () {
        return this.#ua.browser?.type;
    }

    get engine () {
        if ( this.#engine === undefined ) {
            this.#engine = null;

            if ( this.engineName ) {
                this.#engine = this.engineName;

                if ( this.engineVersion ) this.#engine += " " + this.engineVersion;
            }
        }

        return this.#engine;
    }

    get engineName () {
        return this.#ua.engine?.name;
    }

    get engineVersion () {
        return this.#ua.engine?.version;
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

    get osName () {
        return this.#ua.os?.name;
    }

    get osVersion () {
        return this.#ua.os?.version;
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

    get isBot () {
        this.#isBot ??= isBot( this.#ua );

        return this.#isBot;
    }

    get isAiBot () {
        this.#isAiBot ??= isAIBot( this.#ua );

        return this.#isAiBot;
    }

    get isChromeFamily () {
        this.#isChromeFamily ??= isChromeFamily( this.#ua );

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
