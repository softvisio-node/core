import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { defaultHandlers, toMarkdown } from "mdast-util-to-markdown";
import { toString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";
import { CONTINUE, EXIT, SKIP, visit } from "unist-util-visit";
import ansi from "#lib/text/ansi";

const fromMarkdownOptions = {
        "extensions": [ gfm() ],
        "mdastExtensions": [ gfmFromMarkdown() ],
    },
    toMarkdownOptions = {
        "extensions": [ gfmToMarkdown() ],
        "resourceLink": false,
        "bullet": "-",
        "emphasis": "_",
        "strong": "*",
        "listItemIndent": "one",
        "rule": "-",
    },
    ANSI_STYLES = {
        "code": ansi.cyan,
        "inlineCode": ansi.cyan,
        "heading": ansi.underline.bold,
        "emphasis": ansi.italic,
        "strong": ansi.bold,
        "strikethrough": ansi.strikethrough,
        "thematicBreak": ansi.dim,
        "link": ansi.blue.underline,
        "footnote": ansi.underline,
    },
    MARKDOWN_CODE_LANGUAGES = {
        "javascript": {
            "aliases": [ "js" ],
            "type": "text/javascript",
        },
        "typescript": {
            "aliases": [ "ts" ],
            "type": "application/x-typescript",
        },
        "markdown": {
            "aliases": [ "md" ],
            "type": "text/markdown",
        },
        "shell": {
            "aliases": [ "sh" ],
            "type": "application/x-sh",
        },
        "text": {
            "aliases": [ "txt" ],
            "type": null,
        },
    };

export default class Markdown {
    static #codeLanguage;
    #source;
    #ast;

    constructor ( source ) {
        this.#source = source;
    }

    // static
    static getCodeLanguage ( language ) {
        if ( !this.#codeLanguage ) {
            this.#codeLanguage = {};

            for ( const lng in MARKDOWN_CODE_LANGUAGES ) {
                MARKDOWN_CODE_LANGUAGES[ lng ].language = lng;

                this.#codeLanguage[ lng ] = MARKDOWN_CODE_LANGUAGES[ lng ];

                for ( const alias of MARKDOWN_CODE_LANGUAGES[ lng ].aliases || [] ) {
                    this.#codeLanguage[ alias ] = MARKDOWN_CODE_LANGUAGES[ lng ];
                }
            }
        }

        return this.#codeLanguage[ language ];
    }

    // properties
    get source () {
        return this.#source;
    }

    get defaultHandlers () {
        return defaultHandlers;
    }

    get CONTINUE () {
        return CONTINUE;
    }

    get EXIT () {
        return EXIT;
    }

    get SKIP () {
        return SKIP;
    }

    // public
    toMarkdown ( options = {} ) {
        return toMarkdown( this.#getAst(), {
            ...toMarkdownOptions,
            ...options,
        } );
    }

    toString () {
        return this.#toString();
    }

    toAnsi ( { styles = {} } = {} ) {
        styles = {
            ...ANSI_STYLES,
            ...styles,
        };

        return this.#toString( {
            styles,
        } );
    }

    traverse ( callback, { test, reverse } = {} ) {
        visit( this.#getAst(), test, callback, reverse );

        return this;
    }

    getCodeLanguage ( language ) {
        return this.constructor.getCodeLanguage( language );
    }

    nodeToString ( node ) {
        return this.#nodeToString( node );
    }

    // private
    #getAst () {
        if ( this.#ast == null ) {
            this.#ast = fromMarkdown( this.#source, fromMarkdownOptions );
        }

        return this.#ast;
    }

    #toString ( { thematicBreakWidth, styles = {} } = {} ) {
        thematicBreakWidth ||= 3;

        return this.toMarkdown( {
            "handlers": {
                "heading": ( node, parent, context ) => {
                    const depth = Math.max( Math.min( 6, node.depth || 1 ), 1 ),
                        prefix = "#".repeat( depth ),
                        value = this.#nodeToString( node );

                    return this.#applyStyle( value
                        ? prefix + " " + value
                        : prefix, styles.heading );
                },

                "text": ( node, parent ) => {
                    return this.#applyStyle( this.#nodeToString( node ) );
                },

                "emphasis": ( node, parent, context ) => {
                    return this.#applyStyle( this.#nodeToString( node ), styles.emphasis );
                },

                "strong": ( node, parent, context ) => {
                    return this.#applyStyle( this.#nodeToString( node ), styles.strong );
                },

                // strikethrough
                "delete": ( node, parent ) => {
                    return this.#applyStyle( this.#nodeToString( node ), styles.strikethrough );
                },

                "thematicBreak": ( node, parent, context ) => {
                    return this.#applyStyle( "—".repeat( thematicBreakWidth ), styles.thematicBreak );
                },

                "inlineCode": node => {
                    return this.#applyStyle( this.#nodeToString( node ), styles.inlineCode );
                },

                "code": node => {
                    return `\`\`\`${ this.getCodeLanguage( node.lang )?.language || node.lang || "" }
${ this.#applyStyle( this.#nodeToString( node ), styles.code ) }
\`\`\``;
                },

                "link": ( node, parent, context ) => {
                    if ( !node.url ) {
                        return this.#applyStyle( this.#nodeToString( node ), styles.link );
                    }
                    else {
                        const url = this.#parseUrl( node.url, "http:" ),
                            label = this.#parseUrl( this.#nodeToString( node.children[ 0 ] ), url.startsWith( "mailto:" )
                                ? "mailto:"
                                : "http:" );

                        if ( url === label ) {
                            return this.#applyStyle( node.url, styles.link );
                        }
                        else {
                            return `${ this.#applyStyle( this.#nodeToString( node.children[ 0 ] ) ) }: ${ this.#applyStyle( node.url, styles.link ) }`;
                        }
                    }
                },

                "footnoteReference": node => {
                    return this.#applyStyle( `[^${ node.label }]`, styles.footnote );
                },

                "footnoteDefinition": node => {
                    return this.#applyStyle( `[^${ node.label }]`, styles.footnote ) + ": " + this.#nodeToString( node );
                },
            },
        } );
    }

    #parseUrl ( url, protocol ) {
        try {
            return new URL( url ).href;
        }
        catch {}

        try {
            if ( protocol === "mailto:" ) {
                return new URL( protocol + url ).href;
            }
            else if ( url.startsWith( "//" ) ) {
                return new URL( protocol + url ).href;
            }
            else {
                return new URL( protocol + "//" + url ).href;
            }
        }
        catch {}

        return url;
    }

    #nodeToString ( node ) {
        return toString( node );
    }

    #applyStyle ( string, style ) {
        if ( style ) {
            return style( string );
        }
        else {
            return string;
        }
    }
}
