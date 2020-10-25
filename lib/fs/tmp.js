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
            fs.unlinkSync( file );
        }
        catch ( e ) {}
    }

    for ( const dir in TMP_DIRS ) {
        try {
            fs.rmdirSync( dir, { "recursive": true } );
        }
        catch ( e ) {}
    }
} );

module.exports.file = function ( options = {} ) {
    const prefix = options.prefix || os.tmpdir(),
        ext = options.ext || "";

    const temp = new String( path.join( prefix, uuidv4() + ext ) );

    TMP_FILES[temp] = true;

    temp.unlinkSync = function () {
        if ( this.unlinked ) return;

        try {
            if ( fs.existsSync( temp.toString() ) ) fs.unlinkSync( temp.toString() );

            delete TMP_FILES[temp];

            this.unlinked = true;
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

    temp.unlinkSync = function () {
        if ( this.unlinked ) return;

        try {
            if ( fs.existsSync( temp.toString() ) ) fs.rmdirSync( temp.toString(), { "recursive": true } );

            delete TMP_DIRS[temp];

            this.unlinked = true;
        }
        catch ( e ) {}
    };

    return temp;
};
