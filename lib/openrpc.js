const Base = require( "./base" );
const config = require( "./config" );
const Ajv = require( "ajv" );
const res = require( "./result" );
const fs = require( "fs" );
const path = require( "path" );
const util = require( "@softvisio/core/lib/util" );
const url = require( "url" );

const specValidator = loadSpecValidator( require.resolve( "../resources/openrpc.schema.yaml" ) );

const docIndent = 2;

function loadSpecValidator ( path ) {
    var ajv = new Ajv();

    var spec = config.read( path );

    spec.components = spec.components || {};

    for ( const componentName in spec.components ) {
        const component = spec.components[componentName];

        ajv.addSchema( component, `/#/components/${componentName}` );
    }

    spec.schema.$id = "/";

    return ajv.compile( spec.schema );
}

module.exports = class OpenRpc extends Base {
    specs = {};
    refs = {};
    methods = {};

    constructor () {
        super();
    }

    async loadSchemas ( schemas ) {
        var ajv = new Ajv();

        for ( const schema of schemas ) {
            const stat = fs.lstatSync( schema.path );

            if ( !stat ) {
                throw `Schema ${schema.path} is not exists`;
            }

            if ( stat.isFile() ) {
                this._loadSchema( ajv, schema.namespace, "/", schema.path );
            }
            else {
                var files = await util.readTree( schema.path );

                for ( const file of files ) {
                    const ext = path.extname( file );

                    // skip non-yaml files
                    if ( ext !== ".yaml" && ext !== ".yml" ) continue;

                    const schemaPath = path.posix.normalize( `/${path.dirname( file )}/${path.basename( file, ext )}` );

                    this._loadSchema( ajv, schema.namespace, schemaPath, `${schema.path}/${file}` );
                }
            }
        }

        this._compileMethods( ajv );
    }

    _loadSchema ( ajv, namespace, path, filename ) {
        // read spec
        var spec = config.read( filename );

        // validate spec
        if ( !specValidator( spec ) ) {
            throw specValidator.errors;
        }

        spec.namespace = namespace;
        spec.path = path;

        this.specs[namespace] = this.specs[namespace] || {};
        this.specs[namespace][path] = this.specs[namespace][path] || {};

        // register spec
        this.specs[namespace][path] = spec;

        // load components
        spec.components = spec.components || {};
        for ( const componentClass in spec.components ) {
            for ( const componentName in spec.components[componentClass] ) {
                const component = spec.components[componentClass][componentName];

                const ref = `//${namespace}${path}#/components/${componentClass}/${componentName}`;

                // register component
                this.refs[ref] = component;

                ajv.addSchema( component, ref );
            }
        }

        this.methods[namespace] = {};

        // load schema methods
        spec.methods = spec.methods || [];
        for ( const method of spec.methods ) {
            method.id = `${path}/${method.name}`;
            method.namespace = namespace;
            method.path = path;

            // check, that method is unique globally
            if ( this.methods[namespace][method.id] ) {
                throw `Method ${method.namespace}/${method.id} is not unique`;
            }

            // register method
            this.methods[namespace][method.id] = method;
        }
    }

    _compileMethods ( ajv ) {
        for ( const namespace in this.methods ) {
            for ( const methodId in this.methods[namespace] ) {
                const method = this.methods[namespace][methodId],
                    params = [];

                // method has no params
                if ( !method.params ) {
                    method.validator = function () {
                        return true;
                    };

                    return;
                }

                let maxItems = 0,
                    minItems = 0;

                method.params = method.params || [];

                for ( const param of method.params ) {
                    maxItems++;

                    // param is required
                    if ( param.required ) {
                        minItems = maxItems;

                        params.push( param.schema );
                    }

                    // param is not required
                    else {
                        params.push( {
                            "anyOf": [{ "type": "null" }, param.schema],
                        } );
                    }
                }

                // create methos schema
                const schema = {
                    "$id": `//${method.namespace}${method.path}#/methods/${method.name}`,
                    "type": "array",
                    minItems,
                    maxItems,
                    "items": params,
                };

                // compile method schema validator
                method.validator = ajv.compile( schema );
            }
        }
    }

    validate ( namespace, method, data ) {
        var methodSpec = this.methods[namespace][method];

        // method not found
        if ( !methodSpec ) {
            throw "Method not found";
        }

        // method is deprecated
        if ( methodSpec.deprecated ) {
            throw "Method is deprecated";
        }

        // validate schema
        if ( methodSpec.validator( data ) ) {
            return res( 200 );
        }
        else {
            return res( 400, methodSpec.validator.errors );
        }
    }

    generate ( namespace, outputDir ) {
        var refs = {};

        const jsonReplacer = function ( key, val ) {
            if ( key === "" ) return val;

            if ( Array.isArray( val ) ) {
                if ( key === "enum" ) {
                    return val.join( ", " );
                }
                else if ( key === "type" ) {
                    return val.join( ", " );
                }
                else if ( key === "required" ) {
                    return val.join( ", " );
                }
            }

            return val;
        };

        // serialize schema components
        for ( const ref in this.refs ) {
            refs[ref] = JSON.stringify( this.refs[ref], jsonReplacer );
        }

        var specUri;

        var resolveRef = function ( match, ref ) {
            const componentUri = url.resolve( specUri, ref );

            return refs[componentUri];
        };

        var index = `
# API Documentation

        `;

        for ( const id in this.specs[namespace] ) {
            const spec = this.specs[namespace][id];

            specUri = `//${spec.namespace}${spec.path}`;

            const specRelativePath = spec.path.substring( 1 );

            index += `
__* [${spec.path}](./${specRelativePath})__${spec.info.title ? ` - ${spec.info.title}` : ""}
            `;

            // title
            let md = `
# ${spec.info.title}

version: __${spec.info.version}__


${spec.info.description}
            `;

            // TOC
            md += `
## Table of Contents

* Methods
            `;

            for ( const method of spec.methods ) {
                md += `
    __* [${method.name}](#${method.name})__${method.summary ? ` - ${method.summary}` : ""}
`;
            }

            // methods
            md += `
## Methods
`;

            for ( const method of spec.methods ) {
                // method title
                let parameters = "";
                if ( method.params ) {
                    parameters = method.params.map( ( e ) => e.name ).join( ", " );
                }

                md += `
## ${method.deprecated ? "~~" : ""}${method.name}${method.deprecated ? "~~" : ""}

${method.deprecated ? "__DEPRECATED__" : ""}

${method.summary ? `__Summary__: ${method.summary}<br/>` : ""}${method.description ? `${method.description}` : ""}

\`\`\`javascript
let res = await $api.call( "${method.id}"${parameters ? `, ${parameters}` : ""} );
\`\`\`
                `;

                // method params
                md += `
### Parameters:
                `;

                // method has no params
                if ( !method.params ) {
                    md += `
Method require no parameters.
                    `;

                    continue;
                }

                for ( const param of method.params ) {
                    // prepare schema JSON
                    let schema = JSON.stringify( param.schema, jsonReplacer );

                    schema = schema.replace( /{"\$ref":"([^"]+)"}/g, resolveRef );

                    const YAML = require( "yaml" );

                    // schema = JSON.stringify( JSON.parse( schema ), null, docIndent );
                    schema = YAML.stringify( JSON.parse( schema ), { "indent": docIndent } );

                    md += `
* __${param.name}__${param.summary ? ` - ${param.summary}` : ""}

${param.deprecated ? "This parameter is __DEPRECATED__." : ""}

${param.required ? "This parameter is __REQUIRED__." : ""}

${param.description || ""}

\`\`\`yaml
${schema}
\`\`\`
                    `;
                }
            }

            const specPath = outputDir + spec.path + ".md";
            fs.mkdirSync( path.dirname( specPath ), { "recursive": true } );
            fs.writeFileSync( specPath, md );
        }

        // generate entry point
        fs.writeFileSync( outputDir + "/index.md", index );
    }
};
