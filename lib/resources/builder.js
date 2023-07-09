import "#lib/result";
import GitHub from "#lib/api/github";
import env from "#lib/env";
import { TmpDir } from "#lib/tmp";
import File from "#lib/file";
import tar from "#lib/tar";
import crypto from "crypto";

env.loadUserEnv();

export default class RecourcesBuilder {
    #id;
    #githubToken;

    constructor ( id, { githubtoken } = {} ) {
        this.#id = id;
        this.#githubToken = githubtoken || process.env.GITHUB_TOKEN;
    }

    // public
    async build ( { force } = {} ) {
        if ( !this.#githubToken ) {
            return result( [500, `GitHub token not found`] );
        }

        const gitHubApi = new GitHub( this.#githubToken );

        const [owner, repo, tag, name] = this.#id.split( "/" );
        const repository = owner + "/" + repo;

        var res;

        // XXX download remote index via api
        const index = {};

        // get etag
        res = await this.getEtag();
        if ( !res.ok ) return res;

        const etag = this.#prepareEtag( res.data );

        // not modified
        if ( !force && etag === index?.[name]?.etag ) return result( 304 );

        const tmp = new TmpDir();

        res = await this._build( tmp.path );

        if ( !res.pk ) return res;

        const assetPath = tmp.path + "/" + name + ".tar.gz";

        tar.create( {
            "cwd": tmp.path,
            "gzip": true,
            "portable": true,
            "sync": true,
            "file": assetPath,
        } );

        // upload asset tar.gz
        res = await this.#uploadAsset( gitHubApi, repository, tag, new File( { "path": assetPath } ) );
        if ( !res.ok ) return res;

        // update index
        index[name] ||= {};
        index[name].etag = etag;
        index[name].buildDate = new Date();

        // upload index
        res = await this.#uploadAsset( gitHubApi, repository, tag, new File( { "name": "index.json", "buffer": JSON.stringify( index, null, 4 ) } ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // private
    #prepareEtag ( etag ) {
        if ( etag instanceof Date ) {
            return etag.toISOString();
        }
        else if ( etag instanceof crypto.Hash ) {
            return etag.digest( "hex" );
        }
        else {
            return etag;
        }
    }

    async #uploadAsset ( gitHub, repository, tag, file ) {

        // get release id
        const res = await gitHub.getReleaseByTagName( repository, tag );

        if ( !res.ok ) return res;

        return gitHub.updateReleaseAsset( repository, res.data.id, file );
    }
}
