import { spawn } from "node:child_process";

const command = {
    "android": "xdg-open",
    "darwin": "open",
    "linux": "xdg-open",
    "win32": "start",
};

export default openUrl;

export function openUrl ( url, { detached = true, signal } = {} ) {
    if ( !command[ process.platform ] ) return;

    return spawn( command[ process.platform ], [ url ], {
        detached,
        "shell": true,
        "stdio": "ignore",
        signal,
    } );
}

export function mailTo ( recepients, { params, detached, signal } = {} ) {
    if ( !recepients ) {
        return;
    }
    else if ( !Array.isArray( recepients ) ) {
        recepients = [ recepients ];
    }

    const url = new URL( "mailto:" + recepients.join( "," ) );

    if ( params ) {
        url.search = new URLSearchParams( params );
    }

    return openUrl( url.href, {
        detached,
        signal,
    } );
}
