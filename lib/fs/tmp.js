const fs = require( "fs" );
const path = require( "path" );
const os = require( "os" );
const { "v4": uuidv4 } = require( "uuid" );

const TMP_FILES = new Set();
const TMP_DIRS = new Set();

process.setMaxListeners( process.getMaxListeners() + 1 );

process.on( "exit", () => {
    for ( const file of TMP_FILES ) {
        try {
            fs.rmSync( file, { "force": true } );
        }
        catch ( e ) {}
    }

    for ( const dir of TMP_DIRS ) {
        try {
            fs.rmSync( dir, { "recursive": true, "force": true } );
        }
        catch ( e ) {}
    }
} );

module.exports.file = function ( options = {} ) {
    const prefix = options.prefix || os.tmpdir(),
        ext = options.ext || "";

    const tmp = new String( path.join( prefix, uuidv4() + ext ) );

    TMP_FILES.add( tmp );

    tmp.remove = function () {
        if ( !TMP_FILES.has( this ) ) return;

        try {
            if ( fs.existsSync( this.toString() ) ) fs.rmSync( this.toString(), { "force": true } );

            TMP_FILES.delete( this );

            this.removed = true;
        }
        catch ( e ) {}
    };

    return tmp;
};

module.exports.dir = function ( options = {} ) {
    const prefix = options.prefix || os.tmpdir();

    const tmp = new String( path.join( prefix, uuidv4() ) );

    fs.mkdirSync( tmp.toString(), { "recursive": true } );

    TMP_DIRS.add( tmp );

    tmp.remove = function () {
        if ( !TMP_DIRS.has( this ) ) return;

        try {
            if ( fs.existsSync( this.toString() ) ) fs.rmSync( this.toString(), { "recursive": true, "force": true } );

            TMP_DIRS.delete( this );

            this.removed = true;
        }
        catch ( e ) {}
    };

    return tmp;
};
