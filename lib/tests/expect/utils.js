// XXX copied from jest, need to rewrite
const IteratorSymbol = Symbol.iterator;

export const toStrictEqualTesters = [ iterableEquality, typeEquality, sparseArrayEquality ];

const IS_KEYED_SENTINEL = "@@__IMMUTABLE_KEYED__@@";
const IS_SET_SENTINEL = "@@__IMMUTABLE_SET__@@";
const IS_ORDERED_SENTINEL = "@@__IMMUTABLE_ORDERED__@@";

function isAsymmetric ( obj ) {
    return !!obj && isA( "Function", obj.asymmetricMatch );
}

function asymmetricMatch ( a, b ) {
    var asymmetricA = isAsymmetric( a ),
        asymmetricB = isAsymmetric( b );

    if ( asymmetricA && asymmetricB ) {
        return undefined;
    }

    if ( asymmetricA ) {
        return a.asymmetricMatch( b );
    }

    if ( asymmetricB ) {
        return b.asymmetricMatch( a );
    }
}

export function equals ( a, b, customTesters, strictCheck ) {
    customTesters = customTesters || [];

    return eq( a, b, [], [], customTesters, strictCheck ? hasKey : hasDefinedKey );
}

function eq ( a, b, aStack, bStack, customTesters, hasKey ) {
    var result = true;
    var asymmetricResult = asymmetricMatch( a, b );

    if ( asymmetricResult !== undefined ) {
        return asymmetricResult;
    }

    for ( var i = 0; i < customTesters.length; i++ ) {
        var customTesterResult = customTesters[ i ]( a, b );

        if ( customTesterResult !== undefined ) {
            return customTesterResult;
        }
    }

    if ( a instanceof Error && b instanceof Error ) {
        // eslint-disable-next-line eqeqeq
        return a.message == b.message;
    }

    if ( Object.is( a, b ) ) {
        return true;
    } // A strict comparison is necessary because `null == undefined`.

    if ( a === null || b === null ) {
        return a === b;
    }

    var className = Object.prototype.toString.call( a );

    // eslint-disable-next-line eqeqeq
    if ( className != Object.prototype.toString.call( b ) ) {
        return false;
    }

    switch ( className ) {
    case "[object Boolean]":
    case "[object String]":
    case "[object Number]":
        if ( typeof a !== typeof b ) {

            // One is a primitive, one a `new Primitive()`
            return false;
        }
        else if ( typeof a !== "object" && typeof b !== "object" ) {

            // both are proper primitives
            return Object.is( a, b );
        }
        else {

            // both are `new Primitive()`s
            return Object.is( a.valueOf(), b.valueOf() );
        }

    case "[object Date]":

        // Coerce dates to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        // eslint-disable-next-line eqeqeq
        return +a == +b;

        // RegExps are compared by their source patterns and flags.

    case "[object RegExp]":
        return a.source === b.source && a.flags === b.flags;
    }

    if ( typeof a !== "object" || typeof b !== "object" ) {
        return false;
    } // Use DOM3 method isEqualNode (IE>=9)

    if ( isDomNode( a ) && isDomNode( b ) ) {
        return a.isEqualNode( b );
    } // Used to detect circular references.

    var length = aStack.length;

    while ( length-- ) {

        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        // circular references at same depth are equal
        // circular reference is not equal to non-circular one
        if ( aStack[ length ] === a ) {
            return bStack[ length ] === b;
        }
        else if ( bStack[ length ] === b ) {
            return false;
        }
    } // Add the first object to the stack of traversed objects.

    aStack.push( a );
    bStack.push( b ); // Recursively compare objects and arrays.
    // Compare array lengths to determine if a deep comparison is necessary.

    // eslint-disable-next-line eqeqeq
    if ( className == "[object Array]" && a.length !== b.length ) {
        return false;
    } // Deep compare objects.

    var aKeys = keys( a, hasKey ),
        key;
    var size = aKeys.length; // Ensure that both objects contain the same number of properties before comparing deep equality.

    if ( keys( b, hasKey ).length !== size ) {
        return false;
    }

    while ( size-- ) {
        key = aKeys[ size ]; // Deep compare each member

        result = hasKey( b, key ) && eq( a[ key ], b[ key ], aStack, bStack, customTesters, hasKey );

        if ( !result ) {
            return false;
        }
    } // Remove the first object from the stack of traversed objects.

    aStack.pop();
    bStack.pop();
    return result;
}

function hasDefinedKey ( obj, key ) {
    return hasKey( obj, key ) && obj[ key ] !== undefined;
}

function hasKey ( obj, key ) {
    return Object.prototype.hasOwnProperty.call( obj, key );
}

function keys ( obj, hasKey ) {
    var keys = [];

    for ( var key in obj ) {
        if ( hasKey( obj, key ) ) {
            keys.push( key );
        }
    }

    return keys.concat( Object.getOwnPropertySymbols( obj ).filter( symbol => Object.getOwnPropertyDescriptor( obj, symbol ).enumerable ) );
}

function isDomNode ( obj ) {
    return obj !== null && typeof obj === "object" && typeof obj.nodeType === "number" && typeof obj.nodeName === "string" && typeof obj.isEqualNode === "function";
}

function isA ( typeName, value ) {
    return Object.prototype.toString.apply( value ) === "[object " + typeName + "]";
}

function isImmutableUnorderedKeyed ( maybeKeyed ) {
    return !!( maybeKeyed && maybeKeyed[ IS_KEYED_SENTINEL ] && !maybeKeyed[ IS_ORDERED_SENTINEL ] );
}

function isImmutableUnorderedSet ( maybeSet ) {
    return !!( maybeSet && maybeSet[ IS_SET_SENTINEL ] && !maybeSet[ IS_ORDERED_SENTINEL ] );
}

function iterableEquality ( a, b, aStack = [], bStack = [] ) {
    if ( typeof a !== "object" || typeof b !== "object" || Array.isArray( a ) || Array.isArray( b ) || !hasIterator( a ) || !hasIterator( b ) ) {
        return undefined;
    }

    if ( a.constructor !== b.constructor ) {
        return false;
    }

    let length = aStack.length;

    while ( length-- ) {

        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        // circular references at same depth are equal
        // circular reference is not equal to non-circular one
        if ( aStack[ length ] === a ) {
            return bStack[ length ] === b;
        }
    }

    aStack.push( a );
    bStack.push( b );

    const iterableEqualityWithStack = ( a, b ) => iterableEquality( a, b, [ ...aStack ], [ ...bStack ] );

    if ( a.size !== undefined ) {
        if ( a.size !== b.size ) {
            return false;
        }
        else if ( isA( "Set", a ) || isImmutableUnorderedSet( a ) ) {
            let allFound = true;

            for ( const aValue of a ) {
                if ( !b.has( aValue ) ) {
                    let has = false;

                    for ( const bValue of b ) {
                        const isEqual = equals( aValue, bValue, [ iterableEqualityWithStack ] );

                        if ( isEqual === true ) {
                            has = true;
                        }
                    }

                    if ( has === false ) {
                        allFound = false;
                        break;
                    }
                }
            } // Remove the first value from the stack of traversed values.

            aStack.pop();
            bStack.pop();
            return allFound;
        }
        else if ( isA( "Map", a ) || isImmutableUnorderedKeyed( a ) ) {
            let allFound = true;

            for ( const aEntry of a ) {
                if ( !b.has( aEntry[ 0 ] ) || !equals( aEntry[ 1 ], b.get( aEntry[ 0 ] ), [ iterableEqualityWithStack ] ) ) {
                    let has = false;

                    for ( const bEntry of b ) {
                        const matchedKey = equals( aEntry[ 0 ], bEntry[ 0 ], [ iterableEqualityWithStack ] );
                        let matchedValue = false;

                        if ( matchedKey === true ) {
                            matchedValue = equals( aEntry[ 1 ], bEntry[ 1 ], [ iterableEqualityWithStack ] );
                        }

                        if ( matchedValue === true ) {
                            has = true;
                        }
                    }

                    if ( has === false ) {
                        allFound = false;
                        break;
                    }
                }
            } // Remove the first value from the stack of traversed values.

            aStack.pop();
            bStack.pop();
            return allFound;
        }
    }

    const bIterator = b[ IteratorSymbol ]();

    for ( const aValue of a ) {
        const nextB = bIterator.next();

        if ( nextB.done || !equals( aValue, nextB.value, [ iterableEqualityWithStack ] ) ) {
            return false;
        }
    }

    if ( !bIterator.next().done ) {
        return false;
    } // Remove the first value from the stack of traversed values.

    aStack.pop();
    bStack.pop();
    return true;
}

function typeEquality ( a, b ) {
    if ( a == null || b == null || a.constructor === b.constructor ) {
        return undefined;
    }

    return false;
}

function sparseArrayEquality ( a, b ) {
    if ( !Array.isArray( a ) || !Array.isArray( b ) ) {
        return undefined;
    } // A sparse array [, , 1] will have keys ["2"] whereas [undefined, undefined, 1] will have keys ["0", "1", "2"]

    const aKeys = Object.keys( a );
    const bKeys = Object.keys( b );
    return equals( a, b, [ iterableEquality, typeEquality ], true ) && equals( aKeys, bKeys );
}

function hasIterator ( object ) {
    return !!( object != null && object[ IteratorSymbol ] );
}
