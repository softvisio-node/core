import fs from "fs";
import _url from "url";
import glob from "glob";
import Module from "./schema/module.js";

const SPEC_EXTENSION = ".schema.yaml";

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
            return result.catchResult( e );
        }
    }

    async loadObjects ( api ) {
        try {
            for ( const method of Object.values( this.#methods ) ) await method.loadObject( api );

            return result( 200 );
        }
        catch ( e ) {
            return result.catchResult( e );
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

    async generate () {
        const fileTree = new fs.FileTree(),
            { "default": ejs } = await import( "ejs" ),

            // indexTmpl = fs.resolve( "#resources/tmpl/docs/index.md.ejs", import.meta.url ),
            moduleTmpl = fs.resolve( "#resources/tmpl/docs/api-module.md.ejs", import.meta.url );

        for ( const module of Object.values( this.#modules ) ) {
            if ( !module.namespace ) continue;

            fileTree.add( { "path": module.namespace + ".md", "data": await ejs.renderFile( moduleTmpl, { module } ) } );
        }

        // generate main index
        if ( !fileTree.isEmpty ) {

            // fileTree.add( { "path": "README.md", "data": await ejs.renderFile( indexTmpl, { "modules": this.#modules } ) } );
        }

        return fileTree;
    }
}
