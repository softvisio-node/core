import tar from "tar";
import File from "#lib/file";

export default tar;

tar.Pack.prototype.addFile = async function ( file, { mode = 0o0644 } = {} ) {
    file = File.new( file );

    const buffer = await file.buffer(),
        size = buffer.length,
        blockSize = Math.ceil( size / 512 ) * 512;

    // have to pad with zeroes up to the block boundary
    const pad = Buffer.alloc( blockSize - size );

    // create the header
    const h = new tar.Header( {
        "path": file.name,
        size,
        mode,
        "type": "File",
        "mtime": new Date(),
        "uid": process.getuid ? process.getuid() : null,
        "gid": process.getgid ? process.getgid() : null,
        "uname": process.env.USER,
        "gname": process.env.GROUP,
    } );

    // create the ReadEntry, so it works as if we're slurping in entries from another archive
    const re = new tar.ReadEntry( h );

    // add the read entry to the packer
    this.write( re );

    // write the data, this could be a stream or whatever
    re.write( buffer );

    // pad out to the block boundary when that's done
    re.end( pad );
    re.end();

    return this;
};
