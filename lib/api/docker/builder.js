import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { confirm } from "#lib/utils";
import { TmpDir } from "#lib/tmp";
import { readConfig } from "#lib/config";
import Ajv from "#lib/ajv";
import Logger from "#lib/logger";
import Git from "#lib/api/git";

// NOTE https://docs.docker.com/compose/compose-file/build/

const validate = new Ajv().compile( readConfig( "#resources/schemas/docker-compose.schema.yaml", { "resolve": import.meta.url } ) );

export default class {
    #context;
    #signal;
    #tag;
    #push;
    #remove;
    #force;
    #args;

    #logger;
    #git;
    #gitId;
    #tags;
    #composeFile;
    #images = [];

    constructor ( context, { signal, tag, push, remove, force, args } = {} ) {
        this.#context = context;
        this.#signal = signal;
        this.#tag = tag;
        this.#push = push;
        this.#remove = remove;
        this.#force = force;
        this.#args = args;

        this.#logger ??= new Logger();
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

    // XXX delete
    async run1 () {
        const rootPackage = this._findRootPackage();

        if ( !rootPackage ) this._throwError( "Unable to find root package" );

        var dockerRoot = rootPackage.root;

        // read docker-compose.yaml
        if ( !fs.existsSync( rootPackage.root + "/docker-compose.yaml" ) ) this._throwError( `"docker-compose.yaml" not found` );
        const dockerConfig = readConfig( rootPackage.root + "/docker-compose.yaml" );

        // validate docker-compose.yaml
        process.stdout.write( `Validating docker-compose.yaml ... ` );
        if ( !validate( dockerConfig ) ) this._throwError( `not valid, errors:\n${validate.errors}` );
        console.log( `OK` );

        var git = rootPackage.git;

        var status = await git.getId();
        if ( !status.ok ) this._throwError( status, dockerRoot );
        if ( !status.data.hash ) this._throwError( `Unable to identify current changeset`, dockerRoot );
        status = status.data;

        // define tag to clone
        const tag = process.cli.arguments.tag || dockerConfig["x-build"].default_tag || status.branch;

        const clone = status.isDirty || !( status.branch === tag || status.hash.startsWith( tag ) || status.tags.includes( tag ) );

        // clone git repo
        if ( clone ) {
            dockerRoot = new TmpDir();

            process.stdout.write( `Cloning ... ` );
            let res = await git.run( "clone", "--quiet", rootPackage.root, dockerRoot );
            if ( !res.ok ) this._throwError( res );
            console.log( res + "" );

            const { "default": Git } = await import( "#lib/git" );
            git = new Git( dockerRoot );

            process.stdout.write( `Checking out "${tag}" ... ` );
            res = await git.run( "checkout", tag );
            if ( !res.ok ) this._throwError( res );
            console.log( res + "\n" );

            status = await git.getId();
            if ( !status.ok ) this._throwError( status, dockerRoot );
            status = status.data;
        }

        const tags = new Set( [tag] );

        // apply autobuild tags
        if ( dockerConfig["x-build"].auto_tags ) {
            if ( !Array.isArray( dockerConfig["x-build"].auto_tags ) ) dockerConfig["x-build"].auto_tags = [dockerConfig["x-build"].auto_tags];

            for ( const tag of dockerConfig["x-build"].auto_tags ) {
                if ( status.branch === tag || status.tags.includes( tag ) ) tags.add( tag );
            }
        }

        var services = {};

        // index services image
        for ( const service of Object.values( dockerConfig.services ) ) {
            const image = service.image.replace( /:.*/, "" );

            service._baseImage = image;
        }

        for ( const service of Object.values( dockerConfig.services ) ) {

            // do not build service
            if ( !service.build || !service.image ) continue;

            if ( typeof service.build === "string" ) {
                service.build = {
                    "context": service.build,
                };
            }

            // XXX check build.context, do not build if context is not a relative patj (can be git url)

            // remove tag
            const image = service._baseImage;

            if ( services[image] ) {

                // merge dependencies
                if ( service.depends_on ) {
                    for ( const name of service.depends_on ) {
                        const baseImage = dockerConfig.services[name]?._baseImage;

                        if ( !baseImage ) continue;

                        services[image].dependencies.push( baseImage );
                    }
                }

                continue;
            }

            services[image] = {
                image,
                "dependencies": ( service.depends_on || [] ).map( name => dockerConfig.services[name]?._baseImage ).filter( image => image ),
                "images": new Set(),
                "params": service.build,
            };

            for ( const tag of tags ) {
                const _image = image + ":" + tag;

                services[image].images.add( _image );

                console.log( `Image: ${_image}` );
            }
        }

        // XXX =================================================================================

        // build images
        for ( const service of services ) {
            let context = dockerRoot;

            if ( service.params.context ) context = path.posix.join( context, service.params.context );

            const args = [];

            if ( service.params.dockerfile ) args.push( "--file", service.params.dockerfile );

            if ( service.params.shm_size ) args.push( "--shm-size", service.params.shm_size );

            if ( service.params.network ) args.push( "--network", service.params.network );

            if ( service.params.target ) args.push( "--target", service.params.target );

            // compose labels
            let labels = {};

            if ( service.params.labels ) {
                if ( Array.isArray( service.params?.labels ) ) {
                    for ( const label of service.params.labels ) {
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
                else if ( typeof service.params?.labels === "object" ) {
                    labels = { ...service.params.labels };
                }
            }

            labels["git.branch"] = status.branch || "";
            labels["git.tags"] = status.tags.sort().join( "," );
            labels["git.date"] = status.date;
            labels["git.hash"] = status.hash;

            const upstream = await git.getUpstream();
            if ( upstream?.isGithub ) {
                labels["org.opencontainers.image.source"] = upstream.homeUrl;
                labels["org.opencontainers.image.description"] = `branch: ${labels["git.branch"]}, tags: [${labels["git.tags"]}], date: ${labels["git.date"]}, hash: ${labels["git.hash"]}`;
            }

            for ( const label in labels ) {
                args.push( "--label", label + "=" + labels[label] );
            }

            if ( service.params.cache_from ) service.params.cache_from.forEach( image => args.push( "--cache-from", image ) );

            // compose build args
            if ( service.params.args ) {
                if ( Array.isArray( service.params.args ) ) {
                    for ( const arg of service.params.args ) {
                        args.push( "--build-arg", arg );
                    }
                }
                else {
                    for ( const arg in service.params.args ) {
                        args.push( "--build-arg", arg + "=" + service.params.args[arg] );
                    }
                }
            }

            args.push( "--build-arg", `GIT_ID=${JSON.stringify( status )}` );

            if ( process.cli.options.arg ) {
                for ( const arg of process.cli.options.arg ) {
                    args.push( "--build-arg", arg );
                }
            }

            console.log( `\n• Building image: ${service.image} ...` );

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
                    ...[...service.images].map( image => "--tag=" + image ),
                    context,
                ],
                { "stdio": "inherit" }
            );

            if ( res.status ) this._throwError( "Terminated", dockerRoot );

            // push images
            if ( process.cli.options.push ) {
                for ( const image of service.images ) {
                    while ( true ) {
                        console.log( `\n• Pushing: ${image}` );

                        const res = childProcess.spawnSync( "docker", ["image", "push", image], { "stdio": "inherit" } );

                        if ( !res.status ) break;

                        if ( ( await confirm( "\nUnable to push image. Repeat?", ["y", "n"] ) ) === "n" ) break;
                    }
                }
            }
        }

        // remove temp dir
        if ( dockerRoot instanceof TmpDir ) dockerRoot.destroy();

        // remove images
        if ( process.cli.options.remove ) {
            const images = [];

            for ( const service of services ) images.push( ...service.images );

            console.log( `\nRemoving images` );

            childProcess.spawnSync( "docker", ["image", "rm", ...images], { "stdio": "inherit" } );
        }
    }

    // private
    // XXX if cloned by label - we got detached head state, and autobuild branch tags will not work
    async #prepareContext ( tag ) {
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
        tag ||= this.#composeFile["x-build"].default_tag || this.#gitId.branch;

        const clone = this.#gitId.isDirty || !( this.#gitId.branch === tag || this.#gitId.hash.startsWith( tag ) || this.#gitId.tags.includes( tag ) );

        // clone git repo
        if ( clone ) {
            const context = this.#context;
            this.#context = new TmpDir();

            logger.write( `Cloning ... ` );
            let res = await this.#git.run( "clone", "--quiet", context, this.#context );
            if ( !res.ok ) return result( res );
            logger.log( res + "" );

            this.#git = new Git( this.#context );

            logger.write( `Checking out "${tag}" ... ` );
            res = await this.#git.run( "checkout", tag );
            if ( !res.ok ) return result( res );
            logger.log( res + "\n" );

            this.#gitId = await this.#git.getId();
            if ( !this.#gitId.ok ) return result( this.#gitId );
            this.#gitId = this.#gitId.data;
        }

        this.#tags = new Set( [tag] );

        // apply autobuild tags
        if ( this.#composeFile["x-build"].auto_tags ) {
            if ( !Array.isArray( this.composeFile["x-build"].auto_tags ) ) {
                this.#composeFile["x-build"].auto_tags = [this.#composeFile["x-build"].auto_tags];
            }

            for ( const tag of this.#composeFile["x-build"].auto_tags ) {
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

                    this.#images.push( image );

                    colors[image.image] = "bkack";

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
            image.context = image.build.context ? path.posix.join( this.#context, image.build.context ) : this.#context;

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

    async #buildImages () {
        for ( const image of this.#images ) {
            this.#logger.log( `\n• Building image: ${image.image} ...` );

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

            // push images
            if ( this.#push ) {
                for ( const image of image.tags ) {
                    while ( true ) {
                        console.log( `\n• Pushing: ${image}` );

                        const res = childProcess.spawnSync( "docker", ["image", "push", image], { "stdio": "inherit" } );

                        if ( !res.status ) break;

                        if ( this.#force ) return result( 500 );

                        if ( ( await confirm( "\nUnable to push image. Repeat?", ["y", "n"] ) ) === "n" ) break;
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
                images.pusg( tag );
            }
        }

        this.#logger.log( `\nRemoving images` );

        childProcess.spawnSync( "docker", ["image", "rm", ...images], { "stdio": "inherit" } );

        return result( 200 );
    }
}
