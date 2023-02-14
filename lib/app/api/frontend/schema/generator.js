import FileTree from "#lib/file-tree";
import ejs from "#lib/ejs";
import { resolve } from "#lib/utils";

import readKeyword from "./keywords/read.js";
import fileKeyword from "./keywords/file.js";

const apiSchemaTmpl = resolve( "#resources/templates/api-schema.md.ejs", import.meta.url );

const MARKDOWN_TYPE = {
    "object": "Object",
    "array": "Array",
};

export default class {
    #schema;
    #options;

    constructor ( schema, options ) {
        this.#schema = schema;
        this.#options = options;
    }

    // properties
    get schema () {
        return this.#schema;
    }

    get options () {
        return this.#options;
    }

    // public
    async run () {
        const fileTree = new FileTree(),
            versions = [];

        console.log( this.schema.modules );
        process.exit();

        // build versions index
        for ( const module of Object.values( this.schema.modules ) ) {

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

        const httpUrl = new URL( this.options.url );
        httpUrl.protocol = httpUrl.protocol === "http:" || httpUrl.protocol === "ws:" ? "http:" : "https:";
        if ( !httpUrl.pathname.endsWith( "/" ) ) httpUrl.pathname += "/";

        const webSocketsUrl = new URL( httpUrl );
        webSocketsUrl.protocol = httpUrl.protocol === "http:" ? "ws:" : "wss:";

        // build docs
        for ( const version in versions ) {
            fileTree.add( {
                "path": `${this.options.type}-v${version}.md`,
                "content": await ejs.renderFile(
                    apiSchemaTmpl,
                    {
                        version,
                        "modules": Object.values( versions[version] ),
                        "options": this.options,
                        httpUrl,
                        webSocketsUrl,
                        "getParamDescription": this.#getParamDescription.bind( this ),
                    },
                    { "async": true }
                ),
            } );
        }

        return result( 200, fileTree );
    }

    // private
    async #getParamDescription ( method, param ) {
        var desc = "";

        // read keyword
        if ( param.schema.read ) {
            desc += await readKeyword.getDescription( param );
        }

        // file keyword
        else if ( param.schema.file ) {
            desc += await fileKeyword.getDescription( param );
        }

        // raw parameter
        else {
            if ( param.description ) desc = param.description.trim();

            // descriprion has no type, try to get type from the schema
            if ( !desc.match( /^<([\w.]+)(\[\])?\\>/ ) ) {
                let types = param.schema?.instanceof || param.schema?.typeof || param.schema?.type;

                if ( !types ) throw `Method "${method.id}" parameter "${param.name}" has no type defined`;

                if ( !Array.isArray( types ) ) types = [types];

                desc = types.map( type => "<" + ( MARKDOWN_TYPE[type] || type ) + "\\>" ).join( " | " ) + ( desc ? " " + desc : "" );
            }
        }

        // indent
        if ( desc ) desc = " " + desc.replaceAll( /^/gm, " ".repeat( 4 ) ).replaceAll( /^ +$/gm, "" ).trim();

        return desc;
    }
}
