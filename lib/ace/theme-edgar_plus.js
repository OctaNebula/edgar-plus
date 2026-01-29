ace.define("ace/theme/edgar_plus-css", ["require", "exports", "module"], function (e, t, n) {
    n.exports = `
/* Edgar+ Custom Theme - Monaco-Inspired with Colorful Syntax */

.ace-edgar-plus .ace_gutter {
  background: #1e1e1e;
  color: #858585;
}

.ace-edgar-plus .ace_print-margin {
  width: 1px;
  background: #3c3c3c;
}

.ace-edgar-plus {
  background-color: #1e1e1e;
  color: #d4d4d4;
}

.ace-edgar-plus .ace_cursor {
  color: #aeafad;
}

.ace-edgar-plus .ace_marker-layer .ace_selection {
  background: #264f78;
}

.ace-edgar-plus.ace_multiselect .ace_selection.ace_start {
  box-shadow: 0 0 3px 0px #1e1e1e;
}

.ace-edgar-plus .ace_marker-layer .ace_step {
  background: rgb(102, 82, 0);
}

/* Colorful Bracket Matching */
.ace-edgar-plus .ace_marker-layer .ace_bracket {
  margin: -1px 0 0 -1px;
  border: 2px solid #ffd700;
  background: rgba(255, 215, 0, 0.15);
}

.ace-edgar-plus .ace_marker-layer .ace_active-line {
  background: #282828;
}

.ace-edgar-plus .ace_gutter-active-line {
  background-color: #252525;
}

.ace-edgar-plus .ace_marker-layer .ace_selected-word {
  border: 1px solid #4a90d9;
  background: rgba(74, 144, 217, 0.2);
}

.ace-edgar-plus .ace_invisible {
  color: #404040;
}

/* Keywords (if, for, while, return, etc.) - Pink/Magenta */
.ace-edgar-plus .ace_keyword {
  color: #c586c0;
  font-weight: bold;
}

.ace-edgar-plus .ace_keyword.ace_operator {
  color: #d4d4d4;
}

/* Storage keywords (int, char, void, const, static, etc.) - Blue */
.ace-edgar-plus .ace_storage,
.ace-edgar-plus .ace_storage.ace_type {
  color: #569cd6;
}

/* Control keywords in separate color */
.ace-edgar-plus .ace_keyword.ace_control {
  color: #c586c0;
}

/* Meta tags */
.ace-edgar-plus .ace_meta.ace_tag {
  color: #569cd6;
}

/* Entity names (tags) */
.ace-edgar-plus .ace_entity.ace_name.ace_tag {
  color: #569cd6;
}

/* Punctuation - Light Gray with colored brackets */
.ace-edgar-plus .ace_punctuation,
.ace-edgar-plus .ace_punctuation.ace_tag {
  color: #d4d4d4;
}

/* Colorful Brackets/Parens - Rainbow style */
.ace-edgar-plus .ace_paren {
  color: #ffd700;
  font-weight: bold;
}

/* Constants - Purple */
.ace-edgar-plus .ace_constant.ace_character,
.ace-edgar-plus .ace_constant.ace_language,
.ace-edgar-plus .ace_constant.ace_numeric,
.ace-edgar-plus .ace_constant.ace_other {
  color: #b5cea8;
}

/* Boolean and null constants */
.ace-edgar-plus .ace_constant.ace_language {
  color: #569cd6;
}

/* Invalid code */
.ace-edgar-plus .ace_invalid {
  color: #f8f8f0;
  background-color: #f44747;
}

.ace-edgar-plus .ace_invalid.ace_deprecated {
  color: #f8f8f0;
  background-color: #ae81ff;
}

/* Support functions (printf, scanf, malloc, etc.) - Yellow */
.ace-edgar-plus .ace_support.ace_function {
  color: #dcdcaa;
}

.ace-edgar-plus .ace_support.ace_constant {
  color: #4fc1ff;
}

.ace-edgar-plus .ace_support.ace_type,
.ace-edgar-plus .ace_support.ace_class {
  color: #4ec9b0;
}

/* Fold marker */
.ace-edgar-plus .ace_fold {
  background-color: #dcdcaa;
  border-color: #d4d4d4;
}

/* User-defined functions - Yellow/Gold */
.ace-edgar-plus .ace_entity.ace_name.ace_function {
  color: #dcdcaa;
}

/* Other entities */
.ace-edgar-plus .ace_entity.ace_other,
.ace-edgar-plus .ace_entity.ace_other.ace_attribute-name {
  color: #9cdcfe;
}

/* Variables - Light Blue */
.ace-edgar-plus .ace_variable {
  color: #9cdcfe;
}

/* Function parameters - Orange */
.ace-edgar-plus .ace_variable.ace_parameter {
  color: #9cdcfe;
  font-style: italic;
}

/* Strings - Orange/Coral */
.ace-edgar-plus .ace_string {
  color: #ce9178;
}

/* String regex */
.ace-edgar-plus .ace_string.ace_regex {
  color: #d16969;
}

/* Comments - Green */
.ace-edgar-plus .ace_comment {
  color: #6a9955;
  font-style: italic;
}

/* Preprocessor directives (#include, #define) - Purple */
.ace-edgar-plus .ace_meta.ace_preprocessor {
  color: #c586c0;
}

/* Include paths */
.ace-edgar-plus .ace_meta.ace_preprocessor .ace_string {
  color: #ce9178;
}

/* Operators */
.ace-edgar-plus .ace_operator {
  color: #d4d4d4;
}

/* Indent guides */
.ace-edgar-plus .ace_indent-guide {
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bLly+fBgAVdgNP3lNX9gAAAABJRU5ErkJggg==) right repeat-y;
}

.ace-edgar-plus .ace_indent-guide-active {
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQIW2PQ1dX9zzBz5sz/ABCcBFFentLlAAAAAElFTkSuQmCC) right repeat-y;
}

/* Fallback for identifiers (variables) - Light Blue */
.ace-edgar-plus .ace_identifier {
  color: #9cdcfe;
}

/* Tooltip styling for autocomplete */
.ace-edgar-plus .ace_tooltip {
  background-color: #252526;
  border: 1px solid #454545;
  color: #cccccc;
}

/* Autocomplete popup styling */
.ace_autocomplete.ace-edgar-plus {
  background: #252526;
  border: 1px solid #454545;
  color: #d4d4d4;
}

.ace_autocomplete.ace-edgar-plus .ace_marker-layer .ace_active-line {
  background-color: #062f4a;
}

.ace_autocomplete.ace-edgar-plus .ace_completion-highlight {
  color: #18a3ff;
}
`}), ace.define("ace/theme/edgar_plus", ["require", "exports", "module", "ace/theme/edgar_plus-css", "ace/lib/dom"], function (e, t, n) { t.isDark = !0, t.cssClass = "ace-edgar-plus", t.cssText = e("./edgar_plus-css"); var r = e("../lib/dom"); r.importCssString(t.cssText, t.cssClass, !1) }); (function () {
    ace.require(["ace/theme/edgar_plus"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();
