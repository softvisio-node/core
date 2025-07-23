#!/usr/bin/env node

import { writeConfigSync } from "#lib/config";
import fetch from "#lib/fetch";
import { parseXml } from "#lib/xml";

class MimeType {
    #essence;
    #type;
    #subtype;
    #extensions = new Set();
    #aliases = new Set();
    #compressible;
    #charset;
    #iana = false;

    constructor ( essence, { extensions, compressible, charset, iana } ) {
        this.#essence = essence.toLowerCase();

        [ this.#type, this.#subtype ] = this.#essence.split( "/" );

        if ( compressible != null ) this.#compressible = Boolean( compressible );
        this.#charset = charset;
        if ( iana ) this.#iana = true;

        this.addExtensions( extensions );
    }

    // properties
    get essence () {
        return this.#essence;
    }

    get type () {
        return this.#type;
    }

    get subtype () {
        return this.#subtype;
    }

    get extensions () {
        return this.#extensions;
    }

    get aliases () {
        return this.#aliases;
    }

    get compressible () {
        return this.#compressible;
    }

    get charset () {
        return this.#charset;
    }

    get isIana () {
        return this.#iana;
    }

    // public
    toString () {
        return this.#essence;
    }

    toJSON () {
        return {
            "essence": this.#essence,
            "extensions": this.#extensions.size
                ? [ ...this.#extensions ].sort()
                : undefined,
            "aliases": this.#aliases.size
                ? [ ...this.#aliases ].sort()
                : undefined,
            "compressible": this.#compressible || undefined,
            "charset": this.#charset || undefined,
            "iana": this.#iana || undefined,
        };
    }

    addExtensions ( extensions ) {
        if ( !extensions ) return;

        for ( const extension of extensions ) {
            this.#extensions.add( extension.toLowerCase().replace( ".", "" ) );
        }
    }

    addAliases ( aliases ) {
        if ( !Array.isArray( aliases ) ) aliases = [ aliases ];

        for ( const alias of aliases ) {
            if ( !alias ) continue;

            this.#aliases.add( alias.toLowerCase().replace( ".", "" ) );
        }
    }

    setCompressible ( compressible ) {
        if ( compressible ) {
            this.#compressible = true;
        }
    }
}

class Mime {
    #types = {};
    #aliases = {};

    // public
    toJSON () {
        const data = [];

        for ( const type of Object.values( this.#types ).sort( ( a, b ) => a.essence.localeCompare( b.essence ) ) ) {
            data.push( type );
        }

        return data;
    }

    get ( essence ) {
        if ( essence instanceof MimeType ) essence = essence.essence;

        return this.#types[ essence.toLowerCase() ];
    }

    addType ( { essence, extensions, compressible, charset, iana } ) {
        var type = this.get( essence );

        if ( !type ) {
            type = new MimeType( essence, { charset, iana } );

            this.#types[ type.essence ] = type;
        }

        type.addExtensions( extensions );
        type.setCompressible( compressible );

        return type;
    }

    addAliases ( types, aliases ) {
        if ( typeof types === "string" ) {
            types = {
                [ types ]: aliases,
            };
        }

        for ( let [ type, aliases ] of Object.entries( types ) ) {
            type = type.toLowerCase();

            if ( !Array.isArray( aliases ) ) aliases = [ aliases ];

            for ( let alias of aliases ) {
                alias = alias.toLowerCase();

                if ( type === alias ) return;

                if ( this.#aliases[ alias ] ) {
                    if ( this.#aliases[ alias ] !== type ) {
                        throw `Redefine alias, alias: ${ alias }, old: ${ this.#aliases[ alias ] }, new: ${ type }`;
                    }
                }
                else {
                    this.#aliases[ alias ] = type;
                }
            }
        }
    }

    async addIana () {
        const res = await fetch( "https://www.iana.org/assignments/media-types/media-types.xml" ),
            data = parseXml( await res.text() );

        for ( const type of data.registry.registry ) {
            if ( !type.record ) continue;

            for ( const subtype of type.record ) {
                this.addType( {
                    "essence": subtype.file,
                    "iana": true,
                } );
            }
        }
    }

    async addMimeDb () {
        const res = await fetch( "https://raw.githubusercontent.com/jshttp/mime-db/master/db.json" );

        const data = await res.json();

        for ( const [ essence, { extensions, compressible, charset } ] of Object.entries( data ) ) {
            this.addType( {
                essence,
                extensions,
                compressible,
                charset,
            } );
        }
    }

    async addMimeTypesData () {
        const res = await fetch( "https://raw.githubusercontent.com/mime-types/mime-types-data/main/data/mime-types.json" );

        const data = await res.json();

        for ( const type of data ) {

            // if ( type.obsolete && !type[ "use-instead" ] ) {
            //     console.log( `Type ${ type[ "content-type" ] } is deprecated without alias` );
            // }

            this.addType( {
                "essence": type[ "content-type" ],
                "extensions": type.extensions || [],
            } );

            if ( type[ "use-instead" ] ) {

                // fixes
                if ( type[ "use-instead" ] === "vnd.afpc.afplinedata" ) {
                    type[ "use-instead" ] = "application/vnd.afpc.afplinedata";
                }

                this.addAliases( type[ "use-instead" ], type[ "content-type" ] );
            }
        }
    }

    async addMimetypeIo () {
        const res = await fetch( "https://raw.githubusercontent.com/patrickmccallum/mimetype-io/master/src/mimeData.json" );

        const data = await res.json();

        for ( const type of data ) {
            if ( type.deprecated && !type.useInstead ) {
                console.log( `Type ${ type.name } is deprecated without alias` );
            }

            this.addType( {
                "essence": type.name,
                "extensions": type.fileTypes || [],
            } );

            // fixes
            const ignore = new Set( [

                //
                "application/zip",
                "application/zip-compressed",
                "application/x-zip-compressed",

                "application/gzip",
                "application/x-gzip",

                "text/mathml",
                "application/mathml+xml",

                "font/otf",
                "application/x-font-otf",

                "application/pkcs7-mime",
                "application/x-pkcs7-certreqresp",
                "application/x-pkcs7-certificates",

                "application/x-rar-compressed",
                "application/vnd.rar",
            ] );

            if ( type.useInstead ) {
                if ( !ignore.has( type.useInstead ) ) {
                    this.addAliases( type.useInstead, type.name );
                }
            }

            for ( const alias of type.links.deprecates ) {
                if ( ignore.has( alias.toLowerCase() ) ) continue;

                this.addAliases( type.name, alias );
            }

            // type.notices.popularUsage - default, if exists

            // if ( type.links.alternativeTo.length ) {
            //     console.log( "--- alternative to:", type.name, type.links.alternativeTo );
            // }

            // if ( type.links.parentOf.length ) {
            //     console.log( "--- parent of:", type.name, type.links.parentOf );
            // }
        }
    }

    mergeAliases () {
        for ( const [ alias, type ] of Object.entries( this.#aliases ) ) {
            this.#mergeAlias( type, alias );
        }

        for ( const type of Object.values( this.#types ) ) {
            const alias = this.get( type.type + "/x-" + type.subtype );

            if ( !alias ) continue;

            if ( !alias.isIana ) {
                this.#mergeAlias( type.essence, alias.essence );
            }
            else if ( !type.isIana ) {
                this.#mergeAlias( alias.essence, type.essence );
            }
            else {
                console.log( "-".repeat( 20 ) );
                console.log( `Possible alias: ${ type } -> ${ alias }` );
                console.log( JSON.stringify( type, null, 4 ) );
                console.log( JSON.stringify( alias, null, 4 ) );
            }
        }

        // merge by extensions
        const extensions = {};

        for ( const type of Object.values( this.#types ) ) {
            for ( const extension of type.extensions ) {
                extensions[ extension ] ||= new Set();
                extensions[ extension ].add( type.essence );
            }
        }

        for ( const [ extension, types ] of Object.entries( extensions ) ) {
            if ( types.size === 1 ) continue;

            console.log( "---Extension conflict:", extension, [ ...types ] );
        }
    }

    // private
    #mergeAlias ( type, alias ) {
        type = this.get( type );

        type.addAliases( alias );

        alias = this.get( alias );

        if ( alias ) {
            type.addExtensions( alias.extensions );

            if ( alias.compressible ) type.setCompressible( true );

            delete this.#types[ alias.essence ];
        }
    }
}

const mime = new Mime();

mime.addAliases( {
    "application/bdoc": "application/x-bdoc",
    "application/gzip": "application/x-gzip",
    "application/java-vm": "application/x-java-vm",
    "application/mathml+xml": "text/mathml",
    "application/netcdf": "application/x-netcdf",
    "application/pkcs7-mime": [ "application/x-pkcs7-certreqresp", "application/x-pkcs7-certificates" ],
    "application/x-rar-compressed": "application/vnd.rar",
    "application/x-sh": "application/x-shellscript",
    "application/zip": [ "application/zip-compressed", "application/x-zip-compressed" ],
    "audio/adpcm": "audio/x-adpcm",
    "audio/aiff": "audio/x-aiff",
    "audio/midi": "audio/x-midi",
    "audio/wav": [ "audio/vnd.wav", "audio/x-wav", "audio/vnd.wave", "audio/wave", "audio/x-pn-wav" ],
    "font/otf": "application/x-font-otf",
    "image/icns": "image/x-icns",
    "image/jpeg": "image/pjpeg",
    "image/x-raw-canon": "image/x-canon-crw",
    "image/x-raw-epson": "image/x-epson-erf",
    "image/x-raw-fuji": "image/x-fuji-raf",
    "image/x-raw-hasselblad": "image/x-hasselblad-3fr",
    "image/x-raw-kodak": [ "image/x-kodak-k25", "image/x-kodak-kdc" ],
    "image/x-raw-minolta": "image/x-minolta-mrw",
    "image/x-raw-nikon": "image/x-nikon-nef",
    "image/x-raw-olympus": "image/x-olympus-orf",
    "image/x-raw-panasonic": [ "image/x-panasonic-raw" ],
    "image/x-raw-pentax": [ "image/x-pentax-pef" ],
    "image/x-raw-sigma": "image/x-sigma-x3f",
    "image/x-raw-sony": [ "image/x-sony-arw", "image/x-sony-srf", "image/x-sony-sr2" ],
    "text/coffeescript": [ "text/x-coffeescript", "text/x-coffescript" ],
    "text/less": "text/x-less",
    "text/markdown": "text/x-web-markdown",
    "text/x-asm": "text/x-assembly",
    "text/x-c": "text/x-c++src",
    "text/x-perl": "application/x-perl",
    "text/x-python": "application/x-python",
    "text/x-ruby": "application/x-ruby",
    "text/x-tcl": "application/x-tcl",

    // "image/x-tga": "image/x-targa",
} );

await mime.addIana();
await mime.addMimeDb();
await mime.addMimeTypesData();
await mime.addMimetypeIo();

mime.mergeAliases();

writeConfigSync( "mime.json", mime, { "readable": true } );
