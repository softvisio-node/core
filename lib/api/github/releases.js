// NOTE https://docs.github.com/en/rest/releases/releases

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/releases/releases#get-a-release-by-tag-name
        async getReleaseByTagName ( repositorySlug, tagName ) {
            return this._doRequest( "get", `repos/${ repositorySlug }/releases/tags/${ tagName }` );
        }

        // https://docs.github.com/en/rest/releases/assets#list-release-assets
        // XXX fetch all pages
        async listReleaseAssets ( repositorySlug, releaseId ) {
            return this._doRequest( "get", `repos/${ repositorySlug }/releases/${ releaseId }/assets`, {
                "search": {
                    "per_page": 100,
                },
            } );
        }

        // https://docs.github.com/en/rest/releases/assets#delete-a-release-asset
        async deleteReleaseAsset ( repositorySlug, assetId ) {
            return this._doRequest( "delete", `repos/${ repositorySlug }/releases/assets/${ assetId }` );
        }

        // https://docs.github.com/en/rest/releases/assets#upload-a-release-asset
        async uploadReleaseAsset ( repositorySlug, releaseId, file ) {
            return this._doRequest( "post", `https://uploads.github.com/repos/${ repositorySlug }/releases/${ releaseId }/assets`, {
                "search": {
                    "name": file.name,
                },
                "body": file,
            } );
        }

        // https://docs.github.com/en/rest/releases/releases#create-a-release
        async createRelease ( repositorySlug, tagName, options = {} ) {
            return this._doRequest( "post", `repos/${ repositorySlug }/releases`, {
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

        async updateReleaseAsset ( repositorySlug, releaseId, file ) {

            // get assets
            var res = await this.listReleaseAssets( repositorySlug, releaseId );
            if ( !res.ok ) return res;

            // find and remove asset
            for ( const asset of res.data ) {
                if ( asset.name === file.name ) {
                    res = await this.deleteReleaseAsset( repositorySlug, asset.id );
                    if ( !res.ok ) return res;

                    break;
                }
            }

            res = await this.uploadReleaseAsset( repositorySlug, releaseId, file );

            return res;
        }

        async downloadReleaseAssetByName ( repositorySlug, releaseId, name ) {

            // get assets
            var res = await this.listReleaseAssets( repositorySlug, releaseId );
            if ( !res.ok ) return res;

            let url;

            // find asset
            for ( const asset of res.data ) {
                if ( asset.name === name ) {
                    url = asset.url;

                    break;
                }
            }

            if ( !url ) return result( 404 );

            return this._doRequest( "GET", url, {
                "headers": {
                    "accept": "application/octet-stream",
                },
                "rateLimit": true,
                "download": true,
            } );
        }
    };
