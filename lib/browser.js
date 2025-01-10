import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Events from "#lib/events";
import externalResources from "#lib/external-resources";
import { openUrl } from "#lib/open-url";
import { TmpDir } from "#lib/tmp";

const CHROME_HEADLESS_SHELL = externalResources.add( `softvisio-node/core/resources/google-chrome-headless-shell-stable-${ process.platform }-${ process.arch }`, {
        "autoUpdate": false,
    } ),
    CHROME_FOR_TESTING = externalResources.add( `softvisio-node/core/resources/google-chrome-for-testing-stable-${ process.platform }-${ process.arch }`, {
        "autoUpdate": false,
    } );

const PREFERRED_BROWSERS = {
        "darwin": "chrome",
        "linux": "chrome",
        "win32": "msedge",
    },
    PREFERRED_CHROMIUM_BROWSERS = {
        "darwin": "chrome",
        "linux": "chrome",
        "win32": "msedge",
    },
    PREFIXES = {
        "darwin": [ "/" ],
        "linux": [ "/" ],
        "win32": [

            //
            process.env.LOCALAPPDATA,
            process.env.PROGRAMFILES,
            process.env[ "PROGRAMFILES(X86)" ],
        ],
    },
    BROWSERS = {
        "chrome": {
            "chromium": true,
            "paths": {
                "darwin": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "linux": "/opt/google/chrome/chrome",
                "win32": `Google\\Chrome\\Application\\chrome.exe`,
            },
        },
        "chrome-for-testing": {
            "chromium": true,
            "paths": {
                "darwin": CHROME_FOR_TESTING.getResourcePath( "chrome" ),
                "linux": CHROME_FOR_TESTING.getResourcePath( "chrome" ),
                "win32": CHROME_FOR_TESTING.getResourcePath( "chrome.exe" ),
            },
        },
        "chrome-headless-shell": {
            "chromium": true,
            "headless": true,
            "paths": {
                "darwin": CHROME_HEADLESS_SHELL.getResourcePath( "chrome-headless-shell" ),
                "linux": CHROME_HEADLESS_SHELL.getResourcePath( "chrome-headless-shell" ),
                "win32": CHROME_HEADLESS_SHELL.getResourcePath( "chrome-headless-shell.exe" ),
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
                "win32": `Microsoft\\Edge\\Application\\msedge.exe`,
            },
        },
        "vivaldi": {
            "chromium": true,
            "paths": {
                "darwin": "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
                "linux": "/opt/vivaldi/vivaldi",
                "win32": "vivaldi\\vivaldi.exe",
            },
        },
    },
    PREFERRED_BROWSER = PREFERRED_BROWSERS[ process.platform ],
    PREFERRED_CHROMIUM_BROWSER = PREFERRED_CHROMIUM_BROWSERS[ process.platform ];

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
    static #defaultChromiumHeadlessBrowser;

    #ref = true;
    #userDataDir;
    #tmpUserDataDir;
    #proc;

    // XXX bug with --headless=old
    // NOTE use "standalone" option to run browser in a new process, otherwise it will be attached to the already running browser process and child process will be closed immediately
    constructor ( url, { browser, defaultBrowser, incognito, headless, app, newWindow, width, height, maximized = true, signal, userDataDir, standalone, chromiumSandbox, detached } = {} ) {
        super();

        if ( !( url instanceof URL ) ) url = new URL( url );
        url = encodeURI( url.href );

        if ( defaultBrowser ) {
            this.#proc = openUrl( url, { detached, signal } );
        }
        else {
            browser = this.constructor.getBrowser( { browser, headless } );

            if ( !browser ) throw new Error( `No compatible browser found` );

            const command = browser.executablePath;

            var args;

            if ( browser.chromium ) {
                args = [ ...DEFAULT_CHROMIUM_ARGS ];

                if ( !chromiumSandbox && process.platform === "linux" ) {
                    args.push( "--no-sandbox" );
                }

                if ( userDataDir ) {
                    this.#userDataDir = userDataDir;
                }
                else {
                    standalone ??= !headless;

                    if ( standalone ) {
                        this.#tmpUserDataDir = new TmpDir();

                        this.#userDataDir = this.#tmpUserDataDir.path;
                    }
                }

                if ( this.#userDataDir ) {
                    args.push( `--user-data-dir=` + this.#userDataDir );
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

        this.#proc.once( "error", this.#onError.bind( this ) );

        this.#proc.once( "close", this.#onClose.bind( this ) );
    }

    // static
    static get availableBrowsers () {
        if ( !this.#availableBrowsers ) {
            this.#availableBrowsers = {};

            for ( const browser in BROWSERS ) {

                // browser is not available for this platform
                if ( !BROWSERS[ browser ].paths[ process.platform ] ) continue;

                let executablePaths;

                if ( path.isAbsolute( BROWSERS[ browser ].paths[ process.platform ] ) ) {
                    executablePaths = [ BROWSERS[ browser ].paths[ process.platform ] ];
                }
                else {
                    executablePaths = PREFIXES[ process.platform ].map( prefix => path.join( prefix, BROWSERS[ browser ].paths[ process.platform ] ) );
                }

                for ( const executablePath of executablePaths ) {
                    if ( fs.existsSync( executablePath ) ) {
                        this.#availableBrowsers[ browser ] = {
                            browser,
                            "chromium": BROWSERS[ browser ].chromium,
                            "headless": BROWSERS[ browser ].headless,
                            executablePath,
                        };

                        if ( !BROWSERS[ browser ].headless ) {
                            this.#defaultBrowser ??= browser;
                        }

                        if ( BROWSERS[ browser ].chromium ) {
                            this.#defaultChromiumBrowser ??= browser;

                            if ( BROWSERS[ browser ].headless ) {
                                this.#defaultChromiumHeadlessBrowser ??= browser;
                            }
                        }

                        break;
                    }
                }
            }
        }

        return this.#availableBrowsers;
    }

    static get defaultBrowser () {
        return (
            this.availableBrowsers[ "chrome-for-testing" ] || //
            this.availableBrowsers[ PREFERRED_BROWSER ] ||
            this.availableBrowsers[ this.#defaultBrowser ]
        );
    }

    static get defaultChromiumBrowser () {
        return (
            this.availableBrowsers[ "chrome-for-testing" ] || //
            this.availableBrowsers[ PREFERRED_CHROMIUM_BROWSER ] ||
            this.availableBrowsers[ this.#defaultChromiumBrowser ]
        );
    }

    static get defaultChromiumHeadlessBrowser () {
        return (
            this.availableBrowsers[ "chrome-headless-shell" ] || //
            this.availableBrowsers[ this.#defaultChromiumHeadlessBrowser ] ||
            this.defaultChromiumBrowser
        );
    }

    static getBrowser ( { browser, headless } = {} ) {
        if ( headless ) {
            return this.defaultChromiumHeadlessBrowser;
        }
        else if ( browser ) {
            return this.availableBrowsers[ browser ];
        }
        else {
            return this.defaultChromiumBrowser || this.defaultBrowser;
        }
    }

    static async installChrome ( { chromeForTesting, chromeHeadlessShell, installDependencies, log } = {} ) {
        var res;

        if ( chromeForTesting ) {
            res = await CHROME_FOR_TESTING.update();

            if ( res.ok ) {
                this.#clear();
            }
            else if ( !res.is3xx ) {
                return res;
            }
        }

        if ( chromeHeadlessShell ) {
            res = await CHROME_HEADLESS_SHELL.update();

            if ( res.ok ) {
                this.#clear();
            }
            else if ( !res.is3xx ) {
                return res;
            }
        }

        // https://www.remotion.dev/docs/miscellaneous/linux-dependencies
        if ( installDependencies && process.platform === "linux" ) {

            // ubuntu 24.04
            res = await childProcess.spawnSync(
                "apt-get",
                [

                    //
                    "install",
                    "-y",
                    "ttf-mscorefonts-installer", // XXX
                    "libnss3",
                    "libdbus-1-3",
                    "libatk1.0-0",
                    "libasound2t64",
                    "libxrandr2",
                    "libxkbcommon-dev",
                    "libxfixes3",
                    "libxcomposite1",
                    "libxdamage1",
                    "libgbm-dev",
                    "libatk-bridge2.0-0",
                ],
                {
                    "stdio": log
                        ? "inherit"
                        : "pipe",
                }
            );

            if ( res.status ) return result( [ 500, "Failed to install dependencies" ] );
        }

        return result( 200 );
    }

    static #clear () {
        this.#availableBrowsers = null;
        this.#defaultBrowser = null;
        this.#defaultChromiumBrowser = null;
        this.#defaultChromiumHeadlessBrowser = null;
    }

    // properties
    get userDataDir () {
        return this.#userDataDir;
    }

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

    // private
    #onError ( e ) {
        if ( e.code !== "ABORT_ERR" ) throw e;
    }

    #onClose () {
        this.#proc = null;
        this.#tmpUserDataDir = null;

        this.emit( "close" );
    }
}
