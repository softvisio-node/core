import { spawn } from "node:child_process";

const command = {
    "darwin": "open",
    "linux": "xdg-open",
    "win32": "start",
};

export default openUrl;

export function openUrl ( url ) {
    if ( !command[ process.platform ] ) return;

    spawn( command[ process.platform ], [ url ], {
        "detached": true,
        "shell": true,
        "stdio": false,
    } );
}

export function mailTo ( recepients, { params } = {} ) {
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

    openUrl( url.href );
}
