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
    #repository;
    #tag;
    #name;
    #githubToken;

    constructor ( id, { githubtoken } = {} ) {
        this.#id = id;
        this.#githubToken = githubtoken || process.env.GITHUB_TOKEN;

        const [owner, repo, tag, name] = this.#id.split( "/" );

        this.#repository = owner + "/" + repo;
        this.#tag = tag;
        this.#name = name;
    }

    // properties
    get id () {
        return this.#id;
    }

    get repository () {
        return this.#repository;
    }

    get tag () {
        return this.#tag;
    }

    get name () {
        return this.#name;
    }

    // public
    async build ( { force } = {} ) {
        if ( !this.#githubToken ) {
            return result( [500, `GitHub token not found`] );
        }

        const gitHubApi = new GitHub( this.#githubToken );

        var res;

        // get remove index
        const index = await this.#getIndex( gitHubApi );

        // get etag
        res = await this.getEtag();
        if ( !res.ok ) return res;

        const etag = this.#prepareEtag( res.data );

        // not modified
        if ( !force && etag === index?.[this.#name]?.etag ) return result( 304 );

        const tmp = new TmpDir();

        res = await this._build( tmp.path );

        if ( !res.pk ) return res;

        const assetPath = tmp.path + "/" + this.#name + ".tar.gz";

        tar.create( {
            "cwd": tmp.path,
            "gzip": true,
            "portable": true,
            "sync": true,
            "file": assetPath,
        } );

        // upload asset tar.gz
        res = await this.#uploadAsset( gitHubApi, new File( { "path": assetPath } ) );
        if ( !res.ok ) return res;

        // update index
        index[this.#name] ||= {};
        index[this.#name].etag = etag;
        index[this.#name].buildDate = new Date();

        // upload index
        res = await this.#uploadAsset( gitHubApi, new File( { "name": "index.json", "buffer": JSON.stringify( index, null, 4 ) } ) );
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

    async #getIndex ( gitHubApi ) {

        // get release id
        var res = await gitHubApi.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        res = await gitHubApi.downloadReleaseAssetByName( this.#repository, res.data.id, "index.json" );

        if ( !res.ok ) return result( res );

        return res.json();
    }

    async #uploadAsset ( gitHubApi, file ) {

        // get release id
        const res = await gitHubApi.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        return gitHubApi.updateReleaseAsset( this.#repository, res.data.id, file );
    }
}
