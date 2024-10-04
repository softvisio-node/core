import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";

export default class Http extends ExternalRecourceBuilder {
    #url;

    // properties
    get id () {
        return "softvisio-node/core/resources/ffmpeg";
    }

    // protected
    async _getEtag ( { etag, buildDate, meta } ) {
        const res = await fetch( await this.#getUrl(), {
            "method": "head",
        } );

        if ( !res.ok ) throw res;

        return result( 200, res.headers.get( "etag" ) );
    }

    async _build ( location ) {
        const res = await fetch( await this.#getUrl() );

        if ( !res.ok ) throw res;
    }

    // private
    async #getUrl () {
        if ( !this.#url ) {
            const res = await fetch( "https://www.gyan.dev/ffmpeg/builds/release-version" );

            if ( !res.ok ) throw res;

            const version = await res.text();

            this.#url = `https://github.com/GyanD/codexffmpeg/releases/download/${ version }/ffmpeg-${ version }-essentials_build.zip`;
        }

        return this.#url;
    }
}
