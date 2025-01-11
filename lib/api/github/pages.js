// NOTE https://docs.github.com/en/rest/reference/repos#pages

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/reference/repos#get-a-github-pages-site
        async getPages ( repo ) {
            return this._doRequest( "get", `repos/${ repo }/pages` );
        }

        // https://docs.github.com/en/rest/reference/repos#create-a-github-pages-site
        async createPages ( repo, branch, path ) {
            return this._doRequest( "post", `repos/${ repo }/pages`, {
                "headers": {
                    "Accept": "application/vnd.github.switcheroo-preview+json",
                },
                "body": JSON.stringify( {
                    "source": {
                        branch,
                        path,
                    },
                } ),
            } );
        }

        // https://docs.github.com/en/rest/reference/repos?query=#update-information-about-a-github-pages-site
        async updatePages ( repo, options = {} ) {
            return this._doRequest( "put", `repos/${ repo }/pages`, {
                "headers": {
                    "Accept": "application/vnd.github.switcheroo-preview+json",
                },
                "body": JSON.stringify( options ),
            } );
        }
    };
