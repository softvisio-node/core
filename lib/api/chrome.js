const child_process = require( "child_process" );
const fs = require( "../fs" );
const util = require( "../util" );
const fetch = require( "node-fetch" );
const Tab = require( "./chrome/tab" );

// https://chromedevtools.github.io/devtools-protocol/tot/
// https://peter.sh/experiments/chromium-command-line-switches/

const DEFAULT_ARGS = {
    "--disable-background-networking": null,
    "--disable-client-side-phishing-detection": null,
    "--disable-component-update": null,
    "--disable-hang-monitor": null,
    "--disable-prompt-on-repost": null,
    "--disable-sync": null,
    "--disable-web-resources": null,

    "--start-maximized": null,
    "--window-size=1280x720": null,

    "--disable-default-apps": null,
    "--no-default-browser-check": null,
    "--no-first-run": null,
    "--disable-infobars": null,
    "--disable-popup-blocking": null,
    "--disable-web-security": null,
    "--allow-running-insecure-content": null,

    // required to run under docker
    "--no-sandbox": null,

    // logging
    // "--disable-logging": null,
    // "--log-level=0": null,
};

class Chrome {
    host;
    port;

    #bin = process.palatform === "win32" ? process.env["ProgramFiles(x86)"] + "/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome";
    #profilePath;
    #proxyServer;

    #chrome;

    async run ( options = {} ) {
        if ( options.bin ) this.#bin = options.bin;

        this.#profilePath = options.profilePath || fs.tmp.dir();

        const listen = new URL( options.listen || "tcp://127.0.0.1" );

        this.host = listen.host;
        this.port = listen.port || ( await util.getRandomFreePort( "127.0.0.1" ) );

        const args = {
            ...DEFAULT_ARGS,

            "--remote-debugging-address": this.host,
            "--remote-debugging-port": this.port,

            // TODO socks currently may not work with http:80 requests
            // $self->{proxy} ? qq[--proxy-server="socks5://$self->{_proxy_server}->{listen}->{host_port}"] : (),
            // $self->{proxy} ? qq[--proxy-server="$self->{_proxy_server}->{listen}->{host_port}"] : (),

            // set user profile dir
            "--user-data-dir": this.#profilePath.toString(),

            ...( options.args || {} ),

            // open "about:blank" by default
            // 'about:blank',
        };

        // user argent
        if ( options.userAgent ) args["--user-agent"] = options.userAgent;

        // headless
        if ( options.headless || process.platform !== "win32" ) {
            args["--headless"] = null;
            args["--disable-gpu"] = null;
        }

        this.#chrome = child_process.spawn( this.#bin,
            Object.keys( args ).map( key => key + ( args[key] == null ? "" : "=" + args[key] ) ),
            { "stdio": "inherit", "shell": true } );

        this.#chrome.on( "exit", () => {
            this.destroy();
        } );

        return this;
    }

    async connect ( host, port ) {
        while ( 1 ) {
            if ( !( await util.portIsFree( port || this.port, host || this.host ) ) ) break;

            await util.sleep( 100 );
        }

        return this;
    }

    destroy () {
        if ( this.#profilePath && this.#profilePath.unlinkSync ) this.#profilePath.unlinkSync();
    }

    async getTabs () {
        const res = await fetch( `http://${this.host}:${this.port}/json` );

        const json = await res.json();

        return json.map( tab => new Tab( tab ) );
    }

    async openTab ( url ) {
        const res = await fetch( `http://${this.host}:${this.port}/json/new?` + ( url || "about:blank" ) );

        const json = await res.json();

        return new Tab( json );
    }

    setProxy ( proxy ) {
        if ( this.#proxyServer ) {
            this.#proxyServer.setProxy( proxy );

            return true;
        }
    }
}

module.exports.run = async function ( options = {} ) {
    const chrome = new Chrome();

    await chrome.run( options );

    return chrome.connect();
};

module.exports.connect = async function ( host, port ) {
    const chrome = new Chrome();

    return chrome.connect( host, port );
};
