const STYLES = {
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
    "gray": [90, 39],
    "grey": [90, 39],

    "onBlack": [40, 49],
    "onRed": [41, 49],
    "onGreen": [42, 49],
    "onYellow": [43, 49],
    "onBlue": [44, 49],
    "onMagenta": [45, 49],
    "onCyan": [46, 49],
    "onWhite": [47, 49],

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

// eslint-disable-next-line no-control-regex
const ANSI_REGEXP = new RegExp( /\x1b\[.*?m/, "g" );
const RESET = "\x1b[0m";
const RESET_FOREGROUND = "\x1b[39m";
const RESET_BACKGROUND = "\x1b[49m";

function createRGBCode ( prefix, color ) {
    return "\x1b[" + prefix + ";2;" + color.join( ";" ) + "m";
}

function wrap ( string, on, off ) {
    if ( string === "" ) return "";

    on = on.join( "" );
    off = off.join( "" );

    // serialize string
    string += "";

    if ( string.includes( "\n" ) ) {
        return on + string.replaceAll( /\r*\n/g, `${off}$&${on}` ) + off;
    }
    else {
        return on + string + off;
    }
}

class ANSIStyle {
    static add ( name, on, off ) {
        Object.defineProperty( ANSIStyle.prototype, name, {
            get () {
                if ( on ) this.on.push( on );
                if ( off ) this.off.unshift( off );

                return this;
            },
        } );
    }

    RGB ( color ) {
        this.on.push( createRGBCode( 38, color ) );
        this.off.push( RESET_FOREGROUND );

        return this;
    }

    onRGB ( color ) {
        this.on.push( createRGBCode( 48, color ) );
        this.off.push( RESET_BACKGROUND );

        return this;
    }
}

function createStyle ( on, off ) {
    const ANSIStyleFunction = string => wrap( string, ANSIStyleFunction.on, ANSIStyleFunction.off );

    Reflect.setPrototypeOf( ANSIStyleFunction, ANSIStyle.prototype );

    ANSIStyleFunction.on = [on];
    ANSIStyleFunction.off = off ? [off] : [];

    return ANSIStyleFunction;
}

class ANSI {
    static add ( name, on, off ) {
        if ( on != null ) on = "\x1b[" + on + "m";

        if ( off != null ) off = "\x1b[" + off + "m";

        Object.defineProperty( ANSI.prototype, name, {
            get () {
                return createStyle( on, off );
            },
        } );

        ANSIStyle.add( name, on, off );
    }

    addStyle ( name, style ) {
        if ( !( style instanceof ANSIStyle ) ) throw `ANSI theme style is invalid`;

        Object.defineProperty( ANSI.prototype, name, {
            value ( string ) {
                return style( string );
            },
        } );
    }

    RGB ( color ) {
        return createStyle( createRGBCode( 38, color ), RESET_FOREGROUND );
    }

    onRGB ( color ) {
        return createStyle( createRGBCode( 48, color ), RESET_BACKGROUND );
    }

    reset ( string ) {
        return string + RESET;
    }

    remove ( string ) {
        return string.replaceAll( ANSI_REGEXP, "" );
    }

    getCodes ( string ) {
        return [...string.matchAll( ANSI_REGEXP )].map( match => match[0] ).join( "" );
    }
}

for ( const name in STYLES ) ANSI.add( name, ...STYLES[name] );

const ansi = new ANSI();

ansi.addStyle( "hl", ansi.bold.white );
ansi.addStyle( "dim", ansi.gray );
ansi.addStyle( "ok", ansi.bold.white.onRGB( [0, 100, 0] ) );
ansi.addStyle( "warn", ansi.RGB( [0, 0, 0] ).onRGB( [204, 204, 0] ) );
ansi.addStyle( "error", ansi.bold.white.onRed );

export { ansi as default };
