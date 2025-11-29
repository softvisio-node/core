import { pipeline } from "node:stream/promises";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import { calculateMode } from "#lib/fs";
import SemanticVersion from "#lib/semantic-version";
import { createXzStreamDecompressor } from "#lib/stream/xz";
import tar from "#lib/tar";

export default class Ffmpeg extends ExternalRecourceBuilder {
    #release;

    // properties
    get id () {
        return "softvisio-node/core/resources/ffmpeg-linux";
    }

    // protected
    async _getEtag () {
        const release = await this.#getRelease();

        return result( 200, release.version.versionString );
    }

    async _build ( location ) {
        const release = await this.#getRelease();

        const res = await this.gitHubApi.downloadReleaseAssetByUrl( release.url );
        if ( !res.ok ) throw res;

        // download and unpack
        return pipeline(
            createXzStreamDecompressor( res.body ),
            tar.extract( {
                "cwd": location,
                "strip": 1,
            } )
        )
            .then( () =>
                result( 200, {
                    onWriteEntry ( entry ) {
                        if ( entry.path.startsWith( "bin/" ) ) {
                            entry.stat.mode = calculateMode( "rwxr-xr-x" );
                        }
                    },
                } ) )
            .catch( e => result.catch( e ) );
    }

    async _getMeta () {
        const release = await this.#getRelease();

        return result( 200, {
            "version": release.version.version,
            "hash": release.hash,
        } );
    }

    // private
    async #getRelease () {
        if ( this.#release ) return this.#release;

        const res = await this.gitHubApi.listReleases( "BtbN/FFmpeg-Builds" );
        if ( !res.ok ) throw res;

        const latestRelease = {
            "version": null,
            "hash": null,
            "url": null,
        };

        for ( const release of res.data ) {
            for ( const asset of release.assets ) {
                const match = asset.name.match( /^ffmpeg-n(?<version>[\d.]+(?:-\d+)?)-(?<hash>[^-]+)-(?<platform>linux|win)64-gpl-[\d.]+.(?<extname>tar\.xz|zip)$/ );

                if ( !match ) continue;
                if ( match.groups.hash === "latest" ) continue;
                if ( match.groups.platform !== "linux" ) continue;

                const version = new SemanticVersion( match.groups.version );

                if ( !latestRelease.version || version.gt( latestRelease.version ) ) {
                    latestRelease.version = version;
                    latestRelease.hash = match.groups.hash;
                    latestRelease.url = asset.url;
                }
            }
        }

        this.#release = latestRelease;

        return this.#release;
    }
}
