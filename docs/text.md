# Text

## ANSI

```javascript
import { ansi } from "@softvisio/core/text";

// or
import ansi from "@softvisio/core/text/ansi";

console.log(ansi.cold.while.onRed("test"));
```

### ansi.RESET

-   <string\> ANSI reset code.

### ansi.regExp

-   <RegExp\> ANSI codes regular expression.

### ansi.isEnabled

-   <boolean\> ANSI enabled or disabled. Writable property.

### ansi.enable()

Enables ANSI codes.

### ansi.disable()

Disables ANSI codes.

### ansi.defineStyle( name, style )

### ansi.defineStyles( styles )

### ansi.defineColor( name, color )

-   `name` <string\> New color name.
-   `color` <string\> | <integer\> | <integer[]\> Color definitions. Examples of the correct `RGB` colors definitions:
    ```javascript
    ansi.defineColor("teal", "008080");
    ansi.defineColor("teal", "#008080");
    ansi.defineColor("teal", 0x8080);
    ansi.defineColor("teal", 32896);
    ansi.defineColor("teal", [0, 128, 128]);
    ```

Defines named `RGB` color.

### ansi.defineColors( colors )

-   `colors` <Object\> Object, where `key` is color name and `value` is `RGB` color definition.

Defines named `RGB` colors.

### ansi.color( color )

-   `color` <string\> | <integer\> | <integer[]\>

### ansi.onColor( color )

-   `color` <string\> | <integer\> | <integer[]\>

### ansi.reset( string )

-   `string` <string\>
-   Returns: <string\>

Add ANSI reset code to the end of the string. Same as `string += ansi.RESET`.

### ansi.remove( string )

-   `string` <string\>
-   Returns: <string\>

Removes ANSI reset code from the string.

### ansi.wrap( string, maxLength, options )

## Class: Table

Draw text table.

```javascript
import { Table } from "@softvisio/core/text";

// or
import Table from "@softvisio/core/text/table";

const table = new Table({});

table.begin();

table.add(row1, row2);

table.end();
```

### Table.defineStyle( name, style )

-   `name` <string\> New style name.
-   `style` <Object\> Style definition:
    -   `topLine` <string\> Top line style.
    -   `headerRow` <string\> Header row style.
    -   `headerLine` <string\> Header line style.
    -   `dataRow` <string\> Data row style.
    -   `dataLine` <string\> Data line style.
    -   `bottomLine` <string\> Bottom line style.

Define table style. Example of `ascii` style definition:

<!-- prettier-ignore -->
```javascript
Table.defineStyle("ascii", {
    topLine:    "+-++",
    headerRow:  "| ||",
    headerLine: "|=+|",
    dataRow:    "| ||",
    dataLine:   "|-+|",
    bottomLine: "+-++",
});
```

### new Table( options )

-   `options` <Object\> Table options:

    -   `style` <"ascii" | "unicode" | "markdown" | "compact" | "borderless"\> Table style. **Default:** `"ascii"`.
    -   `console` <boolean\> Output table content to the console.
    -   `ansi` <boolean\> Allow ANSI escape codes in the output. **Default:** if `console` is set to `true` - `process.stdout.isTTY` value is used.
    -   `width` <integer\> Table width. If `console` set to `true` terminal width is used as default value. **Default:** `80`.
    -   `lazy` <boolean\> Render table header on first row added. **Default:** `false`.
    -   `header` <boolean\> Render table header. **Default:** `true`.
    -   `columnWidth?` <integer\> Default column width.
    -   `margin` <integer[]\> Default column margin. Should be specified as [leftMargin, rightMargin]. **Default:** `[0, 0]`.
    -   `trim` <boolean\> Trim cell content.
    -   `wordWrap` <boolean\> Split words at spaces.
    -   `align` <"left" | "center" | "right"\> Default column cell content horizontal align for all columns.
    -   `headerAlign` <"left" | "center" | "right"\> Default column header cell content horizontal align for all columns.
    -   `valign` <"top" | "center" | "bottom"\> Default cell content vertical align for all columns.
    -   `headerValign` <"top" | "center" | "bottom"\> Default column header cell content vertical align for all columns.
    -   `columns` <Object\> Table columns:
        -   `width?` <integer\> Column width.
        -   `minWidth?` <integer\> Minimal column width.
        -   `flex` <integer\> Column flex. **Default:** `1`.
        -   `title` <string\> Column title.
        -   `margin` <Array\> Column margin. Should be specified as [leftMargin, rightMargin]. **Default:** `[0, 0]`.
        -   `trim` <boolean\> Trim cell content. **Default:** `false`.
        -   `wordWrap` <boolean\> Split words at spaces. **Default:** `true`.
        -   `align` <"left" | "center" | "right"\> Cell content horizontal align.
        -   `headerAlign` <"left" | "center" | "right"\> Column header cell content horizontal align.
        -   `valign` <"top" | "center" | "bottom"\> Cell content vertical align.
        -   `headerValign` <"top" | "center" | "bottom"\> Column header cell content vertical align.

-   Returns: <Table\>

### table.hasContent

-   <boolean\> `true` if table has some content.

### table.text

-   <string\> Table content.

### table.begin()

-   Returns: <string\> Rendered table heade.

Render table header.

### table.add( ...rows )

-   `...rows` <Array\> | <Object\> Rows to add.
-   Returns: <string\> Rendered rows.

Add rows to the table.

### table.end()

-   Returns: <string\> Rendered table bottom line.

Render bottom line.
