import fs from "fs";
import _url from "url";
import glob from "glob";
import Module from "./schema/module.js";

const SPEC_EXTENSION = ".schema.yaml";

const MARKDOWN_TYPE = {
    "object": "Object",
    "array": "Array",
};

export default class APISchema {
    #url;
    #isInitialized;
    #schema = {}; // XXX remove
    #modules = {};
    #methods = {};
    #logMethods;

    constructor ( url ) {
        this.#url = url + "";
    }

    get url () {
        return this.#url;
    }

    get methods () {
        return this.#methods;
    }

    // public
    loadSchema () {
        try {
            const modules = glob.sync( "**/*" + SPEC_EXTENSION, { "cwd": _url.fileURLToPath( this.#url ), "nodir": true } );

            for ( const file of modules ) {
                const module = this.loadModule( this.#url + "/" + file.replace( SPEC_EXTENSION, "" ) );

                for ( const method of Object.values( module.methods ) ) {
                    this.#methods[method.id] = method;
                }
            }

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async loadAPI ( api ) {
        try {
            for ( const method of Object.values( this.#methods ) ) await method.loadAPI( api );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    loadModule ( url ) {
        if ( this.#modules[url] ) return this.#modules[url];

        const module = new Module( this, url + "" );

        this.#modules[module.url] = module;

        return module;
    }

    findMethod ( id ) {
        const params = [];

        while ( 1 ) {
            if ( this.#methods[id] ) return [id, params];

            const idx = id.lastIndexOf( "/" );

            if ( idx === -1 ) return [null, params];

            params.unshift( id.substr( idx + 1 ) );

            id = id.substr( 0, idx );
        }
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const method of Object.keys( this.#methods ).sort() ) {
                if ( this.#methods[method].logApiCalls ) this.#logMethods[method] = this.#methods[method];
            }
        }

        return this.#logMethods;
    }

    async generate ( options = {} ) {
        const fileTree = new fs.FileTree(),
            { "default": ejs } = await import( "ejs" ),
            apiSchemaTmpl = fs.resolve( "#resources/templates/api-schema.md.ejs", import.meta.url ),
            versions = {};

        // build versions index
        for ( const module of Object.values( this.#modules ) ) {

            // skip external modules
            if ( !module.namespace ) continue;

            let hasMethods;

            for ( const method of Object.values( module.methods ) ) {
                if ( method.private ) continue;

                hasMethods = true;
            }

            // skip modules without methods
            if ( !hasMethods ) continue;

            versions[module.version] ||= {};
            versions[module.version][module.namespace] = module;
        }

        const httpURL = new URL( options.url );
        httpURL.protocol = httpURL.protocol === "http:" || httpURL.protocol === "ws:" ? "http:" : "https:";
        if ( !httpURL.pathname.endsWith( "/" ) ) httpURL.pathname += "/";

        const wsURL = new URL( httpURL );
        wsURL.protocol = httpURL.protocol === "http:" ? "ws:" : "wss:";

        // build docs
        for ( const version in versions ) {
            fileTree.add( {
                "path": `${options.type}-v${version}.md`,
                "data": await ejs.renderFile( apiSchemaTmpl, {
                    version,
                    "modules": Object.values( versions[version] ),
                    options,
                    httpURL,
                    wsURL,
                    "getParamDescription": this.#getParamDescription.bind( this ),
                } ),
            } );
        }

        return fileTree;
    }

    // private
    #getParamDescription ( param ) {

        // <%- param.description ? " " + param.description.replaceAll( /^/gm, " ".repeat( 4 ) ).replaceAll( /^ +$/gm, "" ).trim() : "" %>
        // /<([\w.]+)(\[\])?\\>/g

        var desc = "";

        if ( param.description ) desc = param.description.trim();

        // desc has no type, try to get type from the schema
        if ( !desc.match( /^<([\w.]+)(\[\])?\\>/ ) ) {
            let types = param.schema?.type;

            if ( !types ) throw `Parameter "${param.name}" has no type defined`;

            if ( !Array.isArray( types ) ) types = [types];

            desc = types.map( type => "<" + ( MARKDOWN_TYPE[type] || type ) + "\\>" ).join( " | " ) + " " + desc;
        }

        if ( desc ) desc = " " + desc;

        return desc;
    }
}
