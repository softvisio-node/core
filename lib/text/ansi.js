const ANSI_REGEXP = new RegExp( /(?:\x1b\[|\u009b)[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/, "g" );
const ANSI_KEEP_STYLES_REGEXP = new RegExp( /(?:\x1b\[|\u009b)[\x30-\x3f]*[\x20-\x2f]*[\x40-\x6c\x6e\x7e]/, "g" ); // ANSI SGR code ends with the "m"
const RESET = "\x1b[0m";
const RESET_FOREGROUND = "\x1b[39m";
const RESET_BACKGROUND = "\x1b[49m";
const COLOR_BUFFER = Buffer.alloc( 4 );
var ANSI_ENABLED = true;

function createColorCode ( prefix, color ) {

    // array
    if ( Array.isArray( color ) ) {
        return `\x1b[${prefix};2;${color.join( ";" )}m`;
    }

    // number
    else if ( typeof color === "number" ) {
        COLOR_BUFFER.writeUInt32BE( color );
    }

    // hex string
    else if ( typeof color === "string" ) {
        COLOR_BUFFER.write( color, 1, 3, "hex" );
    }

    // invalid value
    else {
        throw `Color value is invalid`;
    }

    return `\x1b[${prefix};2;${COLOR_BUFFER.readUInt8( 1 )};${COLOR_BUFFER.readUInt8( 2 )};${COLOR_BUFFER.readUInt8( 3 )}m`;
}

function _wrap ( string, on, off ) {
    if ( !ANSI_ENABLED ) return string;

    if ( string === "" ) return "";

    // serialize string
    string += "";

    if ( string.includes( "\n" ) ) {
        return on + string.replaceAll( /\r*\n/g, `${off}$&${on}` ) + off;
    }
    else {
        return on + string + off;
    }
}

class AnsiStyle {
    static defineAnsiCode ( name, on, off ) {
        Object.defineProperty( AnsiStyle.prototype, name, {
            get () {
                if ( on ) this.on += on;
                if ( off ) this.off = off + this.off;

                return this;
            },
        } );
    }

    color ( color ) {
        this.on += createColorCode( 38, color );
        this.off = RESET_FOREGROUND + this.off;

        return this;
    }

    onColor ( color ) {
        this.on += createColorCode( 48, color );
        this.off = RESET_BACKGROUND + this.off;

        return this;
    }
}

function createAnsiStyleWrapper ( on, off ) {
    const ansiStyleWrapper = string => _wrap( string, ansiStyleWrapper.on, ansiStyleWrapper.off );

    Reflect.setPrototypeOf( ansiStyleWrapper, AnsiStyle.prototype );

    ansiStyleWrapper.on = on;
    ansiStyleWrapper.off = off || "";

    return ansiStyleWrapper;
}

class ANSI {

    // static
    static defineAnsiCode ( name, on, off ) {
        Object.defineProperty( ANSI.prototype, name, {
            get () {
                return createAnsiStyleWrapper( on, off );
            },
        } );

        AnsiStyle.defineAnsiCode( name, on, off );
    }

    // properties
    get RESET () {
        return RESET;
    }

    get isEnabled () {
        return ANSI_ENABLED;
    }

    set isEnabled ( value ) {
        ANSI_ENABLED = !!value;
    }

    get regExp () {
        return ANSI_REGEXP;
    }

    // public
    enable () {
        ANSI_ENABLED = true;
    }

    disable () {
        ANSI_ENABLED = false;
    }

    defineStyle ( name, style ) {
        if ( !( style instanceof AnsiStyle ) ) throw `ANSI style is invalid`;

        Object.defineProperty( ANSI.prototype, name, {
            "configurable": true,
            value ( string ) {
                return style( string );
            },
        } );
    }

    defineStyles ( styles ) {
        for ( const name in styles ) this.defineStyle( name, styles[name] );
    }

    defineColor ( name, color ) {
        ANSI.defineAnsiCode( name, createColorCode( 38, color ), RESET_FOREGROUND );

        ANSI.defineAnsiCode( "on" + name.charAt( 0 ).toUpperCase() + name.substring( 1 ), createColorCode( 48, color ), RESET_BACKGROUND );
    }

    defineColors ( colors ) {
        for ( const name in colors ) this.defineColor( name, colors[name] );
    }

    color ( color ) {
        return createAnsiStyleWrapper( createColorCode( 38, color ), RESET_FOREGROUND );
    }

    onColor ( color ) {
        return createAnsiStyleWrapper( createColorCode( 48, color ), RESET_BACKGROUND );
    }

    reset ( string ) {
        return string + RESET;
    }

    remove ( string, options = {} ) {
        if ( options.keepStyles ) {
            return string.replaceAll( ANSI_KEEP_STYLES_REGEXP, "" );
        }
        else {
            return string.replaceAll( ANSI_REGEXP, "" );
        }
    }
}

const codes = {
    "reset": [0, null],
    "bold": [1, 22],

    // "dim": [2, 22],
    "italic": [3, 23],
    "underline": [4, 24],
    "inverse": [7, 27],
    "hidden": [8, 28],
    "strikethrough": [9, 29],

    "black": [30, 39],
    "red": [31, 39],
    "green": [32, 39],
    "yellow": [33, 39],
    "blue": [34, 39],
    "magenta": [35, 39],
    "cyan": [36, 39],
    "white": [37, 39],
    "gray": [90, 39], // alias for brightBlack
    "grey": [90, 39], // alias for brightBlack

    "onBlack": [40, 49],
    "onRed": [41, 49],
    "onGreen": [42, 49],
    "onYellow": [43, 49],
    "onBlue": [44, 49],
    "onMagenta": [45, 49],
    "onCyan": [46, 49],
    "onWhite": [47, 49],
    "onGray": [100, 49], // alias for onBrightBlack
    "onGrey": [100, 49], // alias for onBrightBlack

    "brightBlack": [90, 39],
    "brightRed": [91, 39],
    "brightGreen": [92, 39],
    "brightYellow": [93, 39],
    "brightBlue": [94, 39],
    "brightMagenta": [95, 39],
    "brightCyan": [96, 39],
    "brightWhite": [97, 39],

    "onBrightBlack": [100, 49],
    "onBrightRed": [101, 49],
    "onBrightGreen": [102, 49],
    "onBrightYellow": [103, 49],
    "onBrightBlue": [104, 49],
    "onBrightMagenta": [105, 49],
    "onBrightCyan": [106, 49],
    "onBrightWhite": [107, 49],
};

for ( const name in codes ) ANSI.defineAnsiCode( name, "\x1b[" + codes[name][0] + "m", codes[name][1] ? "\x1b[" + codes[name][1] + "m" : null );

const ansi = new ANSI();

ansi.defineStyles( {
    "hl": ansi.brightWhite,
    "dim": ansi.gray,
    "ok": ansi.bold.brightWhite.onColor( 0x6400 ),
    "warn": ansi.color( 0x0 ).onColor( 0xcccc00 ),
    "error": ansi.bold.brightWhite.onRed,
    "dark": ansi.white.onColor( 0x333333 ),
} );

export { ansi as default };
