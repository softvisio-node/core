import fetch from "#lib/fetch";

// NOTE https://docs.github.com/en/rest/reference/repos#releases

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/reference/repos#get-a-release-by-tag-name
        async getReleaseByTagName ( repo, tagName ) {
            return this._req( "get", `repos/${ repo }/releases/tags/${ tagName }` );
        }

        // https://docs.github.com/en/rest/reference/repos#list-release-assets
        // XXX fetch all pages
        async listReleaseAssets ( repo, releaseId ) {
            return this._req( "get", `repos/${ repo }/releases/${ releaseId }/assets`, {
                "search": {
                    "per_page": 100,
                },
            } );
        }

        // https://docs.github.com/en/rest/reference/repos#delete-a-release-asset
        async deleteReleaseAsset ( repo, assetId ) {
            return this._req( "delete", `repos/${ repo }/releases/assets/${ assetId }` );
        }

        // https://docs.github.com/en/rest/reference/repos#upload-a-release-asset
        async uploadReleaseAsset ( repo, releaseId, file ) {
            return this._req( "post", `https://uploads.github.com/repos/${ repo }/releases/${ releaseId }/assets`, {
                "search": { "name": file.name },
                "body": file,
            } );
        }

        // https://docs.github.com/en/rest/reference/repos#create-a-release
        async createRelease ( repo, tagName, options = {} ) {
            return this._req( "post", `repos/${ repo }/releases`, {
                "body": JSON.stringify( {
                    "tag_name": tagName,
                    "name": options.name,
                    "body": options.body,
                    "prerelease": options.prerelease,
                    "target_commitish": options.targetCommitish,
                    "draft": options.draft,
                    "discussion_category_name": options.discussionCategoryName,
                } ),
            } );
        }

        async updateReleaseAsset ( repo, releaseId, file ) {

            // get assets
            var res = await this.listReleaseAssets( repo, releaseId );
            if ( !res.ok ) return res;

            // find and remove asset
            for ( const asset of res.data ) {
                if ( asset.name === file.name ) {
                    res = await this.deleteReleaseAsset( repo, asset.id );
                    if ( !res.ok ) return res;

                    break;
                }
            }

            res = await this.uploadReleaseAsset( repo, releaseId, file );

            return res;
        }

        async downloadReleaseAssetByName ( repo, releaseId, name ) {

            // get assets
            var res = await this.listReleaseAssets( repo, releaseId );
            if ( !res.ok ) return res;

            let url;

            // find and remove asset
            for ( const asset of res.data ) {
                if ( asset.name === name ) {
                    url = asset.url;

                    break;
                }
            }

            if ( !url ) return result( 404 );

            return fetch( url, {
                "headers": {
                    "accept": "application/octet-stream",
                },
            } );
        }
    };
