const fs = require( "fs" );
const path = require( "path" );

module.exports = class FileTree {
    files = {};

    add ( path, content ) {
        this.files[path] = { content };
    }

    write ( dirname ) {
        for ( const file in this.files ) {
            const filePath = dirname + "/" + file;

            fs.mkdirSync( path.dirname( filePath ), { "recursive": true } );

            fs.writeFileSync( filePath, this.files[file].content );
        }
    }

    isEmpty () {
        return Object.isEmpty( this.files );
    }
};
