import glob from "#lib/glob";
import tar from "#lib/tar";
import fs from "node:fs";

export default Super =>
    class extends ( Super || class {} ) {
        async getImages () {
            return this._request( "get", "images/json" );
        }

        async pruneImages ( { tagged, until } = {} ) {
            const filters = {};

            if ( tagged ) filters.dangling = [ "false" ];
            if ( until ) filters.until = [ until ];

            return this._request( "post", "images/prune", {
                "params": {
                    filters,
                },
            } );
        }

        async pushImage ( image, { signal, credentials } ) {
            var tag;

            [ image, tag ] = image.split( ":" );

            return this._request( "post", `images/${ encodeURIComponent( image ) }/push`, {
                "stream": true,
                signal,
                "params": {
                    tag,
                },
                "registryAuth": await this._getImageAuth( image, credentials ),
            } );
        }

        async deleteImage ( image ) {
            return this._request( "delete", `images/${ encodeURIComponent( image ) }`, {
                "params": {
                    "force": false,
                    "noprune": false,
                },
            } );
        }

        async tagImage ( image, tag ) {
            const [ repo, repoTag ] = tag.split( ":" );

            return this._request( "post", `images/${ encodeURIComponent( image ) }/tag`, {
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

            const files = glob( "**", {
                "cwd": context,
                "ignoreFile": ".dockerignore",
            } );

            // add mandatory files
            const index = new Set( files );

            // add .dockerignore
            if ( !index.has( ".dockerignore" && fs.existsSync( context + "/.dockerignore" ) ) ) {
                files.push( ".dockerignore" );
            }

            // add Dockerfile
            if ( options.dockerFile ) {
                if ( !index.has( options.dockerFile ) && !fs.existsSync( context + "/" + options.dockerFile ) ) {
                    files.push( options.dockerFile );
                }
            }
            else if ( !index.has( "Dockerfile" ) && !index.has( "dockerfile" ) ) {
                if ( fs.existsSync( context + "/Dockerfile" ) ) {
                    files.push( "Dockerfile" );
                }
                else if ( fs.existsSync( context + "/dockerfile" ) ) {
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

            return this._request( "post", "build", {
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
