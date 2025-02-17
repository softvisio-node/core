// NOTE https://docs.github.com/en/rest/repos/repos

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/repos/repos#get-a-repository
        async getRepository ( repo ) {
            return this._doRequest( "get", `repos/${ repo }` );
        }

        // https://docs.github.com/en/rest/repos/repos#update-a-repository
        async updateRepository ( repo, data ) {
            return this._doRequest( "PATCH", `repos/${ repo }`, {
                "body": JSON.stringify( data ),
            } );
        }

        // https://docs.github.com/en/rest/repos/repos#check-if-dependabot-security-updates-are-enabled-for-a-repository
        async getDependabotsecurityupdatesEnabled ( repo ) {
            return this._doRequest( "get", `repos/${ repo }/automated-security-fixes` );
        }
    };
