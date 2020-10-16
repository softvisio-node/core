const fs = require( "fs" );
const path = require( "path" );
const os = require( "os" );
const { "v4": uuidv4 } = require( "uuid" );

const TMP = {
    "files": {},
    "dirs": {},
};

process.setMaxListeners( process.getMaxListeners() + 1 );

process.on( "exit", () => {
    for ( const file in TMP.files ) {
        try {
            fs.unlinkSync( file );
        }
        catch ( e ) {}
    }

    for ( const dir in TMP.dirs ) {
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

    TMP.files[temp] = true;

    temp.unlinkSync = function () {
        if ( this.unlinked ) return;

        try {
            if ( fs.existsSync( temp.toString() ) ) fs.unlinkSync( temp.toString() );

            delete TMP.files[temp];

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

    TMP.dirs[temp] = true;

    temp.unlinkSync = function () {
        if ( this.unlinked ) return;

        try {
            if ( fs.existsSync( temp.toString() ) ) fs.rmdirSync( temp.toString(), { "recursive": true } );

            delete TMP.dirs[temp];

            this.unlinked = true;
        }
        catch ( e ) {}
    };

    return temp;
};
