export default class Logger {

    // public
    log ( string ) {
        console.log( string );
    }

    write ( string ) {
        process.stdout.write( string );
    }

    logWarning ( string ) {
        console.log( string );
    }

    logError ( string ) {
        console.error( string );
    }
}
