// https://git-scm.com/docs/git-clone#_git_urls_a_id_urls_a

const ISSUE_RE = /(?<=^|\W)(?<repoId>[\w.-]+\/[\w.-]+)?#(?<issueId>\d+)(?=\W|$)/g;

export default class GitUpstream {
    repoNamespace;
    repoName;
    repoId;
    host;

    hosting; // github, bitbucket, gitlab
    sshPort;
    httpsPort;

    constructor ( url ) {
        var match = url.match( /^git@([A-Za-z0-9.-]+?):([A-Za-z0-9_-]+?)\/([A-Za-z0-9_.-]+)/ );

        // git@github.com:softvisio/phonegap.git
        if ( match ) {
            this.host = match[1];
            this.repoNamespace = match[2];
            this.repoName = match[3];
        }

        // https://github.com/softvisio/phonegap.git
        // git://github.com/softvisio/phonegap.git
        // ssh://git@github.com/softvisio/phonegap.git
        else {
            url = new URL( url, "file:" );

            if ( url.schema === "file:" ) return;

            this.host = url.hostname;

            if ( url.port ) {
                if ( url.protocol === "https:" ) this.httpsPort = url.port;
                else if ( url.protocol === "ssh:" ) this.sshPort = url.port;
            }

            match = url.pathname.match( /([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)/ );

            if ( match ) {
                this.repoNamespace = match[1];
                this.repoName = match[2];
            }
        }

        this.repoName = this.repoName.replace( /\.git$/, "" );

        this.repoId = this.repoNamespace + "/" + this.repoName;

        if ( this.host.indexOf( "bitbucket" ) > -1 ) this.hosting = "bitbucket";
        else if ( this.host.indexOf( "github" ) > -1 ) this.hosting = "github";
        else if ( this.host.indexOf( "gitlab" ) > -1 ) this.hosting = "gitlab";
    }

    get isGithub () {
        return this.hosting === "github";
    }

    get isBitbucket () {
        return this.hosting === "bitbucket";
    }

    get isGitlab () {
        return this.hosting === "gitlab";
    }

    get httpsCloneUrl () {
        return this.#getBaseUrl( true ) + ".git";
    }

    get sshCloneUrl () {
        return this.#getBaseUrl( false ) + ".git";
    }

    get httpsWikiCloneUrl () {
        return this.#getWikiCloneUrl( true );
    }

    get sshWikiCloneUrl () {
        return this.#getWikiCloneUrl( false );
    }

    get homeUrl () {
        return this.#getBaseUrl( true );
    }

    get issuesUrl () {
        return this.#getIssuesUrl();
    }

    get discussionsUrl () {
        var url = this.#getBaseUrl( true );

        // github
        if ( this.isGithub ) {
            return url + "/discussions";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return null;
        }

        // gitlab
        else {
            return null;
        }
    }

    get wikiUrl () {
        var url = this.#getBaseUrl( true );

        // github
        if ( this.isGithub ) {
            url += "/wiki";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            url += "/wiki";
        }

        // gitlab
        else {
            url += "/-/wikis";
        }

        return url;
    }

    get docsUrl () {

        // github
        if ( this.isGithub ) {
            return `https://${this.repoNamespace}.github.io/${this.repoName}/`;
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return null;
        }

        // gitlab
        else {
            return null;
        }
    }

    get rawUrl () {

        // github
        if ( this.isGithub ) {
            return `https://raw.githubusercontent.com/${this.repoId}`;
        }

        // bitbucket
        else if ( this.isBirbucket ) {
            return `https://bitbucket.org/${this.repoId}/raw`;
        }

        // gitlab
        else {
            return `${this.#getBaseUrl( true )}/-/raw`;
        }
    }

    // public
    getChangelogUrl ( branch ) {
        branch ||= "master";

        return this.rawUrl + "/" + branch + "/CHANGELOG.md";
    }

    getCommitUrl ( hash ) {

        // github
        if ( this.isGithub ) {
            return `${this.#getBaseUrl( true )}/commit/${hash}`;
        }

        // bitbucket
        else if ( this.isBirbucket ) {
            return `${this.#getBaseUrl( true )}/commit/${hash}`;
        }

        // gitlab
        else {
            return `${this.#getBaseUrl( true )}/-/commit/${hash}`;
        }
    }

    getIssueUrl ( id, repoId ) {
        return this.#getIssuesUrl( repoId ) + "/" + id;
    }

    linkifyMessage ( message ) {

        // linkify issues
        return message.replaceAll( ISSUE_RE, ( match, repoId, issueId ) => {
            var link;

            if ( !repoId || repoId === this.repoId ) {
                link = `[#${issueId}](${this.getIssueUrl( issueId )})`;
            }
            else {
                link = `[${repoId}#${issueId}](${this.getIssueUrl( issueId, repoId )})`;
            }

            return link;
        } );
    }

    // private
    #getBaseUrl ( https, repoId ) {
        var url = https ? "https://" : "ssh://git@";

        url += this.host;

        if ( https ) {
            if ( this.httpsPort ) url += ":" + this.httpsPort;
        }
        else {
            if ( this.sshPort ) url += ":" + this.sshPort;
        }

        url += "/" + ( repoId || this.repoId );

        return url;
    }

    #getWikiCloneUrl ( https ) {
        const url = this.#getBaseUrl( https );

        // bitbucket
        if ( this.isBitbucket ) {
            return url + ".git/wiki";
        }

        // github, gitlab
        else {
            return url + ".wiki.git";
        }
    }

    #getIssuesUrl ( repoId ) {
        var url = this.#getBaseUrl( true, repoId );

        // github
        if ( this.isGithub ) {
            return url + "/issues";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return url + "/issues";
        }

        // gitlab
        else {
            return url + "/-/issues";
        }
    }
}
