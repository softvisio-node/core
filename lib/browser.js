import childProcess from "node:child_process";
import fs from "node:fs";
import Events from "#lib/events";

const PREFIXES = process.platform === "win32"
    ? [ process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env[ "PROGRAMFILES(X86)" ] ].filter( Boolean )
    : [ "" ];

const CHANNELS = {
    "chrome": {
        "darwin": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "linux": "/opt/google/chrome/chrome",
        "win32": `\\Google\\Chrome\\Application\\chrome.exe`,
    },
    "chromium": {
        "linux": "/usr/bin/chromium-browser",
    },
    "msedge": {
        "darwin": "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "linux": "/opt/microsoft/msedge/msedge",
        "win32": `\\Microsoft\\Edge\\Application\\msedge.exe`,
    },
};

const DEFAULT_ARGS = [
    "--no-sandbox", // mandatory to run as root on linux
    "--disable-field-trial-config", // https://source.chromium.org/chromium/chromium/src/+/main:testing/variations/README.md
    "--disable-background-networking",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-extensions", // AvoidUnnecessaryBeforeUnloadCheckSync - https://github.com/microsoft/playwright/issues/14047
    "--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync",
    "--allow-pre-commit-input",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--no-first-run",
    "--password-store=basic",
    "--use-mock-keychain", // See https://chromium-review.googlesource.com/c/chromium/src/+/2436773
    "--no-service-autorun",
    "--export-tagged-pdf",
];

const DEFAULT = {
    "android": [ "xdg-open" ],
    "linux": [ "xdg-open" ],
    "darwin": [ "open" ],
    "win32": [ "cmd", [ "/c", "start" ] ],
};

export default class Browser extends Events {
    static #path;

    #ref = true;
    #proc;

    constructor ( url, { defaultBrowser, incognito, headless, app, newWindow, width, height, maximized = true, signal, userDataDir, detached } = {} ) {
        super();

        if ( !( url instanceof URL ) ) url = new URL( url );
        url = encodeURI( url.href );

        var command, args;

        if ( defaultBrowser ) {
            [ command, args = [] ] = DEFAULT[ process.platform ];

            args = [ ...args, url ];
        }
        else {
            command = this.constructor.path;

            args = [ ...DEFAULT_ARGS ];

            if ( userDataDir ) {
                args.push( `--user-data-dir=` + userDataDir );
            }

            if ( newWindow ) {
                args.push( "--new-window" );
            }

            if ( width || height ) {
                args.push( `--window-size=${ width || 100_000 },${ height || 100_000 }` );
            }
            else if ( maximized ) {
                args.push( "--start-maximized" );
            }

            if ( incognito ) {
                args.push( "--incognito" );

                // for Edge
                args.push( "-inprivate" );
            }

            // XXX --headless=old - remove old
            // XXX https://stackoverflow.com/questions/78912977/chromium-based-msedge-or-chrome-headless-printing-exit-code-21
            if ( headless ) {
                args.push( "--headless=old" );
            }

            if ( app ) {
                args.push( "--app=" + url );
            }
            else {
                args.push( url );
            }
        }

        if ( !command ) throw new Error( `No chromium compatible browser found` );

        this.#proc = childProcess
            .spawn( command, args, {
                "stdio": "ignore",
                signal,
                detached,
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
    static get path () {
        if ( this.#path === undefined ) {
            this.#path = null;

            CHANNEL: for ( const channel in CHANNELS ) {
                if ( CHANNELS[ channel ].path ) {
                    this.#path = CHANNELS[ channel ].pathl;

                    break;
                }

                if ( CHANNELS[ channel ].path === undefined ) {
                    CHANNELS[ channel ].path = null;

                    for ( const prefix of PREFIXES ) {
                        if ( !CHANNELS[ channel ][ process.platform ] ) continue;

                        const path = prefix + CHANNELS[ channel ][ process.platform ];

                        if ( fs.existsSync( path ) ) {
                            this.#path = CHANNELS[ channel ].path = path;

                            break CHANNEL;
                        }
                    }
                }
            }
        }

        return this.#path;
    }

    // properties
    get hasRef () {
        return this.#ref;
    }

    isStarted () {
        return !!this.#proc;
    }

    // public
    ref () {
        this.#ref = true;

        this.#proc?.ref();

        return this;
    }

    unref () {
        this.#ref = false;

        this.#proc?.unref();

        return this;
    }

    close () {
        if ( !this.#proc ) return;

        this.#proc.kill();

        this.#proc = null;
    }
}
