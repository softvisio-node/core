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

        // https://docs.github.com/en/rest/repos/repos#enable-dependabot-security-updates
        // https://docs.github.com/en/rest/repos/repos#disable-dependabot-security-updates
        async setDependabotsecurityupdateEnabled ( repo, enabled ) {
            return this._doRequest( enabled
                ? "PUT"
                : "DELETE", `repos/${ repo }/automated-security-fixes` );
        }

        // https://docs.github.com/en/rest/repos/repos#check-if-private-vulnerability-reporting-is-enabled-for-a-repository
        async getPrivateVulnerabilityReportingEnabled ( repo ) {
            return this._doRequest( "get", `repos/${ repo }/private-vulnerability-reporting` );
        }

        // https://docs.github.com/en/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository
        // https://docs.github.com/en/rest/repos/repos#disable-private-vulnerability-reporting-for-a-repository
        async setPrivateVulnerabilityReportingEnabled ( repo, enabled ) {
            return this._doRequest( enabled
                ? "PUT"
                : "DELETE", `repos/${ repo }/private-vulnerability-reporting` );
        }

        // https://docs.github.com/en/rest/repos/repos#check-if-vulnerability-alerts-are-enabled-for-a-repository
        async getVulnerabilityAlertsEnabled ( repo ) {
            return this._doRequest( "get", `repos/${ repo }/vulnerability-alerts` );
        }

        // https://docs.github.com/en/rest/repos/repos#enable-vulnerability-alerts
        // https://docs.github.com/en/rest/repos/repos#disable-vulnerability-alerts
        async setVulnerabilityAlertsEnabled ( repo, enabled ) {
            return this._doRequest( enabled
                ? "PUT"
                : "DELETE", `repos/${ repo }/vulnerability-alerts` );
        }
    };
