const fs = require( "fs" );
const path = require( "path" );
const os = require( "os" );
const { "v4": uuidv4 } = require( "uuid" );

const TMP_FILES = {};
const TMP_DIRS = {};

process.setMaxListeners( process.getMaxListeners() + 1 );

process.on( "exit", () => {
    for ( const file in TMP_FILES ) {
        try {
            fs.rmSync( file, { "force": true } );
        }
        catch ( e ) {}
    }

    for ( const dir in TMP_DIRS ) {
        try {
            fs.rmSync( dir, { "recursive": true, "force": true } );
        }
        catch ( e ) {}
    }
} );

module.exports.file = function ( options = {} ) {
    const prefix = options.prefix || os.tmpdir(),
        ext = options.ext || "";

    const temp = new String( path.join( prefix, uuidv4() + ext ) );

    TMP_FILES[temp] = true;
    var removed;

    temp.remove = function () {
        if ( removed ) return;

        try {
            if ( fs.existsSync( temp.toString() ) ) fs.rmSync( temp.toString(), { "force": true } );

            delete TMP_FILES[temp];

            removed = true;
            this.removed = true;
        }
        catch ( e ) {}
    };

    return temp;
};

module.exports.dir = function ( options = {} ) {
    const prefix = options.prefix || os.tmpdir();

    const temp = new String( path.join( prefix, uuidv4() ) );

    fs.mkdirSync( temp.toString(), { "recursive": true } );

    TMP_DIRS[temp] = true;
    var removed;

    temp.remove = function () {
        if ( removed ) return;

        try {
            if ( fs.existsSync( temp.toString() ) ) fs.rmSync( temp.toString(), { "recursive": true, "force": true } );

            delete TMP_DIRS[temp];

            removed = true;
            this.removed = true;
        }
        catch ( e ) {}
    };

    return temp;
};
