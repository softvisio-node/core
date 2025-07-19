import childProcess from "node:child_process";
import Events from "#lib/events";
import externalResources from "#lib/external-resources";
import File from "#lib/file";
import FileStream from "#lib/file-stream";
import Interval from "#lib/interval";
import stream from "#lib/stream";

const MIME_FORMAT = {
        "audio/mpeg": "mp3",
        "audio/ogg": "ogg",
        "audio/vnd.wav": "wav",
        "audio/mp4": "mp4",
        "audio/basic": "au",
    },
    FORMAT_MIME = {};

for ( const [ mime, format ] of Object.entries( MIME_FORMAT ) ) {
    FORMAT_MIME[ format ] = mime;
}

var FFMPEG_EXECUTABLE_PATH, FFPROBE_EXECUTABLE_PATH;

if ( process.platform === "win32" ) {
    var resource = await externalResources.add( "softvisio-node/core/resources/ffmpeg-win32" ).check();

    FFMPEG_EXECUTABLE_PATH = resource.getResourcePath( "bin/ffmpeg.exe" );
    FFPROBE_EXECUTABLE_PATH = resource.getResourcePath( "bin/ffprobe.exe" );
}
else {
    FFMPEG_EXECUTABLE_PATH = "ffmpeg";
    FFPROBE_EXECUTABLE_PATH = "ffprobe";
}

class FfmpegOperation {
    #events = new Events();
    #options = {
        "hide_banner": null,
        "loglevel": "quiet",
        "progress": "pipe:1",
    };
    #input = [];
    #output = [];
    #fd = 3;
    #proc;

    constructor ( args ) {
        for ( const arg of args ) {
            if ( arg.input ) {
                this.#addInput( arg );
            }
            else if ( arg.output ) {
                this.#addOutput( arg );
            }
            else {
                this.#addOptions( arg, this.#options );
            }
        }
    }

    // static
    static mimeToFormat ( mimeEssence ) {
        return MIME_FORMAT[ mimeEssence ];
    }

    static formatToMime ( format ) {
        return FORMAT_MIME( format );
    }

    // public
    // XXX
    exec () {
        const args = [],
            stdio = [ "ignore", "pipe", "ignore" ];

        // global options
        for ( const [ key, value ] of Object.entries( this.#options ) ) {
            if ( value === undefined ) continue;

            args.push( "-" + key );

            if ( value != null ) args.push( value );
        }

        // files
        for ( const files of [ this.#input, this.#output ] ) {
            for ( const file of files ) {
                if ( file.fd ) stdio.push( "pipe" );

                for ( const [ key, value ] of Object.entries( file.options ) ) {
                    if ( value === undefined ) continue;

                    args.push( "-" + key );

                    if ( value != null ) args.push( value );
                }

                if ( file.type === "input" ) {
                    args.push( "-i" );
                }

                args.push( file.file );
            }
        }

        // create ffmpeg process
        this.#proc = childProcess.spawn( FFMPEG_EXECUTABLE_PATH, args, {
            stdio,
        } );

        // progress
        this.#proc.stdout.on( "data", this.#onProgress.bind( this ) );

        // XXX
        // link output
        for ( const file of this.#output ) {
            if ( file.fd ) {
                stream.pipeline( this.#proc.stdio[ file.fd ], file.stream, e => {} );
            }
        }

        // XXX
        // link input
        for ( const file of this.#input ) {
            if ( file.fd ) {
                stream.pipeline( file.stream, this.#proc.stdio[ file.fd ], e => {} );
            }
        }

        return this;
    }

    on ( event, callback ) {
        this.#events.on( event, callback );

        return this;
    }

    once ( event, callback ) {
        this.#events.once( event, callback );

        return this;
    }

    off ( event, callback ) {
        this.#events.off( event, callback );

        return this;
    }

    // private
    #addOptions ( options, target ) {
        for ( const [ key, value ] of Object.entries( options ) ) {
            if ( value === undefined ) {
                delete target[ key ];
            }
            else {
                target[ key ] = value;
            }
        }
    }

    #addInput ( { input, ...options } ) {
        const file = {
            "type": "input",
            "file": null,
            "fd": null,
            "stream": null,
            "options": {},
        };

        this.#input.push( file );

        this.#addOptions( options, file.options );

        // File
        if ( input instanceof File ) {
            this.#addStream( file, input.stream(), input.type );
        }

        // FileStream
        else if ( input instanceof FileStream ) {
            this.#addStream( file, input, input.type );
        }

        // stream.Readable
        else if ( input instanceof stream.Readable ) {
            this.#addStream( file, input );
        }

        // file path
        else if ( typeof input === "string" ) {
            file.file = input;
        }

        // invalid type
        else {
            throw new Error( "Invalid input type" );
        }
    }

    #addOutput ( { output, ...options } ) {
        const file = {
            "type": "output",
            "file": null,
            "fd": null,
            "stream": null,
            "options": {},
        };

        this.#output.push( file );

        this.#addOptions( options, file.options );

        // File
        if ( output instanceof File ) {
            this.#addStream( file, output.stream(), output.type );
        }

        // FileStream
        else if ( output instanceof FileStream ) {
            this.#addStream( file, output, output.type );
        }

        // stream.Writable
        else if ( output instanceof stream.Writable ) {
            this.#addStream( file, output );
        }

        // file path
        else if ( typeof output === "string" ) {
            file.file = output;
        }

        // invalid type
        else {
            throw new Error( "Invalid input type" );
        }
    }

    // XXX destroy stream on error
    #addStream ( file, stream, type ) {
        file.fd = this.#fd++;
        file.stream = stream;
        file.file = "pipe:" + file.fd;

        // define format
        if ( !file.options.f ) {
            file.options.f = this.constructor.mimeToFormat( type );
        }

        if ( !file.options.f ) {
            throw new Error( "Format is required" );
        }
    }

    // XXX
    #onProgress ( data ) {
        this.#events.emit( "progress", data );
    }
}

class Ffmpeg {

    // public
    mimeToFormat ( mimeEssence ) {
        return FfmpegOperation.mimeToFormat( mimeEssence );
    }

    formatToMime ( format ) {
        return FfmpegOperation.formatToMime( format );
    }

    async probe ( inputFile ) {
        const args = [ "-v", "quiet", "-output_format", "json", "-show_format", "-show_streams", "-" ];

        let input;

        // File instance
        if ( inputFile instanceof File ) {
            input = inputFile.stream();

            if ( !input ) return result( 200 );
        }

        // stream
        else if ( inputFile instanceof stream.Readable ) {
            input = inputFile;
        }
        else {
            throw new Error( "Invalid input file" );
        }

        return new Promise( resolve => {
            try {
                const proc = childProcess.spawn( FFPROBE_EXECUTABLE_PATH, args, {
                    "encoding": "buffer",
                    "stdio": [ input
                        ? "pipe"
                        : "ignore", "pipe", "ignore" ],
                } );

                proc.once( "error", e => resolve( result.catch( e, { "log": false } ) ) );

                proc.stdout
                    .json()
                    .then( data => {
                        if ( !data.format ) return resolve( result( 200 ) );

                        data = {
                            ...data.format,
                            "streams": data.streams,
                        };

                        if ( data.duration ) data.duration = new Interval( Number( data.duration ), "seconds" );
                        if ( data.start_time ) data.start_time = new Interval( Number( data.start_time ), "seconds" );
                        if ( data.size ) data.size = Number( data.size );

                        if ( data.streams ) {
                            for ( const stream of data.streams ) {
                                if ( stream.duration ) stream.duration = new Interval( Number( stream.duration ), "seconds" );
                                if ( stream.start_time ) stream.start_time = new Interval( Number( stream.start_time ), "seconds" );
                                if ( stream.is_avc ) stream.is_avc = Boolean( stream.is_avc );
                                if ( stream.nal_length_size ) data.nal_length_size = Number( stream.nal_length_size );
                                if ( stream.bit_rate ) stream.bit_rate = Number( stream.bit_rate );
                                if ( stream.sample_rate ) stream.sample_rate = Number( stream.sample_rate );
                                if ( stream.nb_frames ) stream.nb_frames = Number( stream.nb_frames );
                            }
                        }

                        resolve( result( 200, data ) );
                    } )
                    .catch( e => {
                        resolve( result.catch( e, { "log": false } ) );
                    } );

                if ( input ) {
                    if ( input instanceof stream.Readable ) {
                        stream.pipeline( input, proc.stdin, e => {
                            if ( e ) {
                                proc.kill( "SIGKILL" );

                                resolve( result.catch( e, { "log": false } ) );
                            }
                        } );
                    }
                    else {
                        proc.stdin.write( input );
                        proc.stdin.end();
                    }
                }
            }
            catch ( e ) {
                resolve( result.catch( e, { "log": false } ) );
            }
        } );
    }

    exec ( ...args ) {
        const operation = new FfmpegOperation( args );

        return operation.exec();
    }
}

export default new Ffmpeg();
