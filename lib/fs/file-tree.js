import fs from "fs";
import _path from "path";
import File from "#lib/file";
import CondVar from "#lib/threads/condvar";
import { objectIsEmpty } from "#lib/utils";

export default class FileTree {
    files = {};

    get isEmpty () {
        return objectIsEmpty( this.files );
    }

    add ( file ) {
        file = File.new( file );

        this.files[file.path] = file;

        return file;
    }

    async write ( dirname ) {
        const cv = new CondVar().begin();

        for ( const path in this.files ) {
            cv.begin();

            const fullPath = dirname + "/" + path;

            fs.mkdirSync( _path.dirname( fullPath ), { "recursive": true } );

            const stream = this.files[path].stream(),
                writeStream = fs.createWriteStream( fullPath );

            writeStream.once( "close", () => cv.end() );

            stream.pipe( writeStream );
        }

        await cv.end().recv();
    }
}
