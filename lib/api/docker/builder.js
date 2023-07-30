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
    #args;
    #credentials;

    #logger;
    #git;
    #gitId;
    #tags;
    #composeFile;
    #images = [];
    #dockerEngine;

    // XXX
    constructor ( context, { signal, tag, autoTags, push, remove, interactive, force, args, credentials } = {} ) {
        this.#context = context;
        this.#signal = signal;
        this.#tag = tag;
        this.#autoTags = autoTags;
        this.#push = push;
        this.#remove = remove;
        this.#interactive = interactive;
        this.#force = force;
        this.#args = args;
        this.#credentials = credentials;

        if ( !this.#interactive ) this.#force = true;

        this.#logger ??= new Logger();

        // XXX
        this.#interactive = false;

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
            if ( !this.#force && ( await confirm( "\nContinue build process?", ["n", "y"] ) ) === "n" ) throw `Aborted`;

            res = await this.#prepareImagesParams();
            if ( !res.ok ) throw res;

            res = await this.#buildImages();
            if ( !res.ok ) throw res;

            res = await this.#removeImages();
            if ( !res.ok ) throw res;
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true, "keepError": true } );

            if ( !res.ok ) this.#logger.logError( res + "" );
        }

        // remove tmp context
        if ( context instanceof TmpDir ) context.destroy();

        return res;
    }

    // private
    // XXX:/#prepareContex if cloned by label - we got detached head state, and autobuild branch tags will not work
    async #prepareContext () {
        const logger = this.#logger;

        // read docker-compose.yaml
        if ( !fs.existsSync( this.#context + "/docker-compose.yaml" ) ) return result( [404, `docker-compose.yaml not found`] );

        this.#composeFile = readConfig( this.#context + "/docker-compose.yaml" );

        // validate docker-compose.yaml
        logger.write( `Validating docker-compose.yaml ... ` );
        if ( !validate( this.#composeFile ) ) return result( [400, `not valid, errors:\n${validate.errors}`] );
        logger.log( `OK` );

        this.#git = new Git( this.#context );

        this.#gitId = await this.#git.getId();
        if ( !this.#gitId.ok ) return this.#gitId;
        if ( !this.#gitId.data.hash ) return result( [500, `Unable to identify current changeset`] );
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

            logger.write( `Checking out "${this.#tag}" ... ` );
            res = await this.#git.run( "checkout", this.#tag );
            if ( !res.ok ) return result( res );
            logger.log( res + "\n" );

            this.#gitId = await this.#git.getId();
            if ( !this.#gitId.ok ) return result( this.#gitId );
            this.#gitId = this.#gitId.data;
        }

        this.#tags = new Set( [this.#tag] );

        // apply autobuild tags
        if ( this.#autoTags ) {
            if ( !Array.isArray( this.#autoTags ) ) {
                this.#autoTags = [this.#autoTags];
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

            // XXX check build.context, do not build if context is not a relative patj (can be git url)

            const image = ( service.baseImage = service.image.replace( /:.*/, "" ) );

            if ( images[image] ) {
                if ( service.depends_on ) {
                    images[image].dependencies.push( ...service.depends_on );
                }

                continue;
            }

            images[image] = {
                image,
                "dependencies": service.depends_on ? [...service.depends_on] : [],
                "build": service.build,
            };
        }

        // resolve dependencies
        for ( const image of Object.values( images ) ) {
            image.dependencies = image.dependencies
                .map( serviceName => {
                    const dependencyImage = this.#composeFile.services?.[serviceName]?.baseImage;

                    if ( !dependencyImage || dependencyImage === image.image ) return;

                    return dependencyImage;
                } )
                .filter( image => image );
        }

        const colors = {},
            sort = image => {
                const color = colors[image.image] || "white";

                if ( color === "black" ) {
                    return result( 200 );
                }
                else if ( color === "grey" ) {
                    return result( [500, `Cyclic dependency found`] );
                }
                else {
                    colors[image.image] = "grey";

                    for ( const dependency of image.dependencies ) {
                        const res = sort( images[dependency] );
                        if ( !res.ok ) return res;
                    }

                    colors[image.image] = "black";

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

    async #prepareImagesParams () {
        for ( const image of this.#images ) {
            image.context = image.build.context ? path.posix.join( this.#context + "", image.build.context ) : this.#context;

            const args = [];

            if ( image.build.dockerfile ) args.push( "--file", image.build.dockerfile );

            if ( image.build.shm_size ) args.push( "--shm-size", image.build.shm_size );

            if ( image.build.network ) args.push( "--network", image.build.network );

            if ( image.build.target ) args.push( "--target", image.build.target );

            if ( image.build.cache_from ) image.build.cache_from.forEach( image => args.push( "--cache-from", image ) );

            let labels = {};

            if ( image.build.labels ) {
                if ( Array.isArray( image.build.labels ) ) {
                    for ( const label of image.build.labels ) {
                        let name, value;

                        const idx = label.indexOf( "=" );

                        if ( idx === -1 ) {
                            name = label;
                            value = "";
                        }
                        else if ( idx === 0 ) {
                            continue;
                        }
                        else {
                            name = label.substring( 0, idx );
                            value = label.substring( idx + 1 );
                        }

                        labels[name] = value;
                    }
                }
                else if ( typeof image.build.labels === "object" ) {
                    labels = { ...image.build.labels };
                }
            }

            labels["git.branch"] = this.#gitId.branch || "";
            labels["git.tags"] = this.#gitId.tags.sort().join( "," );
            labels["git.date"] = this.#gitId.date;
            labels["git.hash"] = this.#gitId.hash;

            const upstream = await this.#git.getUpstream();

            if ( upstream?.isGithub ) {
                labels["org.opencontainers.image.source"] = upstream.homeUrl;

                labels["org.opencontainers.image.description"] = `branch: ${labels["git.branch"]}, tags: [${labels["git.tags"]}], date: ${labels["git.date"]}, hash: ${labels["git.hash"]}`;
            }

            for ( const label in labels ) {
                args.push( "--label", label + "=" + labels[label] );
            }

            // compose build args
            if ( image.build.args ) {
                if ( Array.isArray( image.build.args ) ) {
                    for ( const arg of image.build.args ) {
                        args.push( "--build-arg", arg );
                    }
                }
                else {
                    for ( const arg in image.build.args ) {
                        args.push( "--build-arg", arg + "=" + image.build.args[arg] );
                    }
                }
            }

            args.push( "--build-arg", `GIT_ID=${JSON.stringify( this.$gitId )}` );

            if ( this.#args ) {
                for ( const arg of this.#args ) {
                    args.push( "--build-arg", arg );
                }
            }

            image.args = args;
        }

        return result( 200 );
    }

    // XXX
    async #buildImages () {
        for ( const image of this.#images ) {
            this.#logger.log( `\n• Building image: ${image.image} ...` );

            if ( this.#interactive ) {
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
                        ...image.args,
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

                        // "dockerfile": "dockerfile",
                        "t": image.tags[0], // image tag
                        "q": false, // no verbose
                        "nocache": true,

                        // "pull": true,
                        "rm": true,
                        "forcerm": true,

                        // "buildargs": {}, // XXX json
                        // "labels": {}, // XXX json
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
                            this.#logger.logError( data.error );

                            resolve( result( [500, data.error] ) );
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
                        const res = await this.#dockerEngine.tagImage( image.tags[0], image.tags[n] );

                        if ( !res.ok ) return res;
                    }
                }
            }

            // push images
            if ( this.#push ) {
                for ( const tag of image.tags ) {
                    this.#logger.log( `\n• Pushing: ${tag}` );

                    if ( this.#interactive ) {
                        while ( true ) {
                            const res = childProcess.spawnSync( "docker", ["image", "push", tag], { "stdio": "inherit" } );

                            if ( !res.status ) break;

                            if ( ( await confirm( "\nUnable to push image. Repeat?", ["y", "n"] ) ) === "n" ) break;
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
                                    this.#logger.logError( data.error );

                                    resolve( result( [500, data.error] ) );
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
            childProcess.spawnSync( "docker", ["image", "rm", ...images], { "stdio": "inherit" } );
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
