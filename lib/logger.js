export default class Logger {

    // public
    log ( ...args ) {
        console.log( args.join( " " ) );
    }

    write ( ...args ) {
        process.stdout.write( args.join( " " ) );
    }

    logWarning ( ...args ) {
        console.log( args.join( " " ) );
    }

    writeWarning ( ...args ) {
        process.stdout.write( args.join( " " ) );
    }

    logError ( ...args ) {
        console.error( args.join( " " ) );
    }

    writeError ( ...args ) {
        process.stderr.write( args.join( " " ) );
    }
}
