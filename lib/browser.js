import childProcess from "node:child_process";
import fs from "node:fs";
import Events from "#lib/events";
import { openUrl } from "#lib/open-url";
import { TmpDir } from "#lib/tmp";

const PREFERRED_BROWSERS = {
    "darwin": "chrome",
    "linux": "chrome",
    "win32": "msedge",
};

const PREFERRED_CHROMIUM_BROWSER = {
    "darwin": "chrome",
    "linux": "chrome",
    "win32": "msedge",
};

const PREFIXES = {
    "win32": [

        //
        process.env.LOCALAPPDATA,
        process.env.PROGRAMFILES,
        process.env[ "PROGRAMFILES(X86)" ],
    ],
};

const BROWSERS = {
    "chrome": {
        "chromium": true,
        "paths": {
            "darwin": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "linux": "/opt/google/chrome/chrome",
            "win32": `\\Google\\Chrome\\Application\\chrome.exe`,
        },
    },
    "chromium": {
        "chromium": true,
        "paths": {
            "linux": "/usr/bin/chromium-browser",
        },
    },
    "msedge": {
        "chromium": true,
        "paths": {
            "darwin": "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "linux": "/opt/microsoft/msedge/msedge",
            "win32": `\\Microsoft\\Edge\\Application\\msedge.exe`,
        },
    },
};

const DEFAULT_CHROMIUM_ARGS = [
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

export default class Browser extends Events {
    static #availableBrowsers;
    static #defaultBrowser;
    static #defaultChromiumBrowser;

    #ref = true;
    #userDataDir;
    #proc;

    // XXX bug with --headless=old
    constructor ( url, { browser, defaultBrowser, incognito, headless, app, newWindow, width, height, maximized = true, signal, userDataDir, standalone, chromiumSandbox, detached } = {} ) {
        super();

        if ( !( url instanceof URL ) ) url = new URL( url );
        url = encodeURI( url.href );

        if ( defaultBrowser ) {
            this.#proc = openUrl( url, { detached, signal } );
        }
        else {
            browser = this.constructor.getBrowser( browser );

            if ( !browser ) throw new Error( `No compatible browser found` );

            const command = browser.executablePath;

            var args;

            if ( browser.chromium ) {
                args = [ ...DEFAULT_CHROMIUM_ARGS ];

                if ( !chromiumSandbox ) {
                    args.push( "--no-sandbox" );
                }

                if ( userDataDir ) {
                    args.push( `--user-data-dir=` + userDataDir );
                }
                else if ( standalone ) {
                    this.#userDataDir = new TmpDir();

                    args.push( `--user-data-dir=` + this.#userDataDir.path );
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
                    if ( browser.browser === "msedge" ) {
                        args.push( "-inprivate" );
                    }
                    else {
                        args.push( "--incognito" );
                    }
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

            this.#proc = childProcess.spawn( command, args, {
                "stdio": "ignore",
                signal,
                detached,
            } );
        }

        this.#proc
            .once( "error", e => {
                if ( e.code !== "ABORT_ERR" ) throw e;
            } )
            .once( "close", () => {
                this.#proc = null;
                this.#userDataDir = null;

                this.emit( "close" );
            } );
    }

    // static
    static get availableBrowsers () {
        if ( !this.#availableBrowsers ) {
            this.#availableBrowsers = {};

            for ( const browser in BROWSERS ) {

                // browser is not available for this platform
                if ( !BROWSERS[ browser ].paths[ process.platform ] ) continue;

                for ( const prefix of PREFIXES[ process.platform ] || [ "" ] ) {
                    const executablePath = prefix + BROWSERS[ browser ].paths[ process.platform ];

                    if ( fs.existsSync( executablePath ) ) {
                        this.#availableBrowsers[ browser ] = {
                            browser,
                            "chromium": BROWSERS[ browser ].chromium,
                            executablePath,
                        };

                        this.#defaultBrowser ??= browser;

                        if ( BROWSERS[ browser ].chromium ) {
                            this.#defaultChromiumBrowser ??= browser;
                        }

                        break;
                    }
                }
            }
        }

        return this.#availableBrowsers;
    }

    static get preferredBrowser () {
        return PREFERRED_BROWSERS[ process.platform ];
    }

    static get preferredChromiumBrowser () {
        return PREFERRED_CHROMIUM_BROWSER[ process.platform ];
    }

    static get defaultBrowser () {
        return this.#availableBrowsers[ this.#defaultBrowser ];
    }

    static get defaultChromiumBrowser () {
        return this.availableBrowsers[ this.preferredChromiumBrowser ] || this.#availableBrowsers[ this.#defaultChromiumBrowser ];
    }

    static getBrowser ( browser ) {
        if ( browser ) {
            return this.availableBrowsers[ browser ];
        }
        else {
            return this.defaultChromiumBrowser || this.defaultBrowser;
        }
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
