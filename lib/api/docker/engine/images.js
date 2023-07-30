import glob from "#lib/glob";
import tar from "#lib/tar";

export default Super =>
    class extends ( Super || Object ) {
        async getImages () {
            return this._request( "get", "images/json" );
        }

        async pruneImages ( { tagged, until } = {} ) {
            const filters = {};

            if ( tagged ) filters.dangling = ["false"];
            if ( until ) filters.until = [until];

            return this._request( "post", "images/prune", {
                "params": {
                    filters,
                },
            } );
        }

        async pushImage ( image, { signal, credentials } ) {
            var tag;

            [image, tag] = image.split( ":" );

            return this._request( "post", `images/${encodeURIComponent( image )}/push`, {
                signal,
                "params": {
                    tag,
                },
                "registryAuth": await this._getImageAuth( image, credentials ),
            } );
        }

        async deleteImage ( image ) {
            return this._request( "delete", `images/${encodeURIComponent( image )}`, {
                "params": {
                    "force": false,
                    "noprune": false,
                },
            } );
        }

        async tagImage ( image, tag ) {
            const [repo, repoTag] = tag.split( ":" );

            return this._request( "post", `images/${encodeURIComponent( image )}/tag`, {
                "params": {
                    repo,
                    "tag": repoTag,
                },
            } );
        }

        async buildImage ( context, { signal, credentials, options = {} } = {} ) {
            const files = glob( "**", {
                "cwd": context,
                "ignoreFile": ".dockerignore",
            } );

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
                signal,
                "params": {
                    "dockerfile": options.dockerFile,
                    "t": options.tag,
                    "extrahosts": options.extrahosts,
                    "q": options.quiet,
                    "nocache": !options.cache,
                    "cachefrom": options.cacheFrom,
                    "pull": options.pull,
                    "rm": options.rm,
                    "forcerm": options.force,
                    "buildargs": options.buildArgs,
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
