import { exists } from "#lib/fs";
import { glob } from "#lib/glob";
import tar from "#lib/tar";

export default Super =>
    class extends ( Super || class {} ) {
        async getImages () {
            return this._doRequest( "get", "images/json" );
        }

        async pruneImages ( { tagged, until } = {} ) {
            const filters = {};

            if ( tagged ) filters.dangling = [ "false" ];
            if ( until ) filters.until = [ until ];

            return this._doRequest( "post", "images/prune", {
                "params": {
                    filters,
                },
            } );
        }

        async pushImage ( image, { signal, credentials } ) {
            var tag;

            [ image, tag ] = image.split( ":" );

            return this._doRequest( "post", `images/${ encodeURIComponent( image ) }/push`, {
                "stream": true,
                signal,
                "params": {
                    tag,
                },
                "registryAuth": await this._getImageAuth( image, credentials ),
            } );
        }

        async deleteImage ( image ) {
            return this._doRequest( "delete", `images/${ encodeURIComponent( image ) }`, {
                "params": {
                    "force": false,
                    "noprune": false,
                },
            } );
        }

        async tagImage ( image, tag ) {
            const [ repo, repoTag ] = tag.split( ":" );

            return this._doRequest( "post", `images/${ encodeURIComponent( image ) }/tag`, {
                "params": {
                    repo,
                    "tag": repoTag,
                },
            } );
        }

        async buildImage ( context, { signal, credentials, options = {} } = {} ) {
            if ( typeof credentials === "function" ) {
                credentials = await credentials();
            }

            const files = await glob( "**", {
                "cwd": context,
                "ignoreFile": ".dockerignore",
            } );

            // add mandatory files
            const index = new Set( files );

            // add .dockerignore
            if ( !index.has( ".dockerignore" ) && ( await exists( context + "/.dockerignore" ) ) ) {
                files.push( ".dockerignore" );
            }

            // add Dockerfile
            if ( options.dockerFile ) {
                if ( !index.has( options.dockerFile ) && !( await exists( context + "/" + options.dockerFile ) ) ) {
                    files.push( options.dockerFile );
                }
            }
            else if ( !index.has( "Dockerfile" ) && !index.has( "dockerfile" ) ) {
                if ( await exists( context + "/Dockerfile" ) ) {
                    files.push( "Dockerfile" );
                }
                else if ( await exists( context + "/dockerfile" ) ) {
                    files.push( "Dockerfile" );
                }
            }

            const body = tar.create(
                {
                    "cwd": context,
                    "gzip": false,
                    "portable": true,
                    "sync": false,
                },
                files
            );

            return this._doRequest( "post", "build", {
                "stream": true,
                signal,
                "params": {
                    "dockerfile": options.dockerFile,
                    "t": options.tag,
                    "extrahosts": options.extraHosts,
                    "q": options.quiet,
                    "nocache": !options.cache,
                    "cachefrom": options.cacheFrom,
                    "pull": options.pull,
                    "rm": options.rm,
                    "forcerm": options.forceRm,
                    "buildargs": options.args,
                    "labels": options.labels,

                    "shmsize": options.shmSize,
                    "memory": options.memory,
                    "memswap": options.memSwap,
                    "cpushares": options.cpuShares,
                    "cpusetcpus": options.cpuSetCpus,
                    "cpuperiod": options.cpuPeriod,
                    "cpuquota": options.cpuQuota,

                    "squash": options.squash,
                    "networkmode": options.networkMode,
                    "platform": options.platform,
                    "target": options.target,
                    "outputs": options.outputs,
                },
                body,
                "registryConfig": credentials,
            } );
        }
    };
