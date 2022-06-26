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

const DEFAULT_ARGS = [
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
    "--enable-automation",
    "--password-store=basic",
    "--use-mock-keychain", // See https://chromium-review.googlesource.com/c/chromium/src/+/2436773
    "--no-service-autorun",
    "--export-tagged-pdf",
];

export default class Browser extends Events {
    static #path;
    #proc;

    constructor ( url, { title, width, height, maximized = true, signal, userDataDir } = {} ) {
        super();

        if ( !( url instanceof URL ) ) url = new URL( url );

        if ( !this.constructor.path ) throw Error( `No chromium compatible browser found` );

        const args = [

            //
            ...DEFAULT_ARGS,
            ...( userDataDir ? [`--user-data-dir=${userDataDir}`] : [] ),
            "--app=" + url,
        ];

        if ( width || height ) {
            args.push( `--window-size=${width || 100000},${height || 100000}` );
        }
        else if ( maximized ) {
            args.push( "--start-maximized" );
        }

        this.#proc = childProcess
            .spawn( this.constructor.path, args, {
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
    static get path () {
        if ( this.#path === undefined ) {
            this.#path = null;

            for ( const location of BROWSER_LOCATIONS[process.platform] ) {
                if ( fs.existsSync( location ) ) {
                    this.#path = location;

                    break;
                }
            }
        }

        return this.#path;
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
