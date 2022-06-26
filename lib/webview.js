import Events from "node:events";
import childProcess from "node:child_process";
import fs from "node:fs";

const BROWSER_LOCATIONS = {
    "win32": [

        //
        process.env["LocalAppData"] + "/Google/Chrome/Application/chrome.exe",
        process.env["ProgramFiles(x86)"] + "/Google/Chrome/Application/chrome.exe",
        process.env["ProgramFiles"] + "/Google/Chrome/Application/chrome.exe",
        process.env["ProgramFiles(x86)"] + "/Microsoft/Edge/Application/msedge.exe",
    ],
    "linux": [

        //
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
    ],
    "darwin": [

        //
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
    ],
};

export default class WebView extends Events {
    static #browserPath;
    #proc;

    constructor ( url, { title, width, height, maximized = true, signal, dataDir } = {} ) {
        super();

        if ( !( url instanceof URL ) ) url = new URL( url );

        if ( !this.constructor.browserPath ) throw Error( `No chromium compatible browser found` );

        const args = [

            //
            "--new-window",
            "--no-first-run",
            ...( dataDir ? [`--user-data-dir=${dataDir}`] : [] ),
            "--app=" + url,
        ];

        if ( width || height ) {
            args.push( `--window-size=${width || 100000},${height || 100000}` );
        }
        else if ( maximized ) {
            args.push( "--start-maximized" );
        }

        this.#proc = childProcess
            .spawn( this.constructor.browserPath, args, {
                "stdio": "ignore",
                signal,
            } )
            .once( "error", e => {
                if ( e.code !== "ABORT_ERR" ) throw e;
            } )
            .once( "close", () => {
                this.#proc = null;

                this.emit( "close" );
            } );
    }

    // static
    static get browserPath () {
        if ( this.#browserPath === undefined ) {
            this.#browserPath = null;

            for ( const location of BROWSER_LOCATIONS[process.platform] ) {
                if ( fs.existsSync( location ) ) {
                    this.#browserPath = location;

                    break;
                }
            }
        }

        return this.#browserPath;
    }

    // properties
    isStarted () {
        return !!this.#proc;
    }

    close () {
        if ( !this.#proc ) return;
        this.#proc.kill();

        this.#proc = null;
    }

    #checkWindowsNetIsolation () {
        const stdout = childProcess.execFileSync( "checknetisolation.exe", ["LoopbackExempt", "-s"], {
            "windowsHide": true,
            "encoding": "utf8",
        } );

        return stdout.includes( "microsoft.win32webviewhost_cw5n1h2txyewy" );
    }
}
