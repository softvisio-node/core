import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { confirm } from "#lib/utils";
import { TmpDir } from "#lib/tmp";
import { readConfig } from "#lib/config";
import Ajv from "#lib/ajv";
import Logger from "#lib/logger";
import Git from "#lib/api/git";
import DockerEngine from "#lib/api/docker/engine";

// NOTE https://docs.docker.com/compose/compose-file/build/

const validate = new Ajv().compile( readConfig( "#resources/schemas/docker-compose.schema.yaml", { "resolve": import.meta.url } ) );

export default class {
    #context;
    #signal;
    #tag;
    #autoTags;
    #push;
    #remove;
    #interactive;
    #force;
    #credentials;
    #build = {};

    #logger;
    #git;
    #upstream;
    #gitId;
    #tags;
    #composeFile;
    #images = [];
    #dockerEngine;

    constructor ( context, { composeFile, signal, credentials, tag, autoTags, push, remove, interactive, force, build = {} } = {} ) {
        this.#context = context;
        this.#composeFile = composeFile || "docker-compose.yaml";
        this.#signal = signal;
        this.#tag = tag;
        this.#autoTags = autoTags;
        this.#push = push;
        this.#remove = remove;
        this.#interactive = interactive;
        this.#force = force;
        this.#credentials = credentials;

        // build options
        this.#build.dockerFile = build.dockerFile;
        this.#build.tag = build.tag;
        this.#build.extraHosts = build.extraHosts;
        this.#build.quiet = build.quiet;
        this.#build.cache = build.cache;
        this.#build.cacheFrom = build.cacheFrom;
        this.#build.pull = build.pull;
        this.#build.rm = build.rm;
        this.#build.forceRm = build.forceRm;
        this.#build.args = build.args || {};
        this.#build.labels = build.labels || {};

        this.#build.shmSize = build.shmSize;
        this.#build.memory = build.memory;
        this.#build.memSwap = build.memSwap;
        this.#build.cpuShares = build.cpuShares;
        this.#build.cpuSetCpus = build.cpuSetCpus;
        this.#build.cpuPeriod = build.cpuPeriod;
        this.#build.cpuQuota = build.cpuQuota;

        this.#build.squash = build.squash;
        this.#build.networkMode = build.networkMode;
        this.#build.platform = build.platform;
        this.#build.target = build.target;
        this.#build.outputs = build.outputs;

        if ( !this.#interactive ) this.#force = true;

        this.#logger = new Logger();

        if ( !this.#interactive ) this.#dockerEngine = new DockerEngine();
    }

    // public
    async run () {
        var res, context;

        try {

            // prepare context
            res = await this.#prepareContext();
            if ( !res.ok ) throw res;

            // no tags to build found
            if ( !this.#tags?.size ) throw `No tags to build found`;

            // prepare images
            res = await this.#prepareImages();
            if ( !res.ok ) throw res;

            if ( !this.#images.length ) throw `No imahes to build found`;

            for ( const image of this.#images ) {
                image.tags = [];

                for ( const tag of this.#tags ) {
                    const taggedImage = image.image + ":" + tag;

                    image.tags.push( taggedImage );

                    this.#logger.log( `Image: ` + taggedImage );
                }
            }

            // confirm build
            if ( !this.#force && ( await confirm( "\nContinue build process?", [ "no", "yes" ] ) ) === "no" ) throw `Aborted`;

            res = await this.#buildImages();
            if ( !res.ok ) throw res;
        }
        catch ( e ) {
            res = result.catch( e, { "log": false } );

            if ( !res.ok ) this.#logger.error( res + "" );
        }

        // remove tmp context
        if ( context instanceof TmpDir ) context.destroy();

        // remove build artifacts
        await this.#removeImages();

        return res;
    }

    // private
    // XXX:/#prepareContex if cloned by label - we got detached head state, and autobuild branch tags will not work
    async #prepareContext () {
        const logger = this.#logger;

        // read docker-compose.yaml
        if ( !fs.existsSync( this.#context + "/" + this.#composeFile ) ) return result( [ 404, `Compose file "${ this.#composeFile } not found"` ] );

        this.#composeFile = readConfig( this.#context + "/" + this.#composeFile );

        // validate docker-compose.yaml
        logger.write( `Validating docker-compose.yaml ... ` );
        if ( !validate( this.#composeFile ) ) return result( [ 400, `not valid, errors:\n${ validate.errors }` ] );
        logger.log( `OK` );

        this.#git = new Git( this.#context );
        this.#upstream = this.#git.upstream;

        this.#gitId = await this.#git.getId();
        if ( !this.#gitId.ok ) return this.#gitId;
        if ( !this.#gitId.data.hash ) return result( [ 500, `Unable to identify current changeset` ] );
        this.#gitId = this.#gitId.data;

        // define tag to clone
        this.#tag ||= this.#gitId.branch;

        const clone = this.#gitId.isDirty || !( this.#gitId.branch === this.#tag || this.#gitId.hash.startsWith( this.#tag ) || this.#gitId.tags.includes( this.#tag ) );

        // clone git repo
        if ( clone ) {
            const context = this.#context;
            this.#context = new TmpDir();

            logger.write( `Cloning ... ` );
            let res = await this.#git.run( "clone", "--quiet", context, this.#context );
            if ( !res.ok ) return result( res );
            logger.log( res + "" );

            this.#git = new Git( this.#context );

            logger.write( `Checking out "${ this.#tag }" ... ` );
            res = await this.#git.run( "checkout", this.#tag );
            if ( !res.ok ) return result( res );
            logger.log( res + "\n" );

            this.#gitId = await this.#git.getId();
            if ( !this.#gitId.ok ) return result( this.#gitId );
            this.#gitId = this.#gitId.data;
        }

        this.#tags = new Set( [ this.#tag ] );

        // apply autobuild tags
        if ( this.#autoTags ) {
            if ( !Array.isArray( this.#autoTags ) ) {
                this.#autoTags = [ this.#autoTags ];
            }

            for ( const tag of this.#autoTags ) {
                if ( this.#gitId.branch === tag || this.#gitId.tags.includes( tag ) ) this.#tags.add( tag );
            }
        }

        return result( 200 );
    }

    async #prepareImages () {
        const images = {};

        for ( const service of Object.values( this.#composeFile.services || {} ) ) {

            // do not build service
            if ( !service.build || !service.image ) continue;

            if ( typeof service.build === "string" ) {
                service.build = {
                    "context": service.build,
                };
            }

            // XXX check build.context, do not build if context is not a relative path (can be git url)

            const imageName = ( service.baseImage = service.image.replace( /:.*/, "" ) );

            if ( images[ imageName ] ) {
                if ( service.depends_on ) {
                    images[ imageName ].dependencies.push( ...service.depends_on );
                }

                continue;
            }

            const image = {
                "image": imageName,
                "dependencies": service.depends_on ? [ ...service.depends_on ] : [],
                "build": { ...this.#build },
            };

            images[ imageName ] = image;

            image.context = service.build.context ? path.posix.join( this.#context + "", service.build.context ) : this.#context;

            // preparee build options
            if ( service.build.dockerfile ) image.build.dockerFile = service.build.dockerfile;
            if ( service.build.shm_size ) image.build.shmSize = service.build.shm_size;
            if ( service.build.network ) image.build.networkMode = service.build.network;
            if ( service.build.target ) image.build.target = service.build.target;
            if ( service.build.cache_from ) image.build.cacheFrom = service.build.cache_from;

            image.build.args = { ...image.build.args };
            image.build.labels = { ...image.build.labels };

            // merge build args
            if ( service.build.args ) {
                if ( Array.isArray( service.build.args ) ) {
                    for ( const arg of service.build.args ) {
                        const [ key, value ] = arg.split( /=(.*)/ );

                        image.build.args[ key ] = value;
                    }
                }
                else {
                    for ( const key in service.build.args ) {
                        image.build.args[ key ] = service.build.args[ key ];
                    }
                }
            }

            // add default build args
            image.build.args[ "GIT_ID" ] = JSON.stringify( this.#gitId );

            // merge labels
            if ( service.build.labels ) {
                if ( Array.isArray( service.build.labels ) ) {
                    for ( const label of service.build.labels ) {
                        const [ key, value ] = label.split( /=(.*)/ );

                        image.build.labels[ key ] = value;
                    }
                }
                else if ( typeof service.build.labels === "object" ) {
                    for ( const key in service.build.labels ) {
                        image.build.labels[ key ] = service.build.labels[ key ];
                    }
                }
            }

            // add default labels
            image.build.labels[ "git.branch" ] = this.#gitId.branch || "";
            image.build.labels[ "git.tags" ] = this.#gitId.tags.sort().join( "," );
            image.build.labels[ "git.date" ] = this.#gitId.date;
            image.build.labels[ "git.hash" ] = this.#gitId.hash;

            if ( this.#upstream?.isGithub ) {
                image.build.labels[ "org.opencontainers.image.source" ] = this.#upstream.homeUrl;

                image.build.labels[ "org.opencontainers.image.description" ] = `branch: ${ image.build.labels[ "git.branch" ] }, tags: [${ image.build.labels[ "git.tags" ] }], date: ${ image.build.labels[ "git.date" ] }, hash: ${ image.build.labels[ "git.hash" ] }`;
            }
        }

        // resolve dependencies
        for ( const image of Object.values( images ) ) {
            image.dependencies = image.dependencies
                .map( serviceName => {
                    const dependencyImage = this.#composeFile.services?.[ serviceName ]?.baseImage;

                    if ( !dependencyImage || dependencyImage === image.image ) return;

                    return dependencyImage;
                } )
                .filter( image => image );
        }

        const colors = {},
            sort = image => {
                const color = colors[ image.image ] || "white";

                if ( color === "black" ) {
                    return result( 200 );
                }
                else if ( color === "grey" ) {
                    return result( [ 500, `Cyclic dependency found` ] );
                }
                else {
                    colors[ image.image ] = "grey";

                    for ( const dependency of image.dependencies ) {
                        const res = sort( images[ dependency ] );
                        if ( !res.ok ) return res;
                    }

                    colors[ image.image ] = "black";

                    this.#images.push( image );

                    return result( 200 );
                }
            };

        for ( const image of Object.values( images ) ) {
            const res = sort( image );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async #buildImages () {
        for ( const image of this.#images ) {
            this.#logger.log( "" );
            this.#logger.info( `Building image: ${ image.image } ...` );

            if ( this.#interactive ) {
                const args = [];

                if ( image.build.dockerFile ) args.push( "--file", image.build.dockerFile );
                if ( image.build.shmSize ) args.push( "--shm-size", image.build.shmSize );
                if ( image.build.networkMode ) args.push( "--network", image.build.networkMode );
                if ( image.build.target ) args.push( "--target", image.build.target );
                if ( image.build.cacheFrom ) image.build.cacheFrom.forEach( image => args.push( "--cache-from", image ) );

                for ( const arg in image.build.args ) {
                    args.push( "--build-arg=" + arg + "=" + image.build.args[ arg ] );
                }

                for ( const label in image.build.labels ) {
                    args.push( "--label=" + label + "=" + image.build.labels[ label ] );
                }

                const res = childProcess.spawnSync(
                    "docker",
                    [

                        //
                        "builder",
                        "build",
                        "--rm", // remove intermediate containers after a successful build (default true)
                        "--force-rm", // always remove intermediate containers
                        "--no-cache", // do not use cache when building the image
                        "--pull", // always attempt to pull a newer version of the image
                        ...args,
                        ...image.tags.map( image => "--tag=" + image ),
                        image.context,
                    ],
                    { "stdio": "inherit" }
                );

                if ( res.status ) return result( 500 );
            }
            else {
                let res = await this.#dockerEngine.buildImage( image.context, {
                    "dockerfile": "dockerfile",
                    "signal": this.#signal,
                    "credentials": this.#credentials,
                    "options": {
                        ...image.build.options,
                        "tag": image.tags[ 0 ],
                    },
                } );

                if ( !res.ok ) return res;

                const stream = res.data;

                res = await new Promise( resolve => {
                    stream.on( "data", data => {
                        if ( data.stream ) {
                            this.#logger.write( data.stream );
                        }
                        else if ( data.error ) {
                            this.#logger.error( data.error );

                            resolve( result( [ 500, data.error ] ) );
                        }
                        else if ( data.aux ) {
                            this.#logger.log( "ID: " + data.aux.ID );
                        }
                    } );

                    stream.once( "error", e => resolve( result.catch( e ) ) );

                    stream.once( "close", () => resolve( result( 200 ) ) );
                } );

                if ( !res.ok ) return res;

                // tag image
                if ( image.tags.length > 1 ) {
                    for ( let n = 1; n < image.tags.length; n++ ) {
                        const res = await this.#dockerEngine.tagImage( image.tags[ 0 ], image.tags[ n ] );

                        if ( !res.ok ) return res;
                    }
                }
            }

            // push images
            if ( this.#push ) {
                for ( const tag of image.tags ) {
                    this.#logger.log( "" );
                    this.#logger.info( `Pushing: ${ tag }` );

                    if ( this.#interactive ) {
                        while ( true ) {
                            const res = childProcess.spawnSync( "docker", [ "image", "push", tag ], { "stdio": "inherit" } );

                            if ( !res.status ) break;

                            if ( ( await confirm( "\nUnable to push image. Repeat?", [ "yes", "no" ] ) ) === "no" ) break;
                        }
                    }
                    else {
                        let res = await this.#dockerEngine.pushImage( tag, {
                            "signal": this.#signal,
                            "credentials": this.#credentials,
                        } );

                        if ( !res.ok ) return res;

                        const stream = res.data;

                        res = await new Promise( resolve => {
                            stream.on( "data", data => {
                                if ( data.status ) {

                                    // this.#logger.log( data.status );
                                }
                                else if ( data.error ) {
                                    this.#logger.error( data.error );

                                    resolve( result( [ 500, data.error ] ) );
                                }
                                else if ( data.aux ) {
                                    this.#logger.log( "Digest: " + data.aux.digest );
                                    this.#logger.log( "Size: " + data.aux.size );
                                }
                            } );

                            stream.once( "error", e => resolve( result.catch( e ) ) );

                            stream.once( "close", () => resolve( result( 200 ) ) );
                        } );

                        if ( !res.ok ) return res;
                    }
                }
            }
        }

        return result( 200 );
    }

    async #removeImages () {
        if ( !this.#remove ) return result( 200 );

        const images = [];

        for ( const image of this.#images ) {
            for ( const tag of image.tags ) {
                images.push( tag );
            }
        }

        this.#logger.log( `\nRemoving images` );

        if ( this.#interactive ) {
            childProcess.spawnSync( "docker", [ "image", "rm", ...images ], { "stdio": "inherit" } );
        }
        else {
            for ( const image of images ) {
                const res = await this.#dockerEngine.deleteImage( image );
                this.#logger.log( "Remove image: " + image + " ...  " + res + "" );
            }
        }

        return result( 200 );
    }
}
