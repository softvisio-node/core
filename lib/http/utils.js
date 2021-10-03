export function parseHttpHeader ( header ) {
    const params = [];

    var inquotes = false,
        word = "",
        wordQuoted = false,
        key = null,
        group = {},
        groupHasKeys = false;

    for ( let n = 0; n < header.length; n++ ) {

        // escape
        if ( header[n] === "\\" ) {
            if ( n !== header.length - 1 ) {
                n++;

                word += header[n];
            }
        }

        // quote
        else if ( header[n] === `"` ) {
            inquotes = !inquotes;
            wordQuoted = true;
        }

        // separator: ";", ",", "="
        else if ( header[n] === ";" || header[n] === "," || header[n] === "=" ) {

            // separator is quoted
            if ( inquotes ) {
                word += header[n];
            }

            // end of the word
            else {

                // trim word if it was not quoted
                if ( !wordQuoted ) word = word.trim();

                // "="
                if ( header[n] === "=" ) {
                    key = word;
                }

                // ";"
                else if ( header[n] === ";" ) {
                    if ( key != null ) {
                        if ( key !== "" ) {
                            group[key] = word;
                            groupHasKeys = true;
                        }
                    }
                    else if ( word !== "" ) {
                        group[""] = word;
                        groupHasKeys = true;
                    }

                    key = null;
                }

                // ","
                else if ( groupHasKeys ) {
                    params.push( group );
                    group = {};
                    groupHasKeys = false;
                    key = null;
                }

                word = "";
                wordQuoted = false;
            }
        }

        // raw character
        else {
            word += header[n];
        }
    }

    // process last word
    if ( !wordQuoted ) word = word.trim();

    if ( key != null ) {
        if ( key !== "" ) {
            group[key] = word;
            groupHasKeys = true;
        }
    }
    else if ( word !== "" ) {
        group[""] = word;
        groupHasKeys = true;
    }

    if ( groupHasKeys ) params.push( group );

    return params;
}
